import type { SynastryAspect } from "./chartEngine.js";

export interface CompatibilityScores {
  overall: number;
  emotional: number;
  communication: number;
  attraction: number;
  longTerm: number;
  conflictPotential: number;
  topStrengths: string[];
  topTensions: string[];
  isEstimate?: boolean;
}

function hasPair(a: SynastryAspect, p1: string, p2: string): boolean {
  return (
    (a.aPlanet === p1 && a.bPlanet === p2) ||
    (a.aPlanet === p2 && a.bPlanet === p1)
  );
}

/**
 * Deterministic synastry scoring from aspect list.
 */
export function synastryScoringEngine(aspects: SynastryAspect[], hasFullBirthTime = true): CompatibilityScores {
  let overall = 50;
  let emotional = 50;
  let communication = 50;
  let attraction = 50;
  let longTerm = 50;
  let conflictPotential = 50;
  const strengths: string[] = [];
  const tensions: string[] = [];

  for (const aspect of aspects) {
    const soft = aspect.type === "conjunction" || aspect.type === "trine";
    if (hasPair(aspect, "Venus", "Moon") && soft) {
      emotional += 12;
      overall += 8;
      strengths.push("Venus-Moon harmony supports emotional safety");
    }
    if (hasPair(aspect, "Sun", "Moon") && aspect.type === "conjunction") {
      overall += 10;
      longTerm += 8;
      strengths.push("Sun-Moon alignment supports long-term bonding");
    }
    if (hasPair(aspect, "Venus", "Mars") && soft) {
      attraction += 14;
      strengths.push("Venus-Mars chemistry boosts attraction");
    }
    if (hasPair(aspect, "Mercury", "Mercury") && (aspect.type === "trine" || aspect.type === "sextile")) {
      communication += 12;
      strengths.push("Mercury harmony supports communication flow");
    }
    if (
      (aspect.aPlanet === "Saturn" || aspect.bPlanet === "Saturn") &&
      (aspect.type === "square" || aspect.type === "opposition")
    ) {
      longTerm -= 8;
      conflictPotential += 5;
      tensions.push("Saturn tension can feel heavy over time");
    }
    if (hasPair(aspect, "Mars", "Mars") && aspect.type === "square") {
      conflictPotential += 10;
      tensions.push("Mars-Mars square indicates higher friction");
    }
    if (hasPair(aspect, "Sun", "Sun") && aspect.type === "trine") {
      overall += 6;
      strengths.push("Sun-Sun trine supports core compatibility");
    }
  }

  if (!hasFullBirthTime) {
    overall *= 0.75;
    emotional *= 0.75;
    communication *= 0.75;
    attraction *= 0.75;
    longTerm *= 0.75;
    conflictPotential *= 0.75;
  }

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  return {
    overall: clamp(overall),
    emotional: clamp(emotional),
    communication: clamp(communication),
    attraction: clamp(attraction),
    longTerm: clamp(longTerm),
    conflictPotential: clamp(conflictPotential),
    topStrengths: strengths.slice(0, 3),
    topTensions: tensions.slice(0, 3),
    isEstimate: !hasFullBirthTime,
  };
}
