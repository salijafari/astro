import { prisma } from "../../lib/prisma.js";
import { cacheGetJson, cacheKey, cacheSetJson } from "../../lib/cache.js";
import { getDailyTransits, type NatalChartData } from "../astrology/chartEngine.js";

export interface PromptContext {
  userName: string;
  sunSign: string;
  moonSign: string;
  risingSign: string;
  dominantElement: string;
  topPlacements: string[];
  activeTransits: string[];
  userInterests: string[];
  recentTopics: string[];
  subscriptionTier: "free" | "premium" | "vip";
}

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

/**
 * Assemble full LLM prompt context from cached/stored chart data only.
 */
export async function assembleContext(userId: string): Promise<PromptContext> {
  const cached = await cacheGetJson<PromptContext>(cacheKey.promptContext(userId));
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
  const chart = bp.natalChartJson as NatalChartData;
  const transits = getDailyTransits(chart, new Date().toISOString().slice(0, 10), bp.birthTimezone);

  const topPlacements = chart.planets
    .slice(0, 8)
    .map((p) => `${p.planet} in ${p.sign}${p.house ? ` (${p.house}th)` : ""}`);
  const activeTransits = transits.slice(0, 6).map((t) => `${t.transitBody} ${t.type} natal ${t.natalBody}`);
  const recentTopics = user.conversations.map((x) => x.category ?? "general").filter(Boolean);

  const payload: PromptContext = {
    userName: user.name,
    sunSign: bp.sunSign,
    moonSign: bp.moonSign,
    risingSign: bp.risingSign ?? "Unknown",
    dominantElement: dominantElementFromSigns([bp.sunSign, bp.moonSign, bp.risingSign ?? ""]),
    topPlacements,
    activeTransits,
    userInterests: bp.interestTags,
    recentTopics: recentTopics.slice(0, 6),
    subscriptionTier: user.subscriptionStatus === "premium" ? "premium" : user.subscriptionStatus === "vip" ? "vip" : "free",
  };

  await cacheSetJson(cacheKey.promptContext(userId), payload, 3600);
  return payload;
}
