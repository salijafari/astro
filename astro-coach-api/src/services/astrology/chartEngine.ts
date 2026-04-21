import { DateTime } from "luxon";
import { calc, constants, houses_ex2, utc_to_jd } from "sweph";

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

const EPHE_FLAGS = constants.SEFLG_MOSEPH | constants.SEFLG_SPEED;

export type NatalChartInput = {
  birthDate: string;
  birthTime: string | null;
  birthLat: number;
  birthLong: number;
  birthTimezone: string;
};

export type PlanetRow = {
  planet: string;
  sign: string;
  house: number;
  degree: number;
  longitude: number;
};

export type AspectRow = {
  body1: string;
  body2: string;
  type: string;
  orb: number;
};

export type NatalChartResult = {
  sunSign: string;
  moonSign: string;
  risingSign: string | null;
  planets: PlanetRow[];
  aspects: AspectRow[];
  jdUt: number;
  jdEt: number;
};

export type NatalChartData = NatalChartResult;

/**
 * Normalizes ecliptic longitude to [0, 360).
 */
function normLon(lon: number): number {
  let v = lon % 360;
  if (v < 0) v += 360;
  return v;
}

/**
 * Maps ecliptic longitude to zodiac sign name.
 */
function signFromLongitude(lon: number): string {
  return SIGNS[Math.floor(normLon(lon) / 30)] ?? "Aries";
}

/**
 * Determines Placidus house index (1–12) for a longitude given house cusps.
 */
export function houseForLongitude(longitude: number, cusps: number[]): number {
  const L = normLon(longitude);
  for (let h = 0; h < 12; h++) {
    const start = normLon(cusps[h] ?? 0);
    const end = normLon(cusps[(h + 1) % 12] ?? 0);
    if (start <= end) {
      if (L >= start && L < end) return h + 1;
    } else if (L >= start || L < end) {
      return h + 1;
    }
  }
  return 12;
}

/**
 * Placidus houses and angles at a given UT Julian date and birth coordinates.
 * `houses.data.points[1]` is treated as MC — verify against sweph output if anything looks off at runtime.
 */
export function computePlacidusHouses(input: {
  jdUt: number;
  birthLat: number;
  birthLong: number;
}): { cusps: number[]; ascendant: number; mc: number } {
  const houses = houses_ex2(input.jdUt, 0, input.birthLat, input.birthLong, "P");
  if (houses.flag !== constants.OK) {
    throw new Error(houses.error ?? "houses_ex2 failed");
  }
  return {
    cusps: houses.data.houses,
    ascendant: houses.data.points[0],
    mc: houses.data.points[1],
  };
}

const BODIES: { key: string; id: number }[] = [
  { key: "Sun", id: constants.SE_SUN },
  { key: "Moon", id: constants.SE_MOON },
  { key: "Mercury", id: constants.SE_MERCURY },
  { key: "Venus", id: constants.SE_VENUS },
  { key: "Mars", id: constants.SE_MARS },
  { key: "Jupiter", id: constants.SE_JUPITER },
  { key: "Saturn", id: constants.SE_SATURN },
  { key: "Uranus", id: constants.SE_URANUS },
  { key: "Neptune", id: constants.SE_NEPTUNE },
  { key: "Pluto", id: constants.SE_PLUTO },
  { key: "Chiron", id: constants.SE_CHIRON },
  { key: "North Node", id: constants.SE_TRUE_NODE },
];

function toUtcParts(input: NatalChartInput): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const time = input.birthTime ?? "12:00";
  // Guard: accept full ISO timestamp ("2000-01-15T00:00:00.000Z") or date-only ("2000-01-15").
  // Always extract just the YYYY-MM-DD portion so the T+time suffix is valid.
  const datePart = input.birthDate.slice(0, 10);
  const dt = DateTime.fromISO(`${datePart}T${time}:00`, { zone: input.birthTimezone });
  if (!dt.isValid) throw new Error(`Invalid birth datetime: ${dt.invalidReason}`);
  const u = dt.toUTC();
  return {
    year: u.year,
    month: u.month,
    day: u.day,
    hour: u.hour,
    minute: u.minute,
    second: Math.floor(u.second),
  };
}

/**
 * Computes natal chart positions and major aspects using sweph (Moshier ephemeris).
 */
