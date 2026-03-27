import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../middleware/adminAuth.js";
import { invalidateContentCache, contentCacheKeys } from "../services/content/contentService.js";
import type { FirebaseAuthContext } from "../middleware/firebase-auth.js";

const admin = new Hono<{ Variables: FirebaseAuthContext["Variables"] }>();

// ── Auth guard — all admin routes require isAdmin ─────────────────────────────
admin.use("*", requireAdminAuth);

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/health", (c) => c.json({ ok: true, role: "admin" }));

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT — Zodiac Signs
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/content/signs", async (c) => {
  const rows = await prisma.astrologySign.findMany({ orderBy: { sign: "asc" } });
  return c.json(rows);
});

admin.put("/content/signs/:sign", async (c) => {
  const sign = decodeURIComponent(c.req.param("sign"));
  const body = await c.req.json();
  const row = await prisma.astrologySign.update({ where: { sign }, data: body });
  await invalidateContentCache(contentCacheKeys.sign(sign));
  return c.json(row);
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT — Planets
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/content/planets", async (c) => {
  const rows = await prisma.astrologyPlanet.findMany({ orderBy: { name: "asc" } });
  return c.json(rows);
});

admin.put("/content/planets/:name", async (c) => {
  const name = decodeURIComponent(c.req.param("name"));
  const body = await c.req.json();
  const row = await prisma.astrologyPlanet.update({ where: { name }, data: body });
  await invalidateContentCache(contentCacheKeys.planet(name));
  return c.json(row);
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT — Houses
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/content/houses", async (c) => {
  const rows = await prisma.astrologyHouse.findMany({ orderBy: { number: "asc" } });
  return c.json(rows);
});

admin.put("/content/houses/:number", async (c) => {
  const number = parseInt(c.req.param("number"), 10);
  const body = await c.req.json();
  const row = await prisma.astrologyHouse.update({ where: { number }, data: body });
  await invalidateContentCache(contentCacheKeys.house(number));
  return c.json(row);
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT — Transits
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/content/transits", async (c) => {
  const { transitPlanet, natalTarget, aspect } = c.req.query();
  const rows = await prisma.astrologyTransit.findMany({
    where: {
      ...(transitPlanet ? { transitPlanet } : {}),
      ...(natalTarget ? { natalTarget } : {}),
      ...(aspect ? { aspect } : {}),
    },
    orderBy: [{ transitPlanet: "asc" }, { natalTarget: "asc" }],
    take: 100,
  });
  return c.json(rows);
});

admin.put("/content/transits/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const row = await prisma.astrologyTransit.update({ where: { id }, data: body });
  await invalidateContentCache(
    contentCacheKeys.transit(row.transitPlanet, row.natalTarget, row.aspect)
  );
  return c.json(row);
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT — Tarot
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/content/tarot", async (c) => {
  const rows = await prisma.tarotCardContent.findMany({ orderBy: { cardId: "asc" } });
  return c.json(rows);
});

admin.put("/content/tarot/:cardId", async (c) => {
  const cardId = parseInt(c.req.param("cardId"), 10);
  const body = await c.req.json();
  const row = await prisma.tarotCardContent.update({ where: { cardId }, data: body });
  await invalidateContentCache(contentCacheKeys.tarot(cardId));
  return c.json(row);
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT — Coffee Symbols
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/content/coffee-symbols", async (c) => {
  const rows = await prisma.coffeeSymbol.findMany({ orderBy: { symbol: "asc" } });
  return c.json(rows);
});

admin.put("/content/coffee-symbols/:symbol", async (c) => {
  const symbol = decodeURIComponent(c.req.param("symbol"));
  const body = await c.req.json();
  const row = await prisma.coffeeSymbol.update({ where: { symbol }, data: body });
  await invalidateContentCache(contentCacheKeys.coffeeSymbol(symbol));
  return c.json(row);
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT — Challenge Library
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/content/challenges", async (c) => {
  const rows = await prisma.challengeLibraryEntry.findMany({ orderBy: { challengeId: "asc" } });
  return c.json(rows);
});

admin.put("/content/challenges/:id", async (c) => {
  const challengeId = c.req.param("id");
  const body = await c.req.json();
  const row = await prisma.challengeLibraryEntry.update({ where: { challengeId }, data: body });
  await invalidateContentCache(contentCacheKeys.challenge(challengeId));
  return c.json(row);
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT — Conflict Framework
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/content/conflicts", async (c) => {
  const rows = await prisma.conflictFrameworkEntry.findMany({ orderBy: { conflictTypeId: "asc" } });
  return c.json(rows);
});

