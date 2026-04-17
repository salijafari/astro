import AsyncStorage from "@react-native-async-storage/async-storage";

/** Mantra UX keys only — not auth tokens (workspace plan: AsyncStorage). */
export const MANTRA_UX_KEYS = {
  registerOverride: "akhtar.mantraRegisterOverride",
  firstViewedAt: "akhtar.mantraFirstViewedAt",
  revealEverCompleted: "akhtar.mantraRevealEverCompleted",
  tooltip108: "akhtar.mantra108TooltipShown",
  /** Legacy — migrated on read; then removed. */
  visitedDateLegacy: "akhtar.mantraVisitedDate",
  /** UTC calendar date (YYYY-MM-DD) when user last opened mantra home screen (badge). */
  lastOpenedDateUtc: "akhtar.mantraLastOpenedDateUtc",
  /** `validForDate` from API when `mantra_daily_open` was last tracked. */
  dailyOpenTrackedFor: "akhtar.mantraDailyOpenTrackedFor",
  journalLastTab: "akhtar.journalLastTab",
} as const;

/**
 * Reads a mantra UX flag from AsyncStorage.
 */
export async function readMantraUx(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Persists a mantra UX flag.
 */
export async function writeMantraUx(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    /* non-fatal */
  }
}

/**
 * Removes a mantra UX key.
 */
export async function removeMantraUx(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* non-fatal */
  }
}

/**
 * If legacy `akhtar.mantraVisitedDate` exists, marks reveal completed and deletes legacy key.
 */
export async function migrateLegacyMantraVisitedDate(): Promise<void> {
  const legacy = await readMantraUx(MANTRA_UX_KEYS.visitedDateLegacy);
  if (!legacy) return;
  await writeMantraUx(MANTRA_UX_KEYS.revealEverCompleted, "true");
  await removeMantraUx(MANTRA_UX_KEYS.visitedDateLegacy);
}
