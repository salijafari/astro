/**
 * Personal transits engine — deterministic only (no LLM).
 * Uses Swiss Ephemeris via chartEngine when available; otherwise approximate positions.
 * House + moon ambient helpers are best-effort (wrapped); core aspect loop does not throw.
 */
import {
  computePlacidusHouses,
  houseForLongitude,
  julianNow,
  planetLongitudesAt,
} from "../astrology/chartEngine.js";

export interface TransitEvent {
  id: string;
  transitingBody: string;
  natalTargetBody: string;
  aspectType: string;
  /** Angular separation from exact aspect (degrees). Used by mantra dominant-transit selection. */
  orbDegrees: number;
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
  /** Transits V2: natal-chart house (Placidus) occupied by the transiting body. */
  transitNatalHouse?: number | null;
  /** Transits V2: phase relative to exact aspect (peak = tight orb). */
  aspectLifecycle?: "approaching" | "applying" | "peak" | "separating" | "fading";
  /** Transits V2 payload version for clients. */
  engineVersion?: number;
}

/** Extended alias for documentation — same runtime object as {@link TransitEvent}. */
export type TransitEventV2 = TransitEvent;

export interface TransitEngineInput {
  birthDate: Date;
  sunSign: string | null;
  moonSign: string | null;
  birthLat: number | null;
  birthLong: number | null;
  natalChartJson: unknown;
  timeframe: "today" | "week" | "month";
  /** Request language for deterministic transit card titles (defaults to English). */
  language?: "en" | "fa";
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

const signNameFromLongitude = (lon: number): string => {
  const idx = Math.floor((((lon % 360) + 360) % 360) / 30) % 12;
  return SIGNS[idx] ?? "Aries";
};

const getForwardWindowDays = (timeframe: "today" | "week" | "month"): number => {
  if (timeframe === "today") return 3;
  if (timeframe === "week") return 7;
  return 30;
};

function classifyAspectLifecycle(
  peakAt: Date,
  now: Date,
  orbDeg: number,
  windowEnd: Date,
): "approaching" | "applying" | "peak" | "separating" | "fading" {
  if (orbDeg < 0.85) return "peak";
  if (peakAt.getTime() > now.getTime()) {
    const daysToPeak = (peakAt.getTime() - now.getTime()) / 86_400_000;
    return daysToPeak > 3 ? "approaching" : "applying";
  }
  const daysToEnd = (windowEnd.getTime() - now.getTime()) / 86_400_000;
  return daysToEnd <= 3 && daysToEnd >= 0 ? "fading" : "separating";
}

function tryTransitNatalHouse(transitLongitude: number, birthLat: number | null, birthLong: number | null): number | null {
  if (birthLat == null || birthLong == null) return null;
  try {
    const { jdUt } = julianNow();
    const { cusps } = computePlacidusHouses({
      jdUt,
      birthLat,
      birthLong,
    });
    return houseForLongitude(transitLongitude, cusps);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[transit-engine] Placidus house skipped:", msg);
    return null;
  }
}

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
    Chiron: wrap(sunLon + 310),
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
  Chiron: 0.86,
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

/** Persian titles keyed like {@link TITLE_MAP} (planet × aspect). */
const FA_TITLE_MAP: Record<string, Record<string, string>> = {
  Sun: {
    conjunction: "خودِ واقعی نمایان می‌شود",
    opposition: "نیاز به تعادل درونی",
    square: "اراده در کشمکش",
    trine: "نیروی زندگی روان است",
    sextile: "اعتماد به نفس در حال رشد",
  },
  Moon: {
    conjunction: "احساسات پررنگ می‌شوند",
    opposition: "تنش میان درون و بیرون",
    square: "احساسات در کشمکش",
    trine: "آرامش عاطفی",
    sextile: "شهود بیدار می‌شود",
  },
  Mercury: {
    conjunction: "ذهن شفاف‌تر می‌شود",
    opposition: "تقابل دیدگاه‌ها",
    square: "چالش در ارتباط",
    trine: "وضوح در فکر و بیان",
    sextile: "بیان روان و آسان",
  },
  Venus: {
    conjunction: "دل آماده دریافت عشق است",
    opposition: "روابط نیاز به توازن دارند",
    square: "کشمکش در ارزش‌ها",
    trine: "عشق روان و آسان",
    sextile: "زیبایی و نزدیکی",
  },
  Mars: {
    conjunction: "انرژی در اوج است",
    opposition: "اراده رو در رو می‌شود",
    square: "تنش نیاز به حرکت دارد",
    trine: "قدرت در جریان است",
    sextile: "اقدام با کمترین مقاومت",
  },
  Jupiter: {
    conjunction: "فراوانی نزدیک است",
    opposition: "رشد از دل تعادل",
    square: "رشد همراه با فشار",
    trine: "خرد و بخت همراه‌اند",
    sextile: "فرصت‌ها نزدیک‌اند",
  },
  Saturn: {
    conjunction: "زمان ساختن و نظم دادن",
    opposition: "مسئولیت‌ها نیاز به توازن دارند",
    square: "آزمون استقامت",
    trine: "انضباط نتیجه می‌دهد",
    sextile: "پایه‌ها در حال استحکام‌اند",
  },
  Uranus: {
    conjunction: "تغییر ناگهانی در راه است",
    opposition: "آزادی نیاز به تعادل دارد",
    square: "تنش در دل تغییر",
    trine: "نوآوری روان و طبیعی",
    sextile: "نگاه تازه",
  },
  Neptune: {
    conjunction: "رویا و واقعیت نزدیک می‌شوند",
    opposition: "ابهام نیاز به آگاهی دارد",
    square: "مرزها نامشخص‌اند",
    trine: "الهام در جریان است",
    sextile: "شهود و خلاقیت بیدارند",
  },
  Pluto: {
    conjunction: "دگرگونی عمیق آغاز می‌شود",
    opposition: "قدرت نیاز به توازن دارد",
    square: "تغییر از دل فشار",
    trine: "نوسازی با قدرت",
    sextile: "تغییر با همراهی",
  },
  Chiron: {
    conjunction: "زخم قدیمی دیده می‌شود",
    opposition: "شفا با آگاهی",
    square: "درد در مسیر رشد",
    trine: "شفا آرام و روان",
    sextile: "فرصت ترمیم",
  },
};

function getTitle(planet: string, aspect: string, lang?: string): string {
  if (lang === "fa") {
    return FA_TITLE_MAP[planet]?.[aspect] ?? TITLE_MAP[planet]?.[aspect] ?? "عبور سیاره‌ای";
  }
  return TITLE_MAP[planet]?.[aspect] ?? "Planetary Transit";
}

/** Persian short blurbs keyed like {@link TITLE_MAP} (planet × aspect). */
const FA_SHORT_SUMMARY_MAP: Record<string, Record<string, string>> = {
  Sun: {
    conjunction: "لحظه‌ای برای دیدن خودِ واقعی و قدم برداشتن با هویت راستین.",
    opposition: "تعادل میان خواسته‌های درونی و انتظارات بیرونی اهمیت پیدا می‌کند.",
    square: "اراده در برابر موانع قرار می‌گیرد — فرصتی برای شناخت عمیق‌تر خود.",
    trine: "انرژی و اعتماد به نفس به شکل طبیعی جاری است — از این جریان استفاده کن.",
    sextile: "فرصتی ملایم برای رشد عزت نفس و ابراز وجود.",
  },
  Moon: {
    conjunction: "احساسات پررنگ‌اند — خوب است به آن‌ها گوش بدهی بدون اینکه غرق شوی.",
    opposition: "تنشی میان نیازهای درونی و واقعیت بیرونی — مکث و آگاهی کمک می‌کند.",
    square: "احساسات ممکن است سرکش باشند — مهربانی با خود کلید این دوره است.",
    trine: "آرامش عاطفی در دسترس است — لحظه خوبی برای مراقبت از خود.",
    sextile: "شهود تقویت شده — به احساس درونی‌ات اعتماد کن.",
  },
  Mercury: {
    conjunction: "ذهن تیز و شفاف است — زمان خوبی برای تصمیم‌گیری و بیان ایده‌ها.",
    opposition: "دیدگاه‌های متفاوت در برابر هم قرار می‌گیرند — گوش دادن ارزشمند است.",
    square: "ارتباطات ممکن است چالش‌برانگیز باشند — با صبر و وضوح پیش برو.",
    trine: "افکار روان و بیان آسان — از این وضوح ذهنی بهره ببر.",
    sextile: "تبادل ایده‌ها با سهولت پیش می‌رود — فرصتی برای یادگیری و بیان.",
  },
  Venus: {
    conjunction: "دل آماده عشق و نزدیکی است — به روابط و زیبایی توجه کن.",
    opposition: "روابط نیاز به توازن دارند — صادق بودن با خود و دیگران مهم است.",
    square: "تعارض در ارزش‌ها یا روابط — فرصتی برای شناخت عمیق‌تر نیازها.",
    trine: "عشق و هماهنگی به شکل طبیعی جاری‌اند — لحظه‌ای برای قدردانی.",
    sextile: "پیوند و نزدیکی با آسانی شکل می‌گیرد — به روابط توجه کن.",
  },
  Mars: {
    conjunction: "انرژی در اوج است — با آگاهی و هدفمندی از این نیرو استفاده کن.",
    opposition: "اراده‌ها رو در رو می‌شوند — ایستادگی با احترام بهترین رویکرد است.",
    square: "تنش نیاز به خروجی دارد — به جای واکنش، با آگاهی عمل کن.",
    trine: "قدرت و انرژی با جریان زندگی همسوست — لحظه‌ای برای اقدام.",
    sextile: "پیشرفت با کمترین مقاومت — قدم‌های کوچک نتیجه می‌دهند.",
  },
  Jupiter: {
    conjunction: "دری از فراوانی باز می‌شود — با ذهن باز به فرصت‌ها نگاه کن.",
    opposition: "رشد از دل تعادل می‌آید — نه افراط، نه تفریط.",
    square: "رشد با فشار همراه است — صبر و پشتکار نتیجه می‌دهد.",
    trine: "خرد و بخت همراه‌اند — لحظه‌ای برای توسعه و یادگیری.",
    sextile: "فرصت‌های کوچک اما ارزشمند در دسترس‌اند.",
  },
  Saturn: {
    conjunction: "زمان ساختن و نظم دادن است — با مسئولیت‌پذیری پایه‌های زندگی را مستحکم کن.",
    opposition: "مسئولیت‌ها نیاز به توازن دارند — از چالش‌ها تجربه بساز.",
    square:
      "آزمون استقامت — با مسئولیت‌پذیری، پایه‌های روابط خود را مستحکم کنید و از چالش‌ها تجربه بسازید.",
    trine: "انضباط و پشتکار نتیجه می‌دهند — تلاش مداوم ارزش دارد.",
    sextile: "پایه‌ها در حال استحکام‌اند — گام‌های کوچک منظم را ادامه بده.",
  },
  Uranus: {
    conjunction: "تغییر ناگهانی در راه است — با انعطاف و کنجکاوی استقبال کن.",
    opposition: "آزادی نیاز به تعادل دارد — بین استقلال و تعهد راهی بیاب.",
    square: "تنش در دل تغییر — این ناراحتی نشانه رشد است.",
    trine: "نوآوری و تغییر به شکل طبیعی جاری‌اند — به ایده‌های تازه اعتماد کن.",
    sextile: "نگاه تازه‌ای به موقعیت‌ها — از این بینش استفاده کن.",
  },
  Neptune: {
    conjunction: "رویا و واقعیت نزدیک می‌شوند — با آگاهی و حضور پیش برو.",
    opposition: "ابهام نیاز به آگاهی دارد — مراقب توهمات و خودفریبی باش.",
    square: "مرزها نامشخص‌اند — وضوح و صداقت با خود ضروری است.",
    trine: "الهام و خلاقیت در جریان‌اند — به شهود و هنر توجه کن.",
    sextile: "شهود و خلاقیت بیدارند — فرصتی برای ابراز روح درون.",
  },
  Pluto: {
    conjunction: "دگرگونی عمیق آغاز می‌شود — با شجاعت به چیزهای قدیمی خداحافظی کن.",
    opposition: "قدرت نیاز به توازن دارد — کنترل را با پذیرش تلفیق کن.",
    square: "تغییر از دل فشار می‌آید — این مقاومت بخشی از فرآیند است.",
    trine: "نوسازی با قدرت پیش می‌رود — به مسیر تحول اعتماد کن.",
    sextile: "تغییر با همراهی — فرصتی برای رشد بدون درد زیاد.",
  },
  Chiron: {
    conjunction: "زخم قدیمی دیده می‌شود — با مهربانی به آن نگاه کن.",
    opposition: "شفا با آگاهی — دیدن درد قدیمی قدم اول التیام است.",
    square: "درد در مسیر رشد — این چالش بخشی از شفای عمیق توست.",
    trine: "شفا آرام و روان پیش می‌رود — به فرآیند اعتماد کن.",
    sextile: "فرصت ترمیم در دسترس است — قدمی کوچک به سمت التیام بردار.",
  },
};

/** English short blurbs matching {@link FA_SHORT_SUMMARY_MAP} keys (deterministic first paint). */
const EN_SHORT_SUMMARY_MAP: Record<string, Record<string, string>> = {
  Sun: {
    conjunction: "A moment to see your real self and walk with authentic identity.",
    opposition: "Balance between inner wants and outer expectations matters now.",
    square: "Will meets obstacles — a chance to know yourself more deeply.",
    trine: "Energy and confidence flow naturally — use this current.",
    sextile: "A gentle opening to grow self-worth and self-expression.",
  },
  Moon: {
    conjunction: "Feelings run high — listen without drowning in them.",
    opposition: "Tension between inner needs and outer reality — pause and notice.",
    square: "Emotions may surge — self-kindness is the key.",
    trine: "Emotional ease is available — care for yourself.",
    sextile: "Intuition is louder — trust your inner sense.",
  },
  Mercury: {
    conjunction: "Mind is sharp — a good window to decide and speak ideas clearly.",
    opposition: "Different views face off — listening matters.",
    square: "Communication may pinch — move with patience and clarity.",
    trine: "Thought flows and words come easily — use this mental clarity.",
    sextile: "Ideas exchange smoothly — learn and express.",
  },
  Venus: {
    conjunction: "Heart opens to love and closeness — tend beauty and bonds.",
    opposition: "Relationships need balance — honesty with self and others counts.",
    square: "Friction in values or romance — clarify what you need.",
    trine: "Love and harmony flow — appreciate what’s working.",
    sextile: "Connection forms with ease — invest in relationships.",
  },
  Mars: {
    conjunction: "Energy peaks — channel drive with intention.",
    opposition: "Wills meet — stand firm with respect.",
    square: "Tension wants an outlet — respond with awareness, not reflex.",
    trine: "Strength moves with life — take purposeful action.",
    sextile: "Progress with less resistance — small steps land.",
  },
  Jupiter: {
    conjunction: "Abundance opens a door — stay curious about opportunities.",
    opposition: "Growth asks for balance — neither excess nor denial.",
    square: "Expansion brings pressure — patience pays.",
    trine: "Luck and wisdom travel together — stretch and learn.",
    sextile: "Small opportunities still matter — notice them.",
  },
  Saturn: {
    conjunction: "Time to build and order — shore up foundations responsibly.",
    opposition: "Responsibilities need balance — turn friction into skill.",
    square:
      "A test of endurance — strengthen relationship foundations with responsibility and learn from friction.",
    trine: "Discipline compounds — steady effort counts.",
    sextile: "Foundations firm up — keep small steady steps.",
  },
  Uranus: {
    conjunction: "Sudden change approaches — greet it with flexibility.",
    opposition: "Freedom needs balance — negotiate independence and commitment.",
    square: "Change feels tense — discomfort can signal growth.",
    trine: "Innovation flows — trust fresh angles.",
    sextile: "Fresh eyes on the situation — act on insight.",
  },
  Neptune: {
    conjunction: "Dream and reality blur — stay present and aware.",
    opposition: "Fog needs clarity — watch illusion and wishful thinking.",
    square: "Boundaries blur — honesty with yourself matters.",
    trine: "Inspiration flows — honor intuition and creativity.",
    sextile: "Intuition sparks — express what’s stirring inside.",
  },
  Pluto: {
    conjunction: "Deep change begins — release what no longer fits.",
    opposition: "Power needs balance — blend control with acceptance.",
    square: "Pressure fuels change — resistance is part of the process.",
    trine: "Renewal gathers force — trust the transformation.",
    sextile: "Change with support — growth without unnecessary pain.",
  },
  Chiron: {
    conjunction: "Old pain surfaces — meet it with compassion.",
    opposition: "Healing begins with awareness — seeing the wound is step one.",
    square: "Hurt on the path to growth — part of deeper healing.",
    trine: "Healing unfolds gently — trust the pace.",
    sextile: "Repair is possible — take a small step toward ease.",
  },
};

const FA_SHORT_SUMMARY_MAP_FALLBACK = "این گذار سیاره‌ای تأثیر مهمی بر زندگی شما دارد.";

const FALLBACK_SUMMARIES: Record<string, string> = {
  conjunction:
    "A powerful meeting of energies brings this theme to the center of your attention.",
  trine: "Energy flows easily here, offering a natural opening for growth and expression.",
  sextile: "A helpful opportunity presents itself — one worth leaning into with intention.",
  square: "Some friction here creates the pressure needed to make a meaningful adjustment.",
  opposition: "Two forces ask to be balanced, bringing a key awareness into your daily life.",
};

function getShortSummary(planet: string, aspect: string, lang: string): string {
  if (lang === "fa") {
    return FA_SHORT_SUMMARY_MAP[planet]?.[aspect] ?? FA_SHORT_SUMMARY_MAP_FALLBACK;
  }
  return EN_SHORT_SUMMARY_MAP[planet]?.[aspect] ?? FALLBACK_SUMMARIES[aspect] ?? "";
}

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
  "Chiron",
];

export type MoonAmbientContext = {
  moonSign: string;
  moonDegree: number;
  moonNatalHouse: number | null;
  sunMoonSeparationDeg: number;
  phaseLabel: "new" | "waxing_crescent" | "first_quarter" | "waxing_gibbous" | "full" | "waning_gibbous" | "last_quarter" | "waning_crescent";
};

/**
 * Moon sign, optional natal-house placement, and coarse phase label for snapshot / UI ambience.
 */
export function computeMoonAmbientContext(input: {
  birthLat: number | null;
  birthLong: number | null;
}): MoonAmbientContext | null {
  try {
    const { jdEt } = julianNow();
    const pos = planetLongitudesAt(jdEt);
    const moonLon = pos.Moon;
    const sunLon = pos.Sun;
    if (typeof moonLon !== "number" || typeof sunLon !== "number") return null;

    let rel = ((((moonLon - sunLon) % 360) + 360) % 360);
    const acuteSep = rel > 180 ? 360 - rel : rel;

    let phaseLabel: MoonAmbientContext["phaseLabel"] = "waxing_crescent";
    if (rel < 22.5 || rel > 337.5) phaseLabel = "new";
    else if (rel < 67.5) phaseLabel = "waxing_crescent";
    else if (rel < 112.5) phaseLabel = "first_quarter";
    else if (rel < 157.5) phaseLabel = "waxing_gibbous";
    else if (rel < 202.5) phaseLabel = "full";
    else if (rel < 247.5) phaseLabel = "waning_gibbous";
    else if (rel < 292.5) phaseLabel = "last_quarter";
    else phaseLabel = "waning_crescent";

    const moonNatalHouse = tryTransitNatalHouse(moonLon, input.birthLat, input.birthLong);

    return {
      moonSign: signNameFromLongitude(moonLon),
      moonDegree: ((moonLon % 30) + 30) % 30,
      moonNatalHouse,
      sunMoonSeparationDeg: acuteSep,
      phaseLabel,
    };
  } catch (e) {
    console.warn("[transit-engine] moon ambient skipped:", e);
    return null;
  }
}

function outerPlanetPreferenceRank(body: string): number {
  const order = ["saturn", "uranus", "neptune", "pluto", "chiron"];
  const i = order.indexOf(body.toLowerCase());
  return i >= 0 ? i + 1 : 0;
}

function scoreDominantCandidate(event: TransitEvent): number {
  let score = event.significanceScore ?? 0;

  const lifecycle = event.aspectLifecycle ?? "";
  if (lifecycle === "peak") score += 30;
  else if (lifecycle === "applying") score += 15;
  else if (lifecycle === "separating") score += 10;
  else if (lifecycle === "fading") score += 2;

  const hard = ["conjunction", "square", "opposition"];
  if (hard.includes((event.aspectType ?? "").toLowerCase())) score += 10;

  const outerPlanets = ["saturn", "uranus", "neptune", "pluto", "chiron"];
  const personalPoints = ["sun", "moon", "ascendant", "asc", "midheaven", "mc"];
  const tb = (event.transitingBody ?? "").toLowerCase();
  const nb = (event.natalTargetBody ?? "").toLowerCase();
  if (outerPlanets.includes(tb) && personalPoints.includes(nb)) score += 40;

  if (typeof event.orbDegrees === "number") {
    score += Math.max(0, (10 - event.orbDegrees) * 2);
  }

  return score;
}

