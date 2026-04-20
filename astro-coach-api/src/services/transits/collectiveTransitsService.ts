/**
 * Outer-planet-to-outer-planet collective sky aspects (deterministic sweph positions).
 */
import type { CollectiveAspectKind, CollectiveTransit } from "../../types/collectiveTransit.js";
import { julianNow, planetLongitudesAt } from "../astrology/chartEngine.js";

const OUTER_PLANETS = ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"] as const;
type OuterPlanet = (typeof OUTER_PLANETS)[number];

const ORBS: Record<CollectiveAspectKind, number> = {
  conjunction: 8,
  opposition: 8,
  square: 6,
  trine: 5,
  sextile: 4,
};

const ASPECT_ANGLES: Record<CollectiveAspectKind, number> = {
  conjunction: 0,
  opposition: 180,
  square: 90,
  trine: 120,
  sextile: 60,
};

const PLANET_FA: Record<OuterPlanet, string> = {
  Jupiter: "مشتری",
  Saturn: "زحل",
  Uranus: "اورانوس",
  Neptune: "نپتون",
  Pluto: "پلوتو",
};

const ASPECT_FA: Record<CollectiveAspectKind, string> = {
  conjunction: "مقارنه",
  opposition: "مقابله",
  square: "مربع",
  trine: "مثلث",
  sextile: "سداس",
};

function angularSeparation(lonA: number, lonB: number): number {
  let diff = Math.abs(lonA - lonB) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

function detectAspect(
  lonA: number,
  lonB: number,
): { aspectKind: CollectiveAspectKind; orbDegrees: number } | null {
  const sep = angularSeparation(lonA, lonB);
  const kinds: CollectiveAspectKind[] = ["conjunction", "opposition", "square", "trine", "sextile"];
  for (const kind of kinds) {
    const angle = ASPECT_ANGLES[kind];
    const orb = Math.abs(sep - angle);
    if (orb <= ORBS[kind]) {
      return { aspectKind: kind, orbDegrees: orb };
    }
  }
  return null;
}

function estimateExactAt(bodyA: string, bodyB: string, aspectAngle: number, jdEtNow: number): Date {
  let closestJd = jdEtNow;
  let closestDiff = Infinity;
  for (let d = -90; d <= 90; d++) {
    try {
      const jd = jdEtNow + d;
      const lons = planetLongitudesAt(jd);
      const lonA = lons[bodyA];
      const lonB = lons[bodyB];
      if (lonA === undefined || lonB === undefined) continue;
      const sep = angularSeparation(lonA, lonB);
      const diff = Math.abs(sep - aspectAngle);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestJd = jd;
      }
    } catch {
      continue;
    }
  }
  const msFromEpoch = (closestJd - 2440587.5) * 86400000;
  return new Date(msFromEpoch);
}

function estimateOrbWindow(
  bodyA: string,
  bodyB: string,
  aspectKind: CollectiveAspectKind,
  exactJdEt: number,
): { startAt: Date; endAt: Date } {
  const orb = ORBS[aspectKind];
  const angle = ASPECT_ANGLES[aspectKind];

  let startJd = exactJdEt;
  for (let d = 1; d <= 180; d++) {
    try {
      const jd = exactJdEt - d;
      const lons = planetLongitudesAt(jd);
      const lonA = lons[bodyA];
      const lonB = lons[bodyB];
      if (lonA === undefined || lonB === undefined) break;
      const sep = angularSeparation(lonA, lonB);
      if (Math.abs(sep - angle) > orb) {
        startJd = exactJdEt - (d - 1);
        break;
      }
    } catch {
      break;
    }
  }

  let endJd = exactJdEt;
  for (let d = 1; d <= 180; d++) {
    try {
      const jd = exactJdEt + d;
      const lons = planetLongitudesAt(jd);
      const lonA = lons[bodyA];
      const lonB = lons[bodyB];
      if (lonA === undefined || lonB === undefined) break;
      const sep = angularSeparation(lonA, lonB);
      if (Math.abs(sep - angle) > orb) {
        endJd = exactJdEt + (d - 1);
        break;
      }
    } catch {
      break;
    }
  }

  const toDate = (jd: number) => new Date((jd - 2440587.5) * 86400000);

  return { startAt: toDate(startJd), endAt: toDate(endJd) };
}

