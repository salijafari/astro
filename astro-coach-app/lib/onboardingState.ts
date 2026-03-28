import { readPersistedValue, writePersistedValue } from "@/lib/storage";

export const ONBOARDING_COMPLETED_KEY = "akhtar.onboardingCompleted";

/**
 * Returns whether setup/onboarding was completed on this device.
 * Accepts both legacy "1" and new "true" values for backward compatibility.
 */
export async function isOnboardingCompletedLocally(): Promise<boolean> {
  const stored = await readPersistedValue(ONBOARDING_COMPLETED_KEY);
  return stored === "true" || stored === "1";
}

/**
 * Marks onboarding complete/incomplete for local app gating.
 */
export async function setOnboardingCompletedLocally(completed: boolean): Promise<void> {
  await writePersistedValue(ONBOARDING_COMPLETED_KEY, completed ? "true" : "false");
}
