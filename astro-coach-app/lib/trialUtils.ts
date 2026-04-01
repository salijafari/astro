/** Must match astro-coach-api `TRIAL_DURATION_MS` / `computeTrialDaysLeft`. */
const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whole days remaining in the DB-backed trial (0 if none or expired).
 */
export function computeTrialDaysLeftClient(
  trialStartedAt: string | Date | null | undefined,
): number {
  if (!trialStartedAt) return 0;
  const started = new Date(trialStartedAt).getTime();
  const msLeft = started + TRIAL_MS - Date.now();
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}
