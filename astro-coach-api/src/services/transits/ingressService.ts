/**
 * Approximate upcoming sign ingresses via Swiss Ephemeris (deterministic UX hints).
 */
import { julianNow, planetLongitudesAt } from "../astrology/chartEngine.js";

const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

const TRACK_BODIES = ["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"] as const;

export type IngressEvent = {
  body: string;
  intoSign: string;
  /** Rough UTC midpoint of the calendar day when sign change is first detected. */
  approximateAt: string;
};

function normLon(lon: number): number {
  let v = lon % 360;
  if (v < 0) v += 360;
  return v;
}

function signIndex(lon: number): number {
  return Math.floor(normLon(lon) / 30) % 12;
}

function jdPlusEt(baseEt: number, days: number): number {
  return baseEt + days;
}

/**
 * Steps one day at a time to detect the first sign change for each tracked body.
 */
export function computeIngressHints(opts: { horizonDays?: number } = {}): IngressEvent[] {
  const horizonDays = opts.horizonDays ?? 21;
  const out: IngressEvent[] = [];
  try {
    const { jdEt } = julianNow();
    const now = new Date();

    for (const body of TRACK_BODIES) {
      const lon0 = planetLongitudesAt(jdEt)[body];
      if (typeof lon0 !== "number") continue;
      const startIdx = signIndex(lon0);

      for (let d = 1; d <= horizonDays; d++) {
        const lon = planetLongitudesAt(jdPlusEt(jdEt, d))[body];
        if (typeof lon !== "number") break;
        const idx = signIndex(lon);
        if (idx !== startIdx) {
          const midday = new Date(now.getTime() + (d - 0.5) * 86400000);
          out.push({
            body,
            intoSign: SIGNS[idx] ?? "Aries",
            approximateAt: midday.toISOString(),
          });
          break;
        }
      }
    }

    out.sort((a, b) => a.approximateAt.localeCompare(b.approximateAt));
    return out.slice(0, 32);
  } catch (e) {
    console.warn("[ingressService] computeIngressHints failed:", e);
    return [];
  }
}
