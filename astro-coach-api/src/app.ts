import type { DecodedIdToken } from "firebase-admin/auth";
import { find as findTimeZone } from "geo-tz";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireFirebaseAuth } from "./middleware/firebase-auth.js";
import { prisma } from "./lib/prisma.js";
import { getDisplayName } from "./lib/displayName.js";
import { sanitizeAssistantText, sanitizeJsonStringFields } from "./lib/sanitizeText.js";
import { redis } from "./lib/redis.js";
import { cacheGetJson, cacheKey, cacheSetUntilLocalMidnight } from "./lib/cache.js";
import {
  generateCompletion,
  getAnthropicModelForFeature,
  type GenerateCompletionResult,
} from "./services/ai/generateCompletion.js";
import { streamClaudeCompletionAsSSE } from "./lib/streamCompletion.js";
import {
  computeNatalChart,
  julianNow,
  getDailyTransits,
  getForwardTransits,
  getSynastryAspects,
  planetLongitudesAt,
  synastryScore,
  transitHitsNatal,
  type NatalChartData,
  type NatalChartInput,
} from "./services/chartEngine.js";
import { computeSunSignFallback } from "./services/astrology/sunSignFromDate.js";
import {
  computeSynastry,
  extractPlanetsFromChartJson,
  sunSignToLongitude,
} from "./services/astrology/synastryEngine.js";
import { hasFeatureAccess } from "./lib/revenuecat.js";
import {
  autoStartTrialIfEligible,
  computeTrialDaysLeft,
  isDbTrialActive,
} from "./lib/subscriptionAccess.js";
import { trialCheckMiddleware } from "./middleware/trialCheck.js";
import { stripe } from "./lib/stripe.js";
import type Stripe from "stripe";
import { DateTime } from "luxon";
import { adminAuth } from "./lib/firebase-admin.js";
import { handleAuthSync } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import tarotApp from "./routes/tarot.js";
import mantraApp from "./routes/mantra.js";
import { voice } from "./routes/voice.js";
import { SPREADS } from "./services/tarot/spreads.js";
import { TAROT_CARDS_JSON } from "./lib/tarotCardsJson.js";
import { sendToUser } from "./services/notifications.js";
import { persistCompleteOnboarding } from "./services/onboardingComplete.js";
import { geocodeCity, searchCities } from "./services/geocodingService.js";
import { challengeRulesEngine } from "./services/astrology/challengeRulesEngine.js";
import { safetyClassifier } from "./services/ai/safetyClassifier.js";
import { assembleContext } from "./services/ai/promptAssembler.js";
import { summarizeSession } from "./services/ai/sessionSummarizer.js";
import {
  buildCoffeeStep2SystemPrompt,
  buildCoffeeStep2UserRequest,
  buildCoffeeVisionPrompt,
  getCoffeeReadingDefaultPayload,
  type CoffeeReadingLang,
} from "./services/ai/prompts/coffeeReading.js";
import { buildDreamInterpreterPrompt } from "./services/ai/prompts/dreamInterpreter.js";
import { buildCompatibilityPrompt } from "./services/ai/prompts/compatibility.js";
import {
  buildAskMeAnythingPrompt,
  buildUserContextString,
  buildTransitOutlookPrompt,
  buildTransitDetailPrompt,
  appendOutputCompliance,
} from "./services/ai/systemPrompts.js";
import {
  computeMoonAmbientContext,
  computeTransits,
  pickDominantTransitForOverview,
  type TransitEvent,
} from "./services/transits/engine.js";
import { upsertUserTransitDailyCache } from "./services/transits/transitDailyCacheService.js";
import { computeIngressHints } from "./services/transits/ingressService.js";
import { computeLunationHints } from "./services/transits/lunationService.js";
import { computeRetrogradeStatus } from "./services/transits/retrogradeService.js";
import { computeCollectiveTransits } from "./services/transits/collectiveTransitsService.js";

type Vars = {
  firebaseUid: string;
  firebaseUser: DecodedIdToken;
  dbUserId: string;
};

/** Optional voice metadata on user chat turns (AMA + compatibility). */
const chatVoiceMetadataSchema = z.object({
  inputMode: z.enum(["text", "voice"]).optional(),
  transcript: z.string().max(8000).optional(),
  language: z.enum(["fa", "en"]).optional(),
});

type ChatVoiceMetadata = z.infer<typeof chatVoiceMetadataSchema>;

function messageVoiceData(meta: ChatVoiceMetadata) {
  const d: { inputMode?: string; transcript?: string; language?: string } = {};
  if (meta.inputMode !== undefined) d.inputMode = meta.inputMode;
  if (meta.transcript !== undefined) d.transcript = meta.transcript;
  if (meta.language !== undefined) d.language = meta.language;
  return d;
}

const app = new Hono<{ Variables: Vars }>();

app.use("*", async (c, next) => {
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`);
  await next();
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path} → ${c.res.status}`);
});

const ALLOWED_ORIGINS = new Set([
  "https://app.akhtar.today",
  "https://akhtar.today",
  "http://localhost:8081",
  "http://localhost:3000",
  "http://localhost:19006",
]);

/** In-memory lock so we do not queue duplicate LLM enrichment jobs for the same snapshot (cache hits). */
const transitEnrichmentInProgress = new Set<string>();

function getEnrichmentKey(userId: string, snapshotLocalDate: string, timeframe: string): string {
  return `${userId}:${snapshotLocalDate}:${timeframe}`;
}

/** Last time we queued a retry from a stale cache hit (snapshot older than 30m, `aiEnrichedAt` still null). */
const transitEnrichmentStaleRetryLastQueued = new Map<string, number>();

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return undefined;
      return ALLOWED_ORIGINS.has(origin) ? origin : undefined;
    },
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

const storageDir = process.env.COSMIC_CARD_STORAGE_PATH ?? join(process.cwd(), "storage", "cards");

app.get("/files/:name", async (c) => {
  const name = c.req.param("name");
  if (!name || name.includes("..") || name.includes("/")) {
    return c.json({ error: "bad_request" }, 400);
  }
  try {
    const buf = await readFile(join(storageDir, name));
    return new Response(buf, { headers: { "Content-Type": "image/png" } });
  } catch {
    return c.json({ error: "not_found" }, 404);
  }
});

/** Public tarot spread catalog (no auth). */
app.get("/api/tarot/spreads", (c) => c.json({ spreads: SPREADS }));

/**
 * Public tarot deck (78 cards). Reference data only — no auth.
 * Query: ?lang=en|fa (informational; each card includes both locales).
 */
app.get("/api/tarot/cards", (c) => {
  try {
    const lang = c.req.query("lang") === "en" ? "en" : "fa";
    return c.json({ cards: TAROT_CARDS_JSON, lang, total: TAROT_CARDS_JSON.length });
  } catch (e) {
    console.error("[tarot/cards]", e);
    return c.json({ error: "Could not load tarot cards" }, 500);
  }
});

const api = new Hono<{ Variables: Vars }>();
api.post("/auth/sync", handleAuthSync);
api.use("*", requireFirebaseAuth);

api.route("/voice", voice);

/** ---------- File upload (Phase 4 / Coffee) ---------- */
api.post("/files/upload", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasFeatureAccess(firebaseUid, dbId))) return c.json({ error: "premium_required" }, 402);

  const body = z
    .object({
      // Expected: "data:image/jpeg;base64,...." or "data:image/png;base64,..."
      dataUrl: z.string().min(20),
    })
    .parse(await c.req.json());

  const m = body.dataUrl.match(/^data:(image\/png|image\/jpeg);base64,(.+)$/);
  if (!m) return c.json({ error: "bad_request", message: "Expected PNG/JPEG dataUrl." }, 400);

  const base64 = m[2] ?? "";
  let buf: Buffer;
  try {
    buf = Buffer.from(base64, "base64");
  } catch {
    return c.json({ error: "bad_request", message: "Invalid base64." }, 400);
  }
  if (buf.byteLength > 6_000_000) {
    return c.json({ error: "payload_too_large", message: "Max 6MB." }, 413);
  }

  await mkdir(storageDir, { recursive: true });
  const fileName = `coffee-${dbId}-${Date.now()}.png`;
  const filePath = join(storageDir, fileName);

  // Normalize to PNG to keep /files/:name simple and consistent.
  const sharp = (await import("sharp")).default;
  await sharp(buf).png({ quality: 90 }).toFile(filePath);

  const base = process.env.PUBLIC_API_BASE_URL ?? "";
  return c.json({ name: fileName, imageUrl: `${base}/files/${fileName}` });
});

/** ---------- User ---------- */
api.get("/geocode", async (c) => {
  try {
    c.get("firebaseUid");
    const q = c.req.query("q") ?? "";
    if (q.trim().length < 2) {
      return c.json({ results: [] });
    }
    const results = await searchCities(q);
    return c.json({ results });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[geocode] search error:", err?.message);
    return c.json({ error: "Geocoding failed" }, 500);
  }
});

api.get("/user/me", async (c) => {
  const id = c.get("dbUserId");
  const user = await prisma.user.findUnique({
    where: { id },
    include: { birthProfile: true },
  });
  if (!user) return c.json({ error: "Not found" }, 404);
  return c.json({
    id: user.id,
    name: user.name,
    email: user.email,
    onboardingComplete: user.onboardingComplete,
    subscriptionStatus: user.subscriptionStatus,
    hasBirthProfile: !!user.birthProfile,
  });
});

api.get("/auth/me", async (c) => {
  const id = c.get("dbUserId");
  const user = await prisma.user.findUnique({
    where: { id },
    include: { birthProfile: true, notificationPreference: true },
  });
  if (!user) return c.json({ error: "Not found" }, 404);
  const { birthProfile, notificationPreference, ...rest } = user;
  return c.json({ user: rest, birthProfile, notificationPreference });
});

/**
 * Profile completeness for routing (name + birth date required). No cached profile ambiguity.
 */
api.get("/user/profile/status", async (c) => {
  const id = c.get("dbUserId");
  const user = await prisma.user.findUnique({
    where: { id },
    include: { birthProfile: true },
  });
  if (!user) {
    return c.json({ complete: false, missingFields: ["all"] as string[], profile: null });
  }
  const missing: string[] = [];
  if (!user.name?.trim()) missing.push("name");
  if (!user.birthProfile?.birthDate) missing.push("birthDate");
  const bp = user.birthProfile;
  return c.json({
    complete: missing.length === 0,
    missingFields: missing,
    profile: {
      name: user.name?.trim() || null,
      birthDate: bp?.birthDate ?? null,
      birthTime: bp?.birthTime ?? null,
      birthCity: bp?.birthCity ?? null,
      sunSign: bp?.sunSign ?? null,
      moonSign: bp?.moonSign ?? null,
      risingSign: bp?.risingSign ?? null,
    },
  });
});

/**
 * Complete user profile for AI context — returns minimal fallback
 * instead of 404 when user record is missing (pre-sync edge case).
 */
api.get("/user/profile", async (c) => {
  const id = c.get("dbUserId");
  const user = await prisma.user.findUnique({
    where: { id },
    include: { birthProfile: true, notificationPreference: true },
  });
  if (!user) {
    return c.json({
      user: null,
      birthProfile: null,
      notificationPreference: null,
      isProfileComplete: false,
    });
  }
  const bp = user.birthProfile;
  const computeSunSign = (d: Date | null | undefined): string | null => {
    if (!d) return null;
    const month = d.getMonth() + 1;
    const day = d.getDate();
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
    return "Pisces";
  };
  const sunSign = bp?.sunSign ?? computeSunSign(bp?.birthDate) ?? "Unknown";
  const displayName = user.name?.trim() || null;
  const firebaseUid = c.get("firebaseUid");
  const trialDaysLeft = computeTrialDaysLeft(user.trialStartedAt);
  const trialActive = isDbTrialActive(user.trialStartedAt);
  const hasAccess = await hasFeatureAccess(firebaseUid, user.id);
  return c.json({
    user: {
      id: user.id,
      name: displayName,
      firstName: displayName,
      nameFa: user.nameFa ?? null,
      email: user.email,
      language: user.language,
      onboardingComplete: user.onboardingComplete,
      trialStartedAt: user.trialStartedAt ?? null,
      subscriptionStatus: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId ?? null,
      trialDaysLeft,
      trialActive,
      hasAccess,
      mantraReminderTime: user.mantraReminderTime ?? null,
    },
    birthProfile: bp
      ? {
          birthDate: bp.birthDate,
          birthTime: bp.birthTime,
          birthCity: bp.birthCity,
          birthLat: bp.birthLat,
          birthLong: bp.birthLong,
          birthTimezone: bp.birthTimezone,
          sunSign,
          moonSign: bp.moonSign ?? null,
          risingSign: bp.risingSign ?? null,
          natalChartJson: bp.natalChartJson,
        }
      : null,
    isProfileComplete: Boolean(user.name?.trim() && bp?.birthDate),
    notificationPreference: user.notificationPreference,
  });
});

