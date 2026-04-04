export const PEOPLE_REL_TYPES = ["partner", "friend", "family", "coworker", "other"] as const;
export type PeopleRelationshipType = (typeof PEOPLE_REL_TYPES)[number];

export const formatDateForApi = (date: Date | null): string | null => {
  if (!date) return null;
  return date.toISOString().split("T")[0] ?? null;
};

/** Ensures backend Zod pattern /^\\d{2}:\\d{2}$/ — zero-padded HH:MM, no seconds. */
export const formatTimeForApi = (time: string | null): string | undefined => {
  if (!time || !time.trim()) return undefined;
  const parts = time.trim().split(":");
  if (parts.length < 2) return undefined;
  const h = parts[0]!.padStart(2, "0");
  const m = parts[1]!.slice(0, 2).padStart(2, "0");
  const formatted = `${h}:${m}`;
  if (!/^\d{2}:\d{2}$/.test(formatted)) return undefined;
  return formatted;
};

/** Web: entire row should open the native date/time UI (not only a tiny input chrome). */
export const openWebDateTimeInput = (el: HTMLInputElement | null) => {
  if (!el) return;
  try {
    if (typeof el.showPicker === "function") {
      void el.showPicker();
      return;
    }
  } catch {
    /* showPicker can reject; fall through */
  }
  el.click();
};
