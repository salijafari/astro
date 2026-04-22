import type { PlanetRow } from "./chartEngine.js";
import { SIGN_RULER } from "./astroGlossaryServer.js";

export type ElementBalance = {
  fire: number;
  earth: number;
  air: number;
  water: number;
};

export type ModalityBalance = {
  cardinal: number;
  fixed: number;
  mutable: number;
};

export type SalienceMap = {
  chartRuler: string | null;
  angularPlanets: string[];
  luminaryPlanets: string[];
  stellia: number[];
  elementBalance: ElementBalance;
  modalityBalance: ModalityBalance;
  topPlanetsByHouseWeight: string[];
};

const SIGN_ELEMENT: Record<string, keyof ElementBalance> = {
  Aries: "fire",
  Leo: "fire",
  Sagittarius: "fire",
  Taurus: "earth",
  Virgo: "earth",
  Capricorn: "earth",
  Gemini: "air",
  Libra: "air",
  Aquarius: "air",
  Cancer: "water",
  Scorpio: "water",
  Pisces: "water",
};

const SIGN_MODALITY: Record<string, keyof ModalityBalance> = {
  Aries: "cardinal",
  Cancer: "cardinal",
  Libra: "cardinal",
  Capricorn: "cardinal",
  Taurus: "fixed",
  Leo: "fixed",
  Scorpio: "fixed",
  Aquarius: "fixed",
  Gemini: "mutable",
  Virgo: "mutable",
  Sagittarius: "mutable",
  Pisces: "mutable",
};

const ANGULAR_HOUSES = new Set([1, 4, 7, 10]);

const PLANET_SORT_ORDER = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "North Node",
] as const;

function planetSortIndex(name: string): number {
  const i = (PLANET_SORT_ORDER as readonly string[]).indexOf(name);
  return i >= 0 ? i : 99;
}

/**
 * Derives a salience map from persisted natal `PlanetRow[]` (no ephemeris calls).
 */
export function deriveSalience(planets: PlanetRow[], risingSign: string | null): SalienceMap {
  const chartRuler = risingSign ? (SIGN_RULER[risingSign] ?? null) : null;

  const angularPlanets = planets.filter((p) => ANGULAR_HOUSES.has(p.house)).map((p) => p.planet);

  const luminaryPlanets = planets.filter((p) => p.planet === "Sun" || p.planet === "Moon").map((p) => p.planet);

  const houseCounts: Record<number, number> = {};
  for (const p of planets) {
    if (p.house > 0) {
      houseCounts[p.house] = (houseCounts[p.house] ?? 0) + 1;
    }
  }
  const stellia = Object.entries(houseCounts)
    .filter(([, count]) => count >= 3)
    .map(([h]) => Number(h));

  const elementBalance: ElementBalance = { fire: 0, earth: 0, air: 0, water: 0 };
  const modalityBalance: ModalityBalance = { cardinal: 0, fixed: 0, mutable: 0 };
  for (const p of planets) {
    const el = SIGN_ELEMENT[p.sign];
    const mod = SIGN_MODALITY[p.sign];
    if (el) elementBalance[el]++;
    if (mod) modalityBalance[mod]++;
  }

  const topPlanetsByHouseWeight = [...planets]
    .sort((a, b) => {
      const aAngular = ANGULAR_HOUSES.has(a.house) ? 0 : 1;
      const bAngular = ANGULAR_HOUSES.has(b.house) ? 0 : 1;
      if (aAngular !== bAngular) return aAngular - bAngular;
      return planetSortIndex(a.planet) - planetSortIndex(b.planet);
    })
    .map((p) => p.planet)
    .slice(0, 5);

  return {
    chartRuler,
    angularPlanets,
    luminaryPlanets,
    stellia,
    elementBalance,
    modalityBalance,
    topPlanetsByHouseWeight,
  };
}