export function computeNatalChart(input: NatalChartInput): NatalChartResult {
  const { year, month, day, hour, minute, second } = toUtcParts(input);
  const jd = utc_to_jd(year, month, day, hour, minute, second, constants.SE_GREG_CAL);
  if (jd.flag !== constants.OK) throw new Error(jd.error ?? "utc_to_jd failed");
  const [jdEt, jdUt] = jd.data;

  let cusps: number[] = Array.from({ length: 12 }, (_, i) => (i * 30) % 360);
  let asc: number | null = 0;
  try {
    const houses = houses_ex2(jdUt, 0, input.birthLat, input.birthLong, "P");
    if (houses.flag !== constants.OK) {
      throw new Error(houses.error ?? "houses_ex2 failed");
    }
    cusps = houses.data.houses;
    asc = houses.data.points[0];
  } catch (houseErr: unknown) {
    console.warn("[chartEngine] houses_ex2 failed, using equal houses fallback:", houseErr);
    cusps = Array.from({ length: 12 }, (_, i) => (i * 30) % 360);
    asc = 0;
  }

  const planets: PlanetRow[] = [];
  const longitudes: Record<string, number> = {};

  for (const { key, id } of BODIES) {
    const p = calc(jdEt, id, EPHE_FLAGS);
    if (p.flag !== EPHE_FLAGS) throw new Error(p.error ?? `calc failed for ${key}`);
    const lon = p.data[0];
    longitudes[key] = lon;
    const house = input.birthTime != null ? houseForLongitude(lon, cusps) : 0;
    planets.push({
      planet: key,
      sign: signFromLongitude(lon),
      house: house || 0,
      degree: normLon(lon) % 30,
      longitude: normLon(lon),
    });
  }

  const sunSign = signFromLongitude(longitudes["Sun"] ?? 0);
  const moonSign = signFromLongitude(longitudes["Moon"] ?? 0);
  const risingSign = input.birthTime != null && asc != null ? signFromLongitude(asc) : null;

  const aspects = findMajorAspects(longitudes);

  return { sunSign, moonSign, risingSign, planets, aspects, jdUt, jdEt };
}

/**
 * Computes planet longitudes at a given Julian ET (for transits / daily positions).
 */
export function planetLongitudesAt(jdEt: number): Record<string, number> {
  const longitudes: Record<string, number> = {};
  for (const { key, id } of BODIES) {
    const p = calc(jdEt, id, EPHE_FLAGS);
    if (p.flag !== EPHE_FLAGS) throw new Error(p.error ?? `calc failed for ${key}`);
    longitudes[key] = normLon(p.data[0]);
  }
  return longitudes;
}

/**
 * Builds Julian ET/UT for "now" in UTC (use ET for planet calc).
 */
export function julianNow(): { jdEt: number; jdUt: number } {
  const n = DateTime.utc();
  const jd = utc_to_jd(
    n.year,
    n.month,
    n.day,
    n.hour,
    n.minute,
    Math.floor(n.second),
    constants.SE_GREG_CAL,
  );
  if (jd.flag !== constants.OK) throw new Error(jd.error ?? "utc_to_jd now failed");
  const [jdEt, jdUt] = jd.data;
  return { jdEt, jdUt };
}

export function julianAtTzDate(dateISO: string, timezone: string, hour: number): { jdEt: number; jdUt: number } {
  const dt = DateTime.fromISO(`${dateISO}T${String(hour).padStart(2, "0")}:00:00`, { zone: timezone });
  if (!dt.isValid) throw new Error(`Invalid date/time: ${dt.invalidReason}`);
  const u = dt.toUTC();
  const jd = utc_to_jd(u.year, u.month, u.day, u.hour, u.minute, u.second, constants.SE_GREG_CAL);
  if (jd.flag !== constants.OK) throw new Error(jd.error ?? "utc_to_jd failed");
  const [jdEt, jdUt] = jd.data;
  return { jdEt, jdUt };
}

function findMajorAspects(longitudes: Record<string, number>): AspectRow[] {
  const keys = Object.keys(longitudes);
  const targets: { type: string; angle: number; maxOrb: number }[] = [
    { type: "conjunction", angle: 0, maxOrb: 8 },
    { type: "opposition", angle: 180, maxOrb: 8 },
    { type: "trine", angle: 120, maxOrb: 8 },
    { type: "square", angle: 90, maxOrb: 8 },
    { type: "sextile", angle: 60, maxOrb: 6 },
  ];
  const out: AspectRow[] = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      if (!a || !b) continue;
      const la = longitudes[a];
      const lb = longitudes[b];
      if (la == null || lb == null) continue;
      let diff = Math.abs(la - lb);
      if (diff > 180) diff = 360 - diff;
      for (const t of targets) {
        const orb = Math.abs(diff - t.angle);
        if (orb <= t.maxOrb) out.push({ body1: a, body2: b, type: t.type, orb });
      }
    }
  }
  return out;
}

/**
 * Finds significant transit-to-natal aspects for today.
 */
export function transitHitsNatal(
  natal: Record<string, number>,
  transit: Record<string, number>,
): { transitBody: string; natalBody: string; type: string; orb: number }[] {
  const hits: { transitBody: string; natalBody: string; type: string; orb: number }[] = [];
  const personal = ["Sun", "Moon", "Mercury", "Venus", "Mars"];
  for (const tBody of Object.keys(transit)) {
    for (const nBody of personal) {
      const lt = transit[tBody];
      const ln = natal[nBody];
      if (lt == null || ln == null) continue;
      let diff = Math.abs(lt - ln);
      if (diff > 180) diff = 360 - diff;
      for (const { type, angle, maxOrb } of [
        { type: "conjunction", angle: 0, maxOrb: 3 },
        { type: "square", angle: 90, maxOrb: 3 },
        { type: "opposition", angle: 180, maxOrb: 3 },
      ]) {
        const orb = Math.abs(diff - angle);
        if (orb <= maxOrb) hits.push({ transitBody: tBody, natalBody: nBody, type, orb });
      }
    }
  }
  return hits.slice(0, 5);
}

/**
 * Synastry score 0–100 from cross-aspects between two natal longitude maps.
 */
export function synastryScore(a: Record<string, number>, b: Record<string, number>): number {
  const keysA = ["Sun", "Moon", "Venus", "Mars"] as const;
  const keysB = ["Sun", "Moon", "Venus", "Mars"] as const;
  let score = 50;
  for (const ka of keysA) {
    for (const kb of keysB) {
      const la = a[ka];
      const lb = b[kb];
      if (la == null || lb == null) continue;
      let diff = Math.abs(la - lb);
      if (diff > 180) diff = 360 - diff;
      if (diff < 8) score += 6;
      else if (Math.abs(diff - 120) < 8) score += 4;
      else if (Math.abs(diff - 60) < 6) score += 3;
      else if (Math.abs(diff - 90) < 8) score -= 2;
      else if (Math.abs(diff - 180) < 8) score -= 2;
    }
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export type TransitAspect = ReturnType<typeof transitHitsNatal>[number];

export type SynastryAspect = {
  aPlanet: string;
  bPlanet: string;
  type: "conjunction" | "opposition" | "trine" | "square" | "sextile";
  orb: number;
};

const ASPECT_TARGETS: Array<{ type: SynastryAspect["type"]; angle: number; maxOrb: number }> = [
  { type: "conjunction", angle: 0, maxOrb: 8 },
  { type: "opposition", angle: 180, maxOrb: 8 },
  { type: "trine", angle: 120, maxOrb: 8 },
  { type: "square", angle: 90, maxOrb: 8 },
  { type: "sextile", angle: 60, maxOrb: 6 },
];

function toLongitudes(chart: NatalChartData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of chart.planets) out[p.planet] = p.longitude;
  return out;
}

function angularDiff(a: number, b: number): number {
  let diff = Math.abs(a - b);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * Returns full natal chart JSON from birth data.
 */
export function getNatalChart(
  birthDate: string,
  birthTime: string | null,
  lat: number,
  lng: number,
  timezone: string,
): NatalChartData {
  return computeNatalChart({
    birthDate,
    birthTime,
    birthLat: lat,
    birthLong: lng,
    birthTimezone: timezone,
  });
}

/**
 * Returns today's transits for a user chart.
 */
export function getDailyTransits(natalChart: NatalChartData, date: string, timezone: string): TransitAspect[] {
  const { jdEt } = julianAtTzDate(date, timezone, 12);
  const transit = planetLongitudesAt(jdEt);
  const natal = toLongitudes(natalChart);
  return transitHitsNatal(natal, transit);
}

/**
 * Returns forward-looking transits for a date window.
 */
export function getForwardTransits(natalChart: NatalChartData, fromDate: string, toDays: number): TransitAspect[] {
  const natal = toLongitudes(natalChart);
  const out: TransitAspect[] = [];

  const start = DateTime.fromISO(fromDate, { zone: "UTC" });
  const days = Math.max(1, toDays);
  for (let i = 0; i < days; i++) {
    const d = start.plus({ days: i }).toISODate();
    if (!d) continue;
    const { jdEt } = julianAtTzDate(d, "UTC", 12);
    const transit = planetLongitudesAt(jdEt);
    const hits = transitHitsNatal(natal, transit);
    out.push(...hits);
  }

  return out.slice(0, 200);
}

/**
 * Synastry: returns aspect grid between two charts.
 */
export function getSynastryAspects(chartA: NatalChartData, chartB: NatalChartData): SynastryAspect[] {
  const a = toLongitudes(chartA);
  const b = toLongitudes(chartB);
  const out: SynastryAspect[] = [];

  for (const aPlanet of Object.keys(a)) {
    for (const bPlanet of Object.keys(b)) {
      const la = a[aPlanet];
      const lb = b[bPlanet];
      if (la == null || lb == null) continue;

      const diff = angularDiff(la, lb);
      for (const t of ASPECT_TARGETS) {
        const orb = Math.abs(diff - t.angle);
        if (orb <= t.maxOrb) {
          out.push({ aPlanet, bPlanet, type: t.type, orb });
          break;
        }
      }
    }
  }

  return out;
}
