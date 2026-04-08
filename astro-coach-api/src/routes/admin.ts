import type { Prisma } from "@prisma/client";
import { Hono } from "hono";
import { DateTime } from "luxon";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminUserAuth } from "../middleware/adminUserAuth.js";
import { adminAuth, adminMessaging } from "../lib/firebase-admin.js";
import { invalidateContentCache, contentCacheKeys } from "../services/content/contentService.js";
import { sendMulticastToTokens } from "../services/notifications.js";
import type { FirebaseAuthContext } from "../middleware/firebase-auth.js";

const admin = new Hono<{ Variables: FirebaseAuthContext["Variables"] }>();

const PRIMARY_ADMIN_EMAIL = "publishvibe@gmail.com";

/** Writes an admin audit row (mutations on dashboard-managed resources). */
async function logAdminAction(
  adminEmail: string,
  action: string,
  targetId?: string | null,
  targetEmail?: string | null,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action,
      targetId: targetId ?? undefined,
      targetEmail: targetEmail ?? undefined,
      metadata: metadata === undefined ? undefined : metadata,
    },
  });
}

// ── Auth: Firebase + (AdminUser by DB email OR legacy User.isAdmin) ──────────
admin.use("*", requireAdminUserAuth);

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/health", (c) => c.json({ ok: true, role: "admin" }));

