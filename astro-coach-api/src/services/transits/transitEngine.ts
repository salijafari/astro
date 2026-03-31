/**
 * Deterministic transit computation engine.
 * Extends chartEngine.ts with richer aspect detection, significance scoring,
 * and content enrichment from the AstrologyTransit reference table.
 *
 * NEVER calls the LLM — produces structured data that the LLM interprets.
 * ALL sweph calls wrapped in try/catch — returns empty array on failure.
 */
import { DateTime } from "luxon";
import { PrismaClient } from "@prisma/client";
import {
  planetLongitudesAt,
  julianAtTzDate,
  type NatalChartData,
  type PlanetRow,
} from "../chartEngine.js";

const prisma = new PrismaClient();

/* ─── Types ─── */

export type TransitEventResult = {
  id: string;
  eventType: "aspect" | "ingress";
  transitingBody: string;
  natalTargetBody: string | null;
  natalTargetHouse: number | null;
  aspectType: string | null;
  orbUsed: number;
  startAt: string;
  peakAt: string | null;
  endAt: string;
  isActiveNow: boolean;
  significanceScore: number;
  themeTags: string[];
  title: string;
  shortSummary: string;
  longInterpretation: string | null;
  colorKey: string;
  emotionalTone: string | null;
  practicalExpression: string | null;
};

export type ComputeTransitEventsInput = {
  natalChartJson: unknown;
  birthDate: Date;
  birthTime: string | null;
  birthLat: number | null;
  birthLong: number | null;
  birthTimezone: string | null;
  timeframe: "today" | "week" | "month";
  userId: string;
};

/* ─── Constants ─── */

const ASPECT_DEFS = [
  { type: "conjunction", angle: 0 },
  { type: "trine", angle: 120 },
  { type: "sextile", angle: 60 },
  { type: "square", angle: 90 },
  { type: "opposition", angle: 180 },
] as const;

const TRANSIT_BODIES = [
  "Sun", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
];

const NATAL_TARGETS = [
  "Sun", "Moon", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn",
];

const NATAL_ORB: Record<string, number> = {
  Sun: 6, Moon: 6,
  Mercury: 5, Venus: 5, Mars: 5,
  Jupiter: 4, Saturn: 4,
  Uranus: 3, Neptune: 3, Pluto: 3,
};

const ASPECT_WEIGHT: Record<string, number> = {
  conjunction: 1.0, trine: 0.82, sextile: 0.68,
  square: 0.78, opposition: 0.76,
};

const TRANSIT_BODY_WEIGHT: Record<string, number> = {
  Sun: 0.55, Mercury: 0.62, Venus: 0.66, Mars: 0.78,
  Jupiter: 0.74, Saturn: 0.88, Uranus: 0.84,
  Neptune: 0.8, Pluto: 0.92,
};

const NATAL_TARGET_WEIGHT: Record<string, number> = {
  Sun: 0.9, Moon: 1.0, Mercury: 0.76, Venus: 0.78,
  Mars: 0.78, Jupiter: 0.68, Saturn: 0.74,
  Ascendant: 0.86,
};

const ANGULAR_HOUSES = new Set([1, 4, 7, 10]);

const TIMEFRAME_DAYS: Record<string, number> = {
  today: 1, week: 7, month: 30,
};

/* ─── Color mapping ─── */

export function getTransitColor(body: string): string {
  const map: Record<string, string> = {
    Moon: "#3b82f6",
    Venus: "#14b8a6",
    Mars: "#ef4444",
    Mercury: "#6366f1",
    Jupiter: "#f59e0b",
    Saturn: "#64748b",
    Uranus: "#38bdf8",
    Neptune: "#8b5cf6",
    Pluto: "#dc2626",
    Sun: "#f97316",
    NewMoon: "#94a3b8",
    FullMoon: "#cbd5e1",
  };
  return map[body] ?? "#8b8cff";
}

/* ─── Helpers ─── */

