import type { DecodedIdToken } from "firebase-admin/auth";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { DateTime } from "luxon";
import { z } from "zod";
import { getCardById } from "../data/tarot-deck.js";
import { prisma } from "../lib/prisma.js";
import { hasFeatureAccess } from "../lib/revenuecat.js";
import { sanitizeAssistantText } from "../lib/sanitizeText.js";
import { streamClaudeCompletionAsSSE } from "../lib/streamCompletion.js";
import { requireFirebaseAuth } from "../middleware/firebase-auth.js";
import { buildTarotSystemPrompt } from "../services/ai/systemPrompts.js";
import { generateCompletion } from "../services/ai/generateCompletion.js";
import { drawCards, type DrawnCard } from "../services/tarot/tarot-engine.js";
import { getSpreadById } from "../services/tarot/spreads.js";

type Vars = {
  firebaseUid: string;
  firebaseUser: DecodedIdToken;
  dbUserId: string;
};

const drawnCardSchema = z.object({
  cardId: z.string(),
  position: z.string(),
  positionMeaning: z.string(),
  positionRole: z.string(),
  isReversed: z.boolean(),
});

function startEndUtcForUserDay(tz: string): { dayStart: Date; dayEnd: Date } {
  const local = DateTime.now().setZone(tz);
  return {
    dayStart: local.startOf("day").toUTC().toJSDate(),
    dayEnd: local.endOf("day").toUTC().toJSDate(),
  };
}

function parseDrawnCards(json: unknown): DrawnCard[] {
  return z.array(drawnCardSchema).parse(json);
}

function buildCardsForPrompt(
  drawn: DrawnCard[],
  lang: "en" | "fa",
): Array<{
  cardName: string;
  position: string;
  positionMeaning: string;
  isReversed: boolean;
  keywords: string[];
  symbolism: string;
}> {
  return drawn.map((d) => {
    const card = getCardById(d.cardId);
    const cardName = card ? (lang === "fa" ? card.name.fa : card.name.en) : d.cardId;
    const keywords = card
      ? d.isReversed
        ? card.keywords.reversed
        : card.keywords.upright
      : [];
    return {
      cardName,
      position: d.position,
      positionMeaning: d.positionMeaning,
      isReversed: d.isReversed,
      keywords,
      symbolism: card?.symbolism ?? "",
    };
  });
}

const tarot = new Hono<{ Variables: Vars }>();

tarot.use("*", requireFirebaseAuth);

tarot.post("/draw", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");
  const body = z
    .object({
      spreadId: z.string().min(1),
      question: z.string().max(500).optional(),
    })
    .parse(await c.req.json());

  const spread = getSpreadById(body.spreadId);
  if (!spread) return c.json({ error: "unknown_spread" }, 400);

  const user = await prisma.user.findUnique({
    where: { id: dbId },
    include: { birthProfile: true },
  });
  if (!user) return c.json({ error: "not_found" }, 404);

  const tz = user.birthProfile?.birthTimezone ?? "UTC";
  const premium = await hasFeatureAccess(firebaseUid, dbId);

  if (!premium) {
    if (body.spreadId !== "daily-card") {
      return c.json({ error: "premium_required" }, 402);
    }
    const { dayStart, dayEnd } = startEndUtcForUserDay(tz);
    const already = await prisma.tarotReading.count({
      where: {
        userId: dbId,
        spreadId: "daily-card",
        createdAt: { gte: dayStart, lte: dayEnd },
      },
    });
    if (already >= 1) {
      return c.json({ error: "daily_limit_reached" }, 403);
    }
  }

  let draw;
  try {
    draw = drawCards(body.spreadId);
  } catch {
    return c.json({ error: "draw_failed" }, 400);
  }

  const lang: "en" | "fa" = user.language === "en" ? "en" : "fa";

  const row = await prisma.tarotReading.create({
    data: {
      userId: dbId,
      spreadId: body.spreadId,
      question: body.question?.trim() || null,
      drawnCards: draw.cards as object,
      interpretation: null,
      language: lang,
    },
  });

  return c.json({
    reading: {
      id: row.id,
      spreadId: row.spreadId,
      question: row.question ?? undefined,
      drawnCards: draw.cards,
      language: row.language,
      createdAt: row.createdAt.toISOString(),
    },
  });
});

async function loadReadingForUser(readingId: string, dbId: string) {
  return prisma.tarotReading.findFirst({
    where: { id: readingId, userId: dbId },
  });
}

async function getUserWithProfile(dbId: string) {
  return prisma.user.findUnique({
    where: { id: dbId },
    include: { birthProfile: true },
  });
}

function sseStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