admin.get("/check", (c) => {
  const email = c.get("adminEmail") ?? "";
  return c.json({ isAdmin: true, email });
});

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD STATS (excludes soft-deleted users)
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/stats", async (c) => {
  const now = DateTime.utc();
  const startDay = now.startOf("day").toJSDate();
  const startWeek = now.startOf("week").toJSDate();
  const startMonth = now.startOf("month").toJSDate();
  const notDeleted = { deletedAt: null } satisfies Prisma.UserWhereInput;

  const [
    totalUsers,
    premiumUsers,
    trialUsers,
    newUsersToday,
    newUsersThisWeek,
    newUsersThisMonth,
  ] = await Promise.all([
    prisma.user.count({ where: notDeleted }),
    prisma.user.count({
      where: {
        ...notDeleted,
        subscriptionStatus: { in: ["premium", "vip"] },
      },
    }),
    prisma.user.count({
      where: {
        ...notDeleted,
        subscriptionStatus: "free",
        trialStartedAt: { not: null },
      },
    }),
    prisma.user.count({ where: { ...notDeleted, createdAt: { gte: startDay } } }),
    prisma.user.count({ where: { ...notDeleted, createdAt: { gte: startWeek } } }),
    prisma.user.count({ where: { ...notDeleted, createdAt: { gte: startMonth } } }),
  ]);

  return c.json({
    totalUsers,
    premiumUsers,
    trialUsers,
    newUsersToday,
    newUsersThisWeek,
    newUsersThisMonth,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/audit-log", async (c) => {
  const adminEmailFilter = c.req.query("adminEmail")?.trim();
  const rows = await prisma.adminAuditLog.findMany({
    where: adminEmailFilter ? { adminEmail: adminEmailFilter } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return c.json({ entries: rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN USERS (allowlist)
// ─────────────────────────────────────────────────────────────────────────────

admin.get("/admins", async (c) => {
  const rows = await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } });
  return c.json({ admins: rows });
});

admin.post("/admins", async (c) => {
  const adminEmail = c.get("adminEmail")!;
  const body = z.object({ email: z.string().email().transform((e) => e.toLowerCase().trim()) }).parse(await c.req.json());

  const created = await prisma.adminUser.create({
    data: { email: body.email, addedBy: adminEmail },
  });
  await logAdminAction(adminEmail, "add_admin", created.id, created.email, { email: created.email });
  return c.json(created, 201);
});

admin.delete("/admins/:id", async (c) => {
  const adminEmail = c.get("adminEmail")!;
  const id = c.req.param("id");
  const row = await prisma.adminUser.findUnique({ where: { id } });
  if (!row) return c.json({ error: "Not found" }, 404);
  if (row.email.toLowerCase() === PRIMARY_ADMIN_EMAIL) {
    return c.json({ error: "Primary admin cannot be removed" }, 403);
  }
  await prisma.adminUser.delete({ where: { id } });
  await logAdminAction(adminEmail, "remove_admin", id, row.email, { email: row.email });
  return c.json({ deleted: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATIONS (FCM)
// ─────────────────────────────────────────────────────────────────────────────

const AdminPushBodySchema = z
  .object({
    target: z.enum(["all", "free", "trial", "premium", "user"]),
    userId: z.string().optional(),
    title: z.string().min(1),
    body: z.string().min(1),
  })
  .refine((d) => d.target !== "user" || Boolean(d.userId?.trim()), {
    message: "userId is required when target is user",
  });

function userWhereForPushTarget(target: string, userId?: string): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { deletedAt: null };
  if (target === "user" && userId) {
    return { ...base, id: userId };
  }
  switch (target) {
    case "all":
      return base;
    case "free":
      return { ...base, subscriptionStatus: "free", trialStartedAt: null };
    case "trial":
      return { ...base, subscriptionStatus: "free", trialStartedAt: { not: null } };
    case "premium":
      return { ...base, subscriptionStatus: { in: ["premium", "vip"] } };
    default:
      return base;
  }
}

admin.post("/notifications/send", async (c) => {
  const adminEmail = c.get("adminEmail")!;
  if (!adminMessaging) {
    return c.json({ error: "Firebase Admin messaging not configured" }, 503);
  }

  const parsed = AdminPushBodySchema.parse(await c.req.json());
  const where = userWhereForPushTarget(parsed.target, parsed.userId?.trim());

  const users = await prisma.user.findMany({ where, select: { id: true } });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) {
    await logAdminAction(adminEmail, "send_push", undefined, undefined, {
      target: parsed.target,
      title: parsed.title,
      recipientCount: 0,
      sent: 0,
      failed: 0,
    });
    return c.json({ sent: 0, failed: 0, recipientUsers: 0, tokens: 0 });
  }

  const tokenRows = await prisma.fcmToken.findMany({
    where: { userId: { in: userIds } },
    select: { token: true },
  });
  const tokenStrings = tokenRows.map((r) => r.token);
  const { sent, failed } = await sendMulticastToTokens(tokenStrings, {
    title: parsed.title,
    body: parsed.body,
    data: { type: "admin_broadcast" },
  });

  await logAdminAction(adminEmail, "send_push", undefined, undefined, {
    target: parsed.target,
    userId: parsed.userId ?? null,
    title: parsed.title,
    recipientUsers: userIds.length,
    tokens: tokenStrings.length,
    sent,
    failed,
  });

  return c.json({
    sent,
    failed,
    recipientUsers: userIds.length,
    tokens: tokenStrings.length,
  });
});

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
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

const UserListFilterSchema = z.enum(["all", "free", "trial", "premium", "expired"]);

admin.get("/users", async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const limit = Math.min(Math.max(1, parseInt(c.req.query("limit") ?? "20", 10)), 100);
  const offset = (page - 1) * limit;
  const search = (c.req.query("search") ?? "").trim();
  const filterRaw = (c.req.query("filter") ?? "all").toLowerCase();
  const filterParsed = UserListFilterSchema.safeParse(filterRaw);
  const filter = filterParsed.success ? filterParsed.data : "all";

  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  switch (filter) {
    case "free":
      where.subscriptionStatus = "free";
      where.trialStartedAt = null;
      break;
    case "trial":
      where.subscriptionStatus = "free";
      where.trialStartedAt = { not: null };
      break;
    case "premium":
      where.subscriptionStatus = { in: ["premium", "vip"] };
      break;
    case "expired":
      where.subscriptionStatus = { in: ["premium", "vip"] };
      where.premiumUnlimited = false;
      where.premiumExpiresAt = { not: null, lt: new Date() };
      break;
    default:
      break;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        subscriptionStatus: true,
        premiumExpiresAt: true,
        premiumUnlimited: true,
        trialStartedAt: true,
        onboardingComplete: true,
        language: true,
        createdAt: true,
        isAdmin: true,
        birthProfile: { select: { id: true } },
        _count: { select: { peopleProfiles: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return c.json({ users, total, page, limit });
});

admin.get("/users/:id", async (c) => {
  const id = c.req.param("id");
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: { birthProfile: true },
  });
  if (!user) return c.json({ error: "Not found" }, 404);

  const [peopleCount, chatSessionsCount] = await Promise.all([
    prisma.peopleProfile.count({ where: { userId: id } }),
    prisma.chatSession.count({ where: { userId: id } }),
  ]);

  return c.json({
    user,
    counts: { peopleProfiles: peopleCount, chatSessions: chatSessionsCount },
  });
});

const SubscriptionUpdateSchema = z.object({
  status: z.enum(["premium", "free"]),
  expiresAt: z.union([z.string().datetime(), z.null()]).optional(),
  unlimited: z.boolean().optional(),
});

admin.put("/users/:id/subscription", async (c) => {
  const adminEmail = c.get("adminEmail")!;
  const id = c.req.param("id");
  const body = SubscriptionUpdateSchema.parse(await c.req.json());

  const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return c.json({ error: "Not found" }, 404);

  let data: Prisma.UserUpdateInput = {};
  if (body.status === "free") {
    data = {
      subscriptionStatus: "free",
      premiumUnlimited: false,
      premiumExpiresAt: null,
    };
  } else {
    const unlimited = body.unlimited === true;
    if (unlimited) {
      data = {
        subscriptionStatus: "premium",
        premiumUnlimited: true,
        premiumExpiresAt: null,
      };
    } else if (body.expiresAt !== undefined && body.expiresAt !== null) {
      data = {
        subscriptionStatus: "premium",
        premiumUnlimited: false,
        premiumExpiresAt: new Date(body.expiresAt),
      };
    } else {
      data = {
        subscriptionStatus: "premium",
        premiumUnlimited: false,
        premiumExpiresAt: null,
      };
    }
  }

  const updated = await prisma.user.update({ where: { id }, data });
  await logAdminAction(adminEmail, "update_subscription", id, updated.email, {
    status: body.status,
    expiresAt: body.expiresAt ?? null,
    unlimited: body.unlimited ?? null,
  });
  return c.json(updated);
});

admin.post("/users/:id/grant-premium", async (c) => {
  const adminEmail = c.get("adminEmail")!;
  const id = c.req.param("id");
  const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      subscriptionStatus: "premium",
      premiumUnlimited: true,
      premiumExpiresAt: null,
    },
  });
  await logAdminAction(adminEmail, "grant_premium", id, updated.email, { unlimited: true });
  return c.json(updated);
});

admin.post("/users/:id/revoke-premium", async (c) => {
  const adminEmail = c.get("adminEmail")!;
  const id = c.req.param("id");
  const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return c.json({ error: "Not found" }, 404);

  // PRODUCT DECISION (confirmed): trialStartedAt is intentionally NOT cleared on revoke.
  // Reasoning: If user had an active trial when admin-premium was granted, they retain
  // the remainder of their original 7-day trial window after revoke.
  // This is fair treatment — we gave them premium on top of their existing trial.
  // trialStartedAt is write-once and should never be overwritten except by claim-trial
  // idempotency logic.

  const updated = await prisma.user.update({
    where: { id },
    data: {
      subscriptionStatus: "free",
      premiumUnlimited: false,
      premiumExpiresAt: null,
    },
  });
  await logAdminAction(adminEmail, "revoke_premium", id, updated.email, {});
  return c.json(updated);
});

admin.delete("/users/:id", async (c) => {
  const adminEmail = c.get("adminEmail")!;
  const id = c.req.param("id");
  const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return c.json({ error: "Not found" }, 404);

  if (adminAuth && existing.firebaseUid) {
    try {
      await adminAuth.deleteUser(existing.firebaseUid);
    } catch (e: unknown) {
      const code =
        typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
      if (code !== "auth/user-not-found") {
        console.warn("[admin] Firebase account deletion failed:", e instanceof Error ? e.message : e);
      }
    }
  }

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await logAdminAction(adminEmail, "soft_delete_user", id, existing.email, {});
  return c.json({ ok: true });
});

export { admin as adminRouter };
