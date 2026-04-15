/**
 * Mantra feature — transit selection, template pick, LLM tie-backs, cache/pin/journal.
 */
import type { MantraTemplate } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getDisplayName } from "../lib/displayName.js";
import { hasFeatureAccess } from "../lib/revenuecat.js";
import { generateCompletion } from "./ai/generateCompletion.js";
import { computeTransits, type TransitEvent } from "./transits/engine.js";

const PLANET_FA_MAP: Record<string, string> = {
  Sun: "خورشید",
  Moon: "ماه",
  Mercury: "عطارد",
  Venus: "زهره",
  Mars: "مریخ",
  Jupiter: "مشتری",
  Saturn: "زحل",
  Uranus: "اورانوس",
  Neptune: "نپتون",
  Pluto: "پلوتون",
  Chiron: "کیرون",
  "North Node": "گره شمالی",
};

const QUALITY_FA_MAP: Record<string, string> = {
  discipline: "صبر و انضباط",
  communication: "ارتباط و وضوح",
  love: "عشق و ارتباط",
  action: "اقدام و انرژی",
  expansion: "رشد و فراوانی",
  intuition: "درون‌بینی",
  identity: "هویت و حضور",
  surrender: "تسلیم و ایمان",
  transformation: "دگرگونی",
  healing: "التیام",
  growth: "رشد",
  focus: "تمرکز",
  calm: "آرامش",
  confidence: "اعتماد به نفس",
  "self-worth": "ارزش خود",
  release: "رهاسازی",
  hope: "امید",
  faith: "ایمان",
  general: "عمومی",
};

export type MantraData = {
  templateId: string;
  mantraEn: string;
  mantraFa: string;
  mantraEnExploratory: string;
  mantraFaExploratory: string;
  tieBackEn: string;
  tieBackFa: string;
  dominantTransit: string;
  planetLabelEn: string;
  planetLabelFa: string;
  qualityLabelEn: string;
  qualityLabelFa: string;
  validUntil: string;
  canRefresh: { allowed: boolean; remaining: number };
  isPinned: boolean;
  selectedTheme: string | null;
};

export class MantraServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly upgradeRequired = false,
  ) {
    super(message);
    this.name = "MantraServiceError";
  }
}

export type DominantTransitContext = {
  planetTag: string;
  aspectTag: string;
  signTag: string;
  qualityTag: string;
  planetLabelEn: string;
  planetLabelFa: string;
  qualityLabelEn: string;
  qualityLabelFa: string;
  dominantTransitDescription: string;
  /** English line for tie-back LLM prompt (includes short summary when available). */
  tieBackContextEn: string;
  /** Persian line for tie-back LLM prompt (planet · quality labels). */
  tieBackContextFa: string;
  validUntil: Date;
};

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function themeTagToQuality(themeTags: string[]): string {
  const t = (themeTags[0] ?? "growth").toLowerCase();
  if (
    [
      "discipline",
      "communication",
      "love",
      "action",
      "expansion",
      "intuition",
      "identity",
      "surrender",
      "transformation",
      "healing",
      "growth",
      "focus",
      "calm",
      "confidence",
      "self-worth",
      "release",
      "hope",
      "faith",
    ].includes(t)
  ) {
    return t;
  }
  return "general";
}

