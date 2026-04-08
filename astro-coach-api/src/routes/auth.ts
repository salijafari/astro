import type { Context } from "hono";
import { z } from "zod";
import { adminAuth } from "../lib/firebase-admin.js";
import { prisma } from "../lib/prisma.js";
import { autoStartTrialIfEligible } from "../lib/subscriptionAccess.js";

const syncBodySchema = z.object({
  email: z.string().email().optional(),
  /** E.164 or client-formatted phone from Firebase; optional until stored on User. */
  phoneNumber: z.string().min(3).max(48).optional(),
});

/**
 * POST /api/auth/sync — verifies Firebase ID token, upserts User (no auth middleware).
 */
export async function handleAuthSync(c: Context) {
  try {
    const authHeader = c.req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Missing authorization header" }, 401);
    }

    const token = authHeader.split("Bearer ")[1];
    if (!token) {
      return c.json({ error: "Missing authorization header" }, 401);
    }

    if (!adminAuth) {
      console.warn("adminAuth not available — skipping token verification");
      return c.json({ error: "Auth service temporarily unavailable" }, 503);
    }

    let decoded: { uid: string; email?: string; name?: string };
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch (tokenError) {
      console.error("Token verification failed:", tokenError);
      return c.json({ error: "Invalid token" }, 401);
    }

    const body = syncBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) {
      return c.json({ error: "bad_request", details: body.error.flatten() }, 400);
    }

    const uid = decoded.uid;
    const tokenEmail = decoded.email ?? undefined;
    const email = body.data.email ?? tokenEmail ?? `${uid}@placeholder.local`;

    const emailForConflictCheck = body.data.email ?? tokenEmail;
    if (emailForConflictCheck) {
      const deletedRecord = await prisma.user.findFirst({
        where: {
          email: emailForConflictCheck,
          deletedAt: { not: null },
          NOT: { firebaseUid: uid },
        },
      });

      if (deletedRecord) {
        await prisma.user.update({
          where: { id: deletedRecord.id },
          data: {
            email: `deleted_${deletedRecord.id}@akhtar.deleted`,
            firebaseUid: `deleted_${deletedRecord.id}`,
            name: "",
          },
        });
      }
    }

    /** `User.name` is set only via Profile Setup or Edit Information — never from Firebase. */
    const user = await prisma.user.upsert({
      where: { firebaseUid: uid },
      create: {
        firebaseUid: uid,
        email,
        name: "",
        subscriptionStatus: "free",
      },
      update: {
        email,
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

    await autoStartTrialIfEligible(prisma, user.id);

    return c.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        onboardingComplete: user.onboardingComplete,
        subscriptionStatus: user.subscriptionStatus,
      },
    });
  } catch (error) {
    console.error("/api/auth/sync error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}
