/**
 * Deterministic transit computation engine.
 * Extends chartEngine.ts with richer aspect detection, significance scoring,
 * and content enrichment from the AstrologyTransit reference table.
 *
 * NEVER calls the LLM — produces structured data that the LLM interprets.
 * When natalChartJson is missing OR sweph fails (e.g. Railway without ephemeris files),
 * uses sun-sign-based natal approximations and analytical transiting longitudes.
 */
import { DateTime } from "luxon";
import {
  planetLongitudesAt,
  julianAtTzDate,
  type NatalChartData,
  type PlanetRow,
} from "../chartEngine.js";
import { prisma } from "../../lib/prisma.js";

const ZODIAC = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

const SIGN_START: Record<string, number> = {
  Aries: 0, Taurus: 30, Gemini: 60, Cancer: 90, Leo: 120, Virgo: 150,
  Libra: 180, Scorpio: 210, Sagittarius: 240, Capricorn: 270, Aquarius: 300, Pisces: 330,
};

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
  /** When DB has no natal chart, used to build approximate natal longitudes */
  sunSign?: string | null;
};

/* ─── Constants (same as before) ─── */

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

/* ─── Sun sign / display helpers (exported for overview Big Three) ─── */

function normLon(lon: number): number {
  let v = lon % 360;
  if (v < 0) v += 360;
  return v;
}

function longitudeToSign(lon: number): string {
  return ZODIAC[Math.floor(normLon(lon) / 30)] ?? "Aries";
}

/** Midpoint longitude for a sun sign (approximate natal Sun). */
function sunSignToLongitudeMidpoint(sign: string): number {
  const s = sign.trim();
  const start = SIGN_START[s];
  if (start === undefined) return 15;
  return start + 15;
}

function computeSunSignFromBirthDate(birthDate: Date): string {
  const month = birthDate.getUTCMonth() + 1;
  const day = birthDate.getUTCDate();
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
  return "Pisces";
}

/**
 * When DB moonSign is null, show a label derived from sun-sign approximation (not medical-grade).
 */
export function approximateMoonSignForDisplay(birthDate: Date, sunSign: string | null | undefined): string {
  const effectiveSun = (sunSign?.trim() || computeSunSignFromBirthDate(birthDate)).trim();
  const sunLon = sunSignToLongitudeMidpoint(effectiveSun);
  const moonLon = (sunLon + 60) % 360;
  return longitudeToSign(moonLon);
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

/** When no stored chart: approximate natal longitudes from sun sign + date (deterministic). */
function buildSyntheticNatal(
  birthDate: Date,
  sunSign: string | null | undefined,
): { longitudes: Record<string, number>; planets: PlanetRow[]; houses: number[] } {
  const effectiveSun = (sunSign?.trim() || computeSunSignFromBirthDate(birthDate)).trim();
  const sunLon = sunSignToLongitudeMidpoint(effectiveSun);
  const longitudes: Record<string, number> = {
    Sun: sunLon,
    Moon: (sunLon + 60) % 360,
    Mercury: (sunLon + 20) % 360,
    Venus: (sunLon + 40) % 360,
    Mars: (sunLon + 90) % 360,
    Jupiter: (sunLon + 120) % 360,
    Saturn: (sunLon + 180) % 360,
  };
  const planets: PlanetRow[] = Object.entries(longitudes).map(([planet, longitude]) => ({
    planet,
    sign: longitudeToSign(longitude),
    house: 1,
    degree: longitude % 30,
    longitude,
  }));
  return { longitudes, planets, houses: [] };
}

/**
 * Analytical fallback when sweph/planetLongitudesAt fails (no ephemeris on server).
 * Deterministic, good enough to surface transit-to-natal aspects for UX.
 */
function fallbackTransitingLongitudes(d: Date): Record<string, number> {
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start) / 86_400_000);
  const sun = (280.46 + 0.9856474 * dayOfYear) % 360;
  const moon = (sun + (dayOfYear * 13.2)) % 360;
  return {
    Sun: normLon(sun),
    Moon: normLon(moon),
    Mercury: normLon(sun + 25 + 15 * Math.sin(dayOfYear / 30)),
    Venus: normLon(sun + 48),
    Mars: normLon(sun + 120 + (dayOfYear % 60)),
    Jupiter: normLon(sun + 95),
    Saturn: normLon(sun + 200),
    Uranus: normLon(sun + 45),
    Neptune: normLon(sun + 330),
    Pluto: normLon(sun + 300),
  };
}

function angularDiff(a: number, b: number): number {
  let diff = Math.abs(a - b);
  if (diff > 180) diff = 360 - diff;
  return diff;
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
  const natal =
    parseNatalChart(input.natalChartJson) ??
    buildSyntheticNatal(input.birthDate, input.sunSign ?? null);

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
    console.warn("[transitEngine] sweph unavailable, using analytical transits:", msg);
    transitPositionsByDay = [];
  }

  if (transitPositionsByDay.length === 0) {
    for (let i = 0; i < days; i++) {
      const d = startDate.plus({ days: i }).toISODate();
      if (!d) continue;
      const js = startDate.plus({ days: i }).toJSDate();
      transitPositionsByDay.push({ date: d, positions: fallbackTransitingLongitudes(js) });
    }
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