/** Fallback when user has no birth profile: Moon transit-through, current sun sign. */
function fallbackDominantTransit(userLang: "en" | "fa"): DominantTransitContext {
  const now = new Date();
  const sunSigns = [
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
  const m = now.getMonth() + 1;
  const d = now.getDate();
  let idx = 0;
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) idx = 0;
  else if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) idx = 1;
  else if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) idx = 2;
  else if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) idx = 3;
  else if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) idx = 4;
  else if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) idx = 5;
  else if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) idx = 6;
  else if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) idx = 7;
  else if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) idx = 8;
  else if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) idx = 9;
  else if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) idx = 10;
  else idx = 11;
  const signTag = sunSigns[idx]!.toLowerCase();
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tieBackContextEn = `Gentle lunar rhythm through ${sunSigns[idx]} — stay with your inner weather.`;
  const tieBackContextFa = `${PLANET_FA_MAP.Moon ?? "ماه"} · ${QUALITY_FA_MAP.intuition ?? "درون‌بینی"}`;
  return {
    planetTag: "moon",
    aspectTag: "transit-through",
    signTag,
    qualityTag: "intuition",
    planetLabelEn: "Moon",
    planetLabelFa: PLANET_FA_MAP.Moon ?? "ماه",
    qualityLabelEn: "Intuition",
    qualityLabelFa: QUALITY_FA_MAP.intuition ?? "درون‌بینی",
    dominantTransitDescription: userLang === "fa" ? tieBackContextFa : tieBackContextEn,
    tieBackContextEn,
    tieBackContextFa,
    validUntil: end,
  };
}

export async function getDominantTransit(userId: string): Promise<DominantTransitContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { birthProfile: true },
  });
  const userLang: "en" | "fa" = user?.language === "fa" ? "fa" : "en";
  if (!user?.birthProfile) {
    return fallbackDominantTransit(userLang);
  }
  const bp = user.birthProfile;
  const events = await computeTransits({
    birthDate: bp.birthDate,
    sunSign: bp.sunSign,
    moonSign: bp.moonSign,
    birthLat: bp.birthLat,
    birthLong: bp.birthLong,
    natalChartJson: bp.natalChartJson,
    timeframe: "today",
  });
  const sorted = [...events].sort((a, b) => b.significanceScore - a.significanceScore);
  const event = sorted[0];
  if (!event) {
    return fallbackDominantTransit(userLang);
  }
  return mapTransitEvent(event, userLang);
}

function mapTransitEvent(event: TransitEvent, userLang: "en" | "fa"): DominantTransitContext {
  const planetTag = event.transitingBody.toLowerCase();
  const aspectTag = event.aspectType.toLowerCase();
  const qualityRaw = themeTagToQuality(event.themeTags);
  const qualityLabelEn = event.themeTags[0] ? event.themeTags[0]!.charAt(0).toUpperCase() + event.themeTags[0]!.slice(1) : "Growth";
  const qualityLabelFa = QUALITY_FA_MAP[qualityRaw] ?? qualityLabelEn;
  const planetDisplayFa = PLANET_FA_MAP[event.transitingBody] ?? event.transitingBody;
  const qualityDisplayFa = QUALITY_FA_MAP[qualityRaw] ?? qualityRaw;
  const tieBackContextEn = `${event.transitingBody} · ${qualityRaw} — ${event.shortSummary}`;
  const tieBackContextFa = `${planetDisplayFa} · ${qualityDisplayFa}`;
  const dominantTransitDescription = userLang === "fa" ? tieBackContextFa : tieBackContextEn;
  return {
    planetTag,
    aspectTag,
    signTag: "any",
    qualityTag: qualityRaw,
    planetLabelEn: event.transitingBody,
    planetLabelFa: planetDisplayFa,
    qualityLabelEn,
    qualityLabelFa,
    dominantTransitDescription,
    tieBackContextEn,
    tieBackContextFa,
    validUntil: new Date(event.endAt),
  };
}