/** Update user language preference. Called by the frontend Settings screen. */
api.put("/user/language", async (c) => {
  const dbId = c.get("dbUserId");
  const { language } = z
    .object({ language: z.enum(["en", "fa"]) })
    .parse(await c.req.json());
  const prevRow = await prisma.user.findUnique({
    where: { id: dbId },
    select: { language: true },
  });
  const prevLang = prevRow?.language ?? "fa";
  await prisma.user.update({
    where: { id: dbId },
    data: { language },
  });
  if (prevLang !== language) {
    await clearTransitSnapshotsForUser(dbId);
    await prisma.dailyInsightCache.deleteMany({ where: { userId: dbId } });
    await prisma.dailyHoroscope.deleteMany({ where: { userId: dbId } });
    await prisma.compatibilityProfile.updateMany({
      where: { userId: dbId },
      data: { reportCache: Prisma.DbNull },
    });
    if (redis) {
      const pattern = `daily_horoscope:${dbId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    }
    console.log("[user/language] language-sensitive caches cleared:", { dbId, from: prevLang, to: language });
  }
  console.log("[user/language] updated:", { dbId, language });
  return c.json({ ok: true, language });
});

/** Update profile fields from the Edit Information settings screen. Never touches onboardingComplete. */
const profileUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  nameFa: z.string().max(80).nullable().optional(),
  email: z.string().email().optional(),
  birthDate: z.string().optional(),
  birthTime: z.string().nullable().optional(),
  birthCity: z.string().max(200).nullable().optional(),
  birthLat: z.number().nullable().optional(),
  birthLong: z.number().nullable().optional(),
  birthTimezone: z.string().nullable().optional(),
  /** Local reminder time HH:mm (24h); null clears */
  mantraReminderTime: z
    .union([z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/), z.null()])
    .optional(),
});

api.put("/user/profile", async (c) => {
  const id = c.get("dbUserId");
  try {
    const body = profileUpdateSchema.parse(await c.req.json());
    console.log("[user/profile] PUT body keys:", Object.keys(body), "name:", body.name?.trim());

    if (body.mantraReminderTime !== undefined) {
      await prisma.user.update({
        where: { id },
        data: { mantraReminderTime: body.mantraReminderTime },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { birthProfile: true },
    });
    if (!user) return c.json({ error: "User not found" }, 404);

    if (body.email !== undefined) {
      const trimmedEmail = body.email.trim().toLowerCase();
      if (!trimmedEmail) {
        return c.json({ error: "Email cannot be empty" }, 400);
      }
      try {
        await prisma.user.update({ where: { id }, data: { email: trimmedEmail } });
      } catch (e: unknown) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return c.json(
            { error: "email_in_use", message: "This email is already in use." },
            409,
          );
        }
        throw e;
      }
    }

    if (body.name !== undefined) {
      const trimmedName = body.name.trim();
      if (!trimmedName) {
        return c.json({ error: "Name cannot be empty" }, 400);
      }
      await prisma.user.update({
        where: { id },
        data: { name: trimmedName },
      });
      const verifyName = await prisma.user.findUnique({
        where: { id },
        select: { name: true },
      });
      console.log("[user/profile] name saved:", trimmedName, "→ DB:", verifyName?.name);
      await clearTransitSnapshotsForUser(id);
      console.log("[user/profile] transit cache cleared after name change");
    }

    if (body.nameFa !== undefined) {
      const trimmedNameFa = body.nameFa?.trim() || null;
      await prisma.user.update({
        where: { id },
        data: { nameFa: trimmedNameFa },
      });
      console.log("[user/profile] nameFa saved:", trimmedNameFa);
      // Invalidate Redis prompt context so LLM gets correct name immediately
      if (redis) {
        const baseKey = cacheKey.promptContext(id);
        const keys = await redis.keys(`${baseKey}*`);
        if (keys.length > 0) await redis.del(...keys);
        console.log("[user/profile] prompt context cache cleared after nameFa change:", { keys });
      }
    }

    let bp = user.birthProfile;
    if (!bp) {
      const uFresh = await prisma.user.findUnique({ where: { id }, include: { birthProfile: true } });
      if (!uFresh) return c.json({ error: "User not found" }, 404);
      const effectiveName = uFresh.name?.trim() ?? "";
      const wantsBirthPayload =
        body.birthDate !== undefined ||
        body.birthTime !== undefined ||
        body.birthCity !== undefined ||
        body.birthLat !== undefined ||
        body.birthLong !== undefined ||
        body.birthTimezone !== undefined;

      if (body.birthDate !== undefined) {
        if (!effectiveName) {
          return c.json({ error: "Name is required to save birth data" }, 400);
        }
        let chartLat = body.birthLat;
        let chartLong = body.birthLong;
        let chartTz = body.birthTimezone;
        let cityLabel = body.birthCity?.trim() || "Unknown";

        if ((chartLat == null || chartLong == null) && body.birthCity) {
          const geo = await geocodeCity(body.birthCity);
          if (!geo) {
            return c.json(
              { error: "Could not find coordinates for that city. Please try a more specific city name." },
              400,
            );
          }
          chartLat = geo.lat;
          chartLong = geo.lng;
          chartTz = geo.timezone;
          cityLabel = geo.formattedCity;
        }

        chartLat = chartLat ?? 35.6892;
        chartLong = chartLong ?? 51.389;
        chartTz = chartTz ?? "Asia/Tehran";
        const birthTimeVal = body.birthTime !== undefined ? body.birthTime : null;
        const chartInput: NatalChartInput = {
          birthDate: body.birthDate,
          birthTime: birthTimeVal,
          birthLat: chartLat,
          birthLong: chartLong,
          birthTimezone: chartTz,
        };
        let sunSign = "Unknown";
        let moonSign = "Unknown";
        let risingSign: string | null = null;
        let natalChartJson: Prisma.InputJsonValue = {
          planets: [],
          aspects: [],
          source: "fallback",
        };
        try {
          const chart = computeNatalChart(chartInput);
          sunSign = chart.sunSign;
          moonSign = chart.moonSign;
          risingSign = chart.risingSign;
          natalChartJson = {
            planets: chart.planets,
            aspects: chart.aspects,
            jdUt: chart.jdUt,
            jdEt: chart.jdEt,
          };
        } catch {
          sunSign = computeSunSignFallback(body.birthDate);
        }
        const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
        await persistCompleteOnboarding(
          id,
          {
            name: effectiveName,
            birthDate: body.birthDate,
            birthTime: birthTimeVal,
            birthCity: cityLabel,
            birthLat: chartLat,
            birthLong: chartLong,
            birthTimezone: chartTz,
            interestTags: ["profile-setup"],
            consentVersion: "2026-03-01-v1",
            natalChartJson,
            sunSign,
            moonSign,
            risingSign,
          },
          ip,
        );
        await clearTransitSnapshotsForUser(id);
        console.log("[user/profile] transit cache cleared after birth profile created");
        await autoStartTrialIfEligible(prisma, id);
        const updated = await prisma.user.findUnique({ where: { id }, include: { birthProfile: true } });
        const u = updated!;
        const ubp = u.birthProfile;
        const dn = u.name?.trim() || null;
        return c.json({
          success: true,
          user: {
            id: u.id,
            name: dn,
            firstName: dn,
            nameFa: u.nameFa ?? null,
            email: u.email,
            language: u.language,
            onboardingComplete: u.onboardingComplete,
            trialStartedAt: u.trialStartedAt ?? null,
            subscriptionStatus: u.subscriptionStatus,
            stripeCustomerId: u.stripeCustomerId ?? null,
          },
          birthProfile: ubp
            ? {
                birthDate: ubp.birthDate,
                birthTime: ubp.birthTime,
                birthCity: ubp.birthCity,
                birthLat: ubp.birthLat,
                birthLong: ubp.birthLong,
                birthTimezone: ubp.birthTimezone,
                sunSign: ubp.sunSign,
                moonSign: ubp.moonSign,
                risingSign: ubp.risingSign,
                natalChartJson: ubp.natalChartJson,
              }
            : null,
        });
      }

      // Only block if user sent location/chart anchors (implies full profile creation intent).
      // birthTime-only without an existing BirthProfile cannot be persisted — skip gracefully (200 below).
      const wantsFullProfile =
        body.birthDate !== undefined ||
        body.birthLat !== undefined ||
        body.birthLong !== undefined;
      if (wantsFullProfile) {
        return c.json({ error: "birthDate is required to create a birth profile" }, 400);
      }

      await autoStartTrialIfEligible(prisma, id);
      const uFreshAfter = await prisma.user.findUnique({
        where: { id },
        include: { birthProfile: true },
      });
      const uOut = uFreshAfter ?? uFresh;
      const dn = uOut.name?.trim() || null;
      return c.json({
        user: {
          id: uOut.id,
          name: dn,
          firstName: dn,
          nameFa: uOut.nameFa ?? null,
          email: uOut.email,
          language: uOut.language,
          onboardingComplete: uOut.onboardingComplete,
          trialStartedAt: uOut.trialStartedAt ?? null,
          subscriptionStatus: uOut.subscriptionStatus,
          stripeCustomerId: uOut.stripeCustomerId ?? null,
        },
        birthProfile: null,
      });
    }

    const profileUpdates: Record<string, unknown> = {};
    if (body.birthDate !== undefined) profileUpdates.birthDate = new Date(body.birthDate);
    if (body.birthTime !== undefined) profileUpdates.birthTime = body.birthTime;
    if (body.birthCity != null) {
      if (body.birthLat == null && body.birthLong == null) {
        const geo = await geocodeCity(body.birthCity);
        if (!geo) {
          return c.json(
            { error: "Could not find coordinates for that city. Please try a more specific city name." },
            400,
          );
        }
        profileUpdates.birthCity = geo.formattedCity;
        profileUpdates.birthLat = geo.lat;
        profileUpdates.birthLong = geo.lng;
        profileUpdates.birthTimezone = geo.timezone;
        body.birthLat = geo.lat;
        body.birthLong = geo.lng;
        body.birthTimezone = geo.timezone;
      } else {
        profileUpdates.birthCity = body.birthCity;
        if (body.birthLat != null) profileUpdates.birthLat = body.birthLat;
        if (body.birthLong != null) profileUpdates.birthLong = body.birthLong;
        if (body.birthTimezone != null) profileUpdates.birthTimezone = body.birthTimezone;
      }
    }

    const birthDataChanged =
      body.birthDate !== undefined ||
      body.birthTime !== undefined ||
      body.birthLat !== undefined ||
      body.birthLong !== undefined ||
      body.birthTimezone !== undefined ||
      body.birthCity !== undefined;

    if (birthDataChanged) {
      const finalDate = body.birthDate ? new Date(body.birthDate) : bp.birthDate;
      const finalTime = body.birthTime !== undefined ? body.birthTime : bp.birthTime;
      const finalLat = body.birthLat ?? bp.birthLat;
      const finalLong = body.birthLong ?? bp.birthLong;
      const finalTz = body.birthTimezone ?? bp.birthTimezone;

      try {
        const chart = computeNatalChart({
          birthDate: finalDate.toISOString().split("T")[0]!,
          birthTime: finalTime,
          birthLat: finalLat,
          birthLong: finalLong,
          birthTimezone: finalTz,
        });
        profileUpdates.sunSign = chart.sunSign;
        profileUpdates.moonSign = chart.moonSign;
        profileUpdates.risingSign = chart.risingSign;
        profileUpdates.natalChartJson = {
          planets: chart.planets,
          aspects: chart.aspects,
          jdUt: chart.jdUt,
          jdEt: chart.jdEt,
        };
      } catch (swephErr: unknown) {
        console.warn("[user/profile] chart recompute failed, updating sun sign only:", swephErr);
        const d = body.birthDate ? new Date(body.birthDate) : bp.birthDate;
        profileUpdates.sunSign = computeSunSignFallback(d.toISOString().split("T")[0]!);
      }
    }

    if (Object.keys(profileUpdates).length > 0) {
      await prisma.$transaction([
        prisma.birthProfileAuditLog.create({
          data: { birthProfileId: bp.id, changedBy: id, previousData: bp as object },
        }),
        prisma.birthProfile.update({ where: { userId: id }, data: profileUpdates }),
        prisma.dailyInsightCache.deleteMany({ where: { userId: id } }),
      ]);
    }

    if (birthDataChanged) {
      try {
        await clearTransitSnapshotsForUser(id);
        console.log("[user/profile] transit cache cleared after birth data change");
      } catch (e: unknown) {
        console.warn("[user/profile] clearTransitSnapshots failed (non-fatal):", e);
      }
    }

    try {
      await autoStartTrialIfEligible(prisma, id);
    } catch (e: unknown) {
      console.warn("[user/profile] autoStartTrial failed (non-fatal):", e);
    }
    const updated = await prisma.user.findUnique({ where: { id }, include: { birthProfile: true } });
    const u = updated!;
    const ubp = u.birthProfile;
    const dn = u.name?.trim() || null;
    console.log("[user/profile] updated:", { id, fields: Object.keys(body) });
    return c.json({
      user: {
        id: u.id,
        name: dn,
        firstName: dn,
        nameFa: u.nameFa ?? null,
        email: u.email,
        language: u.language,
        onboardingComplete: u.onboardingComplete,
        trialStartedAt: u.trialStartedAt ?? null,
        subscriptionStatus: u.subscriptionStatus,
        stripeCustomerId: u.stripeCustomerId ?? null,
      },
      birthProfile: ubp
        ? {
            birthDate: ubp.birthDate,
            birthTime: ubp.birthTime,
            birthCity: ubp.birthCity,
            birthLat: ubp.birthLat,
            birthLong: ubp.birthLong,
            birthTimezone: ubp.birthTimezone,
            sunSign: ubp.sunSign,
            moonSign: ubp.moonSign,
            risingSign: ubp.risingSign,
            natalChartJson: ubp.natalChartJson,
          }
        : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[user/profile] error:", msg);
    return c.json({ error: "Failed to update profile", message: msg }, 500);
  }
});

const onboardingFromFlowSchema = z.object({
  firstName: z.string().min(1).max(80),
  birthDate: z.string(),
  birthTime: z.string().nullable(),
  /** User-entered label; null/omit when user skipped city (chart uses defaults below). */
  birthCity: z.union([z.string().min(1).max(200), z.null()]).optional(),
  birthLatitude: z.number().nullable().optional(),
  birthLongitude: z.number().nullable().optional(),
  birthTimezone: z.string().nullable().optional(),
  languagePreference: z.enum(["fa", "en"]).optional(),
});

/**
 * Chat onboarding: computes natal chart server-side and persists the same payload as /user/complete-onboarding.
 */
api.post("/onboarding/complete", async (c) => {
  const id = c.get("dbUserId");
  try {
    const raw = await c.req.json();
    const flow = onboardingFromFlowSchema.parse(raw);
    const chartLat = flow.birthLatitude ?? 51.4769;
    const chartLong = flow.birthLongitude ?? 0;
    const chartTz = flow.birthTimezone ?? "Europe/London";
    const cityLabel = flow.birthCity?.trim() || "Unknown";
    const chartInput: NatalChartInput = {
      birthDate: flow.birthDate,
      birthTime: flow.birthTime,
      birthLat: chartLat,
      birthLong: chartLong,
      birthTimezone: chartTz,
    };
    let sunSign = "Unknown";
    let moonSign = "Unknown";
    let risingSign: string | null = null;
    let natalChartJson: Prisma.InputJsonValue = {
      planets: [],
      aspects: [],
      source: "fallback",
    };
    try {
      const chart = computeNatalChart(chartInput);
      sunSign = chart.sunSign;
      moonSign = chart.moonSign;
      risingSign = chart.risingSign;
      natalChartJson = {
        planets: chart.planets,
        aspects: chart.aspects,
        jdUt: chart.jdUt,
        jdEt: chart.jdEt,
      };
    } catch (chartErr) {
      sunSign = computeSunSignFallback(flow.birthDate);
    }
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    await persistCompleteOnboarding(
      id,
      {
        name: flow.firstName.trim(),
        birthDate: flow.birthDate,
        birthTime: flow.birthTime,
        birthCity: cityLabel,
        birthLat: chartLat,
        birthLong: chartLong,
        birthTimezone: chartTz,
        interestTags: ["chat-onboarding"],
        consentVersion: "2026-03-01-v1",
        natalChartJson,
        sunSign,
        moonSign,
        risingSign,
      },
      ip,
    );
    return c.json({ ok: true });
  } catch (err) {
    console.error("[onboarding/complete] failed for userId=" + id, String(err));
    return c.json({ error: "Failed to save onboarding data", detail: String(err) }, 500);
  }
});

const completeOnboardingSchema = z.object({
  name: z.string().min(1).max(80),
  birthDate: z.string(),
  birthTime: z.string().nullable(),
  birthCity: z.string().min(1),
  birthLat: z.number(),
  birthLong: z.number(),
  birthTimezone: z.string().min(1),
  interestTags: z.array(z.string()).min(1),
  consentVersion: z.string().min(1),
  natalChartJson: z.record(z.string(), z.unknown()),
  sunSign: z.string(),
  moonSign: z.string(),
  risingSign: z.string().nullable(),
});

api.post("/user/complete-onboarding", async (c) => {
  const id = c.get("dbUserId");
  const body = completeOnboardingSchema.parse(await c.req.json());
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  await persistCompleteOnboarding(
    id,
    {
      name: body.name,
      birthDate: body.birthDate,
      birthTime: body.birthTime,
      birthCity: body.birthCity,
      birthLat: body.birthLat,
      birthLong: body.birthLong,
      birthTimezone: body.birthTimezone,
      interestTags: body.interestTags,
      consentVersion: body.consentVersion,
      natalChartJson: body.natalChartJson as Prisma.InputJsonValue,
      sunSign: body.sunSign,
      moonSign: body.moonSign,
      risingSign: body.risingSign,
    },
    ip,
  );
  return c.json({ ok: true });
});

api.delete("/user/account", async (c) => {
  const id = c.get("dbUserId");
  const uid = c.get("firebaseUid");
  await prisma.user.delete({ where: { id } });
  try {
    if (!adminAuth) {
      console.warn("Firebase Admin not initialized; skipping deleteUser");
    } else {
      await adminAuth.deleteUser(uid);
    }
  } catch {
    /* user may already be gone in Firebase */
  }
  return c.json({ ok: true, success: true });
});

api.get("/user/export", async (c) => {
  const id = c.get("dbUserId");
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      birthProfile: true,
      consentRecords: true,
      journalEntries: true,
      conversations: { include: { messages: true } },
      compatibilityProfiles: true,
      dreamEntries: true,
      tarotReadings: true,
      growthTimelineEntries: true,
    },
  });
  return c.json(user);
});

/** ---------- Chart ---------- */
const computeSchema = z.object({
  birthDate: z.string(),
  birthTime: z.string().nullable(),
  birthLat: z.number(),
  birthLong: z.number(),
  birthTimezone: z.string(),
});

api.post("/chart/compute", async (c) => {
  const parsed = computeSchema.parse(await c.req.json());
  const input: NatalChartInput = {
    birthDate: parsed.birthDate,
    birthTime: parsed.birthTime,
    birthLat: parsed.birthLat,
    birthLong: parsed.birthLong,
    birthTimezone: parsed.birthTimezone,
  };
  const chart = computeNatalChart(input);
  const natalChartJson = {
    planets: chart.planets,
    aspects: chart.aspects,
    jdUt: chart.jdUt,
    jdEt: chart.jdEt,
  };
  return c.json({
    sunSign: chart.sunSign,
    moonSign: chart.moonSign,
    risingSign: chart.risingSign,
    natalChartJson,
  });
});

api.get("/chart/natal", async (c) => {
  const id = c.get("dbUserId");
  const bp = await prisma.birthProfile.findUnique({ where: { userId: id } });
  if (!bp) return c.json({ error: "No birth profile" }, 404);
  return c.json({ natalChartJson: bp.natalChartJson, birthProfile: bp });
});

api.get("/chart/interpret/:planet", async (c) => {
  const id = c.get("dbUserId");
  const planet = c.req.param("planet");
  const bp = await prisma.birthProfile.findUnique({ where: { userId: id } });
  if (!bp) return c.json({ error: "No birth profile" }, 404);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json({ interpretation: `${planet} speaks to your chart themes; add ANTHROPIC_API_KEY for full copy.` });
  }

  const chartLang: "en" | "fa" = user?.language === "en" ? "en" : "fa";
  const system = `You are a warm astrologer. Use ONLY the given placement facts. Two or three sentences.

${appendOutputCompliance(chartLang)}`;
  const result = await generateCompletion({
    feature: "chart_interpret",
    complexity: "lightweight",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: JSON.stringify({
          name: user ? getDisplayName(user, user.language) : "there",
          planet,
          sunSign: bp.sunSign,
          moonSign: bp.moonSign,
          rising: bp.risingSign,
          chart: bp.natalChartJson,
        }),
      },
    ],
    safety: { mode: "check", userId: id, text: `chart_interpret:${planet}` },
    timeoutMs: 25_000,
  });

  if (result.ok) return c.json({ interpretation: result.content });
  if (result.kind === "unsafe") {
    return c.json({ interpretation: result.safeResponse ?? "I can't process this request safely right now." });
  }

  return c.json({ interpretation: `${planet} speaks to your chart themes; Claude is unavailable right now.` });
});

api.post("/chart/recalculate", async (c) => {
  const id = c.get("dbUserId");
  const parsed = computeSchema.extend({ birthCity: z.string() }).parse(await c.req.json());
  const prev = await prisma.birthProfile.findUnique({ where: { userId: id } });
  if (!prev) return c.json({ error: "No profile" }, 404);

  const chart = computeNatalChart({
    birthDate: parsed.birthDate,
    birthTime: parsed.birthTime,
    birthLat: parsed.birthLat,
    birthLong: parsed.birthLong,
    birthTimezone: parsed.birthTimezone,
  });

  await prisma.$transaction([
    prisma.birthProfileAuditLog.create({
      data: {
        birthProfileId: prev.id,
        changedBy: id,
        previousData: prev as object,
      },
    }),
    prisma.birthProfile.update({
      where: { userId: id },
      data: {
        birthDate: new Date(parsed.birthDate),
        birthTime: parsed.birthTime,
        birthCity: parsed.birthCity,
        birthLat: parsed.birthLat,
        birthLong: parsed.birthLong,
        birthTimezone: parsed.birthTimezone,
        sunSign: chart.sunSign,
        moonSign: chart.moonSign,
        risingSign: chart.risingSign,
        natalChartJson: {
          planets: chart.planets,
          aspects: chart.aspects,
          jdUt: chart.jdUt,
          jdEt: chart.jdEt,
        },
      },
    }),
    prisma.dailyInsightCache.deleteMany({ where: { userId: id } }),
  ]);

  return c.json({ ok: true, sunSign: chart.sunSign, moonSign: chart.moonSign, risingSign: chart.risingSign });
});

/** ---------- Chat ---------- */
function localDateKey(tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

const memChatCounts = new Map<string, { day: string; count: number; touchedAt: number }>();
const MEM_CHAT_MAX_KEYS = 10_000;
const MEM_CHAT_STALE_MS = 172_800_000; // 48h — drop idle rows when Redis is off

function pruneMemChatCounts(now: number) {
  for (const [k, v] of memChatCounts) {
    if (now - v.touchedAt > MEM_CHAT_STALE_MS) memChatCounts.delete(k);
  }
  while (memChatCounts.size > MEM_CHAT_MAX_KEYS) {
    const first = memChatCounts.keys().next().value;
    if (first === undefined) break;
    memChatCounts.delete(first);
  }
}

async function dailyChatCount(userId: string, tz: string): Promise<number> {
  const day = localDateKey(tz);
  const key = `chat:${userId}:${day}`;
  if (redis) {
    const v = await redis.get(key);
    return v ? Number(v) : 0;
  }
  const now = Date.now();
  if (memChatCounts.size > MEM_CHAT_MAX_KEYS * 0.9) pruneMemChatCounts(now);
  const cur = memChatCounts.get(userId);
  if (!cur || cur.day !== day) return 0;
  return cur.count;
}

async function incrChatCount(userId: string, tz: string): Promise<void> {
  const day = localDateKey(tz);
  const key = `chat:${userId}:${day}`;
  if (redis) {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 86_400);
    return;
  }
  const now = Date.now();
  if (memChatCounts.size > MEM_CHAT_MAX_KEYS * 0.9) pruneMemChatCounts(now);
  const cur = memChatCounts.get(userId);
  if (!cur || cur.day !== day) memChatCounts.set(userId, { day, count: 1, touchedAt: now });
  else memChatCounts.set(userId, { day, count: cur.count + 1, touchedAt: now });
}

/** Refund one free-tier turn when the chat pipeline fails after the user message was reserved. */
async function decrChatCount(userId: string, tz: string): Promise<void> {
  const day = localDateKey(tz);
  const key = `chat:${userId}:${day}`;
  if (redis) {
    const n = await redis.decr(key);
    if (n < 0) await redis.set(key, "0", "EX", 86_400);
    return;
  }
  const now = Date.now();
  const cur = memChatCounts.get(userId);
  if (!cur || cur.day !== day) return;
  const next = Math.max(0, cur.count - 1);
  memChatCounts.set(userId, { day, count: next, touchedAt: now });
}

const CHAT_HISTORY_LIMIT = 10;

/** Compact transit-to-natal hits for AMA prompts (max 2) — full chart JSON is never sent, only longitudes from profile. */
function computeTransitHighlightsForChat(bp: { natalChartJson?: unknown } | null): string {
  try {
    const { jdEt } = julianNow();
    const transit = planetLongitudesAt(jdEt);
    const natalLong: Record<string, number> = {};
    if (bp?.natalChartJson && typeof bp.natalChartJson === "object") {
      const planets = (bp.natalChartJson as { planets?: { planet: string; longitude: number }[] }).planets;
      planets?.forEach((p) => {
        natalLong[p.planet] = p.longitude;
      });
    }
    const hits = transitHitsNatal(natalLong, transit);
    return JSON.stringify(hits.slice(0, 2));
  } catch (err: unknown) {
    console.warn("[chat] transit highlights skipped:", err instanceof Error ? err.message : String(err));
    return "Transit data temporarily unavailable";
  }
}

api.post("/chat/session", async (c) => {
  const dbId = c.get("dbUserId");
  const user = await prisma.user.findUnique({
    where: { id: dbId },
    include: { birthProfile: true },
  });
  if (!user?.onboardingComplete || !user.birthProfile) {
    return c.json({ error: "onboarding_required", message: "Complete onboarding and birth profile before chat." }, 422);
  }
  const { featureKey } = z.object({ featureKey: z.string().min(1).max(120) }).parse(await c.req.json());
  const conv = await prisma.conversation.create({
    data: { userId: dbId, category: featureKey, title: featureKey.slice(0, 60) },
  });
  return c.json({ sessionId: conv.id });
});

api.post("/chat/stream", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  const raw = z
    .object({
      message: z.string().min(1).max(8000).optional(),
      content: z.string().min(1).max(8000).optional(),
      conversationId: z.string().optional(),
      sessionId: z.string().nullable().optional(),
      featureKey: z.string().optional(),
    })
    .merge(chatVoiceMetadataSchema)
    .parse(await c.req.json());
  const message = (raw.content ?? raw.message ?? "").trim();
  if (!message) return c.json({ error: "message_required" }, 400);
  const featureKey = raw.featureKey ?? "ask_me_anything";
  const conversationId = raw.sessionId ?? raw.conversationId;

  const [premium, userWithProfile] = await Promise.all([
    hasFeatureAccess(firebaseUid, dbId),
    prisma.user.findUnique({
      where: { id: dbId },
      include: { birthProfile: true },
    }),
  ]);
  const bp = userWithProfile?.birthProfile ?? null;
  const tz = bp?.birthTimezone ?? "UTC";

  if (!premium) {
    const used = await dailyChatCount(dbId, tz);
    if (used >= 3) {
      return c.json({ error: "free_limit", used, limit: 3 }, 402);
    }
  }

  const transitHighlights = computeTransitHighlightsForChat(bp);

  let convId = conversationId ?? undefined;
  let createdNewConversation = false;
  if (!convId) {
    const conv = await prisma.conversation.create({
      data: { userId: dbId, title: message.slice(0, 60), category: featureKey },
    });
    convId = conv.id;
    createdNewConversation = true;
  }

  const userMessage = await prisma.message.create({
    data: {
      conversationId: convId!,
      role: "user",
      content: message,
      ...messageVoiceData(raw),
    },
  });
  if (!premium) await incrChatCount(dbId, tz);

  const rollbackFailedChatTurn = async () => {
    await prisma.message.delete({ where: { id: userMessage.id } }).catch(() => {});
    if (createdNewConversation) {
      const n = await prisma.message.count({ where: { conversationId: convId! } });
      if (n === 0) await prisma.conversation.delete({ where: { id: convId! } }).catch(() => {});
    }
    if (!premium) await decrChatCount(dbId, tz);
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json({
      response: "Configure ANTHROPIC_API_KEY on Railway to enable live coaching.",
      followUpPrompts: [],
      conversationId: convId,
    });
  }

  const sseLang = userWithProfile?.language === "en" ? "en" : "fa";
  const sseUserCtx = buildUserContextString({
    firstName: userWithProfile
      ? getDisplayName(userWithProfile, userWithProfile.language ?? "fa")
      : "there",
    sunSign: bp?.sunSign ?? null,
    moonSign: bp?.moonSign ?? null,
    risingSign: bp?.risingSign ?? null,
    birthCity: bp?.birthCity ?? null,
    birthDate: bp?.birthDate ?? null,
    language: sseLang,
  });
  const system = buildAskMeAnythingPrompt(sseUserCtx, transitHighlights, sseLang);

  const ssePayload = (obj: Record<string, unknown>) => JSON.stringify(obj);

  c.header("X-Accel-Buffering", "no");
  return streamSSE(c, async (stream) => {
    try {
      const historyRows = await prisma.message.findMany({
        where: { conversationId: convId! },
        orderBy: { createdAt: "desc" },
        take: CHAT_HISTORY_LIMIT,
        select: { role: true, content: true },
      });
      const historyMessages = historyRows.reverse().map((m) => ({ role: m.role, content: m.content }));

      const llmMessages = [{ role: "system" as const, content: system }, ...historyMessages];
      const selectedModel = getAnthropicModelForFeature("chat_message", "deep", false);
      const timeoutMs = 60_000;
      console.log("[chat/stream] calling LLM:", {
        messageCount: llmMessages.length,
        systemPromptLength: system.length,
        timeoutMs,
        complexity: "deep",
        model: selectedModel,
      });
      console.log("[chat/stream] prompt sizes:", {
        systemPromptChars: system.length,
        systemPromptTokensApprox: Math.round(system.length / 4),
        messageCount: llmMessages.length,
        lastMessageChars: historyMessages[historyMessages.length - 1]?.content?.length ?? 0,
      });

      const llmStart = Date.now();
      const streamResult = await streamClaudeCompletionAsSSE(stream, {
        sseStringify: ssePayload,
        feature: "chat_message",
        complexity: "deep",
        messages: llmMessages,
        safety: { mode: "check", userId: dbId, text: message },
        timeoutMs,
        maxRetries: 0,
      });

      console.log("[chat/stream] LLM result:", {
        kind: streamResult.kind,
        errorType: streamResult.kind === "error" ? streamResult.errorType : undefined,
        durationMs: Date.now() - llmStart,
      });

      if (streamResult.kind === "unsafe") {
        const safeText = streamResult.safeResponse ?? "I can't process this request safely right now.";
        const cleanSafe = sanitizeAssistantText(safeText);
        if (!premium) await decrChatCount(dbId, tz);
        await stream.writeSSE({ data: ssePayload({ type: "token", text: cleanSafe }) });
        const saved = await prisma.message.create({
          data: { conversationId: convId!, role: "assistant", content: cleanSafe },
        });
        await prisma.conversation.update({ where: { id: convId! }, data: { updatedAt: new Date() } });
        await stream.writeSSE({
          data: ssePayload({
            type: "done",
            conversationId: convId,
            messageId: saved.id,
            content: cleanSafe,
            followUpPrompts: [] as string[],
          }),
        });
        return;
      }

      if (streamResult.kind === "error") {
        await rollbackFailedChatTurn();
        await stream.writeSSE({
          data: ssePayload({ type: "error", error: "chat_failed", errorType: streamResult.errorType }),
        });
        return;
      }

      let full = streamResult.content;
      let followUps: string[] = [];

      const followUpSplit = full.split("---FOLLOW_UPS---");
      if (followUpSplit.length > 1) {
        full = followUpSplit[0]!.trim();
        followUps = followUpSplit[1]!
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
      } else {
        const jmatch = full.match(/\{[\s\S]*"followUpPrompts"[\s\S]*\}\s*$/);
        if (jmatch) {
          try {
            const j = JSON.parse(jmatch[0]) as { followUpPrompts?: string[] };
            followUps = j.followUpPrompts ?? [];
          } catch {
            /* ignore */
          }
        }
      }

      const cleanContent = sanitizeAssistantText(full);

      try {
        const saved = await prisma.message.create({
          data: { conversationId: convId!, role: "assistant", content: cleanContent },
        });
        await prisma.conversation.update({ where: { id: convId! }, data: { updatedAt: new Date() } });
        await stream.writeSSE({
          data: ssePayload({
            type: "done",
            conversationId: convId,
            messageId: saved.id,
            content: cleanContent,
            followUpPrompts: followUps,
          }),
        });
      } catch {
        await stream.writeSSE({ data: ssePayload({ type: "error", error: "persist_failed" }) });
      }
    } catch {
      await rollbackFailedChatTurn();
      await stream.writeSSE({ data: ssePayload({ type: "error", error: "chat_failed" }) });
      return;
    }
  });
});

/** Non-streaming chat for React Native clients without SSE. */
api.post("/chat/message", async (c) => {
  try {
    const firebaseUid = c.get("firebaseUid");
    const firebaseUser = c.get("firebaseUser");
    const dbId = c.get("dbUserId");
    const payload = z
      .object({
        message: z.string().min(1).max(8000).optional(),
        conversationId: z.string().optional(),
        content: z.string().min(1).max(8000).optional(),
        sessionId: z.string().nullable().optional(),
        featureKey: z.string().optional(),
      })
      .merge(chatVoiceMetadataSchema)
      .parse(await c.req.json());
    const message = (payload.content ?? payload.message ?? "").trim();
    if (!message) return c.json({ error: "message_required" }, 400);
    const content = message;
    const featureKey = payload.featureKey ?? "ask_me_anything";
    const conversationId = payload.sessionId ?? payload.conversationId;

    console.log("[chat/message] received:", {
      uid: firebaseUser?.uid,
      contentLength: content?.length,
      featureKey,
    });

    const [premium, userWithProfile] = await Promise.all([
      hasFeatureAccess(firebaseUid, dbId),
      prisma.user.findUnique({
        where: { id: dbId },
        include: { birthProfile: true },
      }),
    ]);
    const bp = userWithProfile?.birthProfile ?? null;
    const tz = bp?.birthTimezone ?? "UTC";

    if (!premium) {
      const used = await dailyChatCount(dbId, tz);
      if (used >= 3) {
        return c.json({ error: "free_limit", used, limit: 3 }, 402);
      }
    }

    const transitHighlights = computeTransitHighlightsForChat(bp);

    let convId = conversationId;
    let createdNewConversation = false;
    if (!convId) {
      const conv = await prisma.conversation.create({
        data: { userId: dbId, title: message.slice(0, 60), category: featureKey ?? "ask_me_anything" },
      });
      convId = conv.id;
      createdNewConversation = true;
    }

    const userMessage = await prisma.message.create({
      data: {
        conversationId: convId!,
        role: "user",
        content: message,
        ...messageVoiceData(payload),
      },
    });
    if (!premium) await incrChatCount(dbId, tz);

    const rollbackFailedChatTurn = async () => {
      await prisma.message.delete({ where: { id: userMessage.id } }).catch(() => {});
      if (createdNewConversation) {
        const n = await prisma.message.count({ where: { conversationId: convId! } });
        if (n === 0) await prisma.conversation.delete({ where: { id: convId! } }).catch(() => {});
      }
      if (!premium) await decrChatCount(dbId, tz);
    };

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[chat/message] ANTHROPIC_API_KEY is not set in environment");
      return c.json(
        {
          content: "AI service temporarily unavailable. Please try again. ✨",
          followUpPrompts: null,
          error: true,
        },
        200
      );
    }

    const userLang = userWithProfile?.language ?? "fa";
    const userCtx = buildUserContextString({
      firstName: userWithProfile
        ? getDisplayName(userWithProfile, userWithProfile.language ?? "fa")
        : "there",
      sunSign: bp?.sunSign ?? null,
      moonSign: bp?.moonSign ?? null,
      risingSign: bp?.risingSign ?? null,
      birthCity: bp?.birthCity ?? null,
      birthDate: bp?.birthDate ?? null,
      language: userLang,
    });
    const system = buildAskMeAnythingPrompt(userCtx, transitHighlights, userLang);

    const historyRows = await prisma.message.findMany({
      where: { conversationId: convId! },
      orderBy: { createdAt: "desc" },
      take: CHAT_HISTORY_LIMIT,
      select: { role: true, content: true },
    });
    const historyMessages = historyRows.reverse().map((m) => ({ role: m.role, content: m.content }));
    const llmMessages = [{ role: "system" as const, content: system }, ...historyMessages];

    const timeoutMs = 20_000;
    const selectedModel = getAnthropicModelForFeature("chat_complete", "deep", false);
    console.log("[chat] calling LLM:", {
      messageCount: llmMessages.length,
      systemPromptLength: system.length,
      timeoutMs,
      complexity: "deep",
      model: selectedModel,
    });
    console.log("[chat] prompt sizes:", {
      systemPromptChars: system.length,
      systemPromptTokensApprox: Math.round(system.length / 4),
      messageCount: llmMessages.length,
      lastMessageChars: historyMessages[historyMessages.length - 1]?.content?.length ?? 0,
    });

    const llmStart = Date.now();
    const result = await generateCompletion({
      feature: "chat_complete",
      complexity: "deep",
      messages: llmMessages,
      safety: { mode: "check", userId: dbId, text: message },
      timeoutMs,
      maxRetries: 0,
    });

    console.log("[chat] LLM result:", {
      kind: result.kind,
      errorType: result.kind === "error" ? result.errorType : undefined,
      durationMs: Date.now() - llmStart,
    });

    if (result.kind === "unsafe") {
      const safeText = result.safeResponse ?? "I can't process this request safely right now.";
      const cleanSafe = sanitizeAssistantText(safeText);
      if (!premium) await decrChatCount(dbId, tz);
      try {
        await prisma.message.create({
          data: { conversationId: convId!, role: "assistant", content: cleanSafe },
        });
        await prisma.conversation.update({ where: { id: convId! }, data: { updatedAt: new Date() } });
      } catch (error) {
        console.error("[chat/message] persist_failed (unsafe):", error);
        return c.json({ error: "persist_failed" }, 500);
      }
      return c.json({ response: cleanSafe, followUpPrompts: [] as string[], conversationId: convId });
    }

    if (result.kind === "error") {
      console.error("[chat/message] Claude returned error:", {
        errorType: result.errorType,
        message: result.message,
      });
      await rollbackFailedChatTurn();
      return c.json({ error: "chat_failed" }, 502);
    }

    let full = result.content;
    let followUps: string[] = [];

    const followUpSplit = full.split("---FOLLOW_UPS---");
    if (followUpSplit.length > 1) {
      full = followUpSplit[0]!.trim();
      followUps = followUpSplit[1]!
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    } else {
      const jmatch = full.match(/\{[\s\S]*"followUpPrompts"[\s\S]*\}\s*$/);
      if (jmatch) {
        try {
          const j = JSON.parse(jmatch[0]) as { followUpPrompts?: string[] };
          followUps = j.followUpPrompts ?? [];
        } catch {
          /* ignore */
        }
      }
    }

    const cleanContent = sanitizeAssistantText(full);

    console.log("[chat/message] Claude response:", {
      success: true,
      contentLength: cleanContent.length,
      hasFollowUps: followUps.length > 0,
      model: result.model,
    });

    try {
      await prisma.message.create({
        data: { conversationId: convId!, role: "assistant", content: cleanContent },
      });
      await prisma.conversation.update({ where: { id: convId! }, data: { updatedAt: new Date() } });
    } catch (error) {
      console.error("[chat/message] persist_failed (success):", error);
      return c.json({ error: "persist_failed" }, 500);
    }

    return c.json({
      sessionId: convId,
      content: cleanContent,
      followUpPrompts: followUps,
      response: cleanContent,
      conversationId: convId,
      model: result.model,
    });
  } catch (error: any) {
    console.error("[chat/message] error:", error?.message ?? String(error));
    return c.json(
      {
        content: "AI service temporarily unavailable. Please try again. ✨",
        followUpPrompts: null,
        error: true,
      },
      200
    );
  }
});

/** ---------- Daily insight ---------- */
api.get("/daily/insight", async (c) => {
  const dbId = c.get("dbUserId");
  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  if (!bp) return c.json({ error: "No birth profile" }, 404);

  const dbUserInsight = await prisma.user.findUnique({
    where: { id: dbId },
    select: { language: true },
  });
  const insightLang: "en" | "fa" = dbUserInsight?.language === "en" ? "en" : "fa";

  const date = localDateKey(bp.birthTimezone);
  const cached = await prisma.dailyInsightCache.findUnique({
    where: { userId_date: { userId: dbId, date } },
  });
  if (cached) {
    const content = cached.content as {
      title?: string;
      narrative?: string;
      moodIndicator?: string;
      transitDescription?: string;
    };
    return c.json({
      title: content.title,
      narrative: content.narrative,
      moodIndicator: content.moodIndicator,
      date,
      transitDescription: content.transitDescription,
    });
  }

  const { jdEt } = julianNow();
  const transit = planetLongitudesAt(jdEt);
  const natalLong: Record<string, number> = {};
  const planets = (bp.natalChartJson as { planets?: { planet: string; longitude: number }[] })?.planets;
  planets?.forEach((p) => {
    natalLong[p.planet] = p.longitude;
  });
  const hits = transitHitsNatal(natalLong, transit);
  const transitDescription = hits.map((h) => `${h.transitBody} ${h.type} natal ${h.natalBody}`).join("; ") || "Gentle sky weather";

  let payload = {
    title: "Your cosmic weather",
    narrative: "The day invites balance and curiosity.",
    moodIndicator: "Reflective",
    transitDescription,
  };

  if (process.env.ANTHROPIC_API_KEY) {
    const dailySystem = `You are Akhtar, a warm personal astrologer. Return ONLY valid JSON (no markdown).

Fields:
- title: at most 5 words in the user's language
- narrative: 150-250 words, grounded and personal to their Sun/Moon and the transit context in the user message
- moodIndicator: exactly one of High Energy, Reflective, Social, Creative, Cautious, Romantic — label must match the user's language (${insightLang === "fa" ? "Persian" : "English"})

${appendOutputCompliance(insightLang)}`;

    const result = await generateCompletion({
      feature: "daily_insight",
      complexity: "standard",
      messages: [
        { role: "system", content: dailySystem },
        {
          role: "user",
          content: `Sun: ${bp.sunSign}, Moon: ${bp.moonSign}. Transit context: ${transitDescription}. Return JSON with keys title, narrative, moodIndicator only.`,
        },
      ],
      responseFormat: { type: "json_object" },
      safety: { mode: "check", userId: dbId, text: `daily_insight:${bp.sunSign}:${bp.moonSign}` },
      timeoutMs: 25_000,
      maxRetries: 1,
    });

    if (result.kind === "success" && result.json && typeof result.json === "object") {
      payload = { ...payload, ...(result.json as any) };
    }
  }

  let saved: { content: unknown };
  try {
    saved = await prisma.dailyInsightCache.create({
      data: { userId: dbId, date, content: payload as object },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const row = await prisma.dailyInsightCache.findUnique({
        where: { userId_date: { userId: dbId, date } },
      });
      if (!row) throw e;
      saved = row;
    } else {
      throw e;
    }
  }

  const out = saved.content as {
    title?: string;
    narrative?: string;
    moodIndicator?: string;
    transitDescription?: string;
  };
  return c.json({
    title: out.title,
    narrative: out.narrative,
    moodIndicator: out.moodIndicator,
    date,
    transitDescription: out.transitDescription,
  });
});

/** ---------- Daily horoscope (Phase 2) ---------- */
api.get("/horoscope/today", async (c) => {
  const dbId = c.get("dbUserId");
  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  if (!bp) return c.json({ error: "No birth profile" }, 404);

  const hzUser = await prisma.user.findUnique({
    where: { id: dbId },
    select: { language: true },
  });
  const hzLang: "en" | "fa" = hzUser?.language === "en" ? "en" : "fa";

  const date = localDateKey(bp.birthTimezone);
  const redisKey = cacheKey.dailyHoroscope(dbId, date);

  const redisCached = await cacheGetJson<{
    title: string;
    body: string;
    moodLabel: string;
    affirmation?: string | null;
    focusArea?: string | null;
    date: string;
  }>(redisKey);
  if (redisCached) return c.json(redisCached);

  // DB cache
  const existing = await prisma.dailyHoroscope.findUnique({
    where: { userId_date: { userId: dbId, date } },
  });
  if (existing) {
    const mapped = {
      title: existing.title,
      body: existing.body,
      moodLabel: existing.moodLabel,
      affirmation: existing.affirmation ?? null,
      focusArea: existing.focusArea ?? null,
      date,
    };
    await cacheSetUntilLocalMidnight(redisKey, mapped, bp.birthTimezone);
    return c.json(mapped);
  }

  const { jdEt } = julianNow();
  const transit = planetLongitudesAt(jdEt);
  const natalLong: Record<string, number> = {};
  const planets = (bp.natalChartJson as { planets?: { planet: string; longitude: number }[] })?.planets;
  planets?.forEach((p) => {
    natalLong[p.planet] = p.longitude;
  });
  const hits = transitHitsNatal(natalLong, transit);
  const selected = [...hits].sort((a, b) => a.orb - b.orb).slice(0, 3);
  const transitDescription = selected.map((h) => `${h.transitBody} ${h.type} natal ${h.natalBody}`).join("; ") || "Gentle sky weather";

  const moodEnum = ["High Energy", "Reflective", "Social", "Creative", "Cautious", "Romantic"] as const;
  const horoscopeSchema = z.object({
    title: z.string().max(60),
    body: z.string().min(80).max(3500),
    moodLabel: z.enum(moodEnum),
    affirmation: z.string().max(240).optional().nullable(),
    focusArea: z.string().max(240).optional().nullable(),
  });

  let payload = {
    title: "Your cosmic weather",
    body: "The day invites balance and curiosity. Notice what feels light, and let it guide your next step.",
    moodLabel: "Reflective",
    affirmation: null as string | null,
    focusArea: null as string | null,
  };

  if (process.env.ANTHROPIC_API_KEY) {
    const hzSystem = `You are Akhtar. Return ONLY valid JSON (no markdown) for today's personal horoscope.

Fields: title (max 5 words), body (150-250 words), moodLabel, optional affirmation, optional focusArea.
For title, body, affirmation, and focusArea: write entirely in ${hzLang === "fa" ? "Persian (Farsi)" : "English"}.
moodLabel MUST be exactly one of these English tokens (unchanged spelling, for app parsing): ${moodEnum.join(", ")}.

${appendOutputCompliance(hzLang)}`;

    const result = await generateCompletion({
      feature: "daily_horoscope",
      complexity: "standard",
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: hzSystem },
        {
          role: "user",
          content: `Sun: ${bp.sunSign}, Moon: ${bp.moonSign}, Rising: ${bp.risingSign ?? "Unknown"}. Transit highlights: ${transitDescription}. Return JSON with keys title, body, moodLabel, affirmation (optional), focusArea (optional).`,
        },
      ],
      safety: { mode: "check", userId: dbId, text: `daily_horoscope:${bp.sunSign}:${bp.moonSign}` },
      timeoutMs: 25_000,
      maxRetries: 1,
    });

    if (result.kind === "success" && result.json) {
      try {
        const parsed = horoscopeSchema.parse(result.json);
        payload = {
          title: parsed.title,
          body: parsed.body,
          moodLabel: parsed.moodLabel,
          affirmation: parsed.affirmation ?? null,
          focusArea: parsed.focusArea ?? null,
        };
      } catch {
        /* keep defaults */
      }
    }
  }

  const toSave = await prisma.dailyHoroscope.upsert({
    where: { userId_date: { userId: dbId, date } },
    update: {
      title: payload.title,
      body: payload.body,
      moodLabel: payload.moodLabel,
      affirmation: payload.affirmation,
      focusArea: payload.focusArea,
      transitJson: { hits: selected },
    },
    create: {
      userId: dbId,
      date,
      title: payload.title,
      body: payload.body,
      moodLabel: payload.moodLabel,
      affirmation: payload.affirmation,
      focusArea: payload.focusArea,
      transitJson: { hits: selected },
    },
  });

  const mapped = {
    title: toSave.title,
    body: toSave.body,
    moodLabel: toSave.moodLabel,
    affirmation: toSave.affirmation ?? null,
    focusArea: toSave.focusArea ?? null,
    date,
  };
  await cacheSetUntilLocalMidnight(redisKey, mapped, bp.birthTimezone);
  return c.json(mapped);
});

/** ---------- Astrological events (Phase 3) ---------- */
api.get("/events/upcoming", async (c) => {
  console.log("[events] handler called");
  try {
    const firebaseUid = c.get("firebaseUid");
    const dbId = c.get("dbUserId");
    if (!(await hasFeatureAccess(firebaseUid, dbId))) return c.json({ error: "premium_required" }, 402);

    const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
    if (!bp) return c.json({ error: "No birth profile" }, 404);

    const horizonDays = 14;
    const redisKey = cacheKey.astroEvents(dbId, horizonDays);

    const cached = await cacheGetJson<{ events: unknown[]; message?: string }>(redisKey);
    if (cached) return c.json(cached);

    type UpcomingEventRow = {
      title: string;
      eventType: string;
      significance: number;
      category: string;
      whyItMatters: string;
      suggestedAction: string;
      eventDate: Date;
      windowStart: Date;
      windowEnd: Date;
    };

    const tz = bp.birthTimezone || "UTC";
    let upcomingEvents: UpcomingEventRow[] = [];
    try {
      const natalChartJson = bp.natalChartJson as unknown as Parameters<typeof getDailyTransits>[0];
      const start = DateTime.now().setZone(tz).startOf("day");
      const candidates: UpcomingEventRow[] = [];
      for (let i = 0; i < horizonDays; i++) {
        const day = start.plus({ days: i }).toISODate();
        if (!day) continue;
        const transits = getDailyTransits(natalChartJson, day, tz);
        const eventDate = start.plus({ days: i }).toUTC().toJSDate();
        const windowStart = new Date(eventDate);
        const windowEnd = new Date(eventDate.getTime() + 86_400_000);

        for (const t of transits) {
          const significance = Math.max(1, Math.round(100 - t.orb * 15));
          const title = `${t.transitBody} ${t.type} ${t.natalBody}`;
          candidates.push({
            title,
            eventType: t.type,
            significance,
            category: t.natalBody,
            whyItMatters: `This is a high-signal moment for your ${t.natalBody} theme: notice reactions, then choose the next best action.`,
            suggestedAction: `Do one grounding action today (journal 3 lines, breathe 2 minutes, or take a small step).`,
            eventDate,
            windowStart,
            windowEnd,
          });
        }
      }
      candidates.sort((a, b) => b.significance - a.significance);
      upcomingEvents = candidates.slice(0, 5);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[events] sweph unavailable:", msg);
      upcomingEvents = [];
    }

    if (upcomingEvents.length === 0) {
      return c.json({
        events: [],
        message: "Astrological events calculation temporarily unavailable",
      });
    }

    const events = upcomingEvents;
    try {
      await cacheSetUntilLocalMidnight(redisKey, { events }, bp.birthTimezone);
    } catch (cacheErr: unknown) {
      const msg = cacheErr instanceof Error ? cacheErr.message : String(cacheErr);
      console.warn("[events] cache set failed:", msg);
    }
    return c.json({ events });
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string; name?: string };
    console.error("[events] UNHANDLED ERROR:", {
      message: err?.message,
      stack: err?.stack?.split("\n").slice(0, 5),
    });
    return c.json(
      {
        events: [],
        message: "Astrological events calculation temporarily unavailable",
        error: err?.message ?? "Unexpected error",
      },
      200,
    );
  }
});

/** Sun sign from calendar birth date (Western tropical). */
function sunSignFromBirthDateTransit(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return "Aries";
  if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return "Taurus";
  if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return "Gemini";
  if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return "Cancer";
  if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return "Leo";
  if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return "Virgo";
  if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return "Libra";
  if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return "Scorpio";
  if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return "Sagittarius";
  if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return "Capricorn";
  if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return "Aquarius";
  return "Pisces";
}

/** Remove cached transit AI + big-three payloads so the next overview request regenerates. */
async function clearTransitSnapshotsForUser(userId: string): Promise<void> {
  try {
    await prisma.transitSnapshot.deleteMany({ where: { userId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[transit cache] deleteMany failed:", msg);
  }

  try {
    await prisma.userTransitDailyCache.deleteMany({ where: { userId } });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
    if (code !== "P2021") throw e;
  }
}

type TransitOverviewAiCtx = {
  userId: string;
  /** Prisma `TransitSnapshot.localDate` cache key for this overview row. */
  snapshotLocalDate: string;
  timeframe: "today" | "week" | "month";
  language: "en" | "fa";
  userName: string;
  sunSign: string;
  moonSign: string | null;
  risingSign: string | null;
};

function scheduleTransitOverviewAiEnrichment(ctx: TransitOverviewAiCtx): void {
  const key = getEnrichmentKey(ctx.userId, ctx.snapshotLocalDate, ctx.timeframe);
  if (transitEnrichmentInProgress.has(key)) {
    console.log("[transits/enrichment] already in progress, skipping:", key);
    return;
  }
  transitEnrichmentInProgress.add(key);
  console.log("[transits/enrichment] scheduled:", key);
  setImmediate(() => {
    void (async () => {
      try {
        await runTransitOverviewAiEnrichment(ctx);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[transits/enrichment] failed:", key, msg);
      } finally {
        transitEnrichmentInProgress.delete(key);
        console.log("[transits/enrichment] completed:", key);
      }
    })();
  });
}

const TRANSIT_OUTLOOK_BANNED_OPENINGS = [
  "the stars suggest",
  "the universe",
  "based on your chart",
  "this transit",
  "you are entering",
  "a powerful alignment",
] as const;

function hasBannedTransitOutlookOpening(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return TRANSIT_OUTLOOK_BANNED_OPENINGS.some((phrase) => lower.startsWith(phrase));
}

function extractTransitOutlookFromResult(
  result: GenerateCompletionResult | null,
  moodDefault: string,
): { title: string; text: string; moodLabel: string } | null {
  if (!result?.ok || result.kind !== "success") return null;
  const j = result.json;
  if (j && typeof j === "object" && !Array.isArray(j) && "title" in j && "text" in j) {
    const o = j as { title: string; text: string; moodLabel?: string };
    return {
      title: o.title,
      text: o.text,
      moodLabel: o.moodLabel ?? moodDefault,
    };
  }
  try {
    const parsed = JSON.parse(result.content.replace(/```json|```/g, "").trim()) as {
      title?: string;
      text?: string;
      moodLabel?: string;
    };
    if (parsed.title && parsed.text) {
      return {
        title: parsed.title,
        text: parsed.text,
        moodLabel: parsed.moodLabel ?? moodDefault,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function capTransitsForOverviewResponse(
  raw: TransitEvent[] | unknown,
  timeframe: "today" | "week" | "month",
): { cappedTransits: TransitEvent[]; dominantEventId: string | null } {
  const densityCap = timeframe === "today" ? 3 : timeframe === "week" ? 5 : 7;
  const now = new Date();
  const list = (Array.isArray(raw) ? (raw as TransitEvent[]) : []).filter((e) => {
    const end = new Date(e.endAt);
    if (end < now) {
      console.log(
        `[transits/cap] dropping stale event from cache: ${e.transitingBody} ${e.aspectType} ended ${e.endAt}`,
      );
      return false;
    }
    return true;
  });
  const dominantEventId = pickDominantTransitForOverview(list)?.id ?? null;
  const cappedTransits = list.slice(0, densityCap);
  return { cappedTransits, dominantEventId };
}

/** Runs after fast overview response: parallel outlook + summaries, then updates snapshot + aiEnrichedAt. */
async function runTransitOverviewAiEnrichment(ctx: TransitOverviewAiCtx): Promise<void> {
  const t0 = Date.now();
  try {
    const snap = await prisma.transitSnapshot.findUnique({
      where: {
        userId_localDate_timeframeScope: {
          userId: ctx.userId,
          localDate: ctx.snapshotLocalDate,
          timeframeScope: ctx.timeframe,
        },
      },
      select: {
        id: true,
        aiEnrichedAt: true,
        transitsJson: true,
        dailyOutlookTitle: true,
        dailyOutlookText: true,
        moodLabel: true,
      },
    });

    if (!snap) {
      console.log("[transits/enrichment] snapshot missing, skipping");
      return;
    }

    if (snap.aiEnrichedAt != null) {
      console.log("[transits/enrichment] already enriched, skipping LLM:", {
        userId: ctx.userId,
        localDate: ctx.snapshotLocalDate,
        timeframe: ctx.timeframe,
      });
      return;
    }

    const rawList = snap.transitsJson as unknown;
    if (!Array.isArray(rawList) || rawList.length === 0) {
      await prisma.transitSnapshot.update({
        where: { id: snap.id },
        data: { aiEnrichedAt: new Date() },
      });
      console.log("[transits/enrichment] no transits to enrich, skipping");
      return;
    }

    const transitEvents = rawList as TransitEvent[];

    const topForPrompt = transitEvents.slice(0, 3).map((t) => ({
      transitingBody: t.transitingBody,
      natalTargetBody: t.natalTargetBody,
      aspectType: t.aspectType,
      significanceScore: t.significanceScore,
      themeTags: t.themeTags,
      emotionalTone: t.emotionalTone,
      practicalExpression: t.practicalExpression,
    }));

    const moodDefault = ctx.language === "fa" ? "متأمل" : "Reflective";
    let dailyOutlook = {
      title: snap.dailyOutlookTitle ?? "",
      text: snap.dailyOutlookText ?? "",
      moodLabel: snap.moodLabel ?? moodDefault,
    };

    const outlookPrompt = buildTransitOutlookPrompt({
      userName: ctx.userName,
      sunSign: ctx.sunSign,
      moonSign: ctx.moonSign ?? "not recorded",
      risingSign: ctx.risingSign,
      topTransits: topForPrompt,
      language: ctx.language,
    });

    const summaryLangHint =
      ctx.language === "fa"
        ? "Every title and shortSummary must be in Persian (Farsi) script only — no English."
        : "Every title and shortSummary must be in English only — no Persian.";
    const summarySystem = `You write short astrology card copy. For each transit: a concise title (max 8 words) and one shortSummary under 120 characters. Warm, specific. ${summaryLangHint}
Return ONLY valid JSON (no markdown): {"summaries":[{"id":"string","title":"string","shortSummary":"string"}]}. Same order as provided ids.

${appendOutputCompliance(ctx.language)}`;

    const [outlookResult, summariesResult] = await Promise.all([
      generateCompletion({
        feature: "transit_outlook",
        complexity: "standard",
        messages: [
          { role: "system", content: outlookPrompt.system },
          { role: "user", content: outlookPrompt.user },
        ],
        responseFormat: { type: "json_object" },
        safety: { mode: "check", userId: ctx.userId, text: "transit_outlook" },
        timeoutMs: 25_000,
        maxRetries: 1,
      }).catch((e: unknown) => {
        console.warn("[transits] outlook AI failed:", e instanceof Error ? e.message : String(e));
        return null;
      }),
      generateCompletion({
        feature: "transit_summaries",
        complexity: "lightweight",
        messages: [
          { role: "system", content: summarySystem },
          {
            role: "user",
            content: JSON.stringify({
              items: transitEvents.map((t) => ({
                id: t.id,
                title: t.title,
                transitingBody: t.transitingBody,
                aspect: t.aspectType,
                target: t.natalTargetBody,
                themes: t.themeTags,
              })),
            }),
          },
        ],
        responseFormat: { type: "json_object" },
        safety: { mode: "check", userId: ctx.userId, text: "transit_summaries" },
        timeoutMs: 25_000,
        maxRetries: 1,
      }).catch((e: unknown) => {
        console.warn("[transits] summaries AI failed:", e instanceof Error ? e.message : String(e));
        return null;
      }),
    ]);

    const extractedOutlook = extractTransitOutlookFromResult(outlookResult, moodDefault);
    if (extractedOutlook) {
      dailyOutlook = extractedOutlook;
    }

    if (
      hasBannedTransitOutlookOpening(dailyOutlook.text) ||
      hasBannedTransitOutlookOpening(dailyOutlook.title)
    ) {
      console.warn("[transits/enrichment] banned opening detected, retrying once");
      const retryResult = await generateCompletion({
        feature: "transit_outlook",
        complexity: "standard",
        messages: [
          { role: "system", content: outlookPrompt.system },
          { role: "user", content: outlookPrompt.user },
        ],
        responseFormat: { type: "json_object" },
        safety: { mode: "check", userId: ctx.userId, text: "transit_outlook" },
        timeoutMs: 25_000,
        maxRetries: 1,
      }).catch((e: unknown) => {
        console.warn("[transits] outlook retry failed:", e instanceof Error ? e.message : String(e));
        return null;
      });

      const retryExtracted = extractTransitOutlookFromResult(retryResult, moodDefault);
      if (retryExtracted) {
        dailyOutlook = retryExtracted;
      }

      if (
        hasBannedTransitOutlookOpening(dailyOutlook.text) ||
        hasBannedTransitOutlookOpening(dailyOutlook.title)
      ) {
        console.warn("[transits/enrichment] banned opening still present after retry");
      }
    }

    if (summariesResult?.ok && summariesResult.kind === "success") {
      const raw = summariesResult.json;
      let summaries: Array<{ id?: string; title?: string; shortSummary?: string }> | undefined;
      if (raw && typeof raw === "object" && !Array.isArray(raw) && "summaries" in raw) {
        summaries = (raw as { summaries: typeof summaries }).summaries;
      } else {
        try {
          const parsed = JSON.parse(summariesResult.content.replace(/```json|```/g, "").trim()) as {
            summaries?: Array<{ id?: string; title?: string; shortSummary?: string }>;
          };
          summaries = parsed.summaries;
        } catch {
          summaries = undefined;
        }
      }
      if (Array.isArray(summaries)) {
        for (const ev of transitEvents) {
          const row = summaries.find((s) => s.id === ev.id);
          // FA titles are deterministic from FA_TITLE_MAP — LLM must not overwrite them.
          // EN titles may still be improved by LLM (existing behavior).
          if (row?.title?.trim() && ctx.language !== "fa") {
            ev.title = row.title.trim();
          }
          if (row?.shortSummary) ev.shortSummary = row.shortSummary;
        }
      }
    }

    await prisma.transitSnapshot.update({
      where: { id: snap.id },
      data: {
        dailyOutlookTitle: dailyOutlook.title,
        dailyOutlookText: dailyOutlook.text,
        moodLabel: dailyOutlook.moodLabel,
        transitsJson: transitEvents as unknown as Prisma.JsonArray,
        aiEnrichedAt: new Date(),
      },
    });

    console.log("[transits] background AI generation complete");
    console.log(`[transits/perf] background AI + snapshot update: ${Date.now() - t0}ms`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[transits] background generation failed:", msg);
  }
}

/** YYYY-MM-DD in the given IANA timezone (falls back to UTC). Used for snapshot keys and "today" staleness. */
function toLocalDateStr(d: Date, tz?: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().split("T")[0]!;
  }
}

/** Most recent Saturday on or before `now` in the user's zone (Luxon: Mon=1 … Sat=6, Sun=7). */
function getMostRecentSaturdayInZone(now: Date, tz: string): DateTime {
  const d = DateTime.fromJSDate(now, { zone: "utc" }).setZone(tz).startOf("day");
  const w = d.weekday;
  const daysBack = w === 6 ? 0 : w === 7 ? 1 : w + 1;
  return d.minus({ days: daysBack });
}

/** Last calendar Friday of the given year/month in `tz`. */
function getLastFridayOfMonthInZone(year: number, month: number, tz: string): DateTime {
  let d = DateTime.fromObject({ year, month, day: 1 }, { zone: tz }).endOf("month").startOf("day");
  while (d.weekday !== 5) {
    d = d.minus({ days: 1 });
  }
  return d;
}

/** Most recent "last Friday of month" anchor on or before `now` in `tz`. */
function getMostRecentLastFridayInZone(now: Date, tz: string): DateTime {
  const nowZ = DateTime.fromJSDate(now, { zone: "utc" }).setZone(tz).startOf("day");
  const thisMonthLF = getLastFridayOfMonthInZone(nowZ.year, nowZ.month, tz);
  if (thisMonthLF <= nowZ) return thisMonthLF;
  const prev = nowZ.minus({ months: 1 });
  return getLastFridayOfMonthInZone(prev.year, prev.month, tz);
}

function shouldRegenerateTransitOverview(
  timeframe: "today" | "week" | "month",
  snapshot: { generatedAt: Date; language: string | null } | null,
  currentLanguage: "en" | "fa",
  now: Date,
  tz: string,
): boolean {
  if (!snapshot) return true;
  if ((snapshot.language ?? "fa") !== currentLanguage) {
    console.log("[transits] regenerate: language changed", {
      snapshotLang: snapshot.language,
      currentLang: currentLanguage,
    });
    return true;
  }

  const genZ = DateTime.fromJSDate(snapshot.generatedAt, { zone: "utc" }).setZone(tz).startOf("day");

  if (timeframe === "today") {
    const snapshotDate = toLocalDateStr(snapshot.generatedAt, tz);
    const todayDate = toLocalDateStr(now, tz);
    const stale = snapshotDate !== todayDate;
    if (stale) {
      console.log("[transits] regenerate: today snapshot is stale", { snapshotDate, todayDate, tz });
    }
    return stale;
  }

  if (timeframe === "week") {
    const mostRecentSaturday = getMostRecentSaturdayInZone(now, tz);
    const stale = genZ < mostRecentSaturday;
    if (stale) {
      console.log("[transits] regenerate: week snapshot is stale", {
        generatedAt: genZ.toISO(),
        mostRecentSaturday: mostRecentSaturday.toISO(),
      });
    }
    return stale;
  }

  if (timeframe === "month") {
    const mostRecentLastFriday = getMostRecentLastFridayInZone(now, tz);
    const stale = genZ < mostRecentLastFriday;
    if (stale) {
      console.log("[transits] regenerate: month snapshot is stale", {
        generatedAt: genZ.toISO(),
        mostRecentLastFriday: mostRecentLastFriday.toISO(),
      });
    }
    return stale;
  }

  return false;
}

function transitOverviewCacheLocalDate(
  timeframe: "today" | "week" | "month",
  now: Date,
  tz: string,
): string {
  if (timeframe === "today") return toLocalDateStr(now, tz);
  if (timeframe === "week") return getMostRecentSaturdayInZone(now, tz).toISODate()!;
  return getMostRecentLastFridayInZone(now, tz).toISODate()!;
}

/** ---------- Personal Transits ---------- */
api.get("/transits/overview", async (c) => {
  const t0 = Date.now();
  try {
    const firebaseUid = c.get("firebaseUid");
    const timeframe = (c.req.query("timeframe") ?? "today") as "today" | "week" | "month";

    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      include: { birthProfile: true },
    });
    console.log(`[transits/perf] user+profile fetch: ${Date.now() - t0}ms`);
    if (!user) return c.json({ error: "User not found" }, 404);

    const langParam = c.req.query("lang");
    const language: "en" | "fa" = langParam === "en" ? "en" : langParam === "fa" ? "fa" : user.language === "en" ? "en" : "fa";
    console.log("[transits] user language:", user.language);
    console.log("[transits] effective language:", language);

    const bp = user.birthProfile;
    if (!bp?.birthDate && !bp?.sunSign) {
      return c.json(
        {
          status: "incomplete_profile",
          message: "Add your birth details to unlock Personal Transits.",
          cta: "Complete birth details",
        },
        200,
      );
    }

    let tz = bp.birthTimezone?.trim() || "UTC";
    if (!DateTime.now().setZone(tz).isValid) {
      console.warn("[transits] invalid birthTimezone, using UTC:", tz);
      tz = "UTC";
    }
    const now = new Date();
    const cacheLocalDate = transitOverviewCacheLocalDate(timeframe, now, tz);

    const existing = await prisma.transitSnapshot.findUnique({
      where: {
        userId_localDate_timeframeScope: {
          userId: user.id,
          localDate: cacheLocalDate,
          timeframeScope: timeframe,
        },
      },
    });

    const cachedList = existing?.transitsJson;
    const cachedHasTransits = Array.isArray(cachedList) && cachedList.length > 0;
    const needsRegen = shouldRegenerateTransitOverview(
      timeframe,
      existing ? { generatedAt: existing.generatedAt, language: existing.language } : null,
      language,
      now,
      tz,
    );

    console.log("[transits/overview] cache decision:", {
      timeframe,
      needsRegen,
      cacheLocalDate,
      snapshotAge: existing
        ? `${Math.round((now.getTime() - existing.generatedAt.getTime()) / 3_600_000)}h ago`
        : "no snapshot",
      language,
      tz,
    });
    console.log(
      `[transits/perf] cache check: ${Date.now() - t0}ms (${!needsRegen && existing && cachedHasTransits ? "hit" : "miss"})`,
    );

    if (!needsRegen && existing && cachedHasTransits) {
      console.log("[transits] serving cached snapshot:", {
        timeframe,
        generatedAt: existing.generatedAt,
        language: existing.language,
        cacheLocalDate,
      });
      const isGenerating = existing.aiEnrichedAt == null;
      if (isGenerating && cachedHasTransits) {
        const enrichmentKey = getEnrichmentKey(user.id, cacheLocalDate, timeframe);
        const snapshotAgeMs = now.getTime() - existing.generatedAt.getTime();
        const thirtyMinutes = 30 * 60 * 1000;
        const fiveMinutes = 5 * 60 * 1000;

        let allowScheduleFromCacheHit = false;
        if (snapshotAgeMs < thirtyMinutes) {
          allowScheduleFromCacheHit = true;
        } else {
          const lastRetry = transitEnrichmentStaleRetryLastQueued.get(enrichmentKey) ?? 0;
          if (now.getTime() - lastRetry >= fiveMinutes) {
            allowScheduleFromCacheHit = true;
            transitEnrichmentStaleRetryLastQueued.set(enrichmentKey, now.getTime());
          }
        }

        const alreadyQueued = transitEnrichmentInProgress.has(enrichmentKey);

        if (alreadyQueued) {
          console.log(
            "[transits] cache hit — enrichment already queued, serving as-is",
            enrichmentKey,
          );
        } else if (allowScheduleFromCacheHit) {
          console.log("[transits] cache hit — scheduling pending enrichment:", {
            snapshotAge: `${Math.round(snapshotAgeMs / 60000)}min`,
            cacheLocalDate,
            timeframe,
          });
          const b3 = existing.bigThreeJson as {
            sun?: string;
            moon?: string;
            rising?: string | null;
          } | null;
          scheduleTransitOverviewAiEnrichment({
            userId: user.id,
            snapshotLocalDate: cacheLocalDate,
            timeframe,
            language,
            userName: getDisplayName(user, user.language),
            sunSign: typeof b3?.sun === "string" ? b3.sun : "Unknown",
            moonSign: typeof b3?.moon === "string" ? b3.moon : null,
            risingSign: typeof b3?.rising === "string" ? b3.rising : null,
          });
        } else {
          console.log("[transits] cache hit — skipping enrichment reschedule (stale retry cooldown)", {
            snapshotAge: `${Math.round(snapshotAgeMs / 60000)}min`,
            enrichmentKey,
          });
        }
      }
      console.log(`[transits/perf] TOTAL (cache hit): ${Date.now() - t0}ms`);
      const { cappedTransits, dominantEventId: overviewDominantId } = capTransitsForOverviewResponse(
        existing.transitsJson,
        timeframe,
      );
      return c.json({
        timeframe,
        generatedAt: existing.generatedAt,
        isStale: false,
        isGenerating,
        dailyOutlook: {
          title: existing.dailyOutlookTitle,
          text: existing.dailyOutlookText,
          moodLabel: existing.moodLabel,
        },
        bigThree: existing.bigThreeJson,
        precisionNote: existing.precisionNote,
        transits: cappedTransits,
        dominantEventId: overviewDominantId,
        moonAmbient: existing.moonContextJson ?? null,
        lifecycleVersion: existing.lifecycleVersion ?? 2,
      });
    }

    console.log("[transits] generating new snapshot:", {
      timeframe,
      reason: !existing ? "no snapshot" : !cachedHasTransits ? "empty transits" : "schedule or language",
      cacheLocalDate,
    });

    const userName = getDisplayName(user, user.language);
    const birthDateForEngine = bp.birthDate ?? new Date(Date.UTC(1990, 0, 15));
    const sunSign =
      bp.sunSign?.trim() ||
      (bp.birthDate ? sunSignFromBirthDateTransit(bp.birthDate) : "Capricorn");
    const moonSign = bp.moonSign?.trim() || null;
    const risingSign = bp.risingSign ?? null;
    const precisionNote = !bp.birthTime
      ? language === "fa"
        ? "زمان تولد ثبت نشده است. علامت صعودی و زمان‌بندی ممکن است دقیق نباشد."
        : "Birth time missing. Rising sign and timing may be less precise."
      : null;

    let transitEvents: Awaited<ReturnType<typeof computeTransits>> = [];
    try {
      transitEvents = await computeTransits({
        birthDate: birthDateForEngine,
        sunSign: bp.sunSign ?? null,
        moonSign: bp.moonSign ?? null,
        birthLat: bp.birthLat ?? null,
        birthLong: bp.birthLong ?? null,
        natalChartJson: bp.natalChartJson ?? null,
        timeframe,
        language,
      });
    } catch (engineErr: unknown) {
      const msg = engineErr instanceof Error ? engineErr.message : String(engineErr);
      console.warn("[transits] engine error:", msg);
      transitEvents = [];
    }
    console.log(`[transits/perf] engine computed: ${Date.now() - t0}ms`);

    const moonAmbient = computeMoonAmbientContext({
      birthLat: bp.birthLat ?? null,
      birthLong: bp.birthLong ?? null,
    });
    const dominantTransit = pickDominantTransitForOverview(transitEvents);

    const dailyOutlook =
      language === "fa"
        ? {
            title: "تمرکز روز شما",
            text: `${userName} عزیز، امروز آسمان برای شما پیامی شخصی دارد. با نیت روشن پیش بروید و به آنچه توجه‌تان را می‌طلبد توجه کنید.`,
            moodLabel: "متأمل",
          }
        : {
            title: "Your Day in Focus",
            text: `The sky holds something personal for you today, ${userName}. Move with intention and notice what calls for your attention.`,
            moodLabel: "Reflective",
          };

    const expiresAt = new Date(now.getTime() + 30 * 24 * 3_600_000);
    const aiCompleteNow = transitEvents.length === 0;

    const snapshot = await prisma.transitSnapshot.upsert({
      where: {
        userId_localDate_timeframeScope: {
          userId: user.id,
          localDate: cacheLocalDate,
          timeframeScope: timeframe,
        },
      },
      create: {
        userId: user.id,
        localDate: cacheLocalDate,
        timeframeScope: timeframe,
        language,
        dailyOutlookTitle: dailyOutlook.title,
        dailyOutlookText: dailyOutlook.text,
        moodLabel: dailyOutlook.moodLabel,
        bigThreeJson: { sun: sunSign, moon: moonSign, rising: risingSign },
        precisionNote,
        transitsJson: transitEvents as unknown as Prisma.JsonArray,
        generatedAt: now,
        expiresAt,
        aiEnrichedAt: aiCompleteNow ? now : null,
        dominantEventId: dominantTransit?.id ?? null,
        moonContextJson: moonAmbient === null ? Prisma.DbNull : (moonAmbient as unknown as Prisma.InputJsonValue),
        lifecycleVersion: 2,
      },
      update: {
        language,
        dailyOutlookTitle: dailyOutlook.title,
        dailyOutlookText: dailyOutlook.text,
        moodLabel: dailyOutlook.moodLabel,
        bigThreeJson: { sun: sunSign, moon: moonSign, rising: risingSign },
        precisionNote,
        transitsJson: transitEvents as unknown as Prisma.JsonArray,
        generatedAt: now,
        expiresAt,
        aiEnrichedAt: aiCompleteNow ? now : null,
        dominantEventId: dominantTransit?.id ?? null,
        moonContextJson: moonAmbient === null ? Prisma.DbNull : (moonAmbient as unknown as Prisma.InputJsonValue),
        lifecycleVersion: 2,
      },
    });

    try {
      await upsertUserTransitDailyCache({
        userId: user.id,
        localDate: cacheLocalDate,
        language,
        dominantEventId: dominantTransit?.id ?? null,
        eventsJson: transitEvents as unknown as Prisma.InputJsonValue,
        ingressesJson: computeIngressHints(),
        lunationsJson: computeLunationHints(),
        retrogradesJson: computeRetrogradeStatus(),
        moonContextJson:
          moonAmbient === null ? undefined : (moonAmbient as unknown as Prisma.InputJsonValue),
        expiresAt,
      });
    } catch (cacheErr: unknown) {
      const msg = cacheErr instanceof Error ? cacheErr.message : String(cacheErr);
      console.warn("[transits/overview] daily transit cache upsert skipped:", msg);
    }

    if (!aiCompleteNow) {
      scheduleTransitOverviewAiEnrichment({
        userId: user.id,
        snapshotLocalDate: cacheLocalDate,
        timeframe,
        language,
        userName,
        sunSign,
        moonSign,
        risingSign,
      });
    }

    console.log(`[transits/perf] snapshot saved: ${Date.now() - t0}ms`);
    console.log(`[transits/perf] AI outlook+summaries: deferred (background)`);
    console.log(`[transits/perf] TOTAL: ${Date.now() - t0}ms`);

    const { cappedTransits, dominantEventId: overviewDominantId } = capTransitsForOverviewResponse(
      transitEvents,
      timeframe,
    );

    console.log("[transits/overview]", { uid: firebaseUid, timeframe, transitsCount: transitEvents.length });

    return c.json({
      timeframe,
      generatedAt: snapshot.generatedAt,
      isStale: false,
      isGenerating: !aiCompleteNow,
      dailyOutlook,
      bigThree: { sun: sunSign, moon: moonSign, rising: risingSign },
      precisionNote,
      transits: cappedTransits,
      dominantEventId: overviewDominantId,
      moonAmbient,
      lifecycleVersion: 2,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[transits/overview] error:", err?.message);
    return c.json({ error: "Failed to load transits", message: err?.message }, 500);
  }
});

/** Thin deterministic satellite endpoints (registered before `/transits/detail`). */
api.get("/transits/ingresses", async (c) => {
  try {
    c.get("firebaseUid");
    return c.json({ ingresses: computeIngressHints() });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[transits/ingresses] error:", err?.message);
    return c.json({ error: "Failed to load ingresses", message: err?.message }, 500);
  }
});

api.get("/transits/lunations", async (c) => {
  try {
    c.get("firebaseUid");
    return c.json({ lunations: computeLunationHints() });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[transits/lunations] error:", err?.message);
    return c.json({ error: "Failed to load lunations", message: err?.message }, 500);
  }
});

api.get("/transits/retrogrades", async (c) => {
  try {
    c.get("firebaseUid");
    return c.json({ retrogrades: computeRetrogradeStatus() });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[transits/retrogrades] error:", err?.message);
    return c.json({ error: "Failed to load retrogrades", message: err?.message }, 500);
  }
});

api.get("/transits/collective", async (c) => {
  try {
    c.get("firebaseUid");
    const collective = computeCollectiveTransits();
    console.log("[transits/collective] first two:", collective.slice(0, 2));
    return c.json({ collective });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[transits/collective] error:", err?.message);
    return c.json(
      { error: "Failed to load collective transits", message: err?.message },
      500,
    );
  }
});

/** Detail path must not be `/transits/:id` alone — that can match `overview` as a dynamic segment before `/transits/overview`, causing 404s. */
api.get("/transits/detail/:transitId", async (c) => {
  try {
    const firebaseUid = c.get("firebaseUid");
    const { transitId } = c.req.param();

    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      include: { birthProfile: true },
    });
    if (!user) return c.json({ error: "User not found" }, 404);

    const language: "en" | "fa" = user.language === "en" ? "en" : "fa";

    const snapshot = await prisma.transitSnapshot.findFirst({
      where: { userId: user.id },
      orderBy: { generatedAt: "desc" },
    });

    if (!snapshot?.transitsJson) {
      return c.json({ error: "Transit not found" }, 404);
    }

    const transits = snapshot.transitsJson as unknown as Array<Record<string, unknown>>;
    const transit = transits.find((t) => t.id === transitId);
    if (!transit) return c.json({ error: "Transit not found" }, 404);

    if (transit.longInterpretation) {
      return c.json(transit);
    }

    const bp = user.birthProfile;
    const tags = (transit.themeTags as string[]) ?? [];
    const tagJoin = tags.join(language === "fa" ? " و " : " and ");
    const firstTag = tags[0] ?? (language === "fa" ? "این انرژی" : "this energy");
    let interpretation =
      language === "fa"
        ? {
            subtitle: `${transit.transitingBody} ${transit.aspectType ?? "با"} ناتال ${transit.natalTargetBody ?? "نقشه"}`,
            whyThisIsHappening: `${transit.transitingBody} در حال شکل‌گیری یک ${transit.aspectType ?? "تأثیر"} قابل‌توجه با ناتال ${transit.natalTargetBody ?? "نقشه"} شماست.`,
            whyItMattersForYou: `این ترانزیت موضوعاتی مانند ${tagJoin || "رشد و تغییر"} را در نقشه شما فعال می‌کند.`,
            leanInto: [`این هفته بیشتر روی زمینهٔ «${firstTag}» تمرکز کنید.`],
            beMindfulOf: ["در مدت فعال بودن این ترانزیت از تصمیم‌های عجولانه پرهیز کنید."],
          }
        : {
            subtitle: `${transit.transitingBody} ${transit.aspectType ?? "influencing"} natal ${transit.natalTargetBody ?? "chart"}`,
            whyThisIsHappening: `${transit.transitingBody} is forming a notable ${transit.aspectType ?? "influence"} to your natal ${transit.natalTargetBody ?? "chart"}.`,
            whyItMattersForYou: `This transit activates themes of ${tagJoin || "growth and change"} in your chart.`,
            leanInto: [`Pay attention to ${firstTag} themes this week.`],
            beMindfulOf: ["Avoid rushing decisions while this transit is active."],
          };

    try {
      const detailPrompt = buildTransitDetailPrompt({
        userName: getDisplayName(user, user.language),
        sunSign: bp?.sunSign ?? "Unknown",
        moonSign: bp?.moonSign ?? "Unknown",
        risingSign: bp?.risingSign ?? null,
        transit: {
          transitingBody: transit.transitingBody as string,
          natalTargetBody: (transit.natalTargetBody as string) ?? null,
          aspectType: (transit.aspectType as string) ?? null,
          significanceScore: (transit.significanceScore as number) ?? 50,
          themeTags: (transit.themeTags as string[]) ?? [],
          emotionalTone: (transit.emotionalTone as string) ?? null,
          practicalExpression: (transit.practicalExpression as string) ?? null,
        },
        language,
      });

      const aiResult = await generateCompletion({
        feature: "transit_detail",
        complexity: "standard",
        messages: [
          { role: "system", content: detailPrompt.system },
          { role: "user", content: detailPrompt.user },
        ],
        responseFormat: { type: "json_object" },
        safety: { mode: "check", userId: user.id, text: "transit_detail" },
        timeoutMs: 25_000,
        maxRetries: 1,
        maxTokens: 500,
      });

      if (aiResult.ok && aiResult.kind === "success") {
        const j = aiResult.json;
        if (j && typeof j === "object" && !Array.isArray(j) && "subtitle" in j) {
          const o = j as typeof interpretation;
          interpretation = {
            subtitle: o.subtitle,
            whyThisIsHappening: o.whyThisIsHappening,
            whyItMattersForYou: o.whyItMattersForYou,
            leanInto: Array.isArray(o.leanInto) ? o.leanInto : interpretation.leanInto,
            beMindfulOf: Array.isArray(o.beMindfulOf) ? o.beMindfulOf : interpretation.beMindfulOf,
          };
        } else {
          const parsed = JSON.parse(aiResult.content.replace(/```json|```/g, "").trim()) as typeof interpretation;
          if (parsed.subtitle) interpretation = parsed;
        }
      }
    } catch (aiErr: unknown) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      console.warn("[transits/detail] AI failed:", msg);
    }

    return c.json({
      ...transit,
      subtitle: interpretation.subtitle,
      whyThisIsHappening: interpretation.whyThisIsHappening,
      whyItMattersForYou: interpretation.whyItMattersForYou,
      leanInto: interpretation.leanInto,
      beMindfulOf: interpretation.beMindfulOf,
      longInterpretation: interpretation,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[transits/detail] error:", err?.message);
    return c.json({ error: "Failed to load transit detail", message: err?.message }, 500);
  }
});

api.delete("/transits/cache", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const user = await prisma.user.findUnique({
    where: { firebaseUid },
    select: { id: true },
  });
  if (user) {
    await prisma.transitSnapshot.deleteMany({ where: { userId: user.id } }).catch(() => null);
  }
  return c.json({ success: true, message: "Cache cleared" });
});

/** ---------- Life challenges (Phase 3) ---------- */
api.get("/challenges/report", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasFeatureAccess(firebaseUid, dbId))) return c.json({ error: "premium_required" }, 402);

  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  if (!bp) return c.json({ error: "No birth profile" }, 404);

  const redisKey = cacheKey.lifeChallenges(dbId);
  const cached = await cacheGetJson<unknown>(redisKey);
  if (cached) return c.json(cached);

  const natalChartJson = bp.natalChartJson as unknown;
  const clusters = challengeRulesEngine(natalChartJson as any);

  const interpretation =
    clusters.length > 0
      ? `Your chart suggests repeating learning loops. Start with: ${clusters
          .map((c) => c.id.replace(/_/g, " "))
          .slice(0, 3)
          .join(", ")} — then respond with curiosity instead of self-criticism.`
      : "Your chart invites steady growth through gentle self-observation.";

  const hiddenStrengths = clusters.map((c) => `You can turn ${c.id.replace(/_/g, " ")} into conscious wisdom.`);
  const practicePrompts = clusters.slice(0, 3).map((c) => `What would be one small action today that respects your ${c.id.replace(/_/g, " ")} pattern?`);

  const payload = { clusters, interpretation, hiddenStrengths, practicePrompts };

  await cacheSetUntilLocalMidnight(redisKey, payload, bp.birthTimezone);
  return c.json(payload);
});

/** ---------- Conflict advice (Phase 4) ---------- */
api.post("/conflict/advice", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasFeatureAccess(firebaseUid, dbId))) return c.json({ error: "premium_required" }, 402);

  const body = z.object({ message: z.string().min(10).max(8000) }).parse(await c.req.json());

  const safety = await safetyClassifier(dbId, body.message);
  if (!safety.isSafe) return c.json({ error: "unsafe", flagType: safety.flagType, response: safety.safeResponse }, 200);

  const ctx = await assembleContext(dbId).catch(() => null);

  const schema = z.object({
    summary: z.string().min(20).max(800),
    feelings: z.array(z.string().min(2)).min(1).max(6),
    needs: z.array(z.string().min(2)).min(1).max(6),
    scripts: z.array(z.string().min(10)).min(2).max(6),
    boundaries: z.array(z.string().min(5)).min(1).max(6),
    repairSteps: z.array(z.string().min(5)).min(3).max(9),
    reflectionQuestion: z.string().min(10).max(240),
  });

  let payload = {
    summary: "Let’s slow down and name what’s happening, then choose a clear next step.",
    feelings: ["Hurt", "Frustrated"],
    needs: ["Respect", "Clarity"],
    scripts: [
      "I want to understand what you meant. Can we talk for 10 minutes without interrupting?",
      "I felt ___ when ___. What I need is ___. Would you be open to ___?",
    ],
    boundaries: ["If voices rise, I’m going to pause and return in 20 minutes."],
    repairSteps: ["Breathe and settle your body", "Name one feeling", "Name one need", "Ask for one specific action"],
    reflectionQuestion: "What outcome would feel fair to you tomorrow morning?",
  };

  if (process.env.ANTHROPIC_API_KEY) {
    const result = await generateCompletion({
      feature: "conflict_advice",
      complexity: "standard",
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a calm conflict coach. No legal/medical advice. No manipulation. Give actionable, kind, consent-based steps. JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            message: body.message,
            context: ctx,
            schema: "summary, feelings[], needs[], scripts[], boundaries[], repairSteps[], reflectionQuestion",
          }),
        },
      ],
      safety: { mode: "result", result: safety },
      timeoutMs: 25_000,
      maxRetries: 1,
    });

    if (result.kind === "success" && result.json) {
      try {
        payload = schema.parse(result.json);
      } catch {
        /* keep defaults */
      }
    }
  }

  return c.json(payload);
});

/** ---------- Coffee reading (Phase 4) ---------- */
api.post("/coffee/reading", async (c) => {
  try {
    const firebaseUid = c.get("firebaseUid");
    const dbId = c.get("dbUserId");
    if (!(await hasFeatureAccess(firebaseUid, dbId))) return c.json({ error: "premium_required" }, 402);

    const body = z
      .object({
        imageBase64: z.string().min(100),
        mimeType: z.string().default("image/jpeg"),
        /** Optional second image — saucer; when set, vision uses two imageInputs (cup then saucer). */
        saucerImageBase64: z.string().min(100).optional(),
        saucerMimeType: z.string().optional(),
        /** Matches app i18n; falls back to user.language in DB. */
        language: z.enum(["en", "fa"]).optional(),
      })
      .parse(await c.req.json());

    const dbUser = await prisma.user.findUnique({
      where: { id: dbId },
      include: { birthProfile: true },
    });
    if (!dbUser) {
      return c.json({ error: "user_not_found", message: "User not found." }, 404);
    }

    const readerName = getDisplayName(dbUser, dbUser.language);

    const effectiveLang: CoffeeReadingLang =
      body.language === "en" || body.language === "fa"
        ? body.language
        : dbUser.language === "en"
          ? "en"
          : "fa";

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedMimeTypes.includes(body.mimeType)) {
      return c.json(
        { error: "Invalid image type. Please use JPEG, PNG, GIF, or WebP.", code: "invalid_image_type" },
        400,
      );
    }
    const base64SizeBytes = (body.imageBase64.length * 3) / 4;
    if (base64SizeBytes > 5 * 1024 * 1024) {
      return c.json(
        { error: "Image too large. Please use an image under 5MB.", code: "image_too_large" },
        400,
      );
    }

    const hasSaucer = Boolean(body.saucerImageBase64 && body.saucerImageBase64.length >= 100);
    if (hasSaucer) {
      const saucerMime = body.saucerMimeType ?? "image/jpeg";
      if (!allowedMimeTypes.includes(saucerMime)) {
        return c.json(
          { error: "Invalid image type. Please use JPEG, PNG, GIF, or WebP.", code: "invalid_image_type" },
          400,
        );
      }
      const saucerBytes = (body.saucerImageBase64!.length * 3) / 4;
      if (saucerBytes > 5 * 1024 * 1024) {
        return c.json(
          { error: "Image too large. Please use an image under 5MB.", code: "image_too_large" },
          400,
        );
      }
    }

  const schema = z.object({
    visionObservations: z.array(z.string().min(3)).min(3).max(12),
    symbolicMappings: z.array(z.object({ symbol: z.string().min(2).max(40), meaning: z.string().min(10).max(200) })).min(3).max(10),
    interpretation: z.string().min(80).max(2500),
    followUpQuestions: z.array(z.string().min(10).max(200)).min(2).max(5),
    imageQualityFlag: z.boolean(),
  });

  let payload = getCoffeeReadingDefaultPayload(effectiveLang);

  const coffeeStep1Schema = z.object({
    visionObservations: z.array(z.string().min(3)).min(3).max(12),
    symbolicMappings: z.array(z.object({ symbol: z.string().min(2).max(40), meaning: z.string().min(10).max(200) })).min(3).max(10),
    imageQualityFlag: z.boolean(),
  });

  const coffeeStep2Schema = z.object({
    interpretation: z.string().min(80).max(2500),
    followUpQuestions: z.array(z.string().min(10).max(200)).min(2).max(5),
  });

  const imageInputs: { type: "base64"; data: string; mimeType: string }[] = [
    { type: "base64", data: body.imageBase64, mimeType: body.mimeType },
  ];
  if (hasSaucer && body.saucerImageBase64) {
    imageInputs.push({
      type: "base64",
      data: body.saucerImageBase64,
      mimeType: body.saucerMimeType ?? "image/jpeg",
    });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const visionPrompt = buildCoffeeVisionPrompt(effectiveLang, hasSaucer);
    const step1 = await generateCompletion({
      feature: "coffee_reading_step1_vision",
      complexity: "standard",
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: visionPrompt.system },
        { role: "user", content: visionPrompt.user },
      ],
      // Image formatted by generateCompletion via imageInputs — not embedded manually.
      imageInputs,
      safety: { mode: "check", userId: dbId, text: "coffee_reading:vision" },
      timeoutMs: 35_000,
      maxRetries: 1,
    });

    if (step1.kind === "success" && step1.json && typeof step1.json === "object") {
      try {
        const parsed = coffeeStep1Schema.parse(step1.json);
        payload = { ...payload, ...parsed };
      } catch {
        /* keep defaults */
      }
    } else if (step1.kind === "unsafe") {
      payload = { ...payload, interpretation: step1.safeResponse ?? payload.interpretation };
    }

    if (step1.kind === "success") {
      const step2 = await generateCompletion({
        feature: "coffee_reading_step2_symbolic_interpretation",
        complexity: "standard",
        responseFormat: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: buildCoffeeStep2SystemPrompt(effectiveLang, readerName || undefined),
          },
          {
            role: "user",
            content: JSON.stringify({
              visionObservations: payload.visionObservations,
              symbolicMappings: payload.symbolicMappings,
              language: effectiveLang,
              readerName: readerName || undefined,
              request: buildCoffeeStep2UserRequest(effectiveLang),
            }),
          },
        ],
        safety: { mode: "check", userId: dbId, text: "coffee_reading:symbolic_interpretation" },
        timeoutMs: 35_000,
        maxRetries: 1,
      });

      if (step2.kind === "success" && step2.json && typeof step2.json === "object") {
        try {
          const parsed2 = coffeeStep2Schema.parse(step2.json);
          payload = { ...payload, ...parsed2 };
        } catch {
          /* keep defaults */
        }
      } else if (step2.kind === "unsafe") {
        payload = { ...payload, interpretation: step2.safeResponse ?? payload.interpretation };
      }
    }
  }

  const cleanInterpretation = sanitizeAssistantText(payload.interpretation);
  const cleanFollowUps = (payload.followUpQuestions ?? []).map((q) => sanitizeAssistantText(q));
  const payloadOut = { ...payload, interpretation: cleanInterpretation, followUpQuestions: cleanFollowUps };

  await prisma.coffeeReading.create({
    data: {
      userId: dbId,
      imageUrl: `base64-upload:${hasSaucer ? "cup-saucer" : "cup"}:${dbId}:${Date.now()}`,
      visionObservations: payloadOut.visionObservations as object,
      symbolicMappings: payloadOut.symbolicMappings as object,
      interpretation: payloadOut.interpretation,
      followUpMessages: { followUpQuestions: payloadOut.followUpQuestions } as object,
      imageQualityFlag: payloadOut.imageQualityFlag,
    },
  });

  const userMessageContent = hasSaucer
    ? "Coffee cup and saucer photos submitted for reading."
    : "Coffee cup photo submitted for reading.";

  const conversation = await prisma.conversation.create({
    data: {
      userId: dbId,
      title: payloadOut.interpretation.slice(0, 60) || "Coffee reading",
      category: "coffee_reading",
    },
  });
  await prisma.message.create({
    data: { conversationId: conversation.id, role: "user", content: userMessageContent },
  });
  await prisma.message.create({
    data: { conversationId: conversation.id, role: "assistant", content: payloadOut.interpretation },
  });

  return c.json({ ...payloadOut, sessionId: conversation.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[coffee/reading] unhandled error:", msg);
    return c.json({ error: "Could not complete reading", details: msg }, 500);
  }
});

/** ---------- Future guidance (Phase 4) ---------- */
api.post("/future/report", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasFeatureAccess(firebaseUid, dbId))) return c.json({ error: "premium_required" }, 402);

  const body = z
    .object({
      domain: z.enum(["love", "career", "health", "family", "spirituality", "general"]),
      timeWindow: z.enum(["7d", "30d", "90d"]),
    })
    .parse(await c.req.json());

  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  if (!bp) return c.json({ error: "No birth profile" }, 404);

  const fuUser = await prisma.user.findUnique({
    where: { id: dbId },
    select: { language: true },
  });
  const fuLang: "en" | "fa" = fuUser?.language === "en" ? "en" : "fa";

  const days = body.timeWindow === "7d" ? 7 : body.timeWindow === "30d" ? 30 : 90;
  const natalChartJson = bp.natalChartJson as unknown as Parameters<typeof getDailyTransits>[0];
  const start = DateTime.now().setZone(bp.birthTimezone).startOf("day").toISODate() ?? DateTime.utc().toISODate()!;
  const transitHits = getForwardTransits(natalChartJson as any, start, days);
  const themes = transitHits.slice(0, 10).map((t: { transitBody: string; type: string; natalBody: string }) => `${t.transitBody} ${t.type} natal ${t.natalBody}`);

  const schema = z.object({
    upcomingThemes: z.array(z.string().min(5)).min(2).max(8),
    timingWindows: z.array(z.string().min(5)).min(2).max(6),
    opportunities: z.array(z.string().min(8)).min(2).max(6),
    risks: z.array(z.string().min(8)).min(1).max(6),
    actionableNow: z.string().min(40).max(900),
    confidenceNote: z.string().min(10).max(200),
  });

  let payload = {
    upcomingThemes: themes.length ? themes.slice(0, 5) : ["Steady integration", "Clarity through small actions"],
    timingWindows: ["This week: observe + simplify", "Next 2–4 weeks: take one committed step"],
    opportunities: ["Clear one small backlog item", "Have one honest conversation"],
    risks: ["Overcommitting", "Reading too much into one moment"],
    actionableNow: "Pick one focus for the next 7 days. Make it small, repeatable, and measurable. Then review what changes in your energy and results.",
    confidenceNote: "Astrology shows themes, not certainty. Use this as a gentle planning lens.",
  };

  if (process.env.ANTHROPIC_API_KEY) {
    const result = await generateCompletion({
      feature: "future_report",
      complexity: "standard",
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a cautious astrologer-coach. Use ONLY the provided transit themes. No certainty. No medical/legal/financial advice. JSON only.

${appendOutputCompliance(fuLang)}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            domain: body.domain,
            timeWindow: body.timeWindow,
            transitThemes: themes,
            schema: "upcomingThemes[], timingWindows[], opportunities[], risks[], actionableNow, confidenceNote",
          }),
        },
      ],
      safety: { mode: "check", userId: dbId, text: `future_report:${body.domain}:${body.timeWindow}` },
      timeoutMs: 25_000,
      maxRetries: 1,
    });

    if (result.kind === "success" && result.json && typeof result.json === "object") {
      try {
        payload = schema.parse(result.json);
      } catch {
        /* keep defaults */
      }
    }
  }

  await prisma.futureSeerReport.create({
    data: {
      userId: dbId,
      domain: body.domain,
      timeWindow: body.timeWindow,
      upcomingThemes: payload.upcomingThemes as object,
      transitSupport: { themes } as object,
      timingWindows: payload.timingWindows as object,
      risks: payload.risks as object,
      opportunities: payload.opportunities as object,
      actionableNow: payload.actionableNow,
      confidenceNote: payload.confidenceNote,
    },
  });

  return c.json(payload);
});

const peopleRelationshipTypes = ["partner", "friend", "family", "coworker", "other"] as const;
const createPeopleProfileSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  relationshipType: z.enum(peopleRelationshipTypes),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.null()]).optional(),
  birthPlace: z.string().max(200).optional().nullable(),
  birthLat: z.number().min(-90).max(90).optional().nullable(),
  birthLong: z.number().min(-180).max(180).optional().nullable(),
  birthTimezone: z.string().optional().nullable(),
});
const updatePeopleProfileSchema = createPeopleProfileSchema.partial();

/** ---------- People in Your Life (PeopleProfile) ---------- */
api.post("/people", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  try {
    const premium = await hasFeatureAccess(firebaseUid, dbId);
    if (!premium) {
      const n = await prisma.peopleProfile.count({
        where: { userId: dbId, deletedAt: null },
      });
      if (n >= 1) {
        return c.json({ error: "people_limit", message: "Free plan allows one saved person. Upgrade for more." }, 403);
      }
    }
    const body = createPeopleProfileSchema.parse(await c.req.json());
    const hasFullData = !!(
      body.birthTime &&
      body.birthLat != null &&
      body.birthLong != null &&
      body.birthTimezone
    );
    let natalChartJson: Prisma.InputJsonValue | undefined = undefined;
    if (hasFullData) {
      try {
        const chart = computeNatalChart({
          birthDate: body.birthDate,
          birthTime: body.birthTime ?? null,
          birthLat: body.birthLat!,
          birthLong: body.birthLong!,
          birthTimezone: body.birthTimezone!,
        });
        natalChartJson = {
          planets: chart.planets,
          aspects: chart.aspects,
          jdUt: chart.jdUt,
          jdEt: chart.jdEt,
        };
      } catch (e) {
        console.warn("[people] chart computation failed:", e instanceof Error ? e.message : String(e));
        natalChartJson = undefined;
      }
    }
    const profile = await prisma.peopleProfile.create({
      data: {
        userId: dbId,
        name: body.name,
        relationshipType: body.relationshipType,
        birthDate: new Date(body.birthDate),
        birthTime: body.birthTime ?? null,
        birthPlace: body.birthPlace?.trim() || null,
        birthLat: body.birthLat ?? null,
        birthLong: body.birthLong ?? null,
        birthTimezone: body.birthTimezone ?? null,
        hasFullData,
        ...(natalChartJson !== undefined ? { natalChartJson } : {}),
      },
      select: {
        id: true,
        name: true,
        relationshipType: true,
        birthDate: true,
        birthTime: true,
        birthPlace: true,
        hasFullData: true,
        createdAt: true,
      },
    });
    return c.json({ success: true, profile }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: e.flatten() }, 400);
    }
    console.error("[people] create:", e);
    return c.json({ error: "Failed to create profile" }, 500);
  }
});

api.get("/people", async (c) => {
  const dbId = c.get("dbUserId");
  try {
    const profiles = await prisma.peopleProfile.findMany({
      where: { userId: dbId, deletedAt: null },
      select: {
        id: true,
        name: true,
        relationshipType: true,
        birthDate: true,
        birthTime: true,
        birthPlace: true,
        hasFullData: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return c.json({ profiles });
  } catch (e) {
    console.error("[people] list:", e);
    return c.json({ error: "Failed to load profiles" }, 500);
  }
});

/** People + compatibility: static paths before /people/:id */
api.post("/people/compatibility/report", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  try {
    const { personProfileId } = z.object({ personProfileId: z.string().min(1) }).parse(await c.req.json());
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      include: { birthProfile: true },
    });
    if (!user?.birthProfile) {
      return c.json({ error: "Complete your birth profile first" }, 400);
    }
    const personProfile = await prisma.peopleProfile.findFirst({
      where: { id: personProfileId, userId: dbId, deletedAt: null },
    });
    if (!personProfile) return c.json({ error: "Person profile not found" }, 404);

    const premium = await hasFeatureAccess(firebaseUid, dbId);
    const language = user.language === "en" ? "en" : "fa";
    const userName = getDisplayName(user, user.language);
    const personName = personProfile.name.trim();

    let userPlanets = extractPlanetsFromChartJson(user.birthProfile.natalChartJson);
    if (Object.keys(userPlanets).length === 0 && user.birthProfile.sunSign) {
      userPlanets = { Sun: sunSignToLongitude(user.birthProfile.sunSign) };
    }

    const isEstimate = !personProfile.hasFullData;
    let personPlanets: Record<string, number> = {};
    if (personProfile.natalChartJson) {
      personPlanets = extractPlanetsFromChartJson(personProfile.natalChartJson);
    }
    if (Object.keys(personPlanets).length === 0) {
      const dateStr = personProfile.birthDate.toISOString().split("T")[0]!;
      const sun = computeSunSignFallback(dateStr);
      personPlanets = { Sun: sunSignToLongitude(sun) };
    }

    const syn = computeSynastry(userPlanets, personPlanets, isEstimate);

    const langBlock =
      language === "fa"
        ? "CRITICAL: You MUST respond ENTIRELY in Persian (Farsi). Every word in Persian script. No English."
        : "CRITICAL: You MUST respond ENTIRELY in English.";

    let narrativeSummary =
      language === "fa"
        ? "برای متن کامل سازگاری، اشتراک فعال یا دورهٔ آزمایشی لازم است."
        : "Upgrade for the full written compatibility narrative.";
    let tips: string[] =
      language === "fa"
        ? ["نیازهایتان را آرام بیان کنید.", "تفاوت‌ها را به‌عنوان غنا ببینید.", "آیین‌های کوچک مشترک بسازید."]
        : ["Share needs calmly.", "See differences as richness.", "Create small shared rituals."];
    let isFullReport = false;

    if (premium && process.env.ANTHROPIC_API_KEY) {
      const systemPrompt = `You are Akhtar, a warm astrology guide writing a compatibility reading.

IDENTITY — NEVER CONFUSE:
- ${userName} is the person READING this (the account holder).
- ${personName} is the OTHER person. Never swap traits or names.

${userName}'s chart signs: Sun ${user.birthProfile.sunSign}, Moon ${user.birthProfile.moonSign}, Rising ${user.birthProfile.risingSign ?? "Unknown"}.
${personName}: ${isEstimate ? "estimated Sun-only from birth date" : "full chart data available"}.

Pre-computed scores (do not recalculate astrology):
Overall ${syn.overallScore}%, Emotional ${syn.emotionalScore}%, Attraction ${syn.attractionScore}%, Communication ${syn.communicationScore}%, Long-term ${syn.longTermScore}%, Harmony/conflict axis ${syn.conflictScore}%.

Supportive: ${syn.supportingAspects.map((a) => `${a.body1} ${a.aspect} ${a.body2}`).join("; ") || "—"}
Tension: ${syn.tensionAspects.map((a) => `${a.body1} ${a.aspect} ${a.body2}`).join("; ") || "—"}

Relationship type: ${personProfile.relationshipType}
${isEstimate ? `Note: ${personName}'s positions are partly estimated; mention gently.` : ""}

Write 250–350 words: opening dynamic, what flows, what needs patience, three short tips as a numbered list at the end (1. 2. 3.), closing encouragement.
No markdown. No ** or ##. Plain prose + numbered tips only.

${langBlock}`;

      const result = await generateCompletion({
        feature: "compatibility_report_people",
        complexity: "standard",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Write the compatibility reading now." },
        ],
        safety: { mode: "check", userId: dbId, text: `people_compat_report:${personProfileId}` },
        timeoutMs: 35_000,
        maxRetries: 1,
      });

      if (result.kind === "success" && result.content?.trim()) {
        narrativeSummary = sanitizeAssistantText(result.content.trim());
        isFullReport = true;
        tips =
          language === "fa"
            ? ["گفتگوی آرام دربارهٔ نیازها", "قدردانی از تفاوت‌ها", "لحظات کوچک مشترک بسازید"]
            : ["Talk calmly about needs", "Appreciate differences", "Create small shared moments"];
      }
    }

    const report = await prisma.compatibilityReport.upsert({
      where: {
        userId_personProfileId: { userId: dbId, personProfileId },
      },
      create: {
        userId: dbId,
        personProfileId,
        overallScore: syn.overallScore,
        emotionalScore: syn.emotionalScore,
        communicationScore: syn.communicationScore,
        attractionScore: syn.attractionScore,
        longTermScore: syn.longTermScore,
        conflictScore: syn.conflictScore,
        isEstimate,
        isFullReport,
        narrativeSummary,
        tips: tips as unknown as Prisma.InputJsonValue,
        synastryScoringJson: syn.rawAspects as unknown as Prisma.InputJsonValue,
        language,
      },
      update: {
        overallScore: syn.overallScore,
        emotionalScore: syn.emotionalScore,
        communicationScore: syn.communicationScore,
        attractionScore: syn.attractionScore,
        longTermScore: syn.longTermScore,
        conflictScore: syn.conflictScore,
        isEstimate,
        isFullReport,
        narrativeSummary,
        tips: tips as unknown as Prisma.InputJsonValue,
        synastryScoringJson: syn.rawAspects as unknown as Prisma.InputJsonValue,
        language,
      },
    });

    return c.json({
      success: true,
      report,
      narrativeFull: report.isFullReport,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return c.json({ error: "Invalid input", details: e.flatten() }, 400);
    console.error("[people/compatibility/report]", e);
    return c.json({ error: "Failed to generate report" }, 500);
  }
});

api.get("/people/compatibility/report/:personProfileId", async (c) => {
  const dbId = c.get("dbUserId");
  const personProfileId = c.req.param("personProfileId");
  try {
    const person = await prisma.peopleProfile.findFirst({
      where: { id: personProfileId, userId: dbId, deletedAt: null },
      select: { id: true },
    });
    if (!person) return c.json({ error: "Not found" }, 404);
    const report = await prisma.compatibilityReport.findUnique({
      where: { userId_personProfileId: { userId: dbId, personProfileId } },
    });
    if (!report) return c.json({ error: "not_found" }, 404);
    return c.json({ report });
  } catch (e) {
    console.error("[people/compatibility/report GET]", e);
    return c.json({ error: "Failed to load report" }, 500);
  }
});

function buildPeopleCompatibilityChatSystem(args: {
  userName: string;
  personName: string;
  userSun: string;
  userMoon: string;
  userRising: string;
  personEstimateNote: string;
  reportBlock: string;
  relationshipType: string;
  language: "en" | "fa";
}): string {
  const langBlock =
    args.language === "fa"
      ? "CRITICAL: Respond ONLY in Persian (Farsi). Every word in Persian. No English."
      : "CRITICAL: Respond ONLY in English.";
  return `You are Akhtar, speaking with ${args.userName} about their connection with ${args.personName}.

IDENTITY — ABSOLUTE:
- ${args.userName} is the user you are talking TO (they read your reply).
- ${args.personName} is the person they are asking ABOUT. Never swap.

${args.userName}'s chart: Sun ${args.userSun}, Moon ${args.userMoon}, Rising ${args.userRising}.

${args.personName}: ${args.personEstimateNote}

${args.reportBlock}

Relationship type: ${args.relationshipType}

Use "between you and ${args.personName}", "may suggest", "astrologically". No fatalism. No medical/legal/financial advice.
End with a line ---FOLLOW_UPS--- then 2–3 short follow-up questions, one per line.
No markdown headings or bold.

${langBlock}`;
}

api.post("/people/compatibility/chat", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  const raw = z
    .object({
      message: z.string().min(1).max(8000).optional(),
      content: z.string().min(1).max(8000).optional(),
      conversationId: z.string().optional(),
      sessionId: z.string().nullable().optional(),
      personProfileId: z.string().min(1),
    })
    .merge(chatVoiceMetadataSchema)
    .parse(await c.req.json());
  const message = (raw.content ?? raw.message ?? "").trim();
  if (!message) return c.json({ error: "message_required" }, 400);
  const personProfileId = raw.personProfileId;
  const conversationId = raw.sessionId ?? raw.conversationId;

  const [premium, userWithProfile] = await Promise.all([
    hasFeatureAccess(firebaseUid, dbId),
    prisma.user.findUnique({
      where: { id: dbId },
      include: { birthProfile: true },
    }),
  ]);
  const bp = userWithProfile?.birthProfile ?? null;
  const tz = bp?.birthTimezone ?? "UTC";
  if (!bp) return c.json({ error: "onboarding_required" }, 422);

  if (!premium) {
    const used = await dailyChatCount(dbId, tz);
    if (used >= 3) {
      return c.json({ error: "free_limit", used, limit: 3 }, 402);
    }
  }

  const personProfile = await prisma.peopleProfile.findFirst({
    where: { id: personProfileId, userId: dbId, deletedAt: null },
  });
  if (!personProfile) return c.json({ error: "Person profile not found" }, 404);

  const report = await prisma.compatibilityReport.findUnique({
    where: { userId_personProfileId: { userId: dbId, personProfileId } },
  });

  let convId = conversationId ?? undefined;
  let createdNewConversation = false;
  if (convId) {
    const existing = await prisma.conversation.findFirst({
      where: { id: convId, userId: dbId },
    });
    if (!existing || existing.personProfileId !== personProfileId) {
      return c.json({ error: "invalid_conversation" }, 400);
    }
  } else {
    const existingCompat = await prisma.conversation.findFirst({
      where: {
        userId: dbId,
        personProfileId,
        category: "romantic_compatibility",
      },
    });
    if (existingCompat) convId = existingCompat.id;
    else {
      const conv = await prisma.conversation.create({
        data: {
          userId: dbId,
          personProfileId,
          category: "romantic_compatibility",
          title: `Compatibility: ${personProfile.name}`.slice(0, 120),
        },
      });
      convId = conv.id;
      createdNewConversation = true;
    }
  }

  const userMessage = await prisma.message.create({
    data: {
      conversationId: convId!,
      role: "user",
      content: message,
      ...messageVoiceData(raw),
    },
  });
  if (!premium) await incrChatCount(dbId, tz);

  const rollbackFailedChatTurn = async () => {
    await prisma.message.delete({ where: { id: userMessage.id } }).catch(() => {});
    if (createdNewConversation) {
      const n = await prisma.message.count({ where: { conversationId: convId! } });
      if (n === 0) await prisma.conversation.delete({ where: { id: convId! } }).catch(() => {});
    }
    if (!premium) await decrChatCount(dbId, tz);
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json({
      response: "AI service unavailable.",
      followUpPrompts: [],
      conversationId: convId,
    });
  }

  const sseLang = userWithProfile?.language === "en" ? "en" : "fa";
  const userName = userWithProfile
    ? getDisplayName(userWithProfile, userWithProfile.language ?? "fa")
    : "there";
  const personName = personProfile.name.trim();
  const personEstimateNote = personProfile.hasFullData
    ? "Full birth data on file."
    : "Estimated Sun sign from birth date only; be transparent when relevant.";

  let reportBlock = "No saved compatibility report yet; answer from signs and relationship type.";
  if (report) {
    reportBlock = `Saved compatibility scores for ${userName} & ${personName}: overall ${report.overallScore}%, emotional ${report.emotionalScore}%, attraction ${report.attractionScore}%, communication ${report.communicationScore}%, long-term ${report.longTermScore}%, harmony ${report.conflictScore}%.`;
  }

  const system = buildPeopleCompatibilityChatSystem({
    userName,
    personName,
    userSun: bp.sunSign,
    userMoon: bp.moonSign,
    userRising: bp.risingSign ?? "Unknown",
    personEstimateNote,
    reportBlock,
    relationshipType: personProfile.relationshipType,
    language: sseLang,
  });

  const ssePayload = (obj: Record<string, unknown>) => JSON.stringify(obj);
  c.header("X-Accel-Buffering", "no");
  return streamSSE(c, async (stream) => {
    try {
      const historyRows = await prisma.message.findMany({
        where: { conversationId: convId! },
        orderBy: { createdAt: "desc" },
        take: CHAT_HISTORY_LIMIT,
        select: { role: true, content: true },
      });
      const historyMessages = historyRows.reverse().map((m) => ({ role: m.role, content: m.content }));
      const llmMessages = [{ role: "system" as const, content: system }, ...historyMessages];

      const streamResult = await streamClaudeCompletionAsSSE(stream, {
        sseStringify: ssePayload,
        feature: "compatibility_chat_people",
        complexity: "deep",
        messages: llmMessages,
        safety: { mode: "check", userId: dbId, text: message },
        timeoutMs: 60_000,
        maxRetries: 0,
      });

      if (streamResult.kind === "unsafe") {
        const safeText = streamResult.safeResponse ?? "I can't process this safely right now.";
        const cleanSafe = sanitizeAssistantText(safeText);
        if (!premium) await decrChatCount(dbId, tz);
        await stream.writeSSE({ data: ssePayload({ type: "token", text: cleanSafe }) });
        const saved = await prisma.message.create({
          data: { conversationId: convId!, role: "assistant", content: cleanSafe },
        });
        await prisma.conversation.update({ where: { id: convId! }, data: { updatedAt: new Date() } });
        await stream.writeSSE({
          data: ssePayload({
            type: "done",
            conversationId: convId,
            messageId: saved.id,
            content: cleanSafe,
            followUpPrompts: [] as string[],
          }),
        });
        return;
      }

      if (streamResult.kind === "error") {
        await rollbackFailedChatTurn();
        await stream.writeSSE({
          data: ssePayload({ type: "error", error: "chat_failed", errorType: streamResult.errorType }),
        });
        return;
      }

      let full = streamResult.content;
      let followUps: string[] = [];
      const followUpSplit = full.split("---FOLLOW_UPS---");
      if (followUpSplit.length > 1) {
        full = followUpSplit[0]!.trim();
        followUps = followUpSplit[1]!
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
      }

      const cleanContent = sanitizeAssistantText(full);
      try {
        const saved = await prisma.message.create({
          data: { conversationId: convId!, role: "assistant", content: cleanContent },
        });
        await prisma.conversation.update({ where: { id: convId! }, data: { updatedAt: new Date() } });
        await stream.writeSSE({
          data: ssePayload({
            type: "done",
            conversationId: convId,
            messageId: saved.id,
            content: cleanContent,
            followUpPrompts: followUps,
          }),
        });
      } catch {
        await stream.writeSSE({ data: ssePayload({ type: "error", error: "persist_failed" }) });
      }
    } catch {
      await rollbackFailedChatTurn();
      await stream.writeSSE({ data: ssePayload({ type: "error", error: "chat_failed" }) });
    }
  });
});

api.post("/people/compatibility/message", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  try {
    const raw = z
      .object({
        message: z.string().min(1).max(8000).optional(),
        content: z.string().min(1).max(8000).optional(),
        conversationId: z.string().optional(),
        sessionId: z.string().nullable().optional(),
        personProfileId: z.string().min(1),
      })
      .merge(chatVoiceMetadataSchema)
      .parse(await c.req.json());
    const message = (raw.content ?? raw.message ?? "").trim();
    if (!message) return c.json({ error: "message_required" }, 400);
    const personProfileId = raw.personProfileId;
    const conversationId = raw.sessionId ?? raw.conversationId;

    const [premium, userWithProfile] = await Promise.all([
      hasFeatureAccess(firebaseUid, dbId),
      prisma.user.findUnique({ where: { id: dbId }, include: { birthProfile: true } }),
    ]);
    const bp = userWithProfile?.birthProfile ?? null;
    const tz = bp?.birthTimezone ?? "UTC";
    if (!bp) return c.json({ error: "onboarding_required" }, 422);

    if (!premium) {
      const used = await dailyChatCount(dbId, tz);
      if (used >= 3) return c.json({ error: "free_limit", used, limit: 3 }, 402);
    }

    const personProfile = await prisma.peopleProfile.findFirst({
      where: { id: personProfileId, userId: dbId, deletedAt: null },
    });
    if (!personProfile) return c.json({ error: "Person profile not found" }, 404);

    const report = await prisma.compatibilityReport.findUnique({
      where: { userId_personProfileId: { userId: dbId, personProfileId } },
    });

    let convId = conversationId ?? undefined;
    let createdNewConversation = false;
    if (convId) {
      const existing = await prisma.conversation.findFirst({ where: { id: convId, userId: dbId } });
      if (!existing || existing.personProfileId !== personProfileId) {
        return c.json({ error: "invalid_conversation" }, 400);
      }
    } else {
      const existingCompat = await prisma.conversation.findFirst({
        where: { userId: dbId, personProfileId, category: "romantic_compatibility" },
      });
      if (existingCompat) convId = existingCompat.id;
      else {
        const conv = await prisma.conversation.create({
          data: {
            userId: dbId,
            personProfileId,
            category: "romantic_compatibility",
            title: `Compatibility: ${personProfile.name}`.slice(0, 120),
          },
        });
        convId = conv.id;
        createdNewConversation = true;
      }
    }

    const userMessage = await prisma.message.create({
      data: {
        conversationId: convId!,
        role: "user",
        content: message,
        ...messageVoiceData(raw),
      },
    });
    if (!premium) await incrChatCount(dbId, tz);

    const rollbackFailedChatTurn = async () => {
      await prisma.message.delete({ where: { id: userMessage.id } }).catch(() => {});
      if (createdNewConversation) {
        const n = await prisma.message.count({ where: { conversationId: convId! } });
        if (n === 0) await prisma.conversation.delete({ where: { id: convId! } }).catch(() => {});
      }
      if (!premium) await decrChatCount(dbId, tz);
    };

    if (!process.env.ANTHROPIC_API_KEY) {
      return c.json({ response: "AI unavailable.", followUpPrompts: [], conversationId: convId });
    }

    const sseLang = userWithProfile?.language === "en" ? "en" : "fa";
    const userName = userWithProfile
      ? getDisplayName(userWithProfile, userWithProfile.language ?? "fa")
      : "there";
    const personName = personProfile.name.trim();
    const personEstimateNote = personProfile.hasFullData
      ? "Full birth data on file."
      : "Estimated Sun sign from birth date only.";
    let reportBlock = "No saved compatibility report yet.";
    if (report) {
      reportBlock = `Scores: overall ${report.overallScore}%, emotional ${report.emotionalScore}%, attraction ${report.attractionScore}%, communication ${report.communicationScore}%, long-term ${report.longTermScore}%, harmony ${report.conflictScore}%.`;
    }
    const system = buildPeopleCompatibilityChatSystem({
      userName,
      personName,
      userSun: bp.sunSign,
      userMoon: bp.moonSign,
      userRising: bp.risingSign ?? "Unknown",
      personEstimateNote,
      reportBlock,
      relationshipType: personProfile.relationshipType,
      language: sseLang,
    });

    const historyRows = await prisma.message.findMany({
      where: { conversationId: convId! },
      orderBy: { createdAt: "desc" },
      take: CHAT_HISTORY_LIMIT,
      select: { role: true, content: true },
    });
    const historyMessages = historyRows.reverse().map((m) => ({ role: m.role, content: m.content }));
    const llmMessages = [{ role: "system" as const, content: system }, ...historyMessages];

    const result = await generateCompletion({
      feature: "compatibility_chat_people",
      complexity: "deep",
      messages: llmMessages,
      safety: { mode: "check", userId: dbId, text: message },
      timeoutMs: 45_000,
      maxRetries: 0,
    });

    if (result.kind === "unsafe") {
      const cleanSafe = sanitizeAssistantText(result.safeResponse ?? "I can't process this safely.");
      if (!premium) await decrChatCount(dbId, tz);
      await prisma.message.create({ data: { conversationId: convId!, role: "assistant", content: cleanSafe } });
      await prisma.conversation.update({ where: { id: convId! }, data: { updatedAt: new Date() } });
      return c.json({ response: cleanSafe, followUpPrompts: [], conversationId: convId });
    }
    if (result.kind === "error") {
      await rollbackFailedChatTurn();
      return c.json({ error: "chat_failed" }, 502);
    }

    let full = result.content;
    let followUps: string[] = [];
    const followUpSplit = full.split("---FOLLOW_UPS---");
    if (followUpSplit.length > 1) {
      full = followUpSplit[0]!.trim();
      followUps = followUpSplit[1]!
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    }
    const cleanContent = sanitizeAssistantText(full);
    await prisma.message.create({ data: { conversationId: convId!, role: "assistant", content: cleanContent } });
    await prisma.conversation.update({ where: { id: convId! }, data: { updatedAt: new Date() } });
    return c.json({ response: cleanContent, followUpPrompts: followUps, conversationId: convId });
  } catch (e) {
    if (e instanceof z.ZodError) return c.json({ error: "Invalid input" }, 400);
    console.error("[people/compatibility/message]", e);
    return c.json({ error: "chat_failed" }, 500);
  }
});

api.get("/people/:id", async (c) => {
  const dbId = c.get("dbUserId");
  const id = c.req.param("id");
  try {
    const profile = await prisma.peopleProfile.findFirst({
      where: { id, userId: dbId, deletedAt: null },
    });
    if (!profile) return c.json({ error: "Not found" }, 404);
    return c.json({ profile });
  } catch (e) {
    console.error("[people] get:", e);
    return c.json({ error: "Failed to load profile" }, 500);
  }
});

api.put("/people/:id", async (c) => {
  const dbId = c.get("dbUserId");
  const id = c.req.param("id");
  try {
    const existing = await prisma.peopleProfile.findFirst({
      where: { id, userId: dbId, deletedAt: null },
    });
    if (!existing) return c.json({ error: "Not found" }, 404);
    const body = updatePeopleProfileSchema.parse(await c.req.json());
    const mergedBirthTime = body.birthTime !== undefined ? body.birthTime : existing.birthTime;
    const mergedLat = body.birthLat !== undefined ? body.birthLat : existing.birthLat;
    const mergedLong = body.birthLong !== undefined ? body.birthLong : existing.birthLong;
    const mergedTz = body.birthTimezone !== undefined ? body.birthTimezone : existing.birthTimezone;
    const hasFullData = !!(mergedBirthTime && mergedLat != null && mergedLong != null && mergedTz);

    const birthChanged =
      body.birthDate !== undefined ||
      body.birthTime !== undefined ||
      body.birthLat !== undefined ||
      body.birthLong !== undefined ||
      body.birthTimezone !== undefined;

    let nextNatalChart: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined = undefined;
    if (birthChanged && hasFullData) {
      try {
        const birthDateStr =
          body.birthDate ?? existing.birthDate.toISOString().split("T")[0]!;
        const chart = computeNatalChart({
          birthDate: birthDateStr,
          birthTime: mergedBirthTime ?? null,
          birthLat: mergedLat!,
          birthLong: mergedLong!,
          birthTimezone: mergedTz!,
        });
        nextNatalChart = {
          planets: chart.planets,
          aspects: chart.aspects,
          jdUt: chart.jdUt,
          jdEt: chart.jdEt,
        };
      } catch (e) {
        console.warn("[people] chart recompute failed:", e instanceof Error ? e.message : String(e));
      }
    } else if (birthChanged && !hasFullData) {
      nextNatalChart = Prisma.JsonNull;
    }

    const updated = await prisma.peopleProfile.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.relationshipType !== undefined && { relationshipType: body.relationshipType }),
        ...(body.birthDate !== undefined && { birthDate: new Date(body.birthDate) }),
        ...(body.birthTime !== undefined && { birthTime: body.birthTime }),
        ...(body.birthPlace !== undefined && { birthPlace: body.birthPlace }),
        ...(body.birthLat !== undefined && { birthLat: body.birthLat }),
        ...(body.birthLong !== undefined && { birthLong: body.birthLong }),
        ...(body.birthTimezone !== undefined && { birthTimezone: body.birthTimezone }),
        hasFullData,
        ...(nextNatalChart !== undefined ? { natalChartJson: nextNatalChart } : {}),
      },
      select: {
        id: true,
        name: true,
        relationshipType: true,
        birthDate: true,
        hasFullData: true,
      },
    });
    return c.json({ success: true, profile: updated });
  } catch (e) {
    if (e instanceof z.ZodError) return c.json({ error: "Invalid input", details: e.flatten() }, 400);
    console.error("[people] update:", e);
    return c.json({ error: "Failed to update profile" }, 500);
  }
});

api.delete("/people/:id", async (c) => {
  const dbId = c.get("dbUserId");
  const id = c.req.param("id");
  try {
    const existing = await prisma.peopleProfile.findFirst({
      where: { id, userId: dbId, deletedAt: null },
    });
    if (!existing) return c.json({ error: "Not found" }, 404);
    await prisma.peopleProfile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return c.json({ success: true });
  } catch (e) {
    console.error("[people] delete:", e);
    return c.json({ error: "Failed to delete profile" }, 500);
  }
});

/** ---------- Compatibility (legacy CompatibilityProfile) ---------- */
api.post("/compatibility/report", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasFeatureAccess(firebaseUid, dbId))) {
    return c.json({ error: "premium_required" }, 402);
  }
  const { profileId } = z.object({ profileId: z.string() }).parse(await c.req.json());
  const self = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  const partner = await prisma.compatibilityProfile.findFirst({
    where: { id: profileId, userId: dbId },
  });
  if (!self || !partner) return c.json({ error: "Not found" }, 404);

  const a = extractLongitudes(self.natalChartJson);
  const b = extractLongitudes(partner.natalChartJson);
  const score = synastryScore(a, b);

  if (partner.reportCache) {
    return c.json({ score, report: partner.reportCache });
  }

  let report: Record<string, unknown> = { sections: [] };
  if (process.env.ANTHROPIC_API_KEY) {
    const ctx = await assembleContext(dbId, false);
    let synLines: string[] = [];
    try {
      const chartSelf = self.natalChartJson as NatalChartData;
      const chartPartner = partner.natalChartJson as NatalChartData;
      synLines = getSynastryAspects(chartSelf, chartPartner)
        .slice(0, 16)
        .map((x) => `${x.aPlanet} ${x.type} ${x.bPlanet}`);
    } catch {
      synLines = [];
    }
    const pChart = partner.natalChartJson as {
      sunSign?: string;
      moonSign?: string;
      risingSign?: string | null;
    };
    const { system, user } = buildCompatibilityPrompt(
      ctx,
      {
        name: partner.name,
        sunSign: pChart.sunSign ?? "Unknown",
        moonSign: pChart.moonSign ?? "Unknown",
        risingSign: pChart.risingSign ?? undefined,
      },
      synLines,
    );

    const result = await generateCompletion({
      feature: "compatibility_report",
      complexity: "deep",
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `${user} Pre-computed synastry score (0-100): ${score}. User longitudes: ${JSON.stringify(a)}. Partner longitudes: ${JSON.stringify(b)}.`,
        },
      ],
      safety: { mode: "check", userId: dbId, text: `compatibility_report:${profileId}` },
      timeoutMs: 25_000,
      maxRetries: 1,
    });

    if (result.kind === "success" && result.json && typeof result.json === "object") {
      report = sanitizeJsonStringFields(result.json) as Record<string, unknown>;
    }
  }

  await prisma.compatibilityProfile.update({
    where: { id: profileId },
    data: { reportCache: report as Prisma.InputJsonValue, synastryScore: score },
  });

  return c.json({ score, report });
});

function extractLongitudes(json: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const planets = (json as { planets?: { planet: string; longitude: number }[] })?.planets;
  planets?.forEach((p) => {
    out[p.planet] = p.longitude;
  });
  return out;
}

api.post("/compatibility/profile", async (c) => {
  const dbId = c.get("dbUserId");
  const body = z
    .object({
      name: z.string(),
      relationship: z.string(),
      birthDate: z.string(),
      birthTime: z.string().nullable(),
      birthCity: z.string(),
      birthLat: z.number(),
      birthLong: z.number(),
      birthTimezone: z.string(),
    })
    .parse(await c.req.json());

  const chart = computeNatalChart({
    birthDate: body.birthDate,
    birthTime: body.birthTime,
    birthLat: body.birthLat,
    birthLong: body.birthLong,
    birthTimezone: body.birthTimezone,
  });

  const prof = await prisma.compatibilityProfile.create({
    data: {
      userId: dbId,
      name: body.name,
      relationship: body.relationship,
      birthDate: new Date(body.birthDate),
      birthTime: body.birthTime,
      birthCity: body.birthCity,
      birthLat: body.birthLat,
      birthLong: body.birthLong,
      birthTimezone: body.birthTimezone,
      natalChartJson: {
        planets: chart.planets,
        aspects: chart.aspects,
        jdUt: chart.jdUt,
        jdEt: chart.jdEt,
      },
      synastryScore: null,
    },
  });

  const self = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  const score = self ? synastryScore(extractLongitudes(self.natalChartJson), extractLongitudes(prof.natalChartJson)) : 50;

  await prisma.compatibilityProfile.update({
    where: { id: prof.id },
    data: { synastryScore: score },
  });

  return c.json({ id: prof.id, synastryScore: score });
});

api.get("/compatibility/profiles", async (c) => {
  const dbId = c.get("dbUserId");
  const rows = await prisma.compatibilityProfile.findMany({
    where: { userId: dbId },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ profiles: rows });
});

/** ---------- Notifications ---------- */
api.post("/notifications/register", async (c) => {
  const dbId = c.get("dbUserId");
  const { token, enabled } = z
    .object({ token: z.string().min(10), enabled: z.boolean().optional() })
    .parse(await c.req.json());
  await prisma.user.update({
    where: { id: dbId },
    data: {
      pushToken: token,
      notificationPreferences: enabled ?? true,
    },
  });
  return c.json({ ok: true });
});

api.post("/user/fcm-token", async (c) => {
  const dbId = c.get("dbUserId");
  const { token, platform } = z
    .object({ token: z.string().min(10), platform: z.string().min(1) })
    .parse(await c.req.json());
  await prisma.fcmToken.upsert({
    where: { token },
    create: { userId: dbId, token, platform },
    update: { userId: dbId, platform },
  });
  return c.json({ success: true });
});

/** ---------- Subscription ---------- */
/**
 * Lightweight access snapshot for clients. Does not mutate the database.
 * `hasAccess` uses RevenueCat (native) + DB trial/Stripe active (same as API feature gates).
 */
api.get("/subscription/status", async (c) => {
  console.log("[subscription/status] CANARY v2", new Date().toISOString(), {
    userId: c.get("dbUserId") ?? "no-dbUserId",
  });
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  try {
    const user = await prisma.user.findUnique({
      where: { id: dbId },
      select: {
        id: true,
        subscriptionStatus: true,
        trialStartedAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        premiumExpiresAt: true,
        premiumUnlimited: true,
      },
    });
    if (!user) {
      return c.json({ hasAccess: false, error: "User not found" }, 404);
    }

    // Backfill premiumExpiresAt if missing for active Stripe subscribers
    if (
      user.subscriptionStatus === "active" &&
      !user.premiumExpiresAt &&
      user.stripeCustomerId &&
      stripe
    ) {
      console.log("[subscription/status] backfilling premiumExpiresAt for user:", user.id);
      try {
        const subs = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: "active",
          limit: 1,
        });
        if (subs.data.length > 0 && subs.data[0]) {
          const sub0 = subs.data[0];
          const periodEnd = subscriptionCurrentPeriodEndUnix(sub0);
          const subId = sub0.id;
          if (typeof periodEnd === "number" && periodEnd > 0) {
            const expiry = new Date(periodEnd * 1000);
            await prisma.user.update({
              where: { id: user.id },
              data: {
                premiumExpiresAt: expiry,
                stripeSubscriptionId: subId,
              },
            });
            user.premiumExpiresAt = expiry;
            user.stripeSubscriptionId = subId;
            console.log("[subscription/status] backfill complete:", { expiry, subId });
          }
        } else {
          console.log("[subscription/status] no active Stripe subs found for customer:", user.stripeCustomerId);
        }
      } catch (backfillErr) {
        console.error("[subscription/status] backfill error:", backfillErr);
      }
    }

    const trialDaysLeft = computeTrialDaysLeft(user.trialStartedAt);
    const trialActive = trialDaysLeft > 0;
    const hasAccess = await hasFeatureAccess(firebaseUid, dbId);

    const isAdminPremium =
      user.subscriptionStatus === "premium" || Boolean(user.premiumUnlimited);
    const isStripePremium = user.subscriptionStatus === "active";
    const isPremium = isAdminPremium || isStripePremium;

    let premiumDaysLeft: number | null = null;
    let resolvedPremiumExpiresAt = user.premiumExpiresAt;

    // For active Stripe subscribers, always fetch current period end live
    // This is the source of truth — DB is just a cache
    if (user.subscriptionStatus === "active" && user.stripeCustomerId && stripe) {
      try {
        const subs = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: "active",
          limit: 1,
        });

        const activeSub = subs.data[0];
        if (activeSub) {
          const periodEnd = subscriptionCurrentPeriodEndUnix(activeSub);
          if (typeof periodEnd === "number" && periodEnd > 0) {
            resolvedPremiumExpiresAt = new Date(periodEnd * 1000);

            // Persist to DB in background — don't await
            void prisma.user
              .update({
                where: { id: dbId },
                data: {
                  premiumExpiresAt: resolvedPremiumExpiresAt,
                  stripeSubscriptionId: activeSub.id,
                },
              })
              .catch((e) => console.warn("[subscription/status] bg update failed:", e));

            console.log("[subscription/status] live Stripe period end:", resolvedPremiumExpiresAt);
          }
        } else {
          console.warn("[subscription/status] no active Stripe sub for customer:", user.stripeCustomerId);
        }
      } catch (stripeErr) {
        console.warn("[subscription/status] Stripe fetch failed, using DB value:", stripeErr);
        // Fall through to DB value
      }
    }

    if (resolvedPremiumExpiresAt && !user.premiumUnlimited) {
      const msLeft = resolvedPremiumExpiresAt.getTime() - Date.now();
      premiumDaysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    }

    const premiumUnlimitedFlag = user.premiumUnlimited ?? false;

    return c.json({
      hasAccess,
      trialActive,
      trialDaysLeft,
      trialStartedAt: user.trialStartedAt,
      subscriptionStatus: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId,
      isPremium,
      premiumUnlimited: premiumUnlimitedFlag,
      premiumExpiresAt: resolvedPremiumExpiresAt,
      premiumDaysLeft,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[subscription/status]", msg);
    return c.json({ hasAccess: false, error: msg }, 500);
  }
});

/**
 * Claim the 7-day free trial (web + native DB-backed trial).
 * Idempotent: calling again after trial is already claimed returns success without overwriting.
 * Never downgrades users who are already premium or Stripe-active.
 */
api.post("/subscription/claim-trial", async (c) => {
  const firebaseUser = c.get("firebaseUser");
  const dbId = c.get("dbUserId");

  const user = await prisma.user.findUnique({
    where: { id: dbId },
    select: {
      email: true,
      name: true,
      stripeCustomerId: true,
      trialStartedAt: true,
      subscriptionStatus: true,
      premiumUnlimited: true,
    },
  });

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Never downgrade premium or active subscribers
  if (
    user.subscriptionStatus === "premium" ||
    user.subscriptionStatus === "active" ||
    user.premiumUnlimited
  ) {
    const hasAccess = await hasFeatureAccess(firebaseUser.uid, dbId);
    return c.json({
      success: true,
      alreadyPremium: true,
      hasAccess,
    });
  }

  // Create Stripe customer if Stripe is configured and user has no record yet
  let stripeCustomerId = user.stripeCustomerId ?? null;

  if (stripe && !stripeCustomerId) {
    try {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        metadata: {
          firebaseUid: firebaseUser.uid,
          userId: dbId,
          source: "free_trial",
        },
      });
      stripeCustomerId = customer.id;
      console.log("[claim-trial] Stripe customer created:", {
        customerId: customer.id,
        email: user.email,
        uid: firebaseUser.uid,
      });
    } catch (stripeError: unknown) {
      const msg =
        stripeError instanceof Error ? stripeError.message : String(stripeError);
      // Never block trial on Stripe failure — user still gets their trial
      console.warn("[claim-trial] Stripe customer creation failed:", msg);
    }
  }

  if (stripeCustomerId && stripeCustomerId !== user.stripeCustomerId) {
    await prisma.user.update({
      where: { id: dbId },
      data: { stripeCustomerId },
    });
  }

  await autoStartTrialIfEligible(prisma, dbId);

  const after = await prisma.user.findUnique({
    where: { id: dbId },
    select: { trialStartedAt: true, subscriptionStatus: true, stripeCustomerId: true },
  });

  console.log("[subscription] claim-trial after autoStart:", {
    uid: firebaseUser.uid,
    trialStartedAt: after?.trialStartedAt,
    stripeCustomerId: after?.stripeCustomerId,
  });

  return c.json({
    success: true,
    trialStartedAt: after?.trialStartedAt,
    hasAccess: await hasFeatureAccess(firebaseUser.uid, dbId),
  });
});

/**
 * Creates a Stripe Checkout Session for the web paywall.
 * Called by the frontend paywall screen after the 7-day trial expires.
 * Web-only — native users go through RevenueCat/Apple/Google IAP.
 *
 * Does NOT apply trial check middleware — expired trial users must be
 * able to reach this endpoint to subscribe.
 */
api.post("/subscription/create-checkout-session", async (c) => {
  const firebaseUser = c.get("firebaseUser");
  const dbId = c.get("dbUserId");

  /** Allowed Stripe price IDs: env default plus known web catalog prices (client sends one in body). */
  const WEB_STRIPE_PRICE_MONTHLY = "price_1TG884Rv8vuaHOxlRFbLpO5y";
  const WEB_STRIPE_PRICE_ANNUAL = "price_1TJR2VRv8vuaHOxlVYdKbnwU";
  const allowedPriceIds = new Set(
    [process.env.STRIPE_PRICE_ID, WEB_STRIPE_PRICE_MONTHLY, WEB_STRIPE_PRICE_ANNUAL].filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    ),
  );

  let requestedPriceId: string | undefined;
  try {
    const body = (await c.req.json()) as { priceId?: unknown };
    if (typeof body?.priceId === "string" && body.priceId.length > 0) {
      requestedPriceId = body.priceId;
    }
  } catch {
    /* no JSON body — use default price */
  }

  const priceIdToUse =
    requestedPriceId && allowedPriceIds.has(requestedPriceId)
      ? requestedPriceId
      : process.env.STRIPE_PRICE_ID;

  console.log("[checkout] called by:", firebaseUser?.uid);
  console.log("[checkout] stripe available:", !!stripe);
  console.log("[checkout] price ID:", priceIdToUse?.slice(0, 15));

  if (!stripe) {
    return c.json({ error: "Payment not configured" }, 503);
  }

  if (!priceIdToUse) {
    console.error("[stripe] no valid STRIPE_PRICE_ID or priceId in request");
    return c.json({ error: "Payment not configured" }, 503);
  }

  const user = await prisma.user.findUnique({
    where: { id: dbId },
    select: { email: true, stripeCustomerId: true },
  });

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Resolve or create a single Stripe customer for this user
  let stripeCustomerId = user.stripeCustomerId ?? null;

  if (!stripeCustomerId && user.email) {
    // Search for an existing Stripe customer with this email first
    const existing = await stripe.customers.list({ email: user.email, limit: 1 });
    if (existing.data.length > 0 && existing.data[0]) {
      stripeCustomerId = existing.data[0].id;
      console.log("[checkout] found existing Stripe customer:", stripeCustomerId);
    } else {
      // Create a new customer — only if none exists
      const created = await stripe.customers.create({
        email: user.email,
        metadata: { firebaseUid: firebaseUser.uid, dbUserId: dbId },
      });
      stripeCustomerId = created.id;
      console.log("[checkout] created new Stripe customer:", stripeCustomerId);
    }
    // Persist so future sessions reuse this customer
    await prisma.user.update({
      where: { id: dbId },
      data: { stripeCustomerId },
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      customer: stripeCustomerId ?? undefined,
      customer_email: stripeCustomerId ? undefined : (user.email ?? undefined),
      line_items: [{ price: priceIdToUse, quantity: 1 }],
      success_url: "https://app.akhtar.today/subscription/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://app.akhtar.today/subscription/cancelled",
      client_reference_id: dbId,
      metadata: {
        userId: dbId,
        firebaseUid: c.get("firebaseUid") ?? firebaseUser.uid,
      },
    });

    console.log("[stripe] checkout session created:", {
      uid: firebaseUser.uid,
      sessionId: session.id,
    });

    return c.json({ url: session.url, sessionId: session.id });
  } catch (error: unknown) {
    const err = error as { message?: string; type?: string; code?: string; raw?: unknown };
    console.error("[checkout] Stripe error:", {
      message: err.message,
      type: err.type,
      code: err.code,
      stripeError: err.raw,
    });
    return c.json({
      error: "Could not create checkout session",
      details: err.message,
    }, 500);
  }
});

/**
 * Opens a Stripe Customer Portal session for the authenticated user.
 *
 * Two response shapes:
 *   { hasStripeAccount: false, subscriptionStatus, trialStartedAt }
 *     → user has never subscribed via Stripe; frontend should show checkout flow
 *   { hasStripeAccount: true, portalUrl }
 *     → redirect user to Stripe-hosted portal to manage their subscription
 */
api.post("/billing/portal", async (c) => {
  const dbId = c.get("dbUserId");

  if (!stripe) {
    return c.json({ error: "Payment not configured" }, 503);
  }

  const user = await prisma.user.findUnique({
    where: { id: dbId },
    select: {
      email: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      trialStartedAt: true,
    },
  });

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  if (!user.stripeCustomerId) {
    return c.json({
      hasStripeAccount: false,
      subscriptionStatus: user.subscriptionStatus,
      trialStartedAt: user.trialStartedAt,
    });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: "https://app.akhtar.today/settings",
    });
    return c.json({ hasStripeAccount: true, portalUrl: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[billing/portal] Stripe error:", msg);
    return c.json({ error: "Could not open billing portal", details: msg }, 500);
  }
});

/** ---------- Cosmic card ---------- */
api.post("/cosmic-card/generate", async (c) => {
  const dbId = c.get("dbUserId");
  const { type } = z
    .object({
      type: z.enum(["birth-chart", "daily-insight", "compatibility"]),
    })
    .parse(await c.req.json());
  const user = await prisma.user.findUnique({
    where: { id: dbId },
    include: { birthProfile: true },
  });
  if (!user?.birthProfile) return c.json({ error: "No profile" }, 404);

  await mkdir(storageDir, { recursive: true });
  const id = `${dbId}-${Date.now()}.png`;
  const filePath = join(storageDir, id);

  const sharp = (await import("sharp")).default;
  const lines = [
    "Astra Coach",
    user.name,
    `${user.birthProfile.sunSign} Sun · ${user.birthProfile.moonSign} Moon`,
    type,
    new Date().toISOString().slice(0, 10),
  ];
  const svg = `<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#0f172a"/>
    <text x="60" y="200" fill="#e2e8f0" font-size="48" font-family="sans-serif">${escapeXml(lines.join(" · "))}</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(filePath);

  const base = process.env.PUBLIC_API_BASE_URL ?? "";
  return c.json({ imageUrl: `${base}/files/${id}`, deepLink: "astrocoach://open" });
});

/** ---------- Webhooks ---------- */
const wh = new Hono();

/** Billing period end lives on the first subscription item, not top-level on Subscription. */
function subscriptionCurrentPeriodEndUnix(sub: object): number | undefined {
  const end = (sub as { items?: { data?: Array<{ current_period_end?: unknown }> } }).items?.data?.[0]
    ?.current_period_end;
  return typeof end === "number" && end > 0 ? end : undefined;
}

/**
 * Required Stripe webhook events (register in Stripe Dashboard → Developers → Webhooks):
 * - checkout.session.completed
 * - customer.subscription.deleted
 * - customer.subscription.updated
 * - invoice.payment_succeeded
 * - invoice.payment_failed (register in Dashboard; optional: invoice.payment_action_required)
 *
 * Stripe webhook endpoint — NO Firebase auth middleware.
 * Stripe cannot send Firebase ID tokens; signature verification is used instead.
 * Raw body must be read before any JSON parsing for signature verification.
 *
 * Events handled:
 *   checkout.session.completed      → activate subscription
 *   customer.subscription.deleted  → cancel subscription
 *   customer.subscription.updated  → sync subscription status
 *   invoice.payment_succeeded       → backup activate subscription (by Stripe customer)
 *   invoice.payment_failed          → revoke access when subscription is past_due / unpaid / canceled
 */
wh.post("/webhooks/stripe", async (c) => {
  if (!stripe) {
    return c.json({ error: "Stripe not configured" }, 503);
  }

  const rawBody = await c.req.text();
  const signature = c.req.header("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe/webhook] missing signature or webhook secret");
    return c.json({ error: "Webhook not configured" }, 503);
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/webhook] signature verification failed:", msg);
    return c.json({ error: "Invalid signature" }, 400);
  }

  console.log("[stripe/webhook] event verified:", { id: event.id, type: event.type });
  console.log("[stripe/webhook] event received:", event.type);

  switch (event.type) {
    case "checkout.session.completed": {
      try {
        const session = event.data.object as Stripe.Checkout.Session;
        const metaUserId = session.metadata?.userId || session.client_reference_id;
        const metaFirebaseUid = session.metadata?.firebaseUid || session.client_reference_id;
        const customerEmail = session.customer_details?.email ?? undefined;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : (session.customer as Stripe.Customer | null)?.id ?? undefined;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription as Stripe.Subscription | null)?.id ?? undefined;

        console.log("[webhook] checkout.session.completed", {
          metaUserId,
          metaFirebaseUid,
          customerEmail,
          customerId,
          subscriptionId,
        });

        // Fallback lookup chain: DB userId → firebaseUid → stripeCustomerId → email
        let targetUser = metaUserId
          ? await prisma.user.findUnique({ where: { id: metaUserId } })
          : null;

        if (!targetUser && metaFirebaseUid) {
          targetUser = await prisma.user.findUnique({ where: { firebaseUid: metaFirebaseUid } });
        }

        if (!targetUser && customerId) {
          targetUser = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
        }

        if (!targetUser && customerEmail) {
          targetUser = await prisma.user.findUnique({ where: { email: customerEmail } });
        }

        if (!targetUser) {
          console.error("[webhook] checkout.session.completed — NO USER FOUND", {
            metaUserId,
            metaFirebaseUid,
            customerEmail,
            customerId,
          });
          return c.json({ error: "User not found" }, 400);
        }

        console.log("[webhook] found user:", targetUser.id);

        // Get premiumExpiresAt from Stripe subscription
        let premiumExpiresAt: Date | undefined;
        if (subscriptionId) {
          try {
            const retrieved = await stripe!.subscriptions.retrieve(subscriptionId);
            const periodEnd = subscriptionCurrentPeriodEndUnix(retrieved);
            if (typeof periodEnd === "number" && periodEnd > 0) {
              premiumExpiresAt = new Date(periodEnd * 1000);
            }
          } catch (subErr) {
            console.error("[webhook] failed to retrieve subscription:", subErr);
          }
        }

        // ALWAYS update by user.id — never by firebaseUid
        await prisma.user.update({
          where: { id: targetUser.id },
          data: {
            subscriptionStatus: "active",
            ...(customerId ? { stripeCustomerId: customerId } : {}),
            ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
            ...(premiumExpiresAt ? { premiumExpiresAt, premiumUnlimited: false } : {}),
          },
        });

        console.log("[webhook] user updated successfully:", {
          userId: targetUser.id,
          premiumExpiresAt,
          stripeSubscriptionId: subscriptionId,
        });
      } catch (err) {
        console.error("[stripe/webhook] checkout.session.completed error:", err);
        return c.json({ error: "Webhook processing failed" }, 500);
      }
      break;
    }

    case "customer.subscription.deleted": {
      try {
        const subscription = event.data.object as Stripe.Subscription;

        const deletedResult = await prisma.user.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            subscriptionStatus: "cancelled",
            premiumExpiresAt: null,
            premiumUnlimited: false,
          },
        });

        console.log("[stripe/webhook] rows updated:", deletedResult.count);
        console.log("[stripe/webhook] subscription cancelled:", subscription.id);
      } catch (err) {
        console.error("[stripe/webhook] customer.subscription.deleted error:", err);
        return c.json({ error: "Webhook processing failed" }, 500);
      }
      break;
    }

    case "customer.subscription.updated": {
      try {
        const subscription = event.data.object as Stripe.Subscription;
        const status =
          subscription.status === "active"
            ? "active"
            : subscription.status === "canceled"
              ? "cancelled"
              : subscription.status === "past_due" || subscription.status === "unpaid"
                ? "free"
                : "free";

        console.log("[stripe/webhook] customer.subscription.updated:", {
          subscriptionId: subscription.id,
          stripeStatus: subscription.status,
          mappedStatus: status,
        });

        const periodEndUnix = subscriptionCurrentPeriodEndUnix(subscription);
        const updatedResult = await prisma.user.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data:
            status === "active"
              ? {
                  subscriptionStatus: status,
                  ...(periodEndUnix !== undefined
                    ? { premiumExpiresAt: new Date(periodEndUnix * 1000) }
                    : {}),
                }
              : {
                  subscriptionStatus: status,
                  premiumExpiresAt: null,
                  premiumUnlimited: false,
                },
        });

        console.log("[stripe/webhook] rows updated:", updatedResult.count);
        console.log("[stripe/webhook] subscription updated:", {
          id: subscription.id,
          status,
        });
      } catch (err) {
        console.error("[stripe/webhook] customer.subscription.updated error:", err);
        return c.json({ error: "Webhook processing failed" }, 500);
      }
      break;
    }

    case "invoice.payment_succeeded": {
      try {
        /** Webhook JSON still includes `subscription`; Stripe typings may use `parent` instead. */
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : (invoice.subscription as Stripe.Subscription | null)?.id;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : (invoice.customer as Stripe.Customer | null)?.id;

        if (!subscriptionId || !customerId) {
          console.log("[stripe/webhook] invoice.payment_succeeded: missing ids", {
            subscriptionId,
            customerId,
          });
          break;
        }

        console.log("[stripe/webhook] invoice.payment_succeeded:", {
          subscriptionId,
          customerId,
          invoiceId: invoice.id,
        });

        const retrieved = await stripe!.subscriptions.retrieve(subscriptionId);
        const periodEnd = subscriptionCurrentPeriodEndUnix(retrieved);
        if (periodEnd === undefined) {
          console.error(
            "[stripe/webhook] invoice.payment_succeeded: missing current_period_end on subscription item",
          );
          return c.json({ error: "Webhook processing failed" }, 500);
        }
        const premiumExpiresAt = new Date(periodEnd * 1000);

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: "active",
            stripeSubscriptionId: subscriptionId,
            premiumExpiresAt,
            premiumUnlimited: false,
          },
        });
        console.log("[stripe/webhook] subscription activated via invoice:", subscriptionId);
      } catch (err) {
        console.error("[stripe/webhook] invoice.payment_succeeded error:", err);
        return c.json({ error: "Webhook processing failed" }, 500);
      }
      break;
    }

    case "invoice.payment_failed": {
      try {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : (invoice.subscription as Stripe.Subscription | null)?.id ?? null;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : (invoice.customer as Stripe.Customer | null)?.id ?? null;

        console.log("[stripe/webhook] invoice.payment_failed:", {
          invoiceId: invoice.id,
          subscriptionId,
          customerId,
          attemptCount: invoice.attempt_count,
          nextPaymentAttempt: invoice.next_payment_attempt,
        });

        if (!subscriptionId) {
          console.error("[stripe/webhook] invoice.payment_failed: no subscriptionId");
          break;
        }

        // Retrieve the subscription to get current state
        const sub = await stripe!.subscriptions.retrieve(subscriptionId);
        const subStatus = sub.status;

        console.log("[stripe/webhook] invoice.payment_failed subscription status:", subStatus);

        // Only revoke access if Stripe has marked the subscription as past_due or unpaid
        // Stripe retries for ~48 hours before marking as past_due/unpaid
        // We revoke access when status is no longer "active"
        if (subStatus === "past_due" || subStatus === "unpaid" || subStatus === "canceled") {
          if (customerId) {
            await prisma.user.updateMany({
              where: { stripeCustomerId: customerId },
              data: {
                subscriptionStatus: subStatus === "canceled" ? "cancelled" : "free",
                ...(subStatus === "canceled"
                  ? { premiumExpiresAt: null, premiumUnlimited: false }
                  : {}),
              },
            });
            console.log("[stripe/webhook] access revoked due to payment failure:", {
              customerId,
              newStatus: subStatus === "canceled" ? "cancelled" : "free",
            });
          }
        }
        // If status is still "active" — Stripe hasn't given up yet, keep access
      } catch (err) {
        console.error("[stripe/webhook] invoice.payment_failed error:", err);
      }
      break;
    }

    default:
      console.log("[stripe/webhook] unhandled event:", event.type);
  }

  return c.json({ received: true });
});

