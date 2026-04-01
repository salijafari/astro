/**
 * Personal transits engine — deterministic only (no LLM).
 * Uses Swiss Ephemeris via chartEngine when available; otherwise approximate positions.
 * Never throws; always returns at least one event (fallback card if needed).
 */
import { julianNow, planetLongitudesAt } from "../astrology/chartEngine.js";

export interface TransitEvent {
  id: string;
  transitingBody: string;
  natalTargetBody: string;
  aspectType: string;
  startAt: string;
  peakAt: string;
  endAt: string;
  isActiveNow: boolean;
  significanceScore: number;
  themeTags: string[];
  title: string;
  shortSummary: string;
  colorKey: string;
  colorHex: string;
  emotionalTone: string | null;
  practicalExpression: string | null;
}

export interface TransitEngineInput {
  birthDate: Date;
  sunSign: string | null;
  moonSign: string | null;
  birthLat: number | null;
  birthLong: number | null;
  natalChartJson: unknown;
  timeframe: "today" | "week" | "month";
}

const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

const signToLongitude = (sign: string): number => {
  const idx = SIGNS.indexOf(sign as (typeof SIGNS)[number]);
  return idx >= 0 ? idx * 30 + 15 : 285;
};

const birthDateToSunSign = (date: Date): string => {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return "Aries";
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return "Taurus";
  if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return "Gemini";
  if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return "Cancer";
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return "Leo";
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return "Virgo";
  if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return "Libra";
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return "Scorpio";
  if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return "Sagittarius";
  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return "Capricorn";
  if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return "Aquarius";
  return "Pisces";
};

const getApproximateSkyPositions = (): Record<string, number> => {
  const now = new Date();
  const dayOfYear =
    Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000) % 365;
  const sunLon = (dayOfYear / 365) * 360;
  const wrap = (x: number) => ((x % 360) + 360) % 360;
  return {
    Sun: wrap(sunLon),
    Mercury: wrap(sunLon + 12),
    Venus: wrap(sunLon + 28),
    Mars: wrap(sunLon + 95),
    Jupiter: wrap(sunLon + 140),
    Saturn: wrap(sunLon + 200),
    Uranus: wrap(sunLon + 48),
    Neptune: wrap(sunLon + 330),
    Pluto: wrap(sunLon + 300),
  };
};

