/**
 * Deterministic synastry scoring from planet longitudes (no LLM, no sweph).
 * Planet map keys must match chart JSON bodies (e.g. "Sun", "Moon", "Venus").
 */

const ASPECTS = [
  { name: "conjunction" as const, angle: 0, orb: 8, weight: 1.0 },
  { name: "opposition" as const, angle: 180, orb: 8, weight: 0.8 },
  { name: "trine" as const, angle: 120, orb: 7, weight: 0.9 },
  { name: "square" as const, angle: 90, orb: 7, weight: 0.7 },
  { name: "sextile" as const, angle: 60, orb: 5, weight: 0.7 },
];

function detectAspect(lon1: number, lon2: number) {
  const raw = ((((lon1 - lon2) % 360) + 360) % 360) as number;
  const diff = raw > 180 ? 360 - raw : raw;
  for (const asp of ASPECTS) {
    const orbUsed = Math.abs(diff - asp.angle);
    if (orbUsed <= asp.orb) {
      return { ...asp, orb: orbUsed, exactness: 1 - orbUsed / asp.orb };
    }
  }
  return null;
}

const SYNASTRY_RULES: Array<{
  body1: string;
  body2: string;
  aspects: readonly string[];
  category: "emotional" | "attraction" | "communication" | "longTerm" | "conflict";
  points: number;
}> = [
  { body1: "Venus", body2: "Moon", aspects: ["conjunction", "trine"], category: "emotional", points: 12 },
  { body1: "Sun", body2: "Moon", aspects: ["conjunction", "trine"], category: "emotional", points: 10 },
  { body1: "Moon", body2: "Moon", aspects: ["trine"], category: "emotional", points: 8 },
  { body1: "Venus", body2: "Mars", aspects: ["conjunction", "trine"], category: "attraction", points: 14 },
  { body1: "Mars", body2: "Ascendant", aspects: ["conjunction"], category: "attraction", points: 8 },
  { body1: "Mercury", body2: "Mercury", aspects: ["trine", "sextile"], category: "communication", points: 12 },
  { body1: "Mercury", body2: "Sun", aspects: ["conjunction"], category: "communication", points: 8 },
  { body1: "Sun", body2: "Sun", aspects: ["trine", "sextile"], category: "longTerm", points: 6 },
  { body1: "Saturn", body2: "Moon", aspects: ["trine"], category: "longTerm", points: 6 },
  { body1: "Saturn", body2: "Moon", aspects: ["square", "opposition"], category: "conflict", points: -8 },
  { body1: "Mars", body2: "Mars", aspects: ["square"], category: "conflict", points: -10 },
  { body1: "Pluto", body2: "Venus", aspects: ["square"], category: "conflict", points: -7 },
];

export type SynastryAspectEntry = {
  body1: string;
  body2: string;
  aspect: string;
  category: string;
  points: number;
};

export interface SynastryResult {
  emotionalScore: number;
  attractionScore: number;
  communicationScore: number;
  longTermScore: number;
  conflictScore: number;
  overallScore: number;
  isEstimate: boolean;
  supportingAspects: SynastryAspectEntry[];
  tensionAspects: SynastryAspectEntry[];
  rawAspects: SynastryAspectEntry[];
}

const SIGNS: Record<string, number> = {
  Aries: 15,
  Taurus: 45,
  Gemini: 75,
  Cancer: 105,
  Leo: 135,
  Virgo: 165,
  Libra: 195,
  Scorpio: 225,
  Sagittarius: 255,
  Capricorn: 285,
  Aquarius: 315,
  Pisces: 345,
};

export function sunSignToLongitude(sunSign: string): number {
  return SIGNS[sunSign] ?? 285;
}

/** Matches natal chart JSON from computeNatalChart: planets[].planet + .longitude */
export function extractPlanetsFromChartJson(chartJson: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!chartJson || typeof chartJson !== "object") return out;
  const planets = (chartJson as { planets?: { planet: string; longitude: number }[] }).planets;
  planets?.forEach((p) => {
    if (typeof p.longitude === "number") out[p.planet] = p.longitude;
  });
  return out;
}

export function computeSynastry(
  userPlanets: Record<string, number>,
  personPlanets: Record<string, number>,
  isEstimate: boolean,
): SynastryResult {
  const supporting: SynastryAspectEntry[] = [];
  const tension: SynastryAspectEntry[] = [];

  let emotional = 50;
  let attraction = 50;
  let communication = 50;
  let longTerm = 50;
  let conflict = 80;

  for (const rule of SYNASTRY_RULES) {
    const pairs: Array<[number, number]> = [
      [userPlanets[rule.body1]!, personPlanets[rule.body2]!],
      [userPlanets[rule.body2]!, personPlanets[rule.body1]!],
    ];
    for (const [lon1, lon2] of pairs) {
      if (lon1 === undefined || lon2 === undefined) continue;
      const asp = detectAspect(lon1, lon2);
      if (!asp) continue;
      if (!rule.aspects.includes(asp.name)) continue;

      const weightedPoints = rule.points * asp.exactness;

      if (rule.category === "emotional") emotional += weightedPoints;
      if (rule.category === "attraction") attraction += weightedPoints;
      if (rule.category === "communication") communication += weightedPoints;
      if (rule.category === "longTerm") longTerm += weightedPoints;
      if (rule.category === "conflict") conflict += weightedPoints;

      const entry: SynastryAspectEntry = {
        body1: rule.body1,
        body2: rule.body2,
        aspect: asp.name,
        category: rule.category,
        points: Math.round(weightedPoints),
      };

      if (rule.points > 0) supporting.push(entry);
      else tension.push(entry);
    }
  }

  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

  let emotionalFinal = clamp(emotional);
  let attractionFinal = clamp(attraction);
  let communicationFinal = clamp(communication);
  let longTermFinal = clamp(longTerm);
  let conflictFinal = clamp(conflict);

  if (isEstimate) {
    emotionalFinal = Math.round(emotionalFinal * 0.75);
    attractionFinal = Math.round(attractionFinal * 0.75);
    communicationFinal = Math.round(communicationFinal * 0.75);
    longTermFinal = Math.round(longTermFinal * 0.75);
  }

  const overall = Math.round(
    emotionalFinal * 0.25 +
      attractionFinal * 0.2 +
      communicationFinal * 0.2 +
      longTermFinal * 0.25 +
      conflictFinal * 0.1,
  );

  const rawAspects = [...supporting, ...tension];

  return {
    emotionalScore: emotionalFinal,
    attractionScore: attractionFinal,
    communicationScore: communicationFinal,
    longTermScore: longTermFinal,
    conflictScore: conflictFinal,
    overallScore: clamp(overall),
    isEstimate,
    supportingAspects: [...supporting].sort((a, b) => b.points - a.points).slice(0, 3),
    tensionAspects: [...tension].sort((a, b) => a.points - b.points).slice(0, 3),
    rawAspects,
  };
}