/**
 * Picks a single “hero” transit for banners / snapshot pointers (overview UX).
 */
export function pickDominantTransitForOverview(events: TransitEvent[]): TransitEvent | null {
  if (events.length === 0) return null;
  const active = events.filter((e) => e.isActiveNow);
  const pool = active.length > 0 ? active : events;

  const rows = pool.map((e) => ({ e, score: scoreDominantCandidate(e) }));
  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const oa = a.e.orbDegrees ?? 99;
    const ob = b.e.orbDegrees ?? 99;
    if (oa !== ob) return oa - ob;
    return outerPlanetPreferenceRank(b.e.transitingBody) - outerPlanetPreferenceRank(a.e.transitingBody);
  });

  return rows[0]?.e ?? null;
}

/**
 * Computes active personal transits for the given window. Card titles honor
 * {@link TransitEngineInput.language} via bilingual maps (no LLM).
 */
export async function computeTransits(input: TransitEngineInput): Promise<TransitEvent[]> {
  const { birthDate, sunSign, natalChartJson, timeframe, birthLat, birthLong, language } = input;
  const titleLang = language === "fa" ? "fa" : "en";

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

  const daysAhead = getForwardWindowDays(timeframe);
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
      if (window.end < today) continue;
      if (window.start > windowEnd) continue;

      const themes = THEMES[tBody] ?? ["energy", "awareness"];
      const title = getTitle(tBody, aspect.type, titleLang);
      const summary = getShortSummary(tBody, aspect.type, titleLang);

      const colorHex = COLOR_MAP[tBody] ?? "#8b8cff";
      const dayKey = today.toISOString().split("T")[0] ?? "d";

      const peakAt = window.peak;
      const lifecycle = classifyAspectLifecycle(peakAt, today, aspect.orb, window.end);
      const transitNatalHouse = tryTransitNatalHouse(tLon, birthLat, birthLong);

      events.push({
        id: `${tBody}-${nTarget}-${aspect.type}-${dayKey}`,
        transitingBody: tBody,
        natalTargetBody: nTarget,
        aspectType: aspect.type,
        orbDegrees: aspect.orb,
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
        transitNatalHouse,
        aspectLifecycle: lifecycle,
        engineVersion: 2,
      });
    }
  }

  events.sort((a, b) => {
    if (a.isActiveNow && !b.isActiveNow) return -1;
    if (!a.isActiveNow && b.isActiveNow) return 1;
    return b.significanceScore - a.significanceScore;
  });

  const result = events.slice(0, 7);

  console.log(`[transit-engine] computed ${result.length} events`);
  return result;
}