admin.put("/content/conflicts/:id", async (c) => {
  const conflictTypeId = c.req.param("id");
  const body = await c.req.json();
  const row = await prisma.conflictFrameworkEntry.update({ where: { conflictTypeId }, data: body });
  await invalidateContentCache(contentCacheKeys.conflict(conflictTypeId));
  return c.json(row);
});

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const PromptTemplateSchema = z.object({
  featureId: z.string().min(1),
  templateKey: z.string().min(1),
  systemPrompt: z.string().min(10),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

admin.get("/prompts", async (c) => {
  const rows = await prisma.aiPromptTemplate.findMany({
    orderBy: [{ featureId: "asc" }, { templateKey: "asc" }],
  });
  return c.json(rows);
});

admin.post("/prompts", async (c) => {
  const body = PromptTemplateSchema.parse(await c.req.json());
  const row = await prisma.aiPromptTemplate.create({
    data: { ...body, isActive: body.isActive ?? true },
  });
  return c.json(row, 201);
});

admin.put("/prompts/:id", async (c) => {
  const id = c.req.param("id");
  const body = PromptTemplateSchema.partial().parse(await c.req.json());
  const row = await prisma.aiPromptTemplate.update({ where: { id }, data: body });
  await invalidateContentCache(contentCacheKeys.prompt(row.featureId, row.templateKey));
  return c.json(row);
});

admin.delete("/prompts/:id", async (c) => {
  const id = c.req.param("id");
  const row = await prisma.aiPromptTemplate.delete({ where: { id } });
  await invalidateContentCache(contentCacheKeys.prompt(row.featureId, row.templateKey));
  return c.json({ deleted: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// SAFETY RESPONSES
// ─────────────────────────────────────────────────────────────────────────────

const SafetyResponseSchema = z.object({
  flagType: z.string().min(1),
  response: z.string().min(10),
  escalationNote: z.string().optional(),
});

admin.get("/safety-responses", async (c) => {
  const rows = await prisma.safetyResponseContent.findMany({ orderBy: { flagType: "asc" } });
  return c.json(rows);
});

admin.put("/safety-responses/:flagType", async (c) => {
  const flagType = decodeURIComponent(c.req.param("flagType"));
  const body = SafetyResponseSchema.partial().parse(await c.req.json());
  const row = await prisma.safetyResponseContent.update({ where: { flagType }, data: body });
  await invalidateContentCache(contentCacheKeys.safety(flagType));
  return c.json(row);
});

// ─────────────────────────────────────────────────────────────────────────────
// STATS — Basic Usage Metrics
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/stats/overview", async (c) => {
  const [
    totalUsers,
    totalSessions,
    totalMessages,
    premiumUsers,
    totalSummaries,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.chatSession.count(),
    prisma.chatMessage.count(),
    prisma.user.count({ where: { subscriptionStatus: { in: ["premium", "vip"] } } }),
    prisma.chatSessionSummary.count(),
  ]);

  return c.json({
    totalUsers,
    totalSessions,
    totalMessages,
    premiumUsers,
    totalSummaries,
    freeUsers: totalUsers - premiumUsers,
    avgMessagesPerSession:
      totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0,
  });
});

admin.get("/stats/content-counts", async (c) => {
  const [signs, planets, houses, transits, tarot, coffeeSymbols, challenges, conflicts, prompts, safetyResponses] =
    await Promise.all([
      prisma.astrologySign.count(),
      prisma.astrologyPlanet.count(),
      prisma.astrologyHouse.count(),
      prisma.astrologyTransit.count(),
      prisma.tarotCardContent.count(),
      prisma.coffeeSymbol.count(),
      prisma.challengeLibraryEntry.count(),
      prisma.conflictFrameworkEntry.count(),
      prisma.aiPromptTemplate.count(),
      prisma.safetyResponseContent.count(),
    ]);

  return c.json({
    signs,
    planets,
    houses,
    transits,
    tarot,
    coffeeSymbols,
    challenges,
    conflicts,
    prompts,
    safetyResponses,
  });
});

admin.get("/stats/recent-activity", async (c) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

  const [newUsers, newSessions, newMessages] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.chatSession.count({ where: { createdAt: { gte: since } } }),
    prisma.chatMessage.count({ where: { createdAt: { gte: since } } }),
  ]);

  return c.json({ since: since.toISOString(), newUsers, newSessions, newMessages });
});

// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT (read-only for now)
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/users", async (c) => {
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 100);
  const offset = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionStatus: true,
        isAdmin: true,
        createdAt: true,
        _count: { select: { chatSessions: true } },
      },
    }),
    prisma.user.count(),
  ]);

  return c.json({ users, total, page, limit });
});

export { admin as adminRouter };