tarot.post("/interpret", async (c) => {
  const dbId = c.get("dbUserId");
  const raw = z
    .object({
      readingId: z.string().min(1),
      content: z.string().optional(),
      message: z.string().optional(),
    })
    .parse(await c.req.json());
  const readingId = raw.readingId;

  const reading = await loadReadingForUser(readingId, dbId);
  if (!reading) return c.json({ error: "not_found" }, 404);

  const user = await getUserWithProfile(dbId);
  if (!user) return c.json({ error: "not_found" }, 404);

  const bp = user.birthProfile;
  const lang: "en" | "fa" = reading.language === "en" ? "en" : "fa";
  const spread = getSpreadById(reading.spreadId);
  const spreadName = spread ? (lang === "fa" ? spread.name.fa : spread.name.en) : reading.spreadId;
  const drawn = parseDrawnCards(reading.drawnCards);
  const cards = buildCardsForPrompt(drawn, lang);

  const system = buildTarotSystemPrompt({
    userName: user.name?.trim() || "there",
    language: lang,
    sunSign: bp?.sunSign,
    moonSign: bp?.moonSign,
    risingSign: bp?.risingSign ?? undefined,
    spreadName,
    cards,
    question: reading.question,
  });

  const userMessage =
    reading.question?.trim() ||
    (lang === "fa" ? "لطفاً این فال را تفسیر کن." : "Please interpret this reading.");

  c.header("X-Accel-Buffering", "no");
  return streamSSE(c, async (stream) => {
    const ssePayload = sseStringify;

    if (reading.interpretation?.trim()) {
      await stream.writeSSE({
        data: ssePayload({
          type: "done",
          content: reading.interpretation,
          followUpPrompts: [] as string[],
        }),
      });
      return;
    }

    try {
      const streamResult = await streamClaudeCompletionAsSSE(stream, {
        sseStringify: ssePayload,
        feature: "tarot_interpret",
        complexity: "lightweight",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
        safety: { mode: "check", userId: dbId, text: `tarot:${readingId}:${userMessage.slice(0, 200)}` },
        timeoutMs: 90_000,
        maxRetries: 0,
      });

      if (streamResult.kind === "unsafe") {
        const safeText = streamResult.safeResponse ?? "I can’t continue this reading safely right now.";
        const clean = sanitizeAssistantText(safeText);
        await prisma.tarotReading.update({
          where: { id: readingId },
          data: { interpretation: clean },
        });
        await stream.writeSSE({
          data: ssePayload({ type: "done", content: clean, followUpPrompts: [] }),
        });
        return;
      }

      if (streamResult.kind === "error") {
        await stream.writeSSE({
          data: ssePayload({ type: "error", error: "interpret_failed", errorType: streamResult.errorType }),
        });
        return;
      }

      const clean = sanitizeAssistantText(streamResult.content);
      await prisma.tarotReading.update({
        where: { id: readingId },
        data: { interpretation: clean },
      });
      await stream.writeSSE({
        data: ssePayload({ type: "done", content: clean, followUpPrompts: [] }),
      });
    } catch {
      await stream.writeSSE({ data: ssePayload({ type: "error", error: "interpret_failed" }) });
    }
  });
});

tarot.post("/interpret-sync", async (c) => {
  const dbId = c.get("dbUserId");
  const { readingId } = z.object({ readingId: z.string().min(1) }).parse(await c.req.json());

  const reading = await loadReadingForUser(readingId, dbId);
  if (!reading) return c.json({ error: "not_found" }, 404);

  const user = await getUserWithProfile(dbId);
  if (!user) return c.json({ error: "not_found" }, 404);

  if (reading.interpretation?.trim()) {
    return c.json({ content: reading.interpretation });
  }

  const bp = user.birthProfile;
  const lang: "en" | "fa" = reading.language === "en" ? "en" : "fa";
  const spread = getSpreadById(reading.spreadId);
  const spreadName = spread ? (lang === "fa" ? spread.name.fa : spread.name.en) : reading.spreadId;
  const drawn = parseDrawnCards(reading.drawnCards);
  const cards = buildCardsForPrompt(drawn, lang);

  const system = buildTarotSystemPrompt({
    userName: user.name?.trim() || "there",
    language: lang,
    sunSign: bp?.sunSign,
    moonSign: bp?.moonSign,
    risingSign: bp?.risingSign ?? undefined,
    spreadName,
    cards,
    question: reading.question,
  });

  const userMessage =
    reading.question?.trim() ||
    (lang === "fa" ? "لطفاً این فال را تفسیر کن." : "Please interpret this reading.");

  const result = await generateCompletion({
    feature: "tarot_interpret",
    complexity: "lightweight",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMessage },
    ],
    safety: { mode: "check", userId: dbId, text: `tarot_sync:${readingId}` },
    timeoutMs: 90_000,
    maxRetries: 0,
  });

  if (result.kind === "unsafe") {
    const clean = sanitizeAssistantText(result.safeResponse ?? "");
    await prisma.tarotReading.update({ where: { id: readingId }, data: { interpretation: clean } });
    return c.json({ content: clean });
  }

  if (result.kind === "error") {
    return c.json({ error: "interpret_failed", message: result.message }, 500);
  }

  const clean = sanitizeAssistantText(result.content);
  await prisma.tarotReading.update({ where: { id: readingId }, data: { interpretation: clean } });
  return c.json({ content: clean });
});

tarot.get("/reading/:id", async (c) => {
  const dbId = c.get("dbUserId");
  const id = c.req.param("id");
  const r = await prisma.tarotReading.findFirst({
    where: { id, userId: dbId },
  });
  if (!r) return c.json({ error: "not_found" }, 404);
  return c.json({
    reading: {
      id: r.id,
      spreadId: r.spreadId,
      question: r.question ?? undefined,
      drawnCards: r.drawnCards,
      interpretation: r.interpretation ?? undefined,
      language: r.language,
      createdAt: r.createdAt.toISOString(),
    },
  });
});

tarot.get("/history", async (c) => {
  const dbId = c.get("dbUserId");
  const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(c.req.query("limit") ?? "10", 10) || 10));
  const skip = (page - 1) * limit;

  const [readings, total] = await Promise.all([
    prisma.tarotReading.findMany({
      where: { userId: dbId, interpretation: { not: null } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.tarotReading.count({
      where: { userId: dbId, interpretation: { not: null } },
    }),
  ]);

  return c.json({
    readings: readings.map((r) => ({
      id: r.id,
      spreadId: r.spreadId,
      question: r.question ?? undefined,
      drawnCards: r.drawnCards,
      interpretation: r.interpretation ?? undefined,
      language: r.language,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
  });
});

export default tarot;