wh.post("/webhooks/revenuecat", async (c) => {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET?.trim();
  const raw = await c.req.text();
  if (!secret) {
    return c.json({ error: "webhook not configured" }, 503);
  }
  if (c.req.header("authorization") !== `Bearer ${secret}`) {
    return c.json({ error: "unauthorized" }, 401);
  }
  let body: { event?: { type?: string; app_user_id?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return c.json({ error: "bad json" }, 400);
  }
  const t = body.event?.type;
  const uid = body.event?.app_user_id;
  if ((t === "CANCELLATION" || t === "EXPIRATION") && uid) {
    const user = await prisma.user.findUnique({ where: { firebaseUid: uid } });
    if (user) {
      await prisma.winBackSchedule.upsert({
        where: { userId: user.id },
        create: { userId: user.id, runAt: new Date(Date.now() + 86_400_000) },
        update: { runAt: new Date(Date.now() + 86_400_000), processed: false },
      });
    }
  }
  return c.json({ ok: true });
});

app.route("/api", wh);
app.route("/api", mantraApp);
app.route("/api", api);

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** ---------- Places (Google) ---------- */
const placesApi = new Hono<{ Variables: Vars }>();
placesApi.use("*", requireFirebaseAuth);
placesApi.get("/places/autocomplete", async (c) => {
  const q = c.req.query("q") ?? "";
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || q.length < 2) return c.json({ predictions: [] });
  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", q);
  url.searchParams.set("types", "(cities)");
  url.searchParams.set("key", key);
  const res = await fetch(url);
  const data = (await res.json()) as { predictions?: { description: string; place_id: string }[] };
  return c.json({ predictions: data.predictions ?? [] });
});