function normLon(lon: number): number {
  let v = lon % 360;
  if (v < 0) v += 360;
  return v;
}

function angularDiff(a: number, b: number): number {
  let diff = Math.abs(a - b);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

function parseNatalChart(json: unknown): {
  longitudes: Record<string, number>;
  houses: number[];
  planets: PlanetRow[];
} | null {
  if (!json || typeof json !== "object") return null;
  const data = json as NatalChartData;
  if (!Array.isArray(data.planets)) return null;

  const longitudes: Record<string, number> = {};
  for (const p of data.planets) {
    longitudes[p.planet] = p.longitude;
  }

  const houses: number[] = [];
  for (const p of data.planets) {
    if (p.house) houses[p.house] = p.longitude;
  }

  return { longitudes, houses, planets: data.planets };
}

function houseForLongitude(lon: number, planets: PlanetRow[]): number | null {
  const closest = planets.reduce<PlanetRow | null>((best, p) => {
    if (!best) return p;
    return angularDiff(lon, p.longitude) < angularDiff(lon, best.longitude) ? p : best;
  }, null);
  return closest?.house ?? null;
}

function computeSignificance(
  transitBody: string,
  aspectType: string,
  natalTarget: string,
  orbUsed: number,
  maxOrb: number,
  natalHouse: number | null,
  hoursFromPeak: number,
): number {
  const tw = TRANSIT_BODY_WEIGHT[transitBody] ?? 0.6;
  const aw = ASPECT_WEIGHT[aspectType] ?? 0.7;
  const nw = NATAL_TARGET_WEIGHT[natalTarget] ?? 0.7;
  const exactness = Math.max(0, 1 - (orbUsed / maxOrb));
  let score = 100 * tw * aw * nw * exactness;

  if (natalTarget === "Moon") score += 8;
  else if (natalTarget === "Sun") score += 6;
  else if (natalTarget === "Ascendant") score += 5;

  if (natalHouse != null && ANGULAR_HOUSES.has(natalHouse)) score += 4;
  if (hoursFromPeak <= 48) score += 4;

  return Math.round(score * 100) / 100;
}

function fallbackTitle(themes: string[]): string {
  const first = themes[0];
  if (!first) return "Energy In Focus";
  return `${first.charAt(0).toUpperCase()}${first.slice(1)} In Focus`;
}

function fallbackSummary(themes: string[]): string {
  const joined = themes.slice(0, 2).join(" and ");
  return `This period highlights ${joined || "subtle shifts"} in a more noticeable way.`;
}

/* ─── Main computation ─── */

export async function computeTransitEvents(
  input: ComputeTransitEventsInput,
): Promise<TransitEventResult[]> {
  const natal = parseNatalChart(input.natalChartJson);
  if (!natal) return [];

  const tz = input.birthTimezone ?? "UTC";
  const days = TIMEFRAME_DAYS[input.timeframe] ?? 1;
  const now = DateTime.now().setZone(tz);
  const startDate = now.startOf("day");

  let transitPositionsByDay: Array<{
    date: string;
    positions: Record<string, number>;
  }> = [];

  try {
    for (let i = 0; i < days; i++) {
      const d = startDate.plus({ days: i }).toISODate();
      if (!d) continue;
      const { jdEt } = julianAtTzDate(d, tz, 12);
      const positions = planetLongitudesAt(jdEt);
      transitPositionsByDay.push({ date: d, positions });
    }
  } catch (swephErr: unknown) {
    const msg = swephErr instanceof Error ? swephErr.message : String(swephErr);
    console.warn("[transitEngine] sweph unavailable:", msg);
    return [];
  }

  if (transitPositionsByDay.length === 0) return [];

  type RawHit = {
    transitBody: string;
    natalBody: string;
    aspectType: string;
    orbUsed: number;
    maxOrb: number;
    date: string;
    natalHouse: number | null;
  };

  const hits: RawHit[] = [];

  for (const { date, positions } of transitPositionsByDay) {
    for (const tBody of TRANSIT_BODIES) {
      const tLon = positions[tBody];
      if (tLon == null) continue;

      for (const nBody of NATAL_TARGETS) {
        const nLon = natal.longitudes[nBody];
        if (nLon == null) continue;
        const maxOrb = NATAL_ORB[nBody] ?? 4;

        for (const { type: aType, angle } of ASPECT_DEFS) {
          const diff = angularDiff(tLon, nLon);
          const orb = Math.abs(diff - angle);
          if (orb <= maxOrb) {
            const natalHouse = houseForLongitude(nLon, natal.planets);
            hits.push({
              transitBody: tBody,
              natalBody: nBody,
              aspectType: aType,
              orbUsed: orb,
              maxOrb,
              date,
              natalHouse,
            });
          }
        }
      }
    }
  }

  const deduped = new Map<string, RawHit>();
  for (const h of hits) {
    const key = `${h.transitBody}:${h.natalBody}:${h.aspectType}`;
    const existing = deduped.get(key);
    if (!existing || h.orbUsed < existing.orbUsed) {
      deduped.set(key, h);
    }
  }

  const scored = Array.from(deduped.values())
    .map((h) => ({
      ...h,
      score: computeSignificance(
        h.transitBody, h.aspectType, h.natalBody,
        h.orbUsed, h.maxOrb, h.natalHouse, 24,
      ),
    }))
    .filter((h) => h.score >= 48)
    .sort((a, b) => b.score - a.score)
    .slice(0, 7);

  if (scored.length === 0) return [];

  let contentLookup = new Map<string, {
    themes: string[];
    emotionalTone: string;
    practicalExpression: string;
  }>();

  try {
    const lookupKeys = scored.map((s) => ({
      transitPlanet: s.transitBody,
      natalTarget: s.natalBody,
      aspect: s.aspectType,
    }));
    const rows = await prisma.astrologyTransit.findMany({
      where: {
        OR: lookupKeys,
      },
    });
    for (const r of rows) {
      const key = `${r.transitPlanet}:${r.natalTarget}:${r.aspect}`;
      contentLookup.set(key, {
        themes: Array.isArray(r.themes) ? (r.themes as string[]) : [],
        emotionalTone: r.emotionalTone,
        practicalExpression: r.practicalExpression,
      });
    }
  } catch (err: unknown) {
    console.warn("[transitEngine] AstrologyTransit lookup failed:", err);
  }

  const todayStr = now.toISODate() ?? startDate.toISODate() ?? "";
  const endStr = startDate.plus({ days: Math.max(days - 1, 0) }).toISODate() ?? todayStr;

  return scored.map((h, idx) => {
    const key = `${h.transitBody}:${h.natalBody}:${h.aspectType}`;
    const content = contentLookup.get(key);
    const themes = content?.themes ?? [h.aspectType, h.natalBody.toLowerCase()];

    return {
      id: `${input.userId.slice(-6)}-${todayStr}-${idx}`,
      eventType: "aspect" as const,
      transitingBody: h.transitBody,
      natalTargetBody: h.natalBody,
      natalTargetHouse: h.natalHouse,
      aspectType: h.aspectType,
      orbUsed: Math.round(h.orbUsed * 100) / 100,
      startAt: todayStr,
      peakAt: h.date,
      endAt: endStr,
      isActiveNow: h.date === todayStr,
      significanceScore: h.score,
      themeTags: themes.slice(0, 4),
      title: `${h.transitBody} ${h.aspectType} natal ${h.natalBody}`,
      shortSummary: content
        ? content.practicalExpression.slice(0, 160)
        : fallbackSummary(themes),
      longInterpretation: null,
      colorKey: getTransitColor(h.transitBody),
      emotionalTone: content?.emotionalTone ?? null,
      practicalExpression: content?.practicalExpression ?? null,
    };
  });
}
