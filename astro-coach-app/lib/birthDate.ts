/**
 * Birth date utilities — UTC noon convention.
 *
 * A birth date is a CALENDAR concept (a specific day), not an instant.
 * We anchor every Date object representing a birth date to 12:00:00 UTC of
 * that calendar day. UTC noon is safe because no timezone shifts it to a
 * different calendar date.
 *
 * Use these helpers EVERYWHERE birth dates are read, written, or formatted.
 * Never use `toISOString().split("T")[0]` on a birth date — it uses UTC
 * midnight which renders as the previous day in timezones west of UTC.
 */

/**
 * Builds a Date anchored to UTC noon for the given calendar day.
 * Inputs are 1-based month (January = 1).
 */
export function calendarDateToUTC(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/**
 * Formats a Date (assumed to be UTC-noon anchored) as a YYYY-MM-DD string
 * using UTC calendar components. Safe for both display and API serialization.
 */
export function formatCalendarDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parses a server-returned ISO-8601 birth date into a UTC-noon-anchored Date.
 * Accepts plain "YYYY-MM-DD" strings or full ISO strings — in both cases the
 * calendar day is extracted and re-anchored to UTC noon.
 */
export function parseCalendarDateFromISO(iso: string): Date {
  // Extract calendar day, ignore time component entirely.
  const dateOnly = iso.slice(0, 10);
  const parts = dateOnly.split("-");
  if (parts.length !== 3) {
    throw new Error(`Invalid birth date ISO string: ${iso}`);
  }
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    throw new Error(`Invalid birth date components: ${iso}`);
  }
  return calendarDateToUTC(y, m, d);
}

/**
 * Parses a "YYYY-MM-DD" user input (e.g. from a web <input type="date">) into
 * a UTC-noon-anchored Date. Returns null on invalid input.
 */
export function parseCalendarDateFromYMD(value: string): Date | null {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const result = calendarDateToUTC(y, m, d);
  if (isNaN(result.getTime())) return null;
  return result;
}

/**
 * Builds a UTC-noon-anchored Date from a native date picker result.
 * The picker returns a local Date; we extract its local calendar components
 * and re-anchor to UTC noon so the calendar day survives serialization.
 */
export function normalizePickerDate(picked: Date): Date {
  return calendarDateToUTC(picked.getFullYear(), picked.getMonth() + 1, picked.getDate());
}