const getSkyPositions = async (): Promise<Record<string, number>> => {
  try {
    const { jdEt } = julianNow();
    const all = planetLongitudesAt(jdEt);
    const out: Record<string, number> = { ...all };
    delete out.Moon;
    if (Object.keys(out).length >= 8) {
      console.log("[transit-engine] live sweph positions used");
      return out;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[transit-engine] sweph positions failed, using approximation:", msg);
  }
  console.log("[transit-engine] approximate positions used");
  return getApproximateSkyPositions();
};

const getNatalPositions = (sunSign: string, natalChartJson: unknown): Record<string, number> => {
  if (natalChartJson) {
    try {
      const chart =
        typeof natalChartJson === "string" ? JSON.parse(natalChartJson) : natalChartJson;
      const planets =
        (chart as { planets?: unknown }).planets ??
        (chart as { celestialBodies?: unknown }).celestialBodies ??
        (chart as { bodies?: unknown }).bodies;
      if (planets && typeof planets === "object") {
        const positions: Record<string, number> = {};
        for (const [name, data] of Object.entries(planets as Record<string, unknown>)) {
          const d = data as { longitude?: number; lon?: number; absoluteLongitude?: number };
          const lon = d.longitude ?? d.lon ?? d.absoluteLongitude;
          if (typeof lon === "number") positions[name] = lon;
        }
        if (Object.keys(positions).length >= 4) {
          console.log("[transit-engine] natal chart loaded from JSON");
          return positions;
        }
      }
    } catch {
      console.warn("[transit-engine] natal chart parse failed");
    }
  }

  const sunLon = signToLongitude(sunSign);
  console.log("[transit-engine] natal positions from sunSign:", sunSign);
  return {
    Sun: sunLon,
    Moon: (sunLon + 60) % 360,
    Mercury: (sunLon + 18) % 360,
    Venus: (sunLon + 38) % 360,
    Mars: (sunLon + 90) % 360,
    Jupiter: (sunLon + 120) % 360,
    Saturn: (sunLon + 180) % 360,
  };
};

interface Aspect {
  type: string;
  orb: number;
  weight: number;
  maxOrb: number;
}

const detectAspect = (lon1: number, lon2: number): Aspect | null => {
  const raw = (((lon1 - lon2) % 360) + 360) % 360;
  const diff = raw > 180 ? 360 - raw : raw;

  const checks = [
    { type: "conjunction", angle: 0, maxOrb: 8, weight: 1.0 },
    { type: "opposition", angle: 180, maxOrb: 8, weight: 0.76 },
    { type: "trine", angle: 120, maxOrb: 7, weight: 0.82 },
    { type: "square", angle: 90, maxOrb: 7, weight: 0.78 },
    { type: "sextile", angle: 60, maxOrb: 5, weight: 0.68 },
  ];

  for (const c of checks) {
    const orb = Math.abs(diff - c.angle);
    if (orb <= c.maxOrb) {
      return { type: c.type, orb, weight: c.weight, maxOrb: c.maxOrb };
    }
  }
  return null;
}

const TRANSIT_BODY_WEIGHT: Record<string, number> = {
  Sun: 0.55,
  Mercury: 0.62,
  Venus: 0.66,
  Mars: 0.78,
  Jupiter: 0.74,
  Saturn: 0.88,
  Uranus: 0.84,
  Neptune: 0.8,
  Pluto: 0.92,
};

const NATAL_TARGET_WEIGHT: Record<string, number> = {
  Sun: 0.9,
  Moon: 1.0,
  Mercury: 0.76,
  Venus: 0.78,
  Mars: 0.78,
  Jupiter: 0.68,
  Saturn: 0.74,
};

const computeScore = (transitBody: string, natalTarget: string, aspect: Aspect): number => {
  const bw = TRANSIT_BODY_WEIGHT[transitBody] ?? 0.5;
  const nw = NATAL_TARGET_WEIGHT[natalTarget] ?? 0.6;
  const exactness = Math.max(0, 1 - aspect.orb / aspect.maxOrb);
  let score = 100 * bw * aspect.weight * nw * exactness;
  if (natalTarget === "Moon") score += 8;
  if (natalTarget === "Sun") score += 6;
  if (aspect.orb < 1) score += 4;
  return Math.round(score);
};

const THEMES: Record<string, string[]> = {
  Sun: ["identity", "vitality", "confidence"],
  Moon: ["emotions", "instinct", "inner life"],
  Mercury: ["communication", "insight", "decisions"],
  Venus: ["love", "pleasure", "harmony"],
  Mars: ["action", "courage", "drive"],
  Jupiter: ["growth", "expansion", "opportunity"],
  Saturn: ["structure", "responsibility", "pressure"],
  Uranus: ["change", "breakthrough", "liberation"],
  Neptune: ["intuition", "dreams", "imagination"],
  Pluto: ["transformation", "intensity", "release"],
};

const TITLE_MAP: Record<string, Record<string, string>> = {
  Venus: {
    trine: "Steady Pleasure Ahead",
    sextile: "Grace Opens Up",
    conjunction: "Heart Comes Alive",
    square: "Love Asks for Attention",
    opposition: "Connection in Contrast",
  },
  Mars: {
    trine: "Compassionate Fire",
    sextile: "Momentum Builds",
    conjunction: "Action Intensifies",
    square: "Tension Demands Movement",
    opposition: "Power Finds Its Edge",
  },
  Mercury: {
    trine: "Mind in Clear Flow",
    sextile: "Clarity Opens a Door",
    conjunction: "Thoughts Sharpen",
    square: "Decisions Need Care",
    opposition: "Words Carry Weight",
  },
  Jupiter: {
    trine: "Expansion Opens Up",
    sextile: "Opportunity Knocks",
    conjunction: "Growth Accelerates",
    square: "Optimism Needs Grounding",
    opposition: "Belief Meets Reality",
  },
  Saturn: {
    trine: "Serious Momentum Building",
    sextile: "Structure Supports You",
    conjunction: "Claim Your Power",
    square: "Pressure Points to Growth",
    opposition: "Responsibility Arrives",
  },
  Sun: {
    trine: "Vitality Flows Freely",
    conjunction: "Identity Clarifies",
    opposition: "Balance Calls",
    square: "Purpose Under Pressure",
    sextile: "Confidence Rises",
  },
  Neptune: {
    trine: "Intuition Gets Louder",
    sextile: "Imagination Stirs",
    conjunction: "Vision Deepens",
    square: "Clarity Through the Fog",
    opposition: "Reality Softens",
  },
  Pluto: {
    trine: "Deep Change Is Unfolding",
    conjunction: "Transformation Arrives",
    square: "Power Demands Reckoning",
    opposition: "Release What No Longer Serves",
    sextile: "Depth Opens a Path",
  },
  Uranus: {
    trine: "Breakthrough Energy Arrives",
    conjunction: "Liberation Begins",
    square: "Disruption Asks for Flexibility",
    opposition: "Freedom Calls",
    sextile: "Innovation Opens",
  },
};

const getTitle = (body: string, aspect: string, themes: string[]): string => {
  return (
    TITLE_MAP[body]?.[aspect] ??
    `${(themes[0] ?? "Energy").charAt(0).toUpperCase()}${(themes[0] ?? "energy").slice(1)} In Focus`
  );
};

const FALLBACK_SUMMARIES: Record<string, string> = {
  conjunction:
    "A powerful meeting of energies brings this theme to the center of your attention.",
  trine: "Energy flows easily here, offering a natural opening for growth and expression.",
  sextile: "A helpful opportunity presents itself — one worth leaning into with intention.",
  square: "Some friction here creates the pressure needed to make a meaningful adjustment.",
  opposition: "Two forces ask to be balanced, bringing a key awareness into your daily life.",
};

const COLOR_MAP: Record<string, string> = {
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
};

const PLANET_SPEED_DEG_PER_DAY: Record<string, number> = {
  Sun: 1.0,
  Mercury: 1.4,
  Venus: 1.2,
  Mars: 0.52,
  Jupiter: 0.083,
  Saturn: 0.034,
  Uranus: 0.012,
  Neptune: 0.006,
  Pluto: 0.004,
};

const getTransitWindow = (
  body: string,
  orb: number,
  maxOrb: number,
  today: Date,
): { start: Date; peak: Date; end: Date; isActive: boolean } => {
  const speed = PLANET_SPEED_DEG_PER_DAY[body] ?? 0.5;
  const daysToExact = Math.max(0, Math.round(orb / speed));
  const halfWindow = Math.max(1, Math.round(maxOrb / speed));

  const peak = new Date(today);
  peak.setDate(peak.getDate() + daysToExact);

  const start = new Date(peak);
  start.setDate(start.getDate() - halfWindow);

  const end = new Date(peak);
  end.setDate(end.getDate() + halfWindow);

  const isActive = start <= today && end >= today;
  return { start, peak, end, isActive };
};

const MIN_SIGNIFICANCE_SCORE = 30;

const TRANSIT_BODIES = [
  "Sun",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
];

function buildGentleFallback(today: Date): TransitEvent {
  const day = today.toISOString().split("T")[0] ?? "day";
  const hex = COLOR_MAP.Jupiter ?? "#8b8cff";
  return {
    id: `gentle-sky-${day}`,
    transitingBody: "Jupiter",
    natalTargetBody: "Sun",
    aspectType: "trine",
    startAt: today.toISOString(),
    peakAt: today.toISOString(),
    endAt: new Date(today.getTime() + 7 * 86400000).toISOString(),
    isActiveNow: true,
    significanceScore: 35,
    themeTags: ["ease", "perspective", "breathing room"],
    title: "Gentle Sky Weather",
    shortSummary:
      "The sky still has something to say: a soft, supportive background tone you can lean on while life moves at its own pace.",
    colorKey: "jupiter",
    colorHex: hex,
    emotionalTone: null,
    practicalExpression: null,
  };
}

export async function computeTransits(input: TransitEngineInput): Promise<TransitEvent[]> {
  const { birthDate, sunSign, natalChartJson, timeframe } = input;

  const effectiveSunSign = sunSign?.trim() || birthDateToSunSign(birthDate);
  console.log("[transit-engine] computing for sunSign:", effectiveSunSign);

  let skyPositions: Record<string, number>;
  try {
    skyPositions = await getSkyPositions();
  } catch (e) {
    console.warn("[transit-engine] getSkyPositions failed:", e);
    skyPositions = getApproximateSkyPositions();
  }

  let natalPositions: Record<string, number>;
  try {
    natalPositions = getNatalPositions(effectiveSunSign, natalChartJson);
  } catch (e) {
    console.warn("[transit-engine] natal fallback:", e);
    natalPositions = getNatalPositions(effectiveSunSign, null);
  }

  const today = new Date();
  const natalTargets = Object.keys(natalPositions);

  const daysAhead = timeframe === "today" ? 30 : timeframe === "week" ? 7 : 30;
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + daysAhead);

  const events: TransitEvent[] = [];
  const seen = new Set<string>();

  for (const tBody of TRANSIT_BODIES) {
    const tLon = skyPositions[tBody];
    if (tLon === undefined) continue;

    for (const nTarget of natalTargets) {
      const nLon = natalPositions[nTarget];
      if (nLon === undefined) continue;

      const aspect = detectAspect(tLon, nLon);
      if (!aspect) continue;

      const score = computeScore(tBody, nTarget, aspect);
      if (score < MIN_SIGNIFICANCE_SCORE) continue;

      const key = `${tBody}-${nTarget}-${aspect.type}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const window = getTransitWindow(tBody, aspect.orb, aspect.maxOrb, today);
      if (window.start > windowEnd) continue;

      const themes = THEMES[tBody] ?? ["energy", "awareness"];
      const title = getTitle(tBody, aspect.type, themes);
      const summary =
        FALLBACK_SUMMARIES[aspect.type] ??
        `This period brings ${themes[0] ?? "notable energy"} into focus.`;

      const colorHex = COLOR_MAP[tBody] ?? "#8b8cff";
      const dayKey = today.toISOString().split("T")[0] ?? "d";

      events.push({
        id: `${tBody}-${nTarget}-${aspect.type}-${dayKey}`,
        transitingBody: tBody,
        natalTargetBody: nTarget,
        aspectType: aspect.type,
        startAt: window.start.toISOString(),
        peakAt: window.peak.toISOString(),
        endAt: window.end.toISOString(),
        isActiveNow: window.isActive,
        significanceScore: score,
        themeTags: themes.slice(0, 3),
        title,
        shortSummary: summary,
        colorKey: tBody.toLowerCase(),
        colorHex,
        emotionalTone: null,
        practicalExpression: null,
      });
    }
  }

  events.sort((a, b) => {
    if (a.isActiveNow && !b.isActiveNow) return -1;
    if (!a.isActiveNow && b.isActiveNow) return 1;
    return b.significanceScore - a.significanceScore;
  });

  let result = events.slice(0, 7);
  if (result.length === 0) {
    result = [buildGentleFallback(today)];
  }

  console.log(`[transit-engine] computed ${result.length} events`);
  return result;
}
