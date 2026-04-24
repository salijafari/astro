/**
 * Server-side birth date utility — UTC noon convention.
 * Parallel to astro-coach-app/lib/birthDate.ts. Do not import from client code.
 */

/**
 * Parses a birth date string (YYYY-MM-DD prefix) to a Date at UTC noon.
 */
export function parseBirthDateToUTCNoon(input: string): Date {
  const dateOnly = input.slice(0, 10);
  const parts = dateOnly.split("-");
  if (parts.length !== 3) {
    throw new Error(`Invalid birth date: ${input}`);
  }
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
    throw new Error(`Invalid birth date components: ${input}`);
  }
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/**
 * Formats a Date using UTC calendar components as YYYY-MM-DD (for chart keys and APIs).
 */
export function formatBirthDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const da = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}
