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
import { redis } from "./lib/redis.js";
import { cacheGetJson, cacheKey, cacheSetUntilLocalMidnight } from "./lib/cache.js";
import { generateCompletion, streamChatCompletion } from "./services/ai/generateCompletion.js";
import {
  computeNatalChart,
  julianNow,
  getDailyTransits,
  getForwardTransits,
  planetLongitudesAt,
  synastryScore,
  transitHitsNatal,
  type NatalChartInput,
} from "./services/chartEngine.js";
import { fetchSubscriptionStatus, hasPremiumEntitlement } from "./lib/revenuecat.js";
import { DateTime } from "luxon";
import { TAROT_DECK } from "./data/tarotCards.js";
import { adminAuth } from "./lib/firebase-admin.js";
import { handleAuthSync } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { sendToUser } from "./services/notifications.js";
import { persistCompleteOnboarding } from "./services/onboardingComplete.js";
import { challengeRulesEngine } from "./services/astrology/challengeRulesEngine.js";
import { safetyClassifier } from "./services/ai/safetyClassifier.js";
import { assembleContext } from "./services/ai/promptAssembler.js";
import { summarizeSession } from "./services/ai/sessionSummarizer.js";
import { buildCoffeeVisionPrompt } from "./services/ai/prompts/coffeeReading.js";
import { buildAskMeAnythingPrompt, buildUserContextString } from "./services/ai/systemPrompts.js";

type Vars = {
  firebaseUid: string;
  firebaseUser: DecodedIdToken;
  dbUserId: string;
};

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

const api = new Hono<{ Variables: Vars }>();
api.post("/auth/sync", handleAuthSync);
api.use("*", requireFirebaseAuth);

/** ---------- File upload (Phase 4 / Coffee) ---------- */
api.post("/files/upload", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasPremiumEntitlement(firebaseUid))) return c.json({ error: "premium_required" }, 402);

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
 * Complete user profile for AI context — returns minimal fallback
 * instead of 404 when user record is missing (pre-sync edge case).
 */