function weightedRandomPick(templates: MantraTemplate[], selectedTheme: string | undefined): MantraTemplate {
  if (templates.length === 1) return templates[0]!;
  const weights = templates.map((t) => {
    let w = 1;
    if (selectedTheme && t.themeAffinity.includes(selectedTheme)) w = 3;
    return w;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < templates.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return templates[i]!;
  }
  return templates[templates.length - 1]!;
}

export async function selectTemplate(
  dominant: DominantTransitContext,
  selectedTheme: string | undefined,
  userId: string,
  excludeTemplateIds: string[],
): Promise<MantraTemplate> {
  const since = new Date(Date.now() - 14 * 86400000);
  const recent = await prisma.userMantraHistory.findMany({
    where: { userId, shownAt: { gte: since } },
    select: { templateId: true },
  });
  const exclude = new Set([...excludeTemplateIds, ...recent.map((x) => x.templateId)]);

  const tryPool = async (onlyPlanet: boolean): Promise<MantraTemplate[]> => {
    const base = await prisma.mantraTemplate.findMany({
      where: {
        isActive: true,
        ...(onlyPlanet
          ? {
              OR: [{ planetTag: dominant.planetTag }, { planetTag: "any" }],
            }
          : {}),
      },
    });
    return base.filter((t) => !exclude.has(t.id));
  };

  let pool = await tryPool(true);
  if (pool.length === 0) {
    pool = await tryPool(false);
  }
  if (pool.length === 0) {
    const any = await prisma.mantraTemplate.findFirst({ where: { isActive: true } });
    if (!any) throw new MantraServiceError("No mantra templates available.", 500);
    return any;
  }
  return weightedRandomPick(pool, selectedTheme);
}

async function generateTieBackLine(
  template: MantraTemplate,
  dominant: DominantTransitContext,
  languageLabel: "English" | "Persian",
  userName: string,
  mantraText: string,
  transitLineForPrompt: string,
): Promise<string> {
  const systemPrompt = `You are Akhtar, a warm personal astrologer.
Write exactly ONE sentence (max 20 words) explaining why this mantra is relevant right now astrologically.
Rules: Reference the planet warmly. No jargon.
Do not repeat the mantra. Do not start with
'This mantra' or 'Based on'. Write in ${languageLabel}.`;
  const userMessage = `User: ${userName}\nTransit: ${transitLineForPrompt}\nMantra: ${mantraText}`;
  const result = await generateCompletion({
    feature: "mantra_tieback",
    complexity: "lightweight",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    timeoutMs: 25_000,
    maxRetries: 1,
  });
  if (result.kind === "success" && result.content.trim()) {
    return result.content.trim();
  }
  return languageLabel === "Persian"
    ? "این جمله بازتاب انرژی سیاره‌ای شما در این لحظه است."
    : "This phrase reflects your current planetary energy.";
}

export async function canRefresh(
  userId: string,
  isPremium: boolean,
): Promise<{ allowed: boolean; remaining: number }> {
  if (isPremium) return { allowed: true, remaining: 99 };
  const cache = await prisma.userMantraCache.findUnique({ where: { userId } });
  const todayStart = startOfUtcDay(new Date());
  if (!cache) return { allowed: true, remaining: 1 };
  if (cache.refreshResetDate < todayStart) {
    await prisma.userMantraCache.update({
      where: { userId },
      data: { refreshCount: 0, refreshResetDate: todayStart },
    });
    return { allowed: true, remaining: 1 };
  }
  if (cache.refreshCount >= 1) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: 1 - cache.refreshCount };
}

/** Same rules as canRefresh but never writes — for paths that must not touch UserMantraCache. */
function refreshInfoFromCacheRow(
  cache: { refreshCount: number; refreshResetDate: Date } | null,
  isPremium: boolean,
): { allowed: boolean; remaining: number } {
  if (isPremium) return { allowed: true, remaining: 99 };
  const todayStart = startOfUtcDay(new Date());
  if (!cache) return { allowed: true, remaining: 1 };
  if (cache.refreshResetDate < todayStart) {
    return { allowed: true, remaining: 1 };
  }
  if (cache.refreshCount >= 1) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: 1 - cache.refreshCount };
}

