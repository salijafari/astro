/**
 * Client-side Western sun sign from a calendar date string (YYYY-MM-DD or ISO with time).
 * Uses month/day only — no birth time or location required.
 */
export function getSunSign(isoDate: string): string {
  const datePart = isoDate.includes("T") ? isoDate.split("T")[0]! : isoDate.slice(0, 10);
  const parts = datePart.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "";
  const [, mm, dd] = parts as [number, number, number];

  if ((mm === 3 && dd >= 21) || (mm === 4 && dd <= 19)) return "Aries";
  if ((mm === 4 && dd >= 20) || (mm === 5 && dd <= 20)) return "Taurus";
  if ((mm === 5 && dd >= 21) || (mm === 6 && dd <= 20)) return "Gemini";
  if ((mm === 6 && dd >= 21) || (mm === 7 && dd <= 22)) return "Cancer";
  if ((mm === 7 && dd >= 23) || (mm === 8 && dd <= 22)) return "Leo";
  if ((mm === 8 && dd >= 23) || (mm === 9 && dd <= 22)) return "Virgo";
  if ((mm === 9 && dd >= 23) || (mm === 10 && dd <= 22)) return "Libra";
  if ((mm === 10 && dd >= 23) || (mm === 11 && dd <= 21)) return "Scorpio";
  if ((mm === 11 && dd >= 22) || (mm === 12 && dd <= 21)) return "Sagittarius";
  if ((mm === 12 && dd >= 22) || (mm === 1 && dd <= 19)) return "Capricorn";
  if ((mm === 1 && dd >= 20) || (mm === 2 && dd <= 18)) return "Aquarius";
  return "Pisces";
}

/** Sun glyph + Western sun sign label for list UI. */
export function formatSunSign(isoDate: string): string {
  const sign = getSunSign(isoDate);
  return sign ? `☉ ${sign}` : "";
}