api.get("/user/profile", async (c) => {
  const id = c.get("dbUserId");
  const user = await prisma.user.findUnique({
    where: { id },
    include: { birthProfile: true },
  });
  if (!user) {
    return c.json({
      user: null,
      birthProfile: null,
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
  return c.json({
    user: {
      id: user.id,
      firstName: user.name ?? "Friend",
      email: user.email,
    },
    birthProfile: bp
      ? {
          birthDate: bp.birthDate,
          birthTime: bp.birthTime,
          birthCity: bp.birthCity,
          sunSign,
          moonSign: bp.moonSign ?? null,
          risingSign: bp.risingSign ?? null,
          natalChartJson: bp.natalChartJson,
        }
      : null,
    isProfileComplete: !!bp?.birthDate,
  });
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

function computeSunSignFallback(birthDate: string): string {
  const dt = new Date(birthDate);
  if (Number.isNaN(dt.getTime())) return "Unknown";
  const month = dt.getUTCMonth() + 1;
  const day = dt.getUTCDate();
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
}

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
  if (!process.env.OPENROUTER_API_KEY) {
    return c.json({ interpretation: `${planet} speaks to your chart themes; add OPENROUTER_API_KEY for full copy.` });
  }

  const system = "You are a warm astrologer. Use ONLY the given placement facts. Two or three sentences.";
  const result = await generateCompletion({
    feature: "chart_interpret",
    complexity: "lightweight",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: JSON.stringify({
          name: user?.name ?? "Friend",
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

  return c.json({ interpretation: `${planet} speaks to your chart themes; OpenRouter is unavailable right now.` });
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
  const { message, conversationId } = z
    .object({ message: z.string().min(1).max(8000), conversationId: z.string().optional() })
    .parse(await c.req.json());
  // #region agent log
  fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:'endpoint-audit-1',hypothesisId:'F-endpoint-mismatch',location:'astro-coach-api/src/app.ts:/chat/stream:start',message:'backend /chat/stream hit',data:{dbUserId:dbId,hasConversationId:!!conversationId,messageLength:message.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const premium = await hasPremiumEntitlement(firebaseUid);
  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  const tz = bp?.birthTimezone ?? "UTC";

  if (!premium) {
    const used = await dailyChatCount(dbId, tz);
    if (used >= 3) {
      return c.json({ error: "free_limit", used, limit: 3 }, 402);
    }
  }

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

  let convId = conversationId;
  let createdNewConversation = false;
  if (!convId) {
    const conv = await prisma.conversation.create({
      data: { userId: dbId, title: message.slice(0, 60) },
    });
    convId = conv.id;
    createdNewConversation = true;
  }

  const userMessage = await prisma.message.create({
    data: { conversationId: convId!, role: "user", content: message },
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

  if (!process.env.OPENROUTER_API_KEY) {
    return c.json({
      response: "Configure OPENROUTER_API_KEY on Railway to enable live coaching.",
      followUpPrompts: [],
      conversationId: convId,
    });
  }

  const sseUser = await prisma.user.findUnique({ where: { id: dbId }, select: { name: true } });
  const sseUserCtx = buildUserContextString({
    firstName: sseUser?.name ?? "Friend",
    sunSign: bp?.sunSign ?? null,
    moonSign: bp?.moonSign ?? null,
    risingSign: bp?.risingSign ?? null,
    birthCity: bp?.birthCity ?? null,
    birthDate: bp?.birthDate ?? null,
    language: "fa",
  });
  const system = buildAskMeAnythingPrompt(sseUserCtx, JSON.stringify(hits));

  return streamSSE(c, async (stream) => {
    try {
      const history = await prisma.message.findMany({
        where: { conversationId: convId! },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { role: true, content: true },
      });
      const historyMessages = history.map((m) => ({ role: m.role, content: m.content }));

      const streamResult = await streamChatCompletion({
        feature: "chat_message",
        complexity: "deep",
        messages: [
          { role: "system", content: system },
          ...historyMessages,
        ],
        safety: { mode: "check", userId: dbId, text: message },
        onToken: async (t) => {
          await stream.writeSSE({ data: t });
        },
      });

      if (streamResult.kind === "unsafe") {
        const safeText = streamResult.safeResponse ?? "I can't process this request safely right now.";
        if (!premium) await decrChatCount(dbId, tz);
        await stream.writeSSE({ data: safeText });
        await prisma.message.create({ data: { conversationId: convId!, role: "assistant", content: safeText } });
        await prisma.conversation.update({ where: { id: convId! }, data: { updatedAt: new Date() } });
        await stream.writeSSE({
          event: "meta",
          data: JSON.stringify({ conversationId: convId, followUpPrompts: [] as string[] }),
        });
        return;
      }

      if (streamResult.kind === "error") {
        await rollbackFailedChatTurn();
        await stream.writeSSE({ event: "error", data: JSON.stringify({ error: "chat_failed" }) });
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

      try {
        await prisma.message.create({ data: { conversationId: convId!, role: "assistant", content: full } });
        await prisma.conversation.update({ where: { id: convId! }, data: { updatedAt: new Date() } });
        await stream.writeSSE({
          event: "meta",
          data: JSON.stringify({ conversationId: convId, followUpPrompts: followUps }),
        });
      } catch {
        await stream.writeSSE({ event: "error", data: JSON.stringify({ error: "persist_failed" }) });
      }
    } catch {
      // Fallback for unexpected errors: keep legacy failure semantics.
      await rollbackFailedChatTurn();
      await stream.writeSSE({ event: "error", data: JSON.stringify({ error: "chat_failed" }) });
      return;
    }
  });
});

/** Non-streaming chat for React Native clients without SSE. */
api.post("/chat/message", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  const payload = z
    .object({
      message: z.string().min(1).max(8000).optional(),
      conversationId: z.string().optional(),
      content: z.string().min(1).max(8000).optional(),
      sessionId: z.string().nullable().optional(),
      featureKey: z.string().optional(),
    })
    .parse(await c.req.json());
  const message = (payload.content ?? payload.message ?? "").trim();
  if (!message) return c.json({ error: "message_required" }, 400);
  const conversationId = payload.sessionId ?? payload.conversationId;
  // #region agent log
  fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:'endpoint-audit-1',hypothesisId:'F-endpoint-mismatch',location:'astro-coach-api/src/app.ts:/chat/message:start',message:'backend /chat/message hit',data:{dbUserId:dbId,hasConversationId:!!conversationId,messageLength:message.length,hasOpenRouterKey:!!process.env.OPENROUTER_API_KEY,featureKey:payload.featureKey ?? null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const premium = await hasPremiumEntitlement(firebaseUid);
  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  const tz = bp?.birthTimezone ?? "UTC";

  if (!premium) {
    const used = await dailyChatCount(dbId, tz);
    if (used >= 3) {
      return c.json({ error: "free_limit", used, limit: 3 }, 402);
    }
  }

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

  let convId = conversationId;
  let createdNewConversation = false;
  if (!convId) {
    const conv = await prisma.conversation.create({
      data: { userId: dbId, title: message.slice(0, 60) },
    });
    convId = conv.id;
    createdNewConversation = true;
  }

  const userMessage = await prisma.message.create({
    data: { conversationId: convId!, role: "user", content: message },
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

  if (!process.env.OPENROUTER_API_KEY) {
    return c.json({
      sessionId: convId,
      content: "Configure OPENROUTER_API_KEY on Railway to enable live coaching.",
      followUpPrompts: [] as string[],
      response: "Configure OPENROUTER_API_KEY on Railway to enable live coaching.",
      conversationId: convId,
    });
  }

  const user = await prisma.user.findUnique({ where: { id: dbId }, select: { name: true } });
  const userCtx = buildUserContextString({
    firstName: user?.name ?? "Friend",
    sunSign: bp?.sunSign ?? null,
    moonSign: bp?.moonSign ?? null,
    risingSign: bp?.risingSign ?? null,
    birthCity: bp?.birthCity ?? null,
    birthDate: bp?.birthDate ?? null,
    language: "fa",
  });
  const system = buildAskMeAnythingPrompt(userCtx, JSON.stringify(hits));

  const result = await generateCompletion({
    feature: "chat_complete",
    complexity: "deep",
    messages: [
      { role: "system", content: system },
      ...(await prisma.message.findMany({
        where: { conversationId: convId! },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { role: true, content: true },
      })).map((m) => ({ role: m.role, content: m.content })),
    ],
    safety: { mode: "check", userId: dbId, text: message },
    timeoutMs: 25_000,
    maxRetries: 1,
  });

  if (result.kind === "unsafe") {
    const safeText = result.safeResponse ?? "I can't process this request safely right now.";
    if (!premium) await decrChatCount(dbId, tz);
    try {
      await prisma.message.create({ data: { conversationId: convId!, role: "assistant", content: safeText } });
      await prisma.conversation.update({ where: { id: convId! }, data: { updatedAt: new Date() } });
    } catch {
      return c.json({ error: "persist_failed" }, 500);
    }
    return c.json({ response: safeText, followUpPrompts: [] as string[], conversationId: convId });
  }

  if (result.kind === "error") {
    // #region agent log
      fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:'endpoint-audit-1',hypothesisId:'G-chat-complete-crash',location:'astro-coach-api/src/app.ts:/chat/message:result-error',message:'generateCompletion returned error kind',data:{errorType:result.errorType,message:result.message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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

  try {
    await prisma.message.create({ data: { conversationId: convId!, role: "assistant", content: full } });
    await prisma.conversation.update({ where: { id: convId! }, data: { updatedAt: new Date() } });
  } catch {
    // #region agent log
      fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:'endpoint-audit-1',hypothesisId:'G-chat-complete-crash',location:'astro-coach-api/src/app.ts:/chat/message:persist-failed',message:'persist failed after completion',data:{dbUserId:dbId,conversationId:convId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return c.json({ error: "persist_failed" }, 500);
  }

  return c.json({
    sessionId: convId,
    content: full,
    followUpPrompts: followUps,
    response: full,
    conversationId: convId,
    model: result.model,
  });
});

/** ---------- Daily insight ---------- */
api.get("/daily/insight", async (c) => {
  const dbId = c.get("dbUserId");
  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  if (!bp) return c.json({ error: "No birth profile" }, 404);

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

  if (process.env.OPENROUTER_API_KEY) {
    const result = await generateCompletion({
      feature: "daily_insight",
      complexity: "standard",
      messages: [
        {
          role: "user",
          content: `Generate JSON only for ${bp.sunSign} Sun, ${bp.moonSign} Moon. Transit: ${transitDescription}. Schema: {"title":"5 words max","narrative":"150-250 words","moodIndicator":"one of High Energy, Reflective, Social, Creative, Cautious, Romantic"}`,
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

  if (process.env.OPENROUTER_API_KEY) {
    const result = await generateCompletion({
      feature: "daily_horoscope",
      complexity: "standard",
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `Generate JSON only. Write for ${bp.sunSign} Sun, ${bp.moonSign} Moon. Rising: ${bp.risingSign ?? "Unknown"}. Transit highlights: ${transitDescription}. Schema: { "title":"5 words max","body":"150-250 words","moodLabel":"one of ${moodEnum.join(", ")}","affirmation":"optional","focusArea":"optional" }`,
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
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasPremiumEntitlement(firebaseUid))) return c.json({ error: "premium_required" }, 402);

  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  if (!bp) return c.json({ error: "No birth profile" }, 404);

  const horizonDays = 14;
  const redisKey = cacheKey.astroEvents(dbId, horizonDays);

  const cached = await cacheGetJson<{ events: unknown[] }>(redisKey);
  if (cached) return c.json(cached);

  const natalChartJson = bp.natalChartJson as unknown as Parameters<typeof getDailyTransits>[0];
  const start = DateTime.now().setZone(bp.birthTimezone).startOf("day");

  const candidates: Array<{
    title: string;
    eventType: string;
    significance: number;
    category: string;
    whyItMatters: string;
    suggestedAction: string;
    eventDate: Date;
    windowStart: Date;
    windowEnd: Date;
  }> = [];

  for (let i = 0; i < horizonDays; i++) {
    const day = start.plus({ days: i }).toISODate();
    if (!day) continue;
    const transits = getDailyTransits(natalChartJson, day, bp.birthTimezone);
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
  const events = candidates.slice(0, 5);

  // Cache only (avoids duplicate growth in DB for repeated calls)
  await cacheSetUntilLocalMidnight(redisKey, { events }, bp.birthTimezone);
  return c.json({ events });
});

/** ---------- Life challenges (Phase 3) ---------- */
api.get("/challenges/report", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasPremiumEntitlement(firebaseUid))) return c.json({ error: "premium_required" }, 402);

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
  if (!(await hasPremiumEntitlement(firebaseUid))) return c.json({ error: "premium_required" }, 402);

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

  if (process.env.OPENROUTER_API_KEY) {
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
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasPremiumEntitlement(firebaseUid))) return c.json({ error: "premium_required" }, 402);

  const body = z.object({ imageUrl: z.string().url() }).parse(await c.req.json());

  const schema = z.object({
    visionObservations: z.array(z.string().min(3)).min(3).max(12),
    symbolicMappings: z.array(z.object({ symbol: z.string().min(2).max(40), meaning: z.string().min(10).max(200) })).min(3).max(10),
    interpretation: z.string().min(80).max(2500),
    followUpQuestions: z.array(z.string().min(10).max(200)).min(2).max(5),
    imageQualityFlag: z.boolean(),
  });

  let payload = {
    visionObservations: ["Contrast looks medium", "Shapes cluster near the rim", "One dominant dark region"],
    symbolicMappings: [
      { symbol: "cluster", meaning: "Multiple priorities competing for attention" },
      { symbol: "line", meaning: "A path forming through uncertainty" },
      { symbol: "ring", meaning: "A commitment or boundary theme" },
    ],
    interpretation:
      "Your cup suggests a transition period where clarity comes from choosing one small next step and repeating it consistently. Keep your focus narrow this week.",
    followUpQuestions: ["What area of life feels most urgent right now?", "Do you want guidance for love, work, or personal growth?"],
    imageQualityFlag: false,
  };

  const coffeeStep1Schema = z.object({
    visionObservations: z.array(z.string().min(3)).min(3).max(12),
    symbolicMappings: z.array(z.object({ symbol: z.string().min(2).max(40), meaning: z.string().min(10).max(200) })).min(3).max(10),
    imageQualityFlag: z.boolean(),
  });

  const coffeeStep2Schema = z.object({
    interpretation: z.string().min(80).max(2500),
    followUpQuestions: z.array(z.string().min(10).max(200)).min(2).max(5),
  });

  if (process.env.OPENROUTER_API_KEY) {
    const visionPrompt = buildCoffeeVisionPrompt();
    const step1 = await generateCompletion({
      feature: "coffee_reading_step1_vision",
      complexity: "standard",
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: visionPrompt.system },
        { role: "user", content: visionPrompt.user },
      ],
      // Image formatted by generateCompletion via imageInputs — not embedded manually.
      imageInputs: [{ type: "url", data: body.imageUrl }],
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
            content:
              "You are a traditional coffee reader who is gentle and non-deterministic. No doom. No medical/legal/financial advice. JSON only. Use the provided symbols to create symbolic-reflection interpretation and gentle next-step questions.",
          },
          {
            role: "user",
            content: JSON.stringify({
              visionObservations: payload.visionObservations,
              symbolicMappings: payload.symbolicMappings,
              request:
                "Write interpretation (80-2500 chars) and followUpQuestions (2-5 questions). Keep it gentle, non-deterministic, and reflective.",
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

  await prisma.coffeeReading.create({
    data: {
      userId: dbId,
      imageUrl: body.imageUrl,
      visionObservations: payload.visionObservations as object,
      symbolicMappings: payload.symbolicMappings as object,
      interpretation: payload.interpretation,
      followUpMessages: { followUpQuestions: payload.followUpQuestions } as object,
      imageQualityFlag: payload.imageQualityFlag,
    },
  });

  return c.json(payload);
});

/** ---------- Future guidance (Phase 4) ---------- */
api.post("/future/report", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasPremiumEntitlement(firebaseUid))) return c.json({ error: "premium_required" }, 402);

  const body = z
    .object({
      domain: z.enum(["love", "career", "health", "family", "spirituality", "general"]),
      timeWindow: z.enum(["7d", "30d", "90d"]),
    })
    .parse(await c.req.json());

  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  if (!bp) return c.json({ error: "No birth profile" }, 404);

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

  if (process.env.OPENROUTER_API_KEY) {
    const result = await generateCompletion({
      feature: "future_report",
      complexity: "standard",
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a cautious astrologer-coach. Use ONLY the provided transit themes. No certainty. No medical/legal/financial advice. JSON only.",
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

/** ---------- Compatibility ---------- */
api.post("/compatibility/report", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasPremiumEntitlement(firebaseUid))) {
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
  if (process.env.OPENROUTER_API_KEY) {
    const result = await generateCompletion({
      feature: "compatibility_report",
      complexity: "deep",
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `Synastry JSON only. Score ${score}. User chart longitudes ${JSON.stringify(a)}. Partner ${JSON.stringify(b)}. Keys: overall, emotional, communication, romantic, longTerm, challenges, advice (strings).`,
        },
      ],
      safety: { mode: "check", userId: dbId, text: `compatibility_report:${profileId}` },
      timeoutMs: 25_000,
      maxRetries: 1,
    });

    if (result.kind === "success" && result.json && typeof result.json === "object") {
      report = result.json as Record<string, unknown>;
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
api.get("/subscription/status", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  const s = await fetchSubscriptionStatus(firebaseUid);
  await prisma.user.update({
    where: { id: dbId },
    data: { subscriptionStatus: s.status },
  });
  return c.json(s);
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
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasPremiumEntitlement(firebaseUid))) return c.json({ error: "premium_required" }, 402);
  const { text } = z.object({ text: z.string().min(20).max(8000) }).parse(await c.req.json());
  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  let interpretation: Record<string, string> = {
    symbols: "…",
    emotional: "…",
    astro: "…",
  };
  if (process.env.OPENROUTER_API_KEY) {
    const result = await generateCompletion({
      feature: "dream_interpret",
      complexity: "deep",
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `Dream analysis JSON for Sun ${bp?.sunSign}, Moon ${bp?.moonSign}. Dream: ${text}. Keys: symbols, emotional, astro.`,
        },
      ],
      safety: { mode: "check", userId: dbId, text },
      timeoutMs: 25_000,
      maxRetries: 1,
    });

    if (result.kind === "success" && result.json && typeof result.json === "object") {
      interpretation = result.json as Record<string, string>;
    }
  }
  await prisma.dreamEntry.create({
    data: { userId: dbId, dreamText: text, interpretation },
  });
  return c.json({ interpretation });
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

/** ---------- Tarot ---------- */
const tarot = new Hono<{ Variables: Vars }>();
tarot.use("*", requireFirebaseAuth);
tarot.post("/tarot/reading", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  if (!(await hasPremiumEntitlement(firebaseUid))) return c.json({ error: "premium_required" }, 402);
  const body = z
    .object({
      spread: z.enum(["single", "three", "celtic"]),
      intention: z.string().max(200).optional(),
    })
    .parse(await c.req.json());

  const count = body.spread === "single" ? 1 : body.spread === "three" ? 3 : 5;
  const picked: typeof TAROT_DECK = [];
  const used = new Set<number>();
  while (picked.length < count) {
    const i = Math.floor(Math.random() * TAROT_DECK.length);
    if (used.has(i)) continue;
    used.add(i);
    const card = TAROT_DECK[i];
    if (card) picked.push({ ...card, reversed: Math.random() < 0.5 });
  }

  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  let summary = "A meaningful spread for your path.";
  if (process.env.OPENROUTER_API_KEY) {
    const result = await generateCompletion({
      feature: "tarot_reading",
      complexity: "deep",
      messages: [
        {
          role: "user",
          content: `Tarot reading for ${bp?.sunSign} Sun. Cards: ${JSON.stringify(picked)}. Intention: ${body.intention ?? ""}. Warm summary paragraph, no doom.`,
        },
      ],
      safety: { mode: "check", userId: dbId, text: `tarot_reading:${body.intention ?? ""}` },
      timeoutMs: 25_000,
      maxRetries: 1,
    });

    if (result.kind === "success" && result.content.trim()) {
      summary = result.content;
    } else if (result.kind === "unsafe") {
      summary = result.safeResponse ?? summary;
    }
  }

  await prisma.tarotReading.create({
    data: {
      userId: dbId,
      spreadType: body.spread,
      intention: body.intention,
      cardsJson: picked as object,
      summary,
    },
  });

  return c.json({ cards: picked, summary });
});

app.route("/api", tarot);

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
  if (process.env.OPENROUTER_API_KEY) {
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
  const premium = await hasPremiumEntitlement(firebaseUid);
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

/** ---------- Conversations / history ---------- */
const conv = new Hono<{ Variables: Vars }>();
conv.use("*", requireFirebaseAuth);

conv.get("/conversations", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  const premium = await hasPremiumEntitlement(firebaseUid);
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
  if (process.env.OPENROUTER_API_KEY) {
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
  if (process.env.OPENROUTER_API_KEY) {
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
  if (!(await hasPremiumEntitlement(firebaseUid))) return c.json({ error: "premium_required" }, 402);
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

/** ---------- Webhooks ---------- */
const wh = new Hono();
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