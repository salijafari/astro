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
import type { RequestComplexity } from "../services/ai/modelRouter.js";
import { drawCards, type DrawnCard } from "../services/tarot/tarot-engine.js";
import { getSpreadById } from "../services/tarot/spreads.js";
import {
  TAROT_SPREAD_CARD_COUNT,
  TAROT_SPREAD_POSITIONS,
} from "../constants/tarot.js";
import { TAROT_CARDS_JSON } from "../lib/tarotCardsJson.js";
import type { TarotCard } from "../types/tarot.js";

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

type DrawnTarotPayload = TarotCard & {
  position: number;
  positionName: string;
  reversed: boolean;
};

/**
 * POST /api/tarot/reading
 * Draws cards from the static JSON deck and returns a synchronous AI interpretation (premium).
 */
tarot.post("/reading", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbId = c.get("dbUserId");

  const premium = await hasFeatureAccess(firebaseUid, dbId);
  if (!premium) return c.json({ error: "premium_required" }, 402);

  try {
    const body = (await c.req.json()) as {
      spreadType?: string;
      question?: string;
      language?: string;
    };

    const spreadType = ["single", "three", "celtic"].includes(body.spreadType ?? "")
      ? (body.spreadType as "single" | "three" | "celtic")
      : "single";
    const question = body.question?.trim() ? body.question.trim() : null;
    const language: "en" | "fa" = body.language === "en" ? "en" : "fa";
    const cardCount = TAROT_SPREAD_CARD_COUNT[spreadType] ?? 1;

    const allCards = [...TAROT_CARDS_JSON];
    const shuffled = allCards.sort(() => Math.random() - 0.5);
    const drawnCards: DrawnTarotPayload[] = shuffled.slice(0, cardCount).map((card, index) => ({
      ...card,
      position: index,
      positionName: TAROT_SPREAD_POSITIONS[spreadType]?.[index] ?? `Card ${index + 1}`,
      reversed: Math.random() > 0.7,
    }));

    const cardLines = drawnCards.map((card) => {
      const loc = card[language];
      return `${card.positionName}: ${loc.title}${card.reversed ? " (Reversed)" : ""} — ${loc.description}`;
    }).join("\n");

    const systemPrompt =
      language === "fa"
        ? "شما اختر هستید، یک راهنمای روحانی مبتنی بر طالع‌بینی فارسی و عرفان. تفسیری عمیق، گرم و شهودی از کارت‌های طاروت ارائه دهید. از زبان فارسی زیبا و روان استفاده کنید و ارتباط معنادار بین کارت‌ها برقرار کنید."
        : "You are Akhtar, a spiritual guide rooted in Persian astrology and mysticism. Provide a deep, warm, and intuitive tarot interpretation. Connect the cards meaningfully and offer personal, actionable insight.";

    const userPrompt = question
      ? language === "fa"
        ? `سوال: ${question}\n\nکارت‌های کشیده شده:\n${cardLines}\n\nلطفاً یک تفسیر جامع ارائه دهید که کارت‌ها را به سوال مرتبط کند.`
        : `Question: ${question}\n\nCards drawn:\n${cardLines}\n\nPlease provide a comprehensive interpretation connecting these cards to the question.`
      : language === "fa"
        ? `کارت‌های کشیده شده:\n${cardLines}\n\nلطفاً یک تفسیر جامع و معنادار از این کارت‌ها ارائه دهید.`
        : `Cards drawn:\n${cardLines}\n\nPlease provide a comprehensive and meaningful interpretation of these cards.`;

    const complexity: RequestComplexity = "deep";
    const result = await generateCompletion({
      feature: "tarot_reading",
      complexity,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      safety: { mode: "check", userId: dbId, text: question ?? "tarot reading request" },
      maxTokens: 1200,
    });

    let interpretationText: string;
    if (result.kind === "success") {
      interpretationText = sanitizeAssistantText(result.content);
    } else if (result.kind === "unsafe") {
      interpretationText = sanitizeAssistantText(result.safeResponse ?? "");
    } else {
      console.error("[tarot/reading] LLM error:", result);
      return c.json({ error: "Could not generate reading" }, 500);
    }

    const reading = await prisma.tarotReading.create({
      data: {
        userId: dbId,
        spreadId: spreadType,
        question,
        drawnCards: drawnCards as object,
        interpretation: interpretationText,
        language,
      },
    });

    return c.json({
      readingId: reading.id,
      spreadType,
      cards: drawnCards,
      interpretation: interpretationText,
      language,
    });
  } catch (e) {
    console.error("[tarot/reading]", e);
    return c.json({ error: "Reading failed" }, 500);
  }
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
  try {
    const readings = await prisma.tarotReading.findMany({
      where: { userId: dbId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        spreadId: true,
        question: true,
        interpretation: true,
        language: true,
        createdAt: true,
        drawnCards: true,
      },
    });
    return c.json({
      readings: readings.map((r) => ({
        id: r.id,
        spreadType: r.spreadId,
        question: r.question,
        interpretation: r.interpretation,
        language: r.language,
        createdAt: r.createdAt,
        cards: r.drawnCards,
      })),
    });
  } catch (e) {
    console.error("[tarot/history]", e);
    return c.json({ error: "Could not load history" }, 500);
  }
});

export default tarot;