function toMantraData(
  template: MantraTemplate,
  dominant: DominantTransitContext,
  tieBackEn: string,
  tieBackFa: string,
  refreshInfo: { allowed: boolean; remaining: number },
  isPinned: boolean,
  selectedTheme: string | null,
): MantraData {
  return {
    templateId: template.id,
    mantraEn: template.mantraEn,
    mantraFa: template.mantraFa,
    mantraEnExploratory: template.mantraEnExploratory,
    mantraFaExploratory: template.mantraFaExploratory,
    tieBackEn,
    tieBackFa,
    dominantTransit: dominant.dominantTransitDescription,
    planetLabelEn: dominant.planetLabelEn,
    planetLabelFa: dominant.planetLabelFa,
    qualityLabelEn: dominant.qualityLabelEn,
    qualityLabelFa: dominant.qualityLabelFa,
    validUntil: dominant.validUntil.toISOString(),
    canRefresh: refreshInfo,
    isPinned,
    selectedTheme,
  };
}

async function buildMantraPayload(
  userId: string,
  firebaseUid: string,
  template: MantraTemplate,
  dominant: DominantTransitContext,
  selectedTheme: string | null,
): Promise<MantraData> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new MantraServiceError("User not found", 404);
  const name = getDisplayName(user, user.language);
  const tieBackEn = await generateTieBackLine(
    template,
    dominant,
    "English",
    name,
    template.mantraEn,
    dominant.tieBackContextEn,
  );
  const tieBackFa = await generateTieBackLine(
    template,
    dominant,
    "Persian",
    name,
    template.mantraFa,
    dominant.tieBackContextFa,
  );
  const premium = await hasFeatureAccess(firebaseUid, userId);
  const refreshInfo = await canRefresh(userId, premium);
  const pin = await prisma.userMantraPin.findUnique({ where: { userId } });
  const isPinned = !!(pin && pin.expiresAt > new Date());
  return toMantraData(template, dominant, tieBackEn, tieBackFa, refreshInfo, isPinned, selectedTheme);
}