placesApi.get("/places/details", async (c) => {
  const placeId = c.req.query("place_id");
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!placeId || !key) return c.json({ error: "bad_request" }, 400);
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "geometry,formatted_address,utc_offset");
  url.searchParams.set("key", key);
  const res = await fetch(url);
  const data = (await res.json()) as {
    result?: {
      geometry?: { location?: { lat: number; lng: number } };
      formatted_address?: string;
      utc_offset?: number;
    };
  };
  const r = data.result;
  if (!r?.geometry?.location) return c.json({ error: "not_found" }, 404);
  const lng = r.geometry.location.lng;
  const lat = r.geometry.location.lat;
  const zones = findTimeZone(lat, lng);
  const tzGuess = zones[0] ?? "UTC";
  return c.json({
    birthCity: r.formatted_address ?? "",
    birthLat: lat,
    birthLong: lng,
    birthTimezone: tzGuess,
    utcOffsetMinutes: r.utc_offset ?? 0,
  });
});

/** Free-text city → lat/lng/timezone (Geocoding API). Same response shape as /places/details. */
placesApi.get("/places/geocode", async (c) => {
  const address = c.req.query("address")?.trim() ?? "";
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!address || address.length < 2 || !key) return c.json({ error: "bad_request" }, 400);
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);
  const res = await fetch(url);
  const data = (await res.json()) as {
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: { lat: number; lng: number } };
    }>;
    status?: string;
  };
  const r = data.results?.[0];
  if (!r?.geometry?.location) return c.json({ error: "not_found" }, 404);
  const lat = r.geometry.location.lat;
  const lng = r.geometry.location.lng;
  const zones = findTimeZone(lat, lng);
  const tzGuess = zones[0] ?? "UTC";
  return c.json({
    birthCity: r.formatted_address ?? address,
    birthLat: lat,
    birthLong: lng,
    birthTimezone: tzGuess,
  });
});

