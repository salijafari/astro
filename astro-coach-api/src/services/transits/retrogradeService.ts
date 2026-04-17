/**
 * Retrograde detection from Swiss Ephemeris daily speed (Moshier).
 */
import { calc, constants } from "sweph";
import { julianNow } from "../astrology/chartEngine.js";

const EPHE_FLAGS = constants.SEFLG_MOSEPH | constants.SEFLG_SPEED;

const TRACK: { key: string; id: number }[] = [
  { key: "Mercury", id: constants.SE_MERCURY },
  { key: "Venus", id: constants.SE_VENUS },
  { key: "Mars", id: constants.SE_MARS },
  { key: "Jupiter", id: constants.SE_JUPITER },
  { key: "Saturn", id: constants.SE_SATURN },
  { key: "Uranus", id: constants.SE_URANUS },
  { key: "Neptune", id: constants.SE_NEPTUNE },
  { key: "Pluto", id: constants.SE_PLUTO },
];

export type RetrogradeBody = {
  body: string;
  isRetrograde: boolean;
  speedDegPerDay: number;
};

/**
 * Lists major bodies and whether each is retrograde today (sweph speed sign).
 */
export function computeRetrogradeStatus(): RetrogradeBody[] {
  try {
    const { jdEt } = julianNow();
    const out: RetrogradeBody[] = [];
    for (const { key, id } of TRACK) {
      const p = calc(jdEt, id, EPHE_FLAGS);
      if (p.flag !== EPHE_FLAGS) continue;
      const speed = p.data[3] ?? 0;
      out.push({
        body: key,
        isRetrograde: speed < 0,
        speedDegPerDay: speed,
      });
    }
    return out;
  } catch (e) {
    console.warn("[retrogradeService] computeRetrogradeStatus failed:", e);
    return [];
  }
}