export async function getOrCreateMantraCache(
  userId: string,
  firebaseUid: string,
  selectedTheme?: string | null,
): Promise<MantraData> {
  const theme = selectedTheme ?? null;
  const pin = await prisma.userMantraPin.findUnique({ where: { userId } });
  if (pin && pin.expiresAt > new Date()) {
    const template = await prisma.mantraTemplate.findFirst({ where: { id: pin.templateId } });
    const plEn = pin.planetLabel;
    const qlEn = pin.qualityLabel;
    const qlKey = qlEn.toLowerCase();
    const dominant: DominantTransitContext = {
      planetTag: "any",
      aspectTag: "any",
      signTag: "any",
      qualityTag: "general",
      planetLabelEn: plEn,
      planetLabelFa: PLANET_FA_MAP[plEn] ?? plEn,
      qualityLabelEn: qlEn,
      qualityLabelFa: QUALITY_FA_MAP[qlKey] ?? qlEn,
      dominantTransitDescription: pin.dominantTransit,
      tieBackContextEn: pin.dominantTransit,
      tieBackContextFa: pin.dominantTransit,
      validUntil: pin.expiresAt,
    };
    const t =
      template ??
      ({
        id: pin.templateId,
        mantraEn: pin.mantraEn,
        mantraFa: pin.mantraFa,
        mantraEnExploratory: pin.mantraEnExploratory,
        mantraFaExploratory: pin.mantraFaExploratory,
        themeAffinity: [],
        planetTag: "any",
        aspectTag: "any",
        signTag: "any",
        qualityTag: "general",
        isActive: true,
        createdAt: new Date(),
      } as MantraTemplate);
    const premium = await hasFeatureAccess(firebaseUid, userId);
    const refreshInfo = await canRefresh(userId, premium);
    return toMantraData(t, dominant, pin.tieBackEn, pin.tieBackFa, refreshInfo, true, pin.selectedTheme);
  }

  const existing = await prisma.userMantraCache.findUnique({ where: { userId } });
  const now = new Date();
  if (
    existing &&
    existing.validUntil > now &&
    (existing.selectedTheme ?? null) === theme
  ) {
    const template = await prisma.mantraTemplate.findFirst({ where: { id: existing.templateId } });
    if (template) {
      const dominantFresh = await getDominantTransit(userId);
      const premium = await hasFeatureAccess(firebaseUid, userId);
      const refreshInfo = await canRefresh(userId, premium);
      return toMantraData(
        template,
        {
          ...dominantFresh,
          validUntil: existing.validUntil,
          dominantTransitDescription: existing.dominantTransit,
          tieBackContextEn: dominantFresh.tieBackContextEn,
          tieBackContextFa: dominantFresh.tieBackContextFa,
        },
        existing.tieBackEn,
        existing.tieBackFa,
        refreshInfo,
        false,
        existing.selectedTheme,
      );
    }
  }

  const dominant = await getDominantTransit(userId);
  const exclude: string[] = existing ? [existing.templateId] : [];
  const template = await selectTemplate(dominant, theme ?? undefined, userId, exclude);
  const payload = await buildMantraPayload(userId, firebaseUid, template, dominant, theme);
  const todayStart = startOfUtcDay(now);

  await prisma.userMantraCache.upsert({
    where: { userId },
    create: {
      userId,
      templateId: template.id,
      mantraEn: template.mantraEn,
      mantraFa: template.mantraFa,
      mantraEnExploratory: template.mantraEnExploratory,
      mantraFaExploratory: template.mantraFaExploratory,
      tieBackEn: payload.tieBackEn,
      tieBackFa: payload.tieBackFa,
      dominantTransit: dominant.dominantTransitDescription,
      planetLabel: dominant.planetLabelEn,
      qualityLabel: dominant.qualityLabelEn,
      selectedTheme: theme,
      validUntil: dominant.validUntil,
      refreshCount: 0,
      lastRefreshedAt: now,
      refreshResetDate: todayStart,
    },
    update: {
      templateId: template.id,
      mantraEn: template.mantraEn,
      mantraFa: template.mantraFa,
      mantraEnExploratory: template.mantraEnExploratory,
      mantraFaExploratory: template.mantraFaExploratory,
      tieBackEn: payload.tieBackEn,
      tieBackFa: payload.tieBackFa,
      dominantTransit: dominant.dominantTransitDescription,
      planetLabel: dominant.planetLabelEn,
      qualityLabel: dominant.qualityLabelEn,
      selectedTheme: theme,
      validUntil: dominant.validUntil,
      lastRefreshedAt: now,
      refreshResetDate: todayStart,
    },
  });

  await prisma.userMantraHistory.create({
    data: { userId, templateId: template.id },
  });

  return payload;
}

/**
 * Returns the next exploration mantra for swipe/prefetch: new template + tie-backs + history,
 * without updating UserMantraCache or refresh quota.
 */
export async function getNextMantra(
  userId: string,
  firebaseUid: string,
  selectedTheme?: string | null,
): Promise<MantraData> {
  const theme = selectedTheme ?? null;
  const cache = await prisma.userMantraCache.findUnique({ where: { userId } });
  const excludeIds = cache ? [cache.templateId] : [];
  const dominant = await getDominantTransit(userId);
  const template = await selectTemplate(dominant, theme ?? undefined, userId, excludeIds);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new MantraServiceError("User not found", 404);
  const name = getDisplayName(user, user.language);
  const tieBackEn = await generateTieBackLine(
    template,
    dominant,
    "English",
    name,
    template.mantraEn,
    dominant.tieBackContextEn,
  );
  const tieBackFa = await generateTieBackLine(
    template,
    dominant,
    "Persian",
    name,
    template.mantraFa,
    dominant.tieBackContextFa,
  );

  await prisma.userMantraHistory.create({
    data: { userId, templateId: template.id },
  });

  const premium = await hasFeatureAccess(firebaseUid, userId);
  const refreshInfo = refreshInfoFromCacheRow(cache, premium);
  const pin = await prisma.userMantraPin.findUnique({ where: { userId } });
  const isPinned = !!(pin && pin.expiresAt > new Date());
  return toMantraData(template, dominant, tieBackEn, tieBackFa, refreshInfo, isPinned, theme);
}

