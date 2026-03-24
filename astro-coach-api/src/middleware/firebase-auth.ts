import type { DecodedIdToken } from "firebase-admin/auth";
import type { Context, Next } from "hono";
import { adminAuth } from "../lib/firebase-admin.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

export type FirebaseAuthContext = {
  Variables: {
    firebaseUser: DecodedIdToken;
    firebaseUid: string;
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

/** Decode JWT payload for rate-limit key only (not verified). */
function decodeJwtSub(token: string): string | null {
  try {
    const parts = token.split(".");
    const payloadB64 = parts[1];
    if (parts.length < 2 || !payloadB64) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as { sub?: string };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

async function rateLimited(c: Context<FirebaseAuthContext>): Promise<boolean> {
  const auth = c.req.header("authorization");
  let key = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "ip:unknown";
  if (auth?.startsWith("Bearer ")) {
    const sub = decodeJwtSub(auth.slice(7));
    if (sub) key = `user:${sub}`;
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
 * Verifies Firebase ID token, ensures PostgreSQL User row, attaches firebaseUid + dbUserId.
 */
export async function requireFirebaseAuth(c: Context<FirebaseAuthContext>, next: Next) {
  if (await rateLimited(c)) {
    return c.json({ error: "Too many requests" }, 429);
  }
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = auth.slice(7);
  let decoded: DecodedIdToken;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "auth/id-token-expired") {
      return c.json({ error: "Forbidden", reason: "token_expired" }, 403);
    }
    return c.json({ error: "Unauthorized" }, 401);
  }

  const uid = decoded.uid;
  const email = decoded.email ?? `${uid}@placeholder.local`;
  const name =
    (typeof decoded.name === "string" && decoded.name.trim()) ||
    email.split("@")[0] ||
    "Friend";

  let user = await prisma.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) {
    user = await prisma.user.create({
      data: { firebaseUid: uid, email, name },
    });
    await assignExperiments(user.id);
    await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
  } else if (user.email !== email || user.name !== name) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { email, name },
    });
  }

  c.set("firebaseUser", decoded);
  c.set("firebaseUid", uid);
  c.set("dbUserId", user.id);
  await next();
}