app.route("/api", placesApi);

/** ---------- Dream ---------- */
const dream = new Hono<{ Variables: Vars }>();
dream.use("*", requireFirebaseAuth);
dream.post("/dream/interpret", async (c) => {
  console.log("[dream] handler called");
  try {
    const firebaseUid = c.get("firebaseUid");
    const dbId = c.get("dbUserId");
    if (!(await hasFeatureAccess(firebaseUid, dbId))) return c.json({ error: "premium_required" }, 402);

    const raw = (await c.req.json()) as { dreamDescription?: unknown; text?: unknown };
    const dreamTextRaw =
      typeof raw.dreamDescription === "string"
        ? raw.dreamDescription
        : typeof raw.text === "string"
          ? raw.text
          : "";
    const dreamParsed = z.string().min(10).max(2000).safeParse(dreamTextRaw.trim());
    if (!dreamParsed.success) {
      return c.json({ error: "invalid_dream_description" }, 400);
    }
    const dreamDescription = dreamParsed.data;

    const safety = await safetyClassifier(dbId, dreamDescription);
    if (!safety.isSafe) {
      return c.json(
        { error: "unsafe", flagType: safety.flagType, response: safety.safeResponse },
        200,
      );
    }

    const dreamUser = await prisma.user.findUnique({
      where: { id: dbId },
      include: { birthProfile: true },
    });
    console.log("[dream] firebaseUid:", firebaseUid);
    console.log("[dream] user found:", !!dreamUser);
    console.log("[dream] birthProfile found:", !!dreamUser?.birthProfile);
    console.log("[dream] birthDate:", dreamUser?.birthProfile?.birthDate ?? null);

    if (!dreamUser) {
      return c.json(
        { error: "user_not_found", message: "User not found. Please sign in again." },
        404,
      );
    }
    if (!dreamUser.birthProfile?.birthDate) {
      return c.json(
        {
          error: "birth_profile_required",
          message: "Complete your birth profile to use this feature.",
        },
        400,
      );
    }

    let ctx: Awaited<ReturnType<typeof assembleContext>>;
    try {
      ctx = await assembleContext(dbId, true);
    } catch (err: unknown) {
      console.error("[dream] assembleContext failed:", err);
      return c.json(
        {
          content:
            "We couldn't load your full chart context right now. Your dream still matters — please try again in a few minutes.",
          error: true,
        },
        200,
      );
    }

    const { system, user } = buildDreamInterpreterPrompt(ctx, dreamDescription);

    let content = "We couldn't generate an interpretation right now. Please try again in a moment.";

    if (process.env.ANTHROPIC_API_KEY) {
      const result = await generateCompletion({
        feature: "dream_interpret",
        complexity: "standard",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        safety: { mode: "result", result: safety },
        timeoutMs: 25_000,
        maxRetries: 1,
      });

      if (result.kind === "success" && result.content.trim()) {
        content = result.content.trim();
      } else if (result.kind === "unsafe") {
        content = result.safeResponse ?? content;
      }
    }

    content = sanitizeAssistantText(content);

    // Create a Conversation so follow-up messages have a valid FK target in the chat handler
    const conversation = await prisma.conversation.create({
      data: {
        userId: dbId,
        title: dreamDescription.slice(0, 60),
        category: "dream_interpreter",
      },
    });
    await prisma.message.create({
      data: { conversationId: conversation.id, role: "user", content: dreamDescription },
    });
    await prisma.message.create({
      data: { conversationId: conversation.id, role: "assistant", content },
    });

    // DreamEntry preserved for history / moderation purposes
    const entry = await prisma.dreamEntry.create({
      data: {
        userId: dbId,
        dreamText: dreamDescription,
        interpretation: { content } as object,
      },
    });

    return c.json({ content, sessionId: conversation.id, dreamEntryId: entry.id });
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string; name?: string };
    console.error("[dream] UNHANDLED ERROR:", {
      message: err?.message,
      stack: err?.stack?.split("\n").slice(0, 5),
      name: err?.name,
    });
    return c.json(
      {
        error: "Dream interpreter temporarily unavailable",
        message: err?.message ?? "Unexpected error",
        content:
          "Dream interpretation is temporarily unavailable. Please try again in a few minutes.",
      },
      200,
    );
  }
});

