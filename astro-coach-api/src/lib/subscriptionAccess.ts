import type { PrismaClient } from "@prisma/client";

/** Seven-day web trial window (must match RevenueCat `hasFeatureAccess`). */
export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Single source of truth for starting the DB-backed 7-day trial.
 * Runs only when onboarding is complete and the user is not already premium or on trial.
 */
export async function autoStartTrialIfEligible(prisma: PrismaClient, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      trialStartedAt: true,
      subscriptionStatus: true,
      premiumUnlimited: true,
      onboardingComplete: true,
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

  if (!user.onboardingComplete) return;

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
