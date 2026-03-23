import { find as findTimeZone } from "geo-tz";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.js";
import { openai } from "./lib/openai.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import {
  computeNatalChart,
  julianNow,
  planetLongitudesAt,
  synastryScore,
  transitHitsNatal,
  type NatalChartInput,
} from "./services/chartEngine.js";
import { fetchSubscriptionStatus, hasPremiumEntitlement } from "./lib/revenuecat.js";
import { TAROT_DECK } from "./data/tarotCards.js";

type Vars = {
  clerkUserId: string;
  dbUserId: string;
};

const app = new Hono<{ Variables: Vars }>();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

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
api.use("*", requireAuth);

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
  const birthDate = new Date(body.birthDate);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { name: body.name, onboardingComplete: true },
    });
    await tx.birthProfile.upsert({
      where: { userId: id },
      create: {
        userId: id,
        birthDate,
        birthTime: body.birthTime,
        birthCity: body.birthCity,
        birthLat: body.birthLat,
        birthLong: body.birthLong,
        birthTimezone: body.birthTimezone,
        sunSign: body.sunSign,
        moonSign: body.moonSign,
        risingSign: body.risingSign,
        natalChartJson: body.natalChartJson as Prisma.InputJsonValue,
        interestTags: body.interestTags,
      },
      update: {
        birthDate,
        birthTime: body.birthTime,
        birthCity: body.birthCity,
        birthLat: body.birthLat,
        birthLong: body.birthLong,
        birthTimezone: body.birthTimezone,
        sunSign: body.sunSign,
        moonSign: body.moonSign,
        risingSign: body.risingSign,
        natalChartJson: body.natalChartJson as Prisma.InputJsonValue,
        interestTags: body.interestTags,
      },
    });
    await tx.consentRecord.create({
      data: {
        userId: id,
        consentType: "birth_data_storage",
        version: body.consentVersion,
        ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
      },
    });
  });

  return c.json({ ok: true });
});

api.delete("/user/account", async (c) => {
  const id = c.get("dbUserId");
  await prisma.user.delete({ where: { id } });
  return c.json({ ok: true, message: "Deletion queued; Clerk session still active until sign-out." });
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
  if (!process.env.OPENAI_API_KEY) {
    return c.json({ interpretation: `${planet} speaks to your chart themes; add OPENAI_API_KEY for full copy.` });
  }
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a warm astrologer. Use ONLY the given placement facts. Two or three sentences.",
      },
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
  });
  const text = completion.choices[0]?.message?.content ?? "";
  return c.json({ interpretation: text });
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

api.post("/chat/message", async (c) => {
  const clerkId = c.get("clerkUserId");
  const dbId = c.get("dbUserId");
  const { message, conversationId } = z
    .object({ message: z.string().min(1).max(8000), conversationId: z.string().optional() })
    .parse(await c.req.json());

  const premium = await hasPremiumEntitlement(clerkId);
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

  if (!process.env.OPENAI_API_KEY) {
    return c.json({
      response: "Configure OPENAI_API_KEY on Railway to enable live coaching.",
      followUpPrompts: [],
      conversationId: convId,
    });
  }

  const system = `You are a warm astrologer named Astra Coach. User Sun ${bp?.sunSign}, Moon ${bp?.moonSign}, Rising ${bp?.risingSign}. Interests: ${bp?.interestTags?.join(", ") ?? ""}. Transit highlights: ${JSON.stringify(hits)}. Structure: answer, astro context, advice, close. No medical/legal/financial. End JSON line exactly: {"followUpPrompts":["q1","q2"]}`;

  return streamSSE(c, async (stream) => {
    let full = "";
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: message },
        ],
      });
      for await (const chunk of res) {
        const t = chunk.choices[0]?.delta?.content ?? "";
        if (t) {
          full += t;
          await stream.writeSSE({ data: t });
        }
      }
    } catch {
      await rollbackFailedChatTurn();
      await stream.writeSSE({ event: "error", data: JSON.stringify({ error: "chat_failed" }) });
      return;
    }

    let followUps: string[] = [];
    const jmatch = full.match(/\{[\s\S]*"followUpPrompts"[\s\S]*\}\s*$/);
    if (jmatch) {
      try {
        const j = JSON.parse(jmatch[0]) as { followUpPrompts?: string[] };
        followUps = j.followUpPrompts ?? [];
      } catch {
        /* ignore */
      }
    }
    try {
      await prisma.message.create({
        data: { conversationId: convId!, role: "assistant", content: full },
      });
      await prisma.conversation.update({
        where: { id: convId! },
        data: { updatedAt: new Date() },
      });
      await stream.writeSSE({ event: "meta", data: JSON.stringify({ conversationId: convId, followUpPrompts: followUps }) });
    } catch {
      await stream.writeSSE({ event: "error", data: JSON.stringify({ error: "persist_failed" }) });
    }
  });
});