dream.get("/dream/recent", async (c) => {
  const dbId = c.get("dbUserId");
  const rows = await prisma.dreamEntry.findMany({
    where: { userId: dbId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return c.json({ entries: rows });
});

app.route("/api", dream);

app.route("/api/tarot", tarotApp);

/** ---------- Journal ---------- */
const journal = new Hono<{ Variables: Vars }>();
journal.use("*", requireFirebaseAuth);

journal.get("/journal/prompt", async (c) => {
  const dbId = c.get("dbUserId");
  const key = `jp:${dbId}`;
  if (redis) {
    const hit = await redis.get(key);
    if (hit) return c.json({ prompt: hit });
  }
  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  let prompt = "What felt most alive in your heart today?";
  if (process.env.ANTHROPIC_API_KEY) {
    const result = await generateCompletion({
      feature: "journal_prompt",
      complexity: "lightweight",
      messages: [
        {
          role: "user",
          content: `One journal prompt for ${bp?.sunSign} Sun, ${bp?.moonSign} Moon. Single sentence.`,
        },
      ],
      safety: { mode: "check", userId: dbId, text: `journal_prompt:${bp?.sunSign}:${bp?.moonSign}` },
      timeoutMs: 25_000,
      maxRetries: 1,
    });

    if (result.kind === "success" && result.content.trim()) {
      prompt = result.content;
    } else if (result.kind === "unsafe") {
      prompt = result.safeResponse ?? prompt;
    }
  }
  if (redis) await redis.set(key, prompt, "EX", 86_400);
  return c.json({ prompt });
});

async function weeklyJournalCount(userId: string): Promise<number> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  return prisma.journalEntry.count({
    where: { userId, createdAt: { gte: weekAgo } },
  });
}

journal.post("/journal/entry", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  const premium = await hasFeatureAccess(firebaseUid, dbId);
  if (!premium) {
    const w = await weeklyJournalCount(dbId);
    if (w >= 3) return c.json({ error: "free_weekly_limit" }, 402);
  }
  const body = z
    .object({
      content: z.string().min(1).max(20000),
      moodTag: z.string().optional(),
      promptUsed: z.string().optional(),
    })
    .parse(await c.req.json());

  const entry = await prisma.journalEntry.create({
    data: {
      userId: dbId,
      content: body.content,
      moodTag: body.moodTag,
      promptUsed: body.promptUsed,
    },
  });
  if (redis) {
    const sk = `streak:${dbId}`;
    const n = await redis.incr(sk);
    if (n === 1) await redis.expire(sk, 172_800);
  }
  return c.json({ ok: true, id: entry.id });
});

journal.get("/journal/entries", async (c) => {
  const dbId = c.get("dbUserId");
  const rows = await prisma.journalEntry.findMany({
    where: { userId: dbId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return c.json({ entries: rows });
});

app.route("/api", journal);

/** PATCH /api/user/notification-preferences — registered after mantra (plan) */
const userNotificationPrefs = new Hono<{ Variables: Vars }>();
userNotificationPrefs.use("*", requireFirebaseAuth);
userNotificationPrefs.patch("/user/notification-preferences", async (c) => {
  const dbId = c.get("dbUserId");
  try {
    const body = z
      .object({
        dailyHoroscope: z.boolean().optional(),
        dailyMantra: z.boolean().optional(),
      })
      .parse(await c.req.json());
    const updated = await prisma.notificationPreference.upsert({
      where: { userId: dbId },
      create: {
        userId: dbId,
        dailyHoroscope: body.dailyHoroscope ?? true,
        dailyMantra: body.dailyMantra ?? false,
      },
      update: {
        ...(body.dailyHoroscope !== undefined ? { dailyHoroscope: body.dailyHoroscope } : {}),
        ...(body.dailyMantra !== undefined ? { dailyMantra: body.dailyMantra } : {}),
      },
    });
    return c.json(updated);
  } catch (e: unknown) {
    console.error("[notification-preferences]", e);
    return c.json({ error: "Something went wrong. Please try again." }, 500);
  }
});
app.route("/api", userNotificationPrefs);

/** ---------- Conversations / history ---------- */
const conv = new Hono<{ Variables: Vars }>();
conv.use("*", requireFirebaseAuth);

conv.get("/conversations", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  const premium = await hasFeatureAccess(firebaseUid, dbId);
  const search = c.req.query("search") ?? "";
  const page = Number(c.req.query("page") ?? "1");
  const pageSize = premium ? 20 : 3;

  if (!premium && page > 1) {
    return c.json({ conversations: [], limited: true });
  }

  const skip = premium ? (page - 1) * pageSize : 0;

  const where = {
    userId: dbId,
    ...(search
      ? {
          messages: {
            some: { content: { contains: search, mode: "insensitive" as const } },
          },
        }
      : {}),
  };

  const rows = await prisma.conversation.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip,
    take: pageSize,
    include: { messages: { take: 1, orderBy: { createdAt: "desc" } } },
  });

  return c.json({ conversations: rows, limited: !premium });
});

conv.post("/conversations/categorize", async (c) => {
  const { conversationId } = z.object({ conversationId: z.string() }).parse(await c.req.json());
  const dbId = c.get("dbUserId");
  const convo = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: dbId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!convo?.messages[0]) return c.json({ error: "Not found" }, 404);
  let cat = "General";
  if (process.env.ANTHROPIC_API_KEY) {
    const result = await generateCompletion({
      feature: "conversation_categorize",
      complexity: "lightweight",
      messages: [
        {
          role: "user",
          content: `Pick one category: Love, Career, Personal Growth, Family, Spirituality, General. Message: ${convo.messages[0].content}`,
        },
      ],
      safety: { mode: "check", userId: dbId, text: convo.messages[0].content },
      timeoutMs: 25_000,
      maxRetries: 1,
    });

    if (result.kind === "success" && result.content.trim()) {
      cat = result.content.trim();
    }
  }
  await prisma.conversation.update({ where: { id: conversationId }, data: { category: cat } });
  return c.json({ category: cat });
});