export async function refreshMantra(
  userId: string,
  firebaseUid: string,
  isPremium: boolean,
  selectedTheme?: string | null,
): Promise<MantraData> {
  const theme = selectedTheme ?? null;
  const cr = await canRefresh(userId, isPremium);
  if (!cr.allowed) {
    throw new MantraServiceError("Daily refresh limit reached.", 403, true);
  }
  const cache = await prisma.userMantraCache.findUnique({ where: { userId } });
  const excludeIds = cache ? [cache.templateId] : [];
  const dominant = await getDominantTransit(userId);
  const template = await selectTemplate(dominant, theme ?? undefined, userId, excludeIds);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new MantraServiceError("User not found", 404);
  const name = getDisplayName(user, user.language);
  const tieBackEn = await generateTieBackLine(
    template,
    dominant,
    "English",
    name,
    template.mantraEn,
    dominant.tieBackContextEn,
  );
  const tieBackFa = await generateTieBackLine(
    template,
    dominant,
    "Persian",
    name,
    template.mantraFa,
    dominant.tieBackContextFa,
  );
  const now = new Date();
  const todayStart = startOfUtcDay(now);

  await prisma.userMantraCache.upsert({
    where: { userId },
    create: {
      userId,
      templateId: template.id,
      mantraEn: template.mantraEn,
      mantraFa: template.mantraFa,
      mantraEnExploratory: template.mantraEnExploratory,
      mantraFaExploratory: template.mantraFaExploratory,
      tieBackEn,
      tieBackFa,
      dominantTransit: dominant.dominantTransitDescription,
      planetLabel: dominant.planetLabelEn,
      qualityLabel: dominant.qualityLabelEn,
      selectedTheme: theme,
      validUntil: dominant.validUntil,
      refreshCount: 1,
      lastRefreshedAt: now,
      refreshResetDate: todayStart,
    },
    update: {
      templateId: template.id,
      mantraEn: template.mantraEn,
      mantraFa: template.mantraFa,
      mantraEnExploratory: template.mantraEnExploratory,
      mantraFaExploratory: template.mantraFaExploratory,
      tieBackEn,
      tieBackFa,
      dominantTransit: dominant.dominantTransitDescription,
      planetLabel: dominant.planetLabelEn,
      qualityLabel: dominant.qualityLabelEn,
      selectedTheme: theme,
      validUntil: dominant.validUntil,
      refreshCount: { increment: 1 },
      lastRefreshedAt: now,
      refreshResetDate: todayStart,
    },
  });

  await prisma.userMantraHistory.create({
    data: { userId, templateId: template.id },
  });

  const refreshInfo = await canRefresh(userId, isPremium);
  return toMantraData(template, dominant, tieBackEn, tieBackFa, refreshInfo, false, theme);
}

