import type { NatalChartData } from "./chartEngine.js";

type ChallengeRule = {
  id: string;
  triggers: string[];
};

const CHALLENGE_RULES: ChallengeRule[] = [
  { id: "fear_rejection", triggers: ["Moon in Aries square Saturn", "Moon opposition Saturn", "Sun square Saturn"] },
  { id: "self_doubt", triggers: ["Saturn in 1st house", "Chiron conjunct Sun", "Moon square Neptune"] },
  { id: "relationship_patterns", triggers: ["Venus square Saturn", "Venus opposition Pluto", "Moon in 7th square Mars"] },
  { id: "procrastination", triggers: ["Mars square Neptune", "Saturn in 6th", "12th house stellium"] },
  { id: "boundaries", triggers: ["Neptune in 1st", "Pisces rising", "Moon conjunct Neptune"] },
  { id: "burnout", triggers: ["Sun square Pluto", "Mars conjunct Saturn", "6th house stellium"] },
  { id: "money_stress", triggers: ["Saturn in 2nd", "Pluto in 2nd", "Venus square Pluto"] },
  { id: "clarity", triggers: ["Mercury square Neptune", "Gemini Moon", "Mutable grand cross"] },
];

export type ChallengeCluster = {
  id: string;
  confidence: number;
  evidence: string[];
};

function hasAspect(chart: NatalChartData, a: string, type: string, b: string): boolean {
  return chart.aspects.some(
    (x) =>
      x.type === type &&
      ((x.body1 === a && x.body2 === b) || (x.body1 === b && x.body2 === a)),
  );
}

function hasPlacement(chart: NatalChartData, planet: string, sign?: string, house?: number): boolean {
  return chart.planets.some(
    (p) => p.planet === planet && (sign ? p.sign === sign : true) && (house ? p.house === house : true),
  );
}

/**
 * Deterministic cluster matching from natal placements/aspects.
 */
export function challengeRulesEngine(chart: NatalChartData): ChallengeCluster[] {
  const matched: ChallengeCluster[] = [];

  for (const rule of CHALLENGE_RULES) {
    const evidence: string[] = [];
    for (const trigger of rule.triggers) {
      if (trigger === "Moon in Aries square Saturn" && hasPlacement(chart, "Moon", "Aries") && hasAspect(chart, "Moon", "square", "Saturn")) evidence.push(trigger);
      if (trigger === "Moon opposition Saturn" && hasAspect(chart, "Moon", "opposition", "Saturn")) evidence.push(trigger);
      if (trigger === "Sun square Saturn" && hasAspect(chart, "Sun", "square", "Saturn")) evidence.push(trigger);
      if (trigger === "Saturn in 1st house" && hasPlacement(chart, "Saturn", undefined, 1)) evidence.push(trigger);
      if (trigger === "Chiron conjunct Sun" && hasAspect(chart, "Chiron", "conjunction", "Sun")) evidence.push(trigger);
      if (trigger === "Moon square Neptune" && hasAspect(chart, "Moon", "square", "Neptune")) evidence.push(trigger);
      if (trigger === "Venus square Saturn" && hasAspect(chart, "Venus", "square", "Saturn")) evidence.push(trigger);
      if (trigger === "Venus opposition Pluto" && hasAspect(chart, "Venus", "opposition", "Pluto")) evidence.push(trigger);
      if (trigger === "Moon in 7th square Mars" && hasPlacement(chart, "Moon", undefined, 7) && hasAspect(chart, "Moon", "square", "Mars")) evidence.push(trigger);
      if (trigger === "Mars square Neptune" && hasAspect(chart, "Mars", "square", "Neptune")) evidence.push(trigger);
      if (trigger === "Saturn in 6th" && hasPlacement(chart, "Saturn", undefined, 6)) evidence.push(trigger);
      if (trigger === "12th house stellium" && chart.planets.filter((p) => p.house === 12).length >= 3) evidence.push(trigger);
      if (trigger === "Neptune in 1st" && hasPlacement(chart, "Neptune", undefined, 1)) evidence.push(trigger);
      if (trigger === "Pisces rising" && chart.risingSign === "Pisces") evidence.push(trigger);
      if (trigger === "Moon conjunct Neptune" && hasAspect(chart, "Moon", "conjunction", "Neptune")) evidence.push(trigger);
      if (trigger === "Sun square Pluto" && hasAspect(chart, "Sun", "square", "Pluto")) evidence.push(trigger);
      if (trigger === "Mars conjunct Saturn" && hasAspect(chart, "Mars", "conjunction", "Saturn")) evidence.push(trigger);
      if (trigger === "6th house stellium" && chart.planets.filter((p) => p.house === 6).length >= 3) evidence.push(trigger);
      if (trigger === "Saturn in 2nd" && hasPlacement(chart, "Saturn", undefined, 2)) evidence.push(trigger);
      if (trigger === "Pluto in 2nd" && hasPlacement(chart, "Pluto", undefined, 2)) evidence.push(trigger);
      if (trigger === "Mercury square Neptune" && hasAspect(chart, "Mercury", "square", "Neptune")) evidence.push(trigger);
      if (trigger === "Gemini Moon" && hasPlacement(chart, "Moon", "Gemini")) evidence.push(trigger);
      // Mutable grand cross simplified heuristic
      if (trigger === "Mutable grand cross" && chart.planets.filter((p) => ["Gemini", "Virgo", "Sagittarius", "Pisces"].includes(p.sign)).length >= 5) evidence.push(trigger);
    }
    if (evidence.length) {
      matched.push({
        id: rule.id,
        confidence: Math.min(1, evidence.length / rule.triggers.length),
        evidence,
      });
    }
  }

  return matched.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}
