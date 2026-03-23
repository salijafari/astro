import type { Context, Next } from "hono";
import { verifyToken } from "@clerk/backend";
import { clerkClient, verifyClerkBearer } from "../lib/clerk.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

type AuthContext = {
  Variables: {
    clerkUserId: string;
    dbUserId: string;
  };
};

const memBuckets = new Map<string, { count: number; resetAt: number }>();
const MEM_RL_MAX_KEYS = 10_000;

function pruneMemRateBuckets(now: number) {
  for (const [k, v] of memBuckets) {
    if (v.resetAt < now) memBuckets.delete(k);
  }
  while (memBuckets.size > MEM_RL_MAX_KEYS) {
    const first = memBuckets.keys().next().value;
    if (first === undefined) break;
    memBuckets.delete(first);
  }
}

/**
 * Fixed-window rate limit: 100 requests per minute per Clerk user or IP.
 */
async function rateLimited(c: Context<AuthContext>): Promise<boolean> {
  const auth = c.req.header("authorization");
  let key = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "ip:unknown";
  if (auth?.startsWith("Bearer ")) {
    try {
      const r = await verifyToken(auth.slice(7), {
        secretKey: process.env.CLERK_SECRET_KEY ?? "",
      });
      const d = r.data as { sub?: string } | undefined;
      if (d?.sub) key = `user:${d.sub}`;
    } catch {
      /* invalid token — fall back to IP key */
    }
  }
  if (redis) {
    const k = `rl:${key}`;
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, 60);
    return n > 100;
  }
  const now = Date.now();
  if (memBuckets.size > MEM_RL_MAX_KEYS * 0.9) pruneMemRateBuckets(now);
  const b = memBuckets.get(key);
  if (!b || now > b.resetAt) {
    memBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  b.count += 1;
  return b.count > 100;
}

const ACTIVE_EXPERIMENTS = [
  "paywall_price",
  "trial_length",
  "notification_time",
  "chat_limit_framing",
] as const;

function hashVariant(userId: string, experimentName: string): "control" | "treatment" {
  let h = 0;
  const s = userId + experimentName;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? "control" : "treatment";
}

/**
 * Ensures User row exists and Phase-3 experiments are assigned once.
 */
async function assignExperiments(userId: string) {
  for (const name of ACTIVE_EXPERIMENTS) {
    const variant = hashVariant(userId, name);
    await prisma.userExperiment.upsert({
      where: { userId_experimentName: { userId, experimentName: name } },
      create: { userId, experimentName: name, variant },
      update: {},
    });
  }
}

/**
 * Clerk JWT auth + local User row; attaches clerkUserId and dbUserId.
 */
export async function requireAuth(c: Context<AuthContext>, next: Next) {
  if (await rateLimited(c)) {
    return c.json({ error: "Too many requests" }, 429);
  }
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  let sub: string;
  let cu: Awaited<ReturnType<typeof clerkClient.users.getUser>>;
  try {
    const payload = await verifyClerkBearer(auth.slice(7));
    if (!payload.sub) throw new Error("no sub");
    sub = payload.sub;
    cu = await clerkClient.users.getUser(sub);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const email = cu.emailAddresses[0]?.emailAddress ?? `${sub}@placeholder.local`;
  const name =
    [cu.firstName, cu.lastName].filter(Boolean).join(" ").trim() ||
    cu.username ||
    "Friend";

  let user = await prisma.user.findUnique({ where: { clerkId: sub } });
  if (!user) {
    user = await prisma.user.create({
      data: { clerkId: sub, email, name },
    });
    await assignExperiments(user.id);
  } else if (user.email !== email || user.name !== name) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { email, name },
    });
  }

  c.set("clerkUserId", sub);
  c.set("dbUserId", user.id);
  await next();
}
