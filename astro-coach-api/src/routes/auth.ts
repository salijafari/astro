import type { Context } from "hono";
import { z } from "zod";
import { adminAuth } from "../lib/firebase-admin.js";
import { prisma } from "../lib/prisma.js";

const syncBodySchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(80).optional(),
});

/**
 * POST /api/auth/sync — verifies Firebase ID token, upserts User (no auth middleware).
 */
export async function handleAuthSync(c: Context) {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = auth.slice(7);
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "auth/id-token-expired") {
      return c.json({ error: "Forbidden", reason: "token_expired" }, 403);
    }
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = syncBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    return c.json({ error: "bad_request", details: body.error.flatten() }, 400);
  }

  const uid = decoded.uid;
  const tokenEmail = decoded.email ?? undefined;
  const email = body.data.email ?? tokenEmail ?? `${uid}@placeholder.local`;
  const name =
    body.data.firstName?.trim() ||
    (typeof decoded.name === "string" && decoded.name.trim()) ||
    email.split("@")[0] ||
    "Friend";

  const user = await prisma.user.upsert({
    where: { firebaseUid: uid },
    create: {
      firebaseUid: uid,
      email,
      name,
    },
    update: {
      email,
      name,
    },
  });

  try {
    await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
  } catch (e) {
    console.warn("[auth/sync] notificationPreference upsert skipped", e);
  }

  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      onboardingComplete: user.onboardingComplete,
      subscriptionStatus: user.subscriptionStatus,
    },
  });
}
