import type { PrismaClient } from "@prisma/client";

/**
 * AKHTAR SUBSCRIPTION TIERS
 *
 * FREE TIER (no trial, trial expired, or cancelled):
 * - Personal transits: ✅ free
 * - Daily horoscope: ✅ free
 * - Ask Me Anything: max 3 messages per day
 * - Coffee reading: ❌ premium only
 * - Dream interpreter: ❌ premium only
 * - Romantic compatibility: ❌ premium only
 * - People profiles: max 1 person free
 *
 * TRIAL TIER (7 days from account creation):
 * - All features: ✅ fully accessible
 * - No message limit
 * - Starts automatically on account creation
 * - Cannot be restarted after expiry
 *
 * PREMIUM TIER (active subscription):
 * - All features: ✅ fully accessible
 * - No message limit
 */

/** Seven-day web trial window (must match RevenueCat `hasFeatureAccess`). */
export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Single source of truth for starting the DB-backed 7-day trial.
 * Starts at account creation / first sync when the user is not already premium and has no trial yet.
 */
export async function autoStartTrialIfEligible(prisma: PrismaClient, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      trialStartedAt: true,
      subscriptionStatus: true,
      premiumUnlimited: true,
    },
  });

  if (!user) return;

  if (
    user.premiumUnlimited ||
    user.subscriptionStatus === "active" ||
    user.subscriptionStatus === "premium"
  ) {
    return;
  }

  if (user.trialStartedAt) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      trialStartedAt: new Date(),
      subscriptionStatus: "trial",
    },
  });
}

/**
 * Whole days remaining in the DB-backed trial (0 if none or expired).
 */
export function computeTrialDaysLeft(trialStartedAt: Date | null | undefined): number {
  if (!trialStartedAt) return 0;
  const now = Date.now();
  const started = new Date(trialStartedAt).getTime();
  const msLeft = started + TRIAL_DURATION_MS - now;
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}

/** True while the DB trial window is open (independent of RevenueCat). */
export function isDbTrialActive(trialStartedAt: Date | null | undefined): boolean {
  return computeTrialDaysLeft(trialStartedAt) > 0;
}

/** Stripe + DB trial only — use `hasFeatureAccess` for native + web combined. */
export function userHasAccessFromDb(user: {
  subscriptionStatus: string;
  trialStartedAt: Date | null;
}): boolean {
  if (user.subscriptionStatus === "active") return true;
  return isDbTrialActive(user.trialStartedAt);
}
