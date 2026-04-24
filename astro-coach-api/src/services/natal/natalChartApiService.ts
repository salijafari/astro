import { formatBirthDateUTC } from "../../lib/birthDate.js";
import { prisma } from "../../lib/prisma.js";
import { deriveSalience } from "../astrology/salienceEngine.js";
import { getOrGenerateInterpretation, type ThemeCard } from "./natalInterpretationService.js";
import { pickDominantTransitForOverview, type TransitEvent } from "../transits/engine.js";
import type { AspectRow, NatalChartResult, PlanetRow } from "../astrology/chartEngine.js";

export type TransitRibbon = {
  transitId: string | null;
  headlineEn: string;
  headlineFa: string;
  subEn: string;
  subFa: string;
  dateRange: string;
  transitingBody: string;
};

export type NatalChartApiResponse = {
  bigThree: {
    sun: string;
    moon: string;
    rising: string | null;
    sunFa: string;
    moonFa: string;
    risingFa: string | null;
  };
  synthesisParagraph: string;
  themeCards: ThemeCard[];
  currentTransitRibbon: TransitRibbon | null;
  birthTimeStatus: "exact" | "approximate" | "unknown";
  metadata: {
    birthDate: string | null;
    birthTime: string | null;
    birthCity: string | null;
    houseSystem: string;
    zodiac: string;
    engineVersion: string;
  };
  natalPlanets: PlanetRow[];
  natalAspects: AspectRow[];
  ascendantLongitude: number | null;
  midheavenLongitude: number | null;
};

const ZODIAC_FA: Record<string, string> = {
  Aries: "حمل",
  Taurus: "ثور",
  Gemini: "جوزا",
  Cancer: "سرطان",
  Leo: "اسد",
  Virgo: "سنبله",
  Libra: "میزان",
  Scorpio: "عقرب",
  Sagittarius: "قوس",
  Capricorn: "جدی",
  Aquarius: "دلو",
  Pisces: "حوت",
};

function toLocalDateStr(d: Date, tz?: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().split("T")[0]!;
  }
}

function isTransitEvent(x: unknown): x is TransitEvent {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.title === "string";
}

function formatRibbonDateRange(startAt: string, endAt: string, locale: "en" | "fa"): string {
  try {
    const s = new Date(startAt);
    const e = new Date(endAt);
    const loc = locale === "fa" ? "fa-IR" : "en-US";
    const o: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };
    return `${s.toLocaleDateString(loc, o)} – ${e.toLocaleDateString(loc, o)}`;
  } catch {
    return "";
  }
}

/**
 * Assembles the natal chart screen payload: big three, salience-driven LLM copy, dominant transit ribbon.
 */