/** Non-streaming chat for React Native clients without SSE. */
api.post("/chat/complete", async (c) => {
  const clerkId = c.get("clerkUserId");
  const dbId = c.get("dbUserId");
  const { message, conversationId } = z
    .object({ message: z.string().min(1).max(8000), conversationId: z.string().optional() })
    .parse(await c.req.json());

  const premium = await hasPremiumEntitlement(clerkId);
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

  if (!process.env.OPENAI_API_KEY) {
    return c.json({
      response: "Configure OPENAI_API_KEY on Railway to enable live coaching.",
      followUpPrompts: [] as string[],
      conversationId: convId,
    });
  }

  const system = `You are a warm astrologer named Astra Coach. User Sun ${bp?.sunSign}, Moon ${bp?.moonSign}, Rising ${bp?.risingSign}. Interests: ${bp?.interestTags?.join(", ") ?? ""}. Transit highlights: ${JSON.stringify(hits)}. Structure: answer, astro context, advice, close. No medical/legal/financial. End with a line containing JSON only: {"followUpPrompts":["q1","q2"]}`;

  let full: string;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: message },
      ],
    });
    full = completion.choices[0]?.message?.content ?? "";
  } catch {
    await rollbackFailedChatTurn();
    return c.json({ error: "chat_failed" }, 502);
  }

  let followUps: string[] = [];
  const jmatch = full.match(/\{[\s\S]*"followUpPrompts"[\s\S]*\}\s*$/);
  if (jmatch) {
    try {
      const j = JSON.parse(jmatch[0]) as { followUpPrompts?: string[] };
      followUps = j.followUpPrompts ?? [];
    } catch {
      /* ignore */
    }
  }

  try {
    await prisma.message.create({
      data: { conversationId: convId!, role: "assistant", content: full },
    });
    await prisma.conversation.update({
      where: { id: convId! },
      data: { updatedAt: new Date() },
    });
  } catch {
    return c.json({ error: "persist_failed" }, 500);
  }

  return c.json({ response: full, followUpPrompts: followUps, conversationId: convId });
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

  if (process.env.OPENAI_API_KEY) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Generate JSON only for ${bp.sunSign} Sun, ${bp.moonSign} Moon. Transit: ${transitDescription}. Schema: {"title":"5 words max","narrative":"150-250 words","moodIndicator":"one of High Energy, Reflective, Social, Creative, Cautious, Romantic"}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content;
    if (raw) {
      try {
        payload = { ...payload, ...JSON.parse(raw) };
      } catch {
        /* keep default */
      }
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

/** ---------- Compatibility ---------- */
api.post("/compatibility/report", async (c) => {
  const clerkId = c.get("clerkUserId");
  const dbId = c.get("dbUserId");
  if (!(await hasPremiumEntitlement(clerkId))) {
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
  if (process.env.OPENAI_API_KEY) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `Synastry JSON only. Score ${score}. User chart longitudes ${JSON.stringify(a)}. Partner ${JSON.stringify(b)}. Keys: overall, emotional, communication, romantic, longTerm, challenges, advice (strings).`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (raw) report = JSON.parse(raw);
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

/** ---------- Subscription ---------- */
api.get("/subscription/status", async (c) => {
  const clerkId = c.get("clerkUserId");
  const dbId = c.get("dbUserId");
  const s = await fetchSubscriptionStatus(clerkId);
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
placesApi.use("*", requireAuth);
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

app.route("/api", placesApi);

/** ---------- Dream ---------- */
const dream = new Hono<{ Variables: Vars }>();
dream.use("*", requireAuth);
dream.post("/dream/interpret", async (c) => {
  const clerkId = c.get("clerkUserId");
  const dbId = c.get("dbUserId");
  if (!(await hasPremiumEntitlement(clerkId))) return c.json({ error: "premium_required" }, 402);
  const { text } = z.object({ text: z.string().min(20).max(8000) }).parse(await c.req.json());
  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  let interpretation: Record<string, string> = {
    symbols: "…",
    emotional: "…",
    astro: "…",
  };
  if (process.env.OPENAI_API_KEY) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `Dream analysis JSON for Sun ${bp?.sunSign}, Moon ${bp?.moonSign}. Dream: ${text}. Keys: symbols, emotional, astro.`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (raw) interpretation = JSON.parse(raw);
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
tarot.use("*", requireAuth);
tarot.post("/tarot/reading", async (c) => {
  const clerkId = c.get("clerkUserId");
  const dbId = c.get("dbUserId");
  if (!(await hasPremiumEntitlement(clerkId))) return c.json({ error: "premium_required" }, 402);
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
  if (process.env.OPENAI_API_KEY) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `Tarot reading for ${bp?.sunSign} Sun. Cards: ${JSON.stringify(picked)}. Intention: ${body.intention ?? ""}. Warm summary paragraph, no doom.`,
        },
      ],
    });
    summary = completion.choices[0]?.message?.content ?? summary;
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
journal.use("*", requireAuth);

journal.get("/journal/prompt", async (c) => {
  const dbId = c.get("dbUserId");
  const key = `jp:${dbId}`;
  if (redis) {
    const hit = await redis.get(key);
    if (hit) return c.json({ prompt: hit });
  }
  const bp = await prisma.birthProfile.findUnique({ where: { userId: dbId } });
  let prompt = "What felt most alive in your heart today?";
  if (process.env.OPENAI_API_KEY) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `One journal prompt for ${bp?.sunSign} Sun, ${bp?.moonSign} Moon. Single sentence.`,
        },
      ],
    });
    prompt = completion.choices[0]?.message?.content ?? prompt;
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
  const clerkId = c.get("clerkUserId");
  const dbId = c.get("dbUserId");
  const premium = await hasPremiumEntitlement(clerkId);
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
conv.use("*", requireAuth);

conv.get("/conversations", async (c) => {
  const clerkId = c.get("clerkUserId");
  const dbId = c.get("dbUserId");
  const premium = await hasPremiumEntitlement(clerkId);
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
  if (process.env.OPENAI_API_KEY) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Pick one category: Love, Career, Personal Growth, Family, Spirituality, General. Message: ${convo.messages[0].content}`,
        },
      ],
    });
    cat = completion.choices[0]?.message?.content?.trim() ?? cat;
  }
  await prisma.conversation.update({ where: { id: conversationId }, data: { category: cat } });
  return c.json({ category: cat });
});

app.route("/api", conv);

/** ---------- Timeline ---------- */
const timeline = new Hono<{ Variables: Vars }>();
timeline.use("*", requireAuth);
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
  if (process.env.OPENAI_API_KEY) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `Summarize week JSON keys theme, insight, openQuestion from journals ${JSON.stringify(journals)} chats ${JSON.stringify(chats)}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (raw) {
      const j = JSON.parse(raw);
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
exp.use("*", requireAuth);
exp.get("/experiments", async (c) => {
  const dbId = c.get("dbUserId");
  const rows = await prisma.userExperiment.findMany({ where: { userId: dbId } });
  return c.json({ experiments: rows });
});

app.route("/api", exp);

/** ---------- Daily audio ---------- */
const audio = new Hono<{ Variables: Vars }>();
audio.use("*", requireAuth);
audio.post("/daily/audio", async (c) => {
  const clerkId = c.get("clerkUserId");
  const dbId = c.get("dbUserId");
  if (!(await hasPremiumEntitlement(clerkId))) return c.json({ error: "premium_required" }, 402);
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
tiktok.use("*", requireAuth);
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
    const user = await prisma.user.findUnique({ where: { clerkId: uid } });
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

app.route("/api", cron);

export { app };