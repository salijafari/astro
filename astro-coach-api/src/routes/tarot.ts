import type { DecodedIdToken } from "firebase-admin/auth";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { getCardById } from "../data/tarot-deck.js";
import { getDisplayName } from "../lib/displayName.js";
import { prisma } from "../lib/prisma.js";
import { hasFeatureAccess } from "../lib/revenuecat.js";
import { sanitizeAssistantText } from "../lib/sanitizeText.js";
import { streamClaudeCompletionAsSSE } from "../lib/streamCompletion.js";
import { requireFirebaseAuth } from "../middleware/firebase-auth.js";
import { buildTarotSystemPrompt } from "../services/ai/systemPrompts.js";
import { generateCompletion } from "../services/ai/generateCompletion.js";
import type { RequestComplexity } from "../services/ai/modelRouter.js";
import {
  drawFullSpread,
  getCardsForDepth,
  getNewCardsForExpansion,
  type DrawnCard,
} from "../services/tarot/tarot-engine.js";
import { getNextDepth, getSpreadDepth } from "../services/tarot/spreads.js";

type Vars = { firebaseUid: string; firebaseUser: DecodedIdToken; dbUserId: string };

const tarot = new Hono<{ Variables: Vars }>();
tarot.use("*", requireFirebaseAuth);

function sseStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

function buildCardsForPrompt(drawn: DrawnCard[], lang: "en" | "fa", depthId: string) {
  const depth = getSpreadDepth(depthId);
  return drawn.map((d) => {
    const card = getCardById(d.cardId);
    const posLabel =
      lang === "fa"
        ? depth?.positions.find((p) => p.index === d.positionIndex)?.label.fa ?? d.positionLabel
        : depth?.positions.find((p) => p.index === d.positionIndex)?.label.en ?? d.positionLabel;
    return {
      cardName: card ? (lang === "fa" ? card.name.fa : card.name.en) : d.cardId,
      position: posLabel,
      positionMeaning: d.positionMeaning,
      isReversed: d.isReversed,
      keywords: card ? (d.isReversed ? card.keywords.reversed : card.keywords.upright) : [],
      symbolism: card?.symbolism ?? "",
    };
  });
}

function getPreviousDepthId(currentDepth: string): string | undefined {
  const order = ["single", "three", "five", "celtic-cross"] as const;
  const idx = order.indexOf(currentDepth as (typeof order)[number]);
  return idx > 0 ? order[idx - 1] : undefined;
}

const depthComplexity = (depth: string): RequestComplexity => {
  if (depth === "celtic-cross") return "deep";
  if (depth === "five") return "standard";
  return "lightweight";
};

tarot.post("/draw", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbUserId = c.get("dbUserId");
  const body = z
    .object({
      question: z.string().max(500).optional(),
      language: z.enum(["en", "fa"]).optional(),
    })
    .parse(await c.req.json().catch(() => ({})));
  const question = body.question?.trim() ? body.question.trim() : undefined;

  const isPremium = await hasFeatureAccess(firebaseUid, dbUserId);
  if (!isPremium) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const existing = await prisma.tarotReading.findFirst({
      where: { userId: dbUserId, createdAt: { gte: todayStart } },
      select: { id: true },
    });
    if (existing) {
      return c.json({ error: "daily_limit_reached", code: "daily_limit" }, 403);
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: dbUserId },
    select: { language: true },
  });
  const bodyLang = body.language;
  const language = (bodyLang === "en" || bodyLang === "fa"
    ? bodyLang
    : (user?.language === "en" ? "en" : "fa")) as "en" | "fa";

  const allCards = drawFullSpread();
  const reading = await prisma.tarotReading.create({
    data: {
      userId: dbUserId,
      question: question ?? null,
      allCards: allCards as object,
      currentDepth: "single",
      interpretations: {},
      language,
    },
  });

  const revealedCards = getCardsForDepth(allCards, "single");
  return c.json({
    reading: {
      id: reading.id,
      question: reading.question ?? undefined,
      currentDepth: reading.currentDepth,
      revealedCards,
      interpretations: {},
      language,
      createdAt: reading.createdAt.toISOString(),
    },
  });
});

tarot.post("/interpret", async (c) => {
  const dbUserId = c.get("dbUserId");
  const raw = z
    .object({
      readingId: z.string().min(1),
      content: z.string().optional(),
      message: z.string().optional(),
    })
    .parse(await c.req.json().catch(() => ({})));
  const readingId = raw.readingId;

  const reading = await prisma.tarotReading.findUnique({ where: { id: readingId } });
  if (!reading || reading.userId !== dbUserId) return c.json({ error: "not_found" }, 404);

  const interpretations = (reading.interpretations as Record<string, string>) ?? {};
  const cached = interpretations[reading.currentDepth];

  const user = await prisma.user.findUnique({
    where: { id: dbUserId },
    include: { birthProfile: true },
  });
  if (!user) return c.json({ error: "user not found" }, 404);

  const lang = (reading.language === "en" ? "en" : "fa") as "en" | "fa";
  const allCards = reading.allCards as DrawnCard[];
  const depthId = reading.currentDepth as "single" | "three" | "five" | "celtic-cross";
  const cardsForDepth = getCardsForDepth(allCards, depthId);
  const cardsForPrompt = buildCardsForPrompt(cardsForDepth, lang, depthId);

  const prevDepthId = getPreviousDepthId(reading.currentDepth);
  const previousInterpretation = prevDepthId ? interpretations[prevDepthId] : undefined;

  const system = buildTarotSystemPrompt({
    userName: getDisplayName(user, lang),
    language: lang,
    sunSign: user.birthProfile?.sunSign ?? undefined,
    moonSign: user.birthProfile?.moonSign ?? undefined,
    risingSign: user.birthProfile?.risingSign ?? undefined,
    depthId,
    cards: cardsForPrompt,
    question: reading.question ?? undefined,
    previousInterpretation,
  });

  const userMessage =
    reading.question?.trim() ||
    (lang === "fa" ? "لطفاً این فال را تفسیر کن." : "Please interpret this reading.");

  c.header("X-Accel-Buffering", "no");
  return streamSSE(c, async (stream) => {
    const ssePayload = sseStringify;

    if (cached?.trim()) {
      await stream.writeSSE({
        data: ssePayload({
          type: "done",
          content: cached,
          followUpPrompts: [] as string[],
        }),
      });
      return;
    }

    try {
      const streamResult = await streamClaudeCompletionAsSSE(stream, {
        sseStringify: ssePayload,
        feature: "tarot_interpret",
        complexity: depthComplexity(depthId),
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
        safety: { mode: "check", userId: dbUserId, text: `tarot:${readingId}:${userMessage.slice(0, 200)}` },
        timeoutMs: 90_000,
        maxRetries: 0,
      });

      if (streamResult.kind === "unsafe") {
        const safeText = streamResult.safeResponse ?? "I can’t continue this reading safely right now.";
        const clean = sanitizeAssistantText(safeText);
        const updated = { ...interpretations, [reading.currentDepth]: clean };
        await prisma.tarotReading.update({
          where: { id: readingId },
          data: { interpretations: updated as object },
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
      const updated = { ...interpretations, [reading.currentDepth]: clean };
      await prisma.tarotReading.update({
        where: { id: readingId },
        data: { interpretations: updated as object },
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
  const dbUserId = c.get("dbUserId");
  const raw = z
    .object({ readingId: z.string().min(1) })
    .parse(await c.req.json().catch(() => ({})));
  const readingId = raw.readingId;

  const reading = await prisma.tarotReading.findUnique({ where: { id: readingId } });
  if (!reading || reading.userId !== dbUserId) return c.json({ error: "not_found" }, 404);

  const interpretations = (reading.interpretations as Record<string, string>) ?? {};
  const cached = interpretations[reading.currentDepth];
  if (cached?.trim()) return c.json({ content: cached });

  const user = await prisma.user.findUnique({
    where: { id: dbUserId },
    include: { birthProfile: true },
  });
  if (!user) return c.json({ error: "user not found" }, 404);

  const lang = (reading.language === "en" ? "en" : "fa") as "en" | "fa";
  const allCards = reading.allCards as DrawnCard[];
  const depthId = reading.currentDepth as "single" | "three" | "five" | "celtic-cross";
  const cardsForDepth = getCardsForDepth(allCards, depthId);
  const cardsForPrompt = buildCardsForPrompt(cardsForDepth, lang, depthId);
  const prevDepthId = getPreviousDepthId(reading.currentDepth);
  const previousInterpretation = prevDepthId ? interpretations[prevDepthId] : undefined;

  const system = buildTarotSystemPrompt({
    userName: getDisplayName(user, lang),
    language: lang,
    sunSign: user.birthProfile?.sunSign ?? undefined,
    moonSign: user.birthProfile?.moonSign ?? undefined,
    risingSign: user.birthProfile?.risingSign ?? undefined,
    depthId,
    cards: cardsForPrompt,
    question: reading.question ?? undefined,
    previousInterpretation,
  });

  const userMessage =
    reading.question?.trim() ||
    (lang === "fa" ? "لطفاً این فال را تفسیر کن." : "Please interpret this reading.");

  const result = await generateCompletion({
    feature: "tarot_interpret",
    complexity: depthComplexity(depthId),
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMessage },
    ],
    safety: { mode: "check", userId: dbUserId, text: `tarot_sync:${readingId}` },
    timeoutMs: 90_000,
    maxRetries: 0,
  });

  if (result.kind === "unsafe") {
    const clean = sanitizeAssistantText(result.safeResponse ?? "");
    const updated = { ...interpretations, [reading.currentDepth]: clean };
    await prisma.tarotReading.update({
      where: { id: readingId },
      data: { interpretations: updated as object },
    });
    return c.json({ content: clean });
  }

  if (result.kind === "error") {
    return c.json({ error: "interpret_failed", message: result.message }, 500);
  }

  const clean = sanitizeAssistantText(result.content);
  const updated = { ...interpretations, [reading.currentDepth]: clean };
  await prisma.tarotReading.update({
    where: { id: readingId },
    data: { interpretations: updated as object },
  });
  return c.json({ content: clean });
});

tarot.post("/deepen", async (c) => {
  const firebaseUid = c.get("firebaseUid");
  const dbUserId = c.get("dbUserId");
  const raw = z.object({ readingId: z.string().min(1) }).parse(await c.req.json().catch(() => ({})));
  const readingId = raw.readingId;

  const reading = await prisma.tarotReading.findUnique({ where: { id: readingId } });
  if (!reading || reading.userId !== dbUserId) return c.json({ error: "not_found" }, 404);
  if (reading.currentDepth === "celtic-cross") return c.json({ error: "max_depth" }, 400);

  const nextDepth = getNextDepth(reading.currentDepth);
  if (!nextDepth) return c.json({ error: "no next depth" }, 400);

  if (nextDepth.isPremium) {
    const isPremium = await hasFeatureAccess(firebaseUid, dbUserId);
    if (!isPremium) return c.json({ error: "premium_required", code: "premium_required" }, 403);
  }

  const allCards = reading.allCards as DrawnCard[];
  const newCards = getNewCardsForExpansion(allCards, reading.currentDepth, nextDepth.id);
  const allRevealedCards = getCardsForDepth(allCards, nextDepth.id);

  await prisma.tarotReading.update({
    where: { id: readingId },
    data: { currentDepth: nextDepth.id },
  });

  return c.json({
    reading: {
      id: reading.id,
      currentDepth: nextDepth.id,
      newCards,
      allRevealedCards,
    },
  });
});

tarot.get("/history", async (c) => {
  const dbUserId = c.get("dbUserId");
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const limit = Math.min(20, Math.max(1, parseInt(c.req.query("limit") ?? "10", 10)));
  const skip = (page - 1) * limit;

  const where = { userId: dbUserId };
  const [readings, total] = await Promise.all([
    prisma.tarotReading.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.tarotReading.count({ where }),
  ]);

  return c.json({
    readings,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

tarot.get("/reading/:id", async (c) => {
  const dbUserId = c.get("dbUserId");
  const id = c.req.param("id");
  const reading = await prisma.tarotReading.findFirst({
    where: { id, userId: dbUserId },
  });
  if (!reading) return c.json({ error: "not_found" }, 404);
  return c.json({
    reading: {
      ...reading,
      createdAt: reading.createdAt.toISOString(),
      updatedAt: reading.updatedAt.toISOString(),
    },
  });
});

export default tarot;