/** ---------- History list + detail ---------- */
conv.get("/history", async (c) => {
  const dbId = c.get("dbUserId");
  const page  = Math.max(1, Number(c.req.query("page")  ?? "1"));
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? "20")));
  const skip  = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where: { userId: dbId },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { role: true, content: true, createdAt: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversation.count({ where: { userId: dbId } }),
  ]);

  return c.json({
    conversations: rows.map((row) => ({
      id:           row.id,
      title:        row.title ?? "Untitled conversation",
      category:     row.category ?? "ask_me_anything",
      messageCount: row._count.messages,
      lastMessage:  row.messages[0]
        ? { role: row.messages[0].role, preview: row.messages[0].content.slice(0, 120), createdAt: row.messages[0].createdAt }
        : null,
      createdAt:  row.createdAt,
      updatedAt:  row.updatedAt,
    })),
    pagination: { page, limit, total, hasMore: skip + rows.length < total },
  });
});

conv.get("/history/:conversationId", async (c) => {
  const dbId = c.get("dbUserId");
  const { conversationId } = c.req.param();

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: dbId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true, createdAt: true } },
    },
  });

  if (!conversation) return c.json({ error: "Not found" }, 404);

  return c.json({
    conversation: {
      id:        conversation.id,
      title:     conversation.title ?? "Untitled conversation",
      category:  conversation.category ?? "ask_me_anything",
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages:  conversation.messages,
    },
  });
});