export async function pinMantra(userId: string, isPremium: boolean): Promise<{ success: boolean; expiresAt: string }> {
  if (!isPremium) throw new MantraServiceError("Pin requires premium.", 403, true);
  const cache = await prisma.userMantraCache.findUnique({ where: { userId } });
  if (!cache) throw new MantraServiceError("No mantra to pin.", 400);
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await prisma.userMantraPin.upsert({
    where: { userId },
    create: {
      userId,
      templateId: cache.templateId,
      mantraEn: cache.mantraEn,
      mantraFa: cache.mantraFa,
      mantraEnExploratory: cache.mantraEnExploratory,
      mantraFaExploratory: cache.mantraFaExploratory,
      tieBackEn: cache.tieBackEn,
      tieBackFa: cache.tieBackFa,
      dominantTransit: cache.dominantTransit,
      planetLabel: cache.planetLabel,
      qualityLabel: cache.qualityLabel,
      selectedTheme: cache.selectedTheme,
      expiresAt,
    },
    update: {
      templateId: cache.templateId,
      mantraEn: cache.mantraEn,
      mantraFa: cache.mantraFa,
      mantraEnExploratory: cache.mantraEnExploratory,
      mantraFaExploratory: cache.mantraFaExploratory,
      tieBackEn: cache.tieBackEn,
      tieBackFa: cache.tieBackFa,
      dominantTransit: cache.dominantTransit,
      planetLabel: cache.planetLabel,
      qualityLabel: cache.qualityLabel,
      selectedTheme: cache.selectedTheme,
      expiresAt,
    },
  });
  return { success: true, expiresAt: expiresAt.toISOString() };
}

export async function unpinMantra(userId: string): Promise<{ success: boolean }> {
  await prisma.userMantraPin.deleteMany({ where: { userId } });
  return { success: true };
}

export async function saveMantraToJournal(
  userId: string,
  practiceMode: string,
  repetitionCount: number,
  userNote?: string,
): Promise<{ success: boolean; journalEntryId: string }> {
  const pin = await prisma.userMantraPin.findUnique({ where: { userId } });
  const cache = await prisma.userMantraCache.findUnique({ where: { userId } });
  const row = pin && pin.expiresAt > new Date() ? pin : cache;
  if (!row) throw new MantraServiceError("No mantra to save.", 400);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new MantraServiceError("User not found", 404);
  const lang = user.language === "en" ? "en" : "fa";
  const mantraText = lang === "fa" ? row.mantraFa : row.mantraEn;
  const tie = lang === "fa" ? row.tieBackFa : row.tieBackEn;
  const context = `${tie} | ${row.dominantTransit}`;
  const entry = await prisma.journalEntry.create({
    data: {
      userId,
      content: mantraText,
      entryType: "mantra",
      context,
      metadata: { practiceMode, repetitionCount, userNote: userNote ?? null },
    },
  });
  return { success: true, journalEntryId: entry.id };
}

export async function saveMantraBookmark(userId: string): Promise<{
  success: boolean;
  saveId: string;
}> {
  const cache = await prisma.userMantraCache.findUnique({
    where: { userId },
  });
  if (!cache) {
    throw new MantraServiceError("No active mantra to save.", 400, false);
  }
  const save = await prisma.userMantraSave.create({
    data: {
      userId,
      mantraEn: cache.mantraEn,
      mantraFa: cache.mantraFa,
      tieBackEn: cache.tieBackEn,
      tieBackFa: cache.tieBackFa,
      planetLabel: cache.planetLabel,
      qualityLabel: cache.qualityLabel,
    },
  });
  return { success: true, saveId: save.id };
}

export async function getSavedMantras(userId: string): Promise<{
  saves: Array<{
    id: string;
    mantraEn: string;
    mantraFa: string;
    tieBackEn: string;
    tieBackFa: string;
    planetLabel: string;
    qualityLabel: string;
    savedAt: string;
  }>;
}> {
  const saves = await prisma.userMantraSave.findMany({
    where: { userId },
    orderBy: { savedAt: "desc" },
    take: 50,
  });
  return {
    saves: saves.map((s) => ({
      id: s.id,
      mantraEn: s.mantraEn,
      mantraFa: s.mantraFa,
      tieBackEn: s.tieBackEn,
      tieBackFa: s.tieBackFa,
      planetLabel: s.planetLabel,
      qualityLabel: s.qualityLabel,
      savedAt: s.savedAt.toISOString(),
    })),
  };
}

export async function deleteSavedMantra(
  userId: string,
  saveId: string,
): Promise<{ success: boolean }> {
  await prisma.userMantraSave.deleteMany({
    where: { id: saveId, userId },
  });
  return { success: true };
}
