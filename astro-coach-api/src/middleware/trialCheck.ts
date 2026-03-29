import type { Context, Next } from "hono";
import { prisma } from "../lib/prisma.js";

const TRIAL_DURATION_DAYS = 7;

/**
 * Trial expiry enforcement middleware for web feature routes.
 *
 * Applied AFTER requireFirebaseAuth so firebaseUid and dbUserId are available.
 * Must NOT be applied to: auth, onboarding, subscription, health routes.
 *
 * Decision matrix:
 *   - subscriptionStatus === 'active'  → allow (active Stripe or RC subscriber)
 *   - trialStartedAt === null          → allow (trial not yet claimed; frontend prompts)
 *   - trial < 7 days old              → allow (within free trial window)
 *   - trial >= 7 days old             → 402 trial_expired
 *   - user not in DB                  → allow (auth middleware handles missing users)
 */
export async function trialCheckMiddleware(c: Context, next: Next): Promise<Response | void> {
  const dbId: string | undefined = c.get("dbUserId");
  if (!dbId) return next();

  const user = await prisma.user.findUnique({
    where: { id: dbId },
    select: { subscriptionStatus: true, trialStartedAt: true },
  });

  if (!user) return next();

  if (user.subscriptionStatus === "active") return next();

  if (!user.trialStartedAt) return next();

  const daysSinceTrial =
    (Date.now() - user.trialStartedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceTrial >= TRIAL_DURATION_DAYS) {
    const trialExpiredAt = new Date(
      user.trialStartedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );
    return c.json(
      {
        error: "trial_expired",
        message: "Your free trial has ended. Please subscribe to continue.",
        trialExpiredAt,
      },
      402,
    );
  }

  return next();
}
