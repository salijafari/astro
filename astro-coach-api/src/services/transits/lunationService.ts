/**
 * Sun–Moon angle-based lunation hints (deterministic; not for precision eclipse work).
 */
import { calc, constants } from "sweph";
import { julianNow } from "../astrology/chartEngine.js";

export type LunationHint = {
  kind: "new_moon" | "full_moon";
  /** Approximate UTC instant from linear interpolation toward exact angle. */
  approximateAt: string;
};

const EPHE_FLAGS_L = constants.SEFLG_MOSEPH | constants.SEFLG_SPEED;

function getSunMoonLongitudes(jdEt: number): {
  sun: number;
  moon: number;
} | null {
  try {
    const sunResult = calc(jdEt, constants.SE_SUN, EPHE_FLAGS_L);
    if (sunResult.flag !== EPHE_FLAGS_L) return null;
    const moonResult = calc(jdEt, constants.SE_MOON, EPHE_FLAGS_L);
    if (moonResult.flag !== EPHE_FLAGS_L) return null;
    const normLon = (lon: number) => ((lon % 360) + 360) % 360;
    return {
      sun: normLon(sunResult.data[0]),
      moon: normLon(moonResult.data[0]),
    };
  } catch {
    return null;
  }
}

function normLon(lon: number): number {
  let v = lon % 360;
  if (v < 0) v += 360;
  return v;
}

/**
 * Returns coarse next new/full moon hints from current sky state and mean motion (~12°/day moon, 1°/day sun).
 */
export function computeLunationHints(): LunationHint[] {
  try {
    const { jdEt } = julianNow();
    const pos = getSunMoonLongitudes(jdEt);
    if (!pos) return [];
    const moonLon = pos.moon;
    const sunLon = pos.sun;
    if (typeof moonLon !== "number" || typeof sunLon !== "number") return [];

    const rel = normLon(moonLon - sunLon);
    const moonAdvance = 12.2 - 1.0; // relative deg / day approx
    const out: LunationHint[] = [];
    const now = new Date();

    // Toward full (180°)
    const degToFull = rel <= 180 ? 180 - rel : 360 - rel + 180;
    const daysFull = degToFull / moonAdvance;
    if (daysFull > 0 && daysFull < 45) {
      out.push({
        kind: "full_moon",
        approximateAt: new Date(now.getTime() + daysFull * 86400000).toISOString(),
      });
    }

    // Toward new (0° / 360°)
    const degToNew = rel <= 180 ? rel : 360 - rel;
    const daysNew = degToNew / moonAdvance;
    if (daysNew > 0 && daysNew < 45) {
      out.push({
        kind: "new_moon",
        approximateAt: new Date(now.getTime() + daysNew * 86400000).toISOString(),
      });
    }

    out.sort((a, b) => a.approximateAt.localeCompare(b.approximateAt));
    return out.slice(0, 4);
  } catch (e) {
    console.warn("[lunationService] computeLunationHints failed:", e);
    return [];
  }
}
