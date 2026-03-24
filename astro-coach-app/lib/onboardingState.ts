import { readPersistedValue, writePersistedValue } from "@/lib/storage";

export const ONBOARDING_COMPLETED_KEY = "akhtar.onboardingCompleted";

/**
 * Returns whether setup/onboarding was completed on this device.
 */
export async function isOnboardingCompletedLocally(): Promise<boolean> {
  const stored = await readPersistedValue(ONBOARDING_COMPLETED_KEY);
  return stored === "1";
}

/**
 * Marks onboarding complete/incomplete for local app gating.
 */
export async function setOnboardingCompletedLocally(completed: boolean): Promise<void> {
  await writePersistedValue(ONBOARDING_COMPLETED_KEY, completed ? "1" : "0");
}