/**
 * Computes Jupiter–Saturn–Uranus–Neptune–Pluto pairwise aspects (active or next within 60 days).
 */
export function computeCollectiveTransits(): CollectiveTransit[] {
  const results: CollectiveTransit[] = [];

  try {
    const { jdEt } = julianNow();
    const now = new Date();
    const nowMs = now.getTime();

    const lons = planetLongitudesAt(jdEt);

    for (let i = 0; i < OUTER_PLANETS.length; i++) {
      for (let j = i + 1; j < OUTER_PLANETS.length; j++) {
        const bodyA = OUTER_PLANETS[i]!;
        const bodyB = OUTER_PLANETS[j]!;
        const lonA = lons[bodyA];
        const lonB = lons[bodyB];

        if (lonA === undefined || lonB === undefined) continue;

        const detected = detectAspect(lonA, lonB);

        if (detected) {
          const { aspectKind, orbDegrees } = detected;
          const exactDate = estimateExactAt(bodyA, bodyB, ASPECT_ANGLES[aspectKind], jdEt);
          const exactJdEt = exactDate.getTime() / 86400000 + 2440587.5;
          const { startAt, endAt } = estimateOrbWindow(bodyA, bodyB, aspectKind, exactJdEt);
          const isApproaching = nowMs < exactDate.getTime();

          results.push({
            bodyA,
            bodyB,
            aspectKind,
            orbDegrees: Math.round(orbDegrees * 100) / 100,
            exactAt: exactDate.toISOString(),
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            isActiveNow: true,
            isApproaching,
            titleEn: `${bodyA} ${aspectKind} ${bodyB}`,
            titleFa: `${PLANET_FA[bodyA]} ${ASPECT_FA[aspectKind]} ${PLANET_FA[bodyB]}`,
          });
        } else {
          let found = false;
          for (let d = 1; d <= 60 && !found; d++) {
            try {
              const futureLons = planetLongitudesAt(jdEt + d);
              const futureA = futureLons[bodyA];
              const futureB = futureLons[bodyB];
              if (futureA === undefined || futureB === undefined) continue;
              const futureDetected = detectAspect(futureA, futureB);
              if (futureDetected) {
                const { aspectKind } = futureDetected;
                const exactDate = estimateExactAt(bodyA, bodyB, ASPECT_ANGLES[aspectKind], jdEt + d);
                const exactJdEt = exactDate.getTime() / 86400000 + 2440587.5;
                const { startAt, endAt } = estimateOrbWindow(bodyA, bodyB, aspectKind, exactJdEt);

                results.push({
                  bodyA,
                  bodyB,
                  aspectKind,
                  orbDegrees: Math.round(futureDetected.orbDegrees * 100) / 100,
                  exactAt: exactDate.toISOString(),
                  startAt: startAt.toISOString(),
                  endAt: endAt.toISOString(),
                  isActiveNow: false,
                  isApproaching: true,
                  titleEn: `${bodyA} ${aspectKind} ${bodyB}`,
                  titleFa: `${PLANET_FA[bodyA]} ${ASPECT_FA[aspectKind]} ${PLANET_FA[bodyB]}`,
                });
                found = true;
              }
            } catch {
              continue;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[collectiveTransits] computation error:", err);
    return [];
  }

  return results.sort((a, b) => {
    if (a.isActiveNow !== b.isActiveNow) {
      return a.isActiveNow ? -1 : 1;
    }
    return new Date(a.exactAt).getTime() - new Date(b.exactAt).getTime();
  });
}