app.route("/api", conv);

/** ---------- Timeline ---------- */
const timeline = new Hono<{ Variables: Vars }>();
timeline.use("*", requireFirebaseAuth);
timeline.get("/timeline", async (c) => {
  const dbId = c.get("dbUserId");
  const rows = await prisma.growthTimelineEntry.findMany({
    where: { userId: dbId },
    orderBy: { date: "desc" },
    take: 100,
  });
  return c.json({ entries: rows });
});

timeline.post("/timeline/generate-weekly", async (c) => {
  const dbId = c.get("dbUserId");
  const since = new Date(Date.now() - 7 * 86_400_000);
  const journals = await prisma.journalEntry.findMany({ where: { userId: dbId, createdAt: { gte: since } } });
  const chats = await prisma.conversation.findMany({
    where: { userId: dbId, updatedAt: { gte: since } },
    include: { messages: { take: 3 } },
  });
  let theme = "Reflection";
  let insight = "You are integrating recent experiences.";
  let openQuestion = "What support do you need next?";
  if (process.env.ANTHROPIC_API_KEY) {
    const safetyText = journals[0]?.content ? String(journals[0].content).slice(0, 2000) : "";

    const result = await generateCompletion({
      feature: "timeline_generate_weekly",
      complexity: "standard",
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `Summarize week JSON keys theme, insight, openQuestion from journals ${JSON.stringify(journals)} chats ${JSON.stringify(chats)}`,
        },
      ],
      safety: { mode: "check", userId: dbId, text: safetyText },
      timeoutMs: 25_000,
      maxRetries: 1,
    });

    if (result.kind === "success" && result.json && typeof result.json === "object") {
      const j = result.json as { theme?: string; insight?: string; openQuestion?: string };
      theme = j.theme ?? theme;
      insight = j.insight ?? insight;
      openQuestion = j.openQuestion ?? openQuestion;
    }
  }
  const entry = await prisma.growthTimelineEntry.create({
    data: {
      userId: dbId,
      entryType: "chat_insight",
      theme,
      summary: `${insight} ${openQuestion}`,
    },
  });
  return c.json({ entry });
});

app.route("/api", timeline);

/** ---------- Experiments ---------- */
const exp = new Hono<{ Variables: Vars }>();
exp.use("*", requireFirebaseAuth);
exp.get("/experiments", async (c) => {
  const dbId = c.get("dbUserId");
  const rows = await prisma.userExperiment.findMany({ where: { userId: dbId } });
  return c.json({ experiments: rows });
});

app.route("/api", exp);

/** ---------- Daily audio ---------- */
const audio = new Hono<{ Variables: Vars }>();
audio.use("*", requireFirebaseAuth);
audio.post("/daily/audio", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasFeatureAccess(firebaseUid, dbId))) return c.json({ error: "premium_required" }, 402);
  const key = `audio:${dbId}:${localDateKey("UTC")}`;
  if (redis) {
    const hit = await redis.get(key);
    if (hit) return c.json(JSON.parse(hit));
  }
  const payload = { audioUrl: "", durationSeconds: 0, message: "Wire ElevenLabs or Polly + storage to enable audio." };
  if (redis) await redis.set(key, JSON.stringify(payload), "EX", 86_400);
  return c.json(payload);
});

app.route("/api", audio);

/** ---------- TikTok cosmic variant ---------- */
const tiktok = new Hono<{ Variables: Vars }>();
tiktok.use("*", requireFirebaseAuth);
tiktok.post("/cosmic-card/tiktok-variant", async (c) => {
  const dbId = c.get("dbUserId");
  const { variant } = z
    .object({
      variant: z.enum(["birth-reveal", "daily-transit", "compatibility", "tarot-reveal"]),
    })
    .parse(await c.req.json());

  const user = await prisma.user.findUnique({
    where: { id: dbId },
    include: { birthProfile: true },
  });
  if (!user) return c.json({ error: "Not found" }, 404);
  const bp = user.birthProfile;
  if (!bp) return c.json({ error: "No profile" }, 404);

  await mkdir(storageDir, { recursive: true });
  const id = `tt-${dbId}-${Date.now()}.png`;
  const filePath = join(storageDir, id);
  const sharp = (await import("sharp")).default;
  const svg = `<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#000"/>
    <text x="40" y="120" fill="#fff" font-size="64" font-family="sans-serif">${escapeXml(variant)}</text>
    <text x="40" y="220" fill="#f472b6" font-size="42" font-family="sans-serif">${escapeXml(user.name)}</text>
    <text x="40" y="300" fill="#fff" font-size="36" font-family="sans-serif">${escapeXml(bp.sunSign)}</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(filePath);
  const base = process.env.PUBLIC_API_BASE_URL ?? "";
  return c.json({
    imageUrl: `${base}/files/${id}`,
    captionTemplate: `${user.name} found out their Big Three — ${bp.sunSign} Sun. Astra Coach.`,
  });
});

app.route("/api", tiktok);

/** ---------- Cron / workers ---------- */
const cron = new Hono();
cron.get("/cron/daily-notifications", async (c) => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return c.json({ error: "cron not configured" }, 503);
  if (c.req.query("secret") !== secret) return c.json({ error: "unauthorized" }, 401);
  return c.json({ ok: true, scheduled: 0, note: "Wire Expo push batch against User.pushToken." });
});

cron.get("/cron/transit-notifications", async (c) => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return c.json({ error: "cron not configured" }, 503);
  if (c.req.query("secret") !== secret) return c.json({ error: "unauthorized" }, 401);
  await prisma.pushNotificationLog.create({
    data: { kind: "transit_cron_tick", body: "tick" },
  });
  return c.json({ ok: true });
});

cron.get("/cron/winback", async (c) => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return c.json({ error: "cron not configured" }, 503);
  if (c.req.query("secret") !== secret) return c.json({ error: "unauthorized" }, 401);
  const due = await prisma.winBackSchedule.findMany({ where: { processed: false, runAt: { lte: new Date() } } });
  for (const w of due) {
    await prisma.winBackSchedule.update({ where: { id: w.id }, data: { processed: true } });
  }
  return c.json({ processed: due.length });
});

cron.get("/cron/daily-horoscopes", async (c) => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return c.json({ error: "cron not configured" }, 503);
  if (c.req.query("secret") !== secret) return c.json({ error: "unauthorized" }, 401);

  const prefs = await prisma.notificationPreference.findMany({
    where: { dailyHoroscope: true },
  });
  let sent = 0;
  let failed = 0;
  for (const p of prefs) {
    const local = DateTime.now().setZone(p.preferredTimezone);
    if (!local.isValid) continue;
    // Match preferred hour within the first 30 minutes so cron can run every 5–15 min without missing the slot.
    if (local.hour !== p.preferredHour || local.minute >= 30) continue;

    const startOfDayUserTz = local.startOf("day").toUTC().toJSDate();
    const alreadySentToday = await prisma.pushNotificationLog.findFirst({
      where: {
        userId: p.userId,
        kind: "daily_horoscope",
        createdAt: { gte: startOfDayUserTz },
      },
    });
    if (alreadySentToday) continue;

    const r = await sendToUser(p.userId, {
      title: "Your daily insight",
      body: "A gentle nudge from the stars — open Akhtar for today’s reading.",
      data: { type: "daily_horoscope" },
    });
    if (r.sent > 0) {
      await prisma.pushNotificationLog.create({
        data: {
          userId: p.userId,
          kind: "daily_horoscope",
          body: "daily_horoscope",
        },
      });
    }
    sent += r.sent;
    failed += r.failed;
  }

  return c.json({ sent, failed });
});

cron.get("/cron/mantra-reminders", async (c) => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return c.json({ error: "cron not configured" }, 503);
  if (c.req.query("secret") !== secret) return c.json({ error: "unauthorized" }, 401);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const users = await prisma.user.findMany({
    where: { mantraReminderTime: { not: null }, deletedAt: null },
    include: { birthProfile: true, notificationPreference: true },
  });

  let sent = 0;
  let failed = 0;
  let cleared = 0;

  for (const u of users) {
    if (u.updatedAt < thirtyDaysAgo) {
      await prisma.user.update({ where: { id: u.id }, data: { mantraReminderTime: null } });
      cleared += 1;
      continue;
    }

    const tz =
      u.birthProfile?.birthTimezone?.trim() ||
      u.notificationPreference?.preferredTimezone?.trim() ||
      "UTC";
    const local = DateTime.now().setZone(tz);
    if (!local.isValid) continue;

    const parts = (u.mantraReminderTime ?? "").split(":");
    const rh = Number(parts[0]);
    const rm = Number(parts[1] ?? 0);
    if (Number.isNaN(rh) || rh < 0 || rh > 23) continue;

    if (local.hour !== rh || local.minute >= 30) continue;

    const startOfDayUserTz = local.startOf("day").toUTC().toJSDate();
    const alreadySentToday = await prisma.pushNotificationLog.findFirst({
      where: {
        userId: u.id,
        kind: "mantra_reminder_v2",
        createdAt: { gte: startOfDayUserTz },
      },
    });
    if (alreadySentToday) continue;

    const lang = u.language === "en" ? "en" : "fa";
    const body = lang === "fa" ? "مانترای امروزت آماده‌ست." : "Your mantra is waiting.";
    const r = await sendToUser(u.id, {
      title: "Akhtar",
      body,
      data: { type: "mantra_open" },
    });
    if (r.sent > 0) {
      await prisma.pushNotificationLog.create({
        data: {
          userId: u.id,
          kind: "mantra_reminder_v2",
          body: "mantra_reminder_v2",
        },
      });
    }
    sent += r.sent;
    failed += r.failed;
  }

  return c.json({ sent, failed, clearedStaleReminder: cleared });
});

app.route("/api", cron);
app.route("/api/admin", adminRouter);

// ─── Chat Session: close + summarize ─────────────────────────────────────────
// Called by the client when a user ends a coaching session to trigger
// async summarization (for memory persistence across future sessions).
api.post("/chat-sessions/:sessionId/close", async (c) => {
  const dbUserId = c.get("dbUserId");
  const { sessionId } = c.req.param();

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true },
  });

  if (!session) return c.json({ error: "Session not found" }, 404);
  if (session.userId !== dbUserId) return c.json({ error: "Forbidden" }, 403);

  // Fire-and-forget — client gets an immediate 200 while summarisation runs in background
  summarizeSession(sessionId).catch((err) =>
    console.error("[session-close] summarize error:", err)
  );

  return c.json({ ok: true, message: "Session closed. Summary generating in background." });
});

export { app };