/** Seven-day web trial window (must match RevenueCat `hasFeatureAccess`). */
export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

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
