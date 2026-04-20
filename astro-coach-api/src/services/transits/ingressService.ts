/**
 * Approximate upcoming sign ingresses via Swiss Ephemeris (deterministic UX hints).
 */
import { calc, constants } from "sweph";
import { julianNow } from "../astrology/chartEngine.js";

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

const EPHE_FLAGS_I = constants.SEFLG_MOSEPH | constants.SEFLG_SPEED;

const INGRESS_BODY_IDS: Record<string, number> = {
  Sun: constants.SE_SUN,
  Mercury: constants.SE_MERCURY,
  Venus: constants.SE_VENUS,
  Mars: constants.SE_MARS,
  Jupiter: constants.SE_JUPITER,
  Saturn: constants.SE_SATURN,
};

function getIngressBodyLongitudes(jdEt: number): Record<string, number> {
  const result: Record<string, number> = {};
  const normLon = (lon: number) => ((lon % 360) + 360) % 360;
  for (const [name, id] of Object.entries(INGRESS_BODY_IDS)) {
    try {
      const p = calc(jdEt, id, EPHE_FLAGS_I);
      if (p.flag !== EPHE_FLAGS_I) continue;
      result[name] = normLon(p.data[0]);
    } catch {
      continue;
    }
  }
  return result;
}

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
      const lon0 = getIngressBodyLongitudes(jdEt)[body];
      if (typeof lon0 !== "number") continue;
      const startIdx = signIndex(lon0);

      for (let d = 1; d <= horizonDays; d++) {
        const lon = getIngressBodyLongitudes(jdPlusEt(jdEt, d))[body];
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
