import type { NatalChartData } from "./chartEngine.js";
import type { TransitAspect } from "./chartEngine.js";
import {
  getSignMeaning,
  getPlanetMeaning,
  getTransitMeaning,
} from "../content/contentService.js";

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface SignSummary {
  sign: string;
  element: string;
  modality: string;
  emotionalStyle: string;
  communicationStyle: string;
  relationshipStyle: string;
  keywords: string[];
  growthEdge: string;
}

export interface TransitSummary {
  label: string;          // e.g. "Jupiter conjunct natal Sun"
  themes: string[];
  emotionalTone: string;
  practicalExpression: string;
  caution: string;
  domain: string[];
  source: "database" | "planet_fallback"; // where meaning came from
}

export interface AssembledMeaning {
  sun: SignSummary | null;
  moon: SignSummary | null;
  rising: SignSummary | null;
  dominantElement: string;
  dominantModality: string;
  innerPlanetSigns: { planet: string; sign: string }[];  // Sun/Moon/Mercury/Venus/Mars
  transitSummaries: TransitSummary[];
  contextBlocks: string[];  // pre-formatted prose strings ready for LLM injection
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INNER_PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars"];

type ElementKey = "fire" | "earth" | "air" | "water";
type ModalityKey = "cardinal" | "fixed" | "mutable";

const ELEMENT_MAP: Record<string, ElementKey> = {
  Aries: "fire", Leo: "fire", Sagittarius: "fire",
  Taurus: "earth", Virgo: "earth", Capricorn: "earth",
  Gemini: "air", Libra: "air", Aquarius: "air",
  Cancer: "water", Scorpio: "water", Pisces: "water",
};

const MODALITY_MAP: Record<string, ModalityKey> = {
  Aries: "cardinal", Cancer: "cardinal", Libra: "cardinal", Capricorn: "cardinal",
  Taurus: "fixed", Leo: "fixed", Scorpio: "fixed", Aquarius: "fixed",
  Gemini: "mutable", Virgo: "mutable", Sagittarius: "mutable", Pisces: "mutable",
};

function tallyDominant<T extends string>(
  signs: string[],
  map: Record<string, T>
): T {
  const counts: Record<string, number> = {};
  for (const s of signs) {
    const key = map[s];
    if (key) counts[key] = (counts[key] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (sorted[0]?.[0] as T) ?? ("balanced" as T);
}

function toSignSummary(raw: Awaited<ReturnType<typeof getSignMeaning>>): SignSummary | null {
  if (!raw) return null;
  return {
    sign: raw.sign,
    element: raw.element,
    modality: raw.modality,
    emotionalStyle: raw.emotionalStyle,
    communicationStyle: raw.communicationStyle,
    relationshipStyle: raw.relationshipStyle,
    keywords: raw.keywords,
    growthEdge: raw.growthEdge,
  };
}

// ─── Main Assembler ───────────────────────────────────────────────────────────

/**
 * Translates raw natal chart data and active transits into a rich
 * `AssembledMeaning` object ready for injection into LLM prompts.
 *
 * - Sign meanings are looked up from the content service (Redis → DB → static).
 * - Transit meanings are looked up per (planet, target, aspect).
 *   If no exact match exists in the DB, falls back to the transiting planet's
 *   `underTransit` description from the Planet table.
 * - Dominant element + modality are tallied from the 5 inner planets.
 */
export async function assembleMeaning(
  natalChart: NatalChartData,
  activeTransits: TransitAspect[]
): Promise<AssembledMeaning> {
  // ── 1. Fetch sun / moon / rising sign meanings ──────────────────────────────
  const [sunMeaning, moonMeaning, risingMeaning] = await Promise.all([
    getSignMeaning(natalChart.sunSign),
    getSignMeaning(natalChart.moonSign),
    natalChart.risingSign ? getSignMeaning(natalChart.risingSign) : Promise.resolve(null),
  ]);

  // ── 2. Inner planet placements for element/modality tally ──────────────────
  const innerRows = natalChart.planets.filter((p) =>
    INNER_PLANETS.includes(p.planet)
  );

  const innerPlanetSigns = innerRows.map((p) => ({
    planet: p.planet,
    sign: p.sign,
  }));

  const innerSignNames = innerRows.map((p) => p.sign);
  const dominantElement = tallyDominant(innerSignNames, ELEMENT_MAP);
  const dominantModality = tallyDominant(innerSignNames, MODALITY_MAP);

  // ── 3. Resolve transit meanings ─────────────────────────────────────────────
  const transitSummaries: TransitSummary[] = [];

  for (const transit of activeTransits.slice(0, 8)) {
    const label = `${transit.transitBody} ${transit.type} natal ${transit.natalBody}`;

    // Try exact transit entry first
    const exactMeaning = await getTransitMeaning(
      transit.transitBody,
      transit.natalBody,
      transit.type
    );

    if (exactMeaning) {
      transitSummaries.push({
        label,
        themes: exactMeaning.themes,
        emotionalTone: exactMeaning.emotionalTone,
        practicalExpression: exactMeaning.practicalExpression,
        caution: exactMeaning.caution,
        domain: exactMeaning.domain,
        source: "database",
      });
      continue;
    }

    // Fallback: use the transiting planet's generic `underTransit` text
    const planetData = await getPlanetMeaning(transit.transitBody);
    if (planetData) {
      transitSummaries.push({
        label,
        themes: planetData.keywords.slice(0, 4),
        emotionalTone: planetData.underTransit,
        practicalExpression: planetData.healthyExpression,
        caution: planetData.difficultExpression,
        domain: planetData.rulesOver.slice(0, 3),
        source: "planet_fallback",
      });
    }
  }

  // ── 4. Build pre-formatted prose context blocks ─────────────────────────────
  const contextBlocks: string[] = [];

  if (sunMeaning) {
    contextBlocks.push(
      `SUN IN ${sunMeaning.sign.toUpperCase()} (${sunMeaning.element} / ${sunMeaning.modality}): ` +
        `${sunMeaning.emotionalStyle} In communication: ${sunMeaning.communicationStyle} ` +
        `Growth edge: ${sunMeaning.growthEdge}`
    );
  }

  if (moonMeaning) {
    contextBlocks.push(
      `MOON IN ${moonMeaning.sign.toUpperCase()}: ${moonMeaning.emotionalStyle} ` +
        `Relationship style: ${moonMeaning.relationshipStyle}`
    );
  }

  if (risingMeaning) {
    contextBlocks.push(
      `RISING IN ${risingMeaning.sign.toUpperCase()}: ${risingMeaning.communicationStyle} ` +
        `Keywords: ${risingMeaning.keywords.slice(0, 4).join(", ")}.`
    );
  }

  if (innerPlanetSigns.length > 0) {
    const placements = innerPlanetSigns
      .map((p) => `${p.planet} in ${p.sign}`)
      .join(", ");
    contextBlocks.push(
      `INNER PLANETS: ${placements}. Dominant element: ${dominantElement}. Dominant modality: ${dominantModality}.`
    );
  }

  for (const t of transitSummaries) {
    contextBlocks.push(
      `ACTIVE TRANSIT — ${t.label}: Themes: ${t.themes.join(", ")}. ` +
        `Tone: ${t.emotionalTone} Practical: ${t.practicalExpression}`
    );
  }

  return {
    sun: toSignSummary(sunMeaning),
    moon: toSignSummary(moonMeaning),
    rising: toSignSummary(risingMeaning),
    dominantElement,
    dominantModality,
    innerPlanetSigns,
    transitSummaries,
    contextBlocks,
  };
}
