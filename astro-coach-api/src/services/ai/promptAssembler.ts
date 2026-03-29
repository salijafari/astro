import { prisma } from "../../lib/prisma.js";
import { cacheGetJson, cacheKey, cacheSetJson } from "../../lib/cache.js";
import {
  getDailyTransits,
  type NatalChartData,
  type PlanetRow,
} from "../astrology/chartEngine.js";
import { assembleMeaning } from "../astrology/meaningAssembler.js";
import { getLatestSessionSummary } from "./sessionSummarizer.js";
import type { PromptContext } from "../../types/promptContext.js";

export type { PromptContext };

function dominantElementFromSigns(signs: string[]): string {
  type Buckets = { fire: number; earth: number; air: number; water: number };
  const buckets: Buckets = { fire: 0, earth: 0, air: 0, water: 0 };
  for (const s of signs) {
    if (["Aries", "Leo", "Sagittarius"].includes(s)) buckets.fire++;
    if (["Taurus", "Virgo", "Capricorn"].includes(s)) buckets.earth++;
    if (["Gemini", "Libra", "Aquarius"].includes(s)) buckets.air++;
    if (["Cancer", "Scorpio", "Pisces"].includes(s)) buckets.water++;
  }
  const sorted = Object.entries(buckets).sort((a, b) => (b[1] as number) - (a[1] as number));
  return sorted[0]?.[0] ?? "balanced";
}

function dominantModalityFromSigns(signs: string[]): string {
  const counts: Record<string, number> = { cardinal: 0, fixed: 0, mutable: 0 };
  for (const s of signs) {
    if (["Aries", "Cancer", "Libra", "Capricorn"].includes(s)) counts.cardinal!++;
    if (["Taurus", "Leo", "Scorpio", "Aquarius"].includes(s)) counts.fixed!++;
    if (["Gemini", "Virgo", "Sagittarius", "Pisces"].includes(s)) counts.mutable!++;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "balanced";
}

/**
 * Normalizes stored JSON so getDailyTransits / assembleMeaning never throw on
 * null, non-object, or empty `planets` (e.g. chart-compute failure at onboarding).
 * Sun/Moon/Rising fall back to BirthProfile columns when missing from JSON.
 */
function normalizeChartForContext(
  natalChartJson: unknown,
  bp: { sunSign: string; moonSign: string; risingSign: string | null },
): NatalChartData {
  const raw =
    natalChartJson && typeof natalChartJson === "object" && !Array.isArray(natalChartJson)
      ? (natalChartJson as Record<string, unknown>)
      : {};
  const planetsRaw = Array.isArray(raw.planets) ? raw.planets : [];
  const planets: PlanetRow[] = planetsRaw.filter((p): p is PlanetRow => {
    if (!p || typeof p !== "object") return false;
    const row = p as Record<string, unknown>;
    return (
      typeof row.planet === "string" &&
      typeof row.longitude === "number" &&
      typeof row.sign === "string"
    );
  });
  const aspects = Array.isArray(raw.aspects) ? (raw.aspects as NatalChartData["aspects"]) : [];
  return {
    sunSign: typeof raw.sunSign === "string" ? raw.sunSign : bp.sunSign,
    moonSign: typeof raw.moonSign === "string" ? raw.moonSign : bp.moonSign,
    risingSign: typeof raw.risingSign === "string" ? raw.risingSign : bp.risingSign,
    planets,
    aspects,
    jdUt: typeof raw.jdUt === "number" ? raw.jdUt : 0,
    jdEt: typeof raw.jdEt === "number" ? raw.jdEt : 0,
  };
}

/**
 * Assembles the LLM prompt context for a user.
 *
 * @param userId - The user's ID.
 * @param enriched - When true, also populates `assembledMeaning` (content service
 *   lookups for each sign/transit) and `sessionSummary` (memory from the last session).
 *   Enriched mode is ~200–400ms slower due to DB/Redis lookups — use for features
 *   that benefit from deep personalisation (coaching, tarot, growth).
 *   Lightweight mode (default) is cached and fast — use for quick queries.
 */
export async function assembleContext(
  userId: string,
  enriched = false
): Promise<PromptContext> {
  const cacheKeyStr = enriched
    ? `${cacheKey.promptContext(userId)}:enriched`
    : cacheKey.promptContext(userId);

  const cached = await cacheGetJson<PromptContext>(cacheKeyStr);
  if (cached) return cached;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      birthProfile: true,
      conversations: { orderBy: { updatedAt: "desc" }, take: 3, select: { category: true } },
    },
  });
  if (!user?.birthProfile) throw new Error("Missing birth profile for prompt context.");
  const bp = user.birthProfile;
  const chart = normalizeChartForContext(bp.natalChartJson, {
    sunSign: bp.sunSign,
    moonSign: bp.moonSign,
    risingSign: bp.risingSign,
  });
  const transits = getDailyTransits(chart, new Date().toISOString().slice(0, 10), bp.birthTimezone);

  const topPlacements = chart.planets
    .slice(0, 8)
    .map((p) => `${p.planet} in ${p.sign}${p.house ? ` (${p.house}th)` : ""}`);
  const activeTransits = transits.slice(0, 6).map((t) => `${t.transitBody} ${t.type} natal ${t.natalBody}`);
  const recentTopics = user.conversations.map((x) => x.category ?? "general").filter(Boolean);

  const innerSigns = [bp.sunSign, bp.moonSign, bp.risingSign ?? ""];
  const language: "en" | "fa" = user.language === "en" ? "en" : "fa";
  const payload: PromptContext = {
    userName: user.name,
    language,
    sunSign: bp.sunSign,
    moonSign: bp.moonSign,
    risingSign: bp.risingSign ?? "Unknown",
    dominantElement: dominantElementFromSigns(innerSigns),
    dominantModality: dominantModalityFromSigns(innerSigns),
    topPlacements,
    activeTransits,
    userInterests: bp.interestTags,
    recentTopics: recentTopics.slice(0, 6),
    subscriptionTier:
      user.subscriptionStatus === "premium"
        ? "premium"
        : user.subscriptionStatus === "vip"
          ? "vip"
          : "free",
  };

  if (enriched) {
    // Parallel fetch: meaning assembly + session memory
    const [assembledMeaning, sessionSummary] = await Promise.all([
      assembleMeaning(chart, transits),
      getLatestSessionSummary(userId),
    ]);
    payload.assembledMeaning = assembledMeaning;
    if (sessionSummary) payload.sessionSummary = sessionSummary;
  }

  // Enriched context cached for 30 min (shorter TTL — transit meanings can change)
  const ttl = enriched ? 1800 : 3600;
  await cacheSetJson(cacheKeyStr, payload, ttl);
  return payload;
}