export async function buildNatalChartApiResponse(
  dbUserId: string,
  locale: "en" | "fa",
): Promise<NatalChartApiResponse | null> {
  const bp = await prisma.birthProfile.findUnique({
    where: { userId: dbUserId },
  });
  if (!bp) return null;

  const chartJson = bp.natalChartJson as {
    planets?: unknown;
    aspects?: unknown;
    ascendantLongitude?: unknown;
    midheavenLongitude?: unknown;
    jdUt?: number;
    jdEt?: number;
    source?: string;
  } | null;

  if (!chartJson || chartJson.source === "fallback" || !Array.isArray(chartJson.planets) || chartJson.planets.length === 0) {
    return null;
  }

  const ascendantLongitude =
    typeof chartJson.ascendantLongitude === "number" ? chartJson.ascendantLongitude : null;
  const midheavenLongitude =
    typeof chartJson.midheavenLongitude === "number" ? chartJson.midheavenLongitude : null;

  const chart: NatalChartResult = {
    sunSign: bp.sunSign,
    moonSign: bp.moonSign,
    risingSign: bp.risingSign,
    ascendantLongitude,
    midheavenLongitude,
    planets: chartJson.planets as PlanetRow[],
    aspects: (Array.isArray(chartJson.aspects) ? chartJson.aspects : []) as NatalChartResult["aspects"],
    jdUt: typeof chartJson.jdUt === "number" ? chartJson.jdUt : 0,
    jdEt: typeof chartJson.jdEt === "number" ? chartJson.jdEt : 0,
  };

  const salience = deriveSalience(chart.planets, chart.risingSign);

  const birthTimeStatus: "exact" | "approximate" | "unknown" = bp.birthTime ? "exact" : "unknown";

  const birthDateKey = formatBirthDateUTC(bp.birthDate);

  let interpretation = { synthesisParagraph: "", themeCards: [] as NatalChartApiResponse["themeCards"] };
  try {
    interpretation = await getOrGenerateInterpretation(
      dbUserId,
      locale,
      chart,
      salience,
      birthDateKey,
      bp.birthTime,
      bp.birthCity,
    );
  } catch (err) {
    console.error("[natalChartApi] interpretation error:", err);
  }

  // Guard: if interpretation returned more than 5 cards, it was cached incorrectly — delete and regenerate
  if (interpretation.themeCards.length > 5) {
    await prisma.natalChartInterpretation.deleteMany({
      where: { userId: dbUserId },
    });
    try {
      interpretation = await getOrGenerateInterpretation(
        dbUserId,
        locale,
        chart,
        salience,
        birthDateKey,
        bp.birthTime,
        bp.birthCity,
      );
    } catch (err) {
      console.error("[natalChartApi] interpretation regenerate after bad cache:", err);
    }
  }

  let transitRibbon: TransitRibbon | null = null;
  try {
    const tz = bp.birthTimezone?.trim() || "UTC";
    const todayLocal = toLocalDateStr(new Date(), tz);

    const enCache = await prisma.userTransitDailyCache.findUnique({
      where: { userId_localDate_language: { userId: dbUserId, localDate: todayLocal, language: "en" } },
    });
    const faCache = await prisma.userTransitDailyCache.findUnique({
      where: { userId_localDate_language: { userId: dbUserId, localDate: todayLocal, language: "fa" } },
    });

    const primary = locale === "fa" ? faCache ?? enCache : enCache ?? faCache;
    const secondary = locale === "fa" ? enCache : faCache;

    if (primary?.eventsJson && Array.isArray(primary.eventsJson)) {
      const events = (primary.eventsJson as unknown[]).filter(isTransitEvent) as TransitEvent[];
      const dominant = pickDominantTransitForOverview(events);
      if (dominant) {
        let headlineEn = dominant.title;
        let headlineFa = dominant.title;
        let subEn = dominant.shortSummary ?? "";
        let subFa = dominant.shortSummary ?? "";

        if (secondary?.eventsJson && Array.isArray(secondary.eventsJson)) {
          const alt = (secondary.eventsJson as unknown[]).filter(isTransitEvent) as TransitEvent[];
          const match = alt.find((e) => e.id === dominant.id);
          if (match) {
            if (locale === "fa") {
              headlineFa = dominant.title;
              subFa = dominant.shortSummary ?? "";
              headlineEn = match.title;
              subEn = match.shortSummary ?? "";
            } else {
              headlineEn = dominant.title;
              subEn = dominant.shortSummary ?? "";
              headlineFa = match.title;
              subFa = match.shortSummary ?? "";
            }
          }
        }

        transitRibbon = {
          transitId: dominant.id ?? null,
          headlineEn,
          headlineFa,
          subEn,
          subFa,
          dateRange: formatRibbonDateRange(dominant.startAt, dominant.endAt, locale),
          transitingBody: dominant.transitingBody ?? "",
        };
      }
    }
  } catch (err) {
    console.error("[natalChartApi] transit ribbon error:", err);
  }

  return {
    bigThree: {
      sun: chart.sunSign,
      moon: chart.moonSign,
      rising: chart.risingSign,
      sunFa: ZODIAC_FA[chart.sunSign] ?? chart.sunSign,
      moonFa: ZODIAC_FA[chart.moonSign] ?? chart.moonSign,
      risingFa: chart.risingSign ? (ZODIAC_FA[chart.risingSign] ?? chart.risingSign) : null,
    },
    synthesisParagraph: interpretation.synthesisParagraph,
    themeCards: interpretation.themeCards,
    currentTransitRibbon: transitRibbon,
    birthTimeStatus,
    metadata: {
      birthDate: birthDateKey,
      birthTime: bp.birthTime,
      birthCity: bp.birthCity,
      houseSystem: "Placidus",
      zodiac: "Tropical",
      engineVersion: "1.3",
    },
    natalPlanets: chart.planets,
    natalAspects: chart.aspects,
    ascendantLongitude: chart.ascendantLongitude,
    midheavenLongitude: chart.midheavenLongitude,
  };
}
