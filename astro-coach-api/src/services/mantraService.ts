/**
 * Mantra feature — transit selection, template pick, LLM tie-backs, pin/journal/bookmarks.
 */
import type { MantraTemplate } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getDisplayName } from "../lib/displayName.js";
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

/** Client/UI compat: daily limits removed; always unlimited exploration. */
const UNLIMITED_REFRESH = { allowed: true, remaining: 99 } as const;

const GENERIC_TIE_BACK_EN = "This phrase reflects your current planetary energy.";
const GENERIC_TIE_BACK_FA = "این جمله بازتاب انرژی سیاره‌ای شما در این لحظه است.";

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
  console.log("[selectTemplate] called with:", {
    dominantPlanetTag: dominant?.planetTag,
    theme: selectedTheme,
    userId,
    excludeIds: excludeTemplateIds,
  });

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
  console.log("[selectTemplate] Pool 1 size:", pool.length, "templates:", pool.map((t) => t.id));

  if (pool.length === 0) {
    pool = await tryPool(false);
    console.log("[selectTemplate] Pool 2 size:", pool.length);
  }
  if (pool.length === 0) {
    console.log("[selectTemplate] FALLBACK findFirst hit - pool was empty after exclusions");
    const any = await prisma.mantraTemplate.findFirst({ where: { isActive: true } });
    if (!any) throw new MantraServiceError("No mantra templates available.", 500);
    const winner = any;
    console.log("[selectTemplate] WINNER:", winner?.id);
    return winner;
  }
  const winner = weightedRandomPick(pool, selectedTheme);
  console.log("[selectTemplate] WINNER:", winner?.id);
  return winner;
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

function toMantraData(
  template: MantraTemplate,
  dominant: DominantTransitContext,
  tieBackEn: string,
  tieBackFa: string,
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
    canRefresh: UNLIMITED_REFRESH,
    isPinned,
    selectedTheme,
  };
}

async function getExcludeIdsForFreshPick(userId: string): Promise<string[]> {
  const last = await prisma.userMantraHistory.findFirst({
    where: { userId },
    orderBy: { shownAt: "desc" },
    select: { templateId: true },
  });
  return last ? [last.templateId] : [];
}

async function resolvePinnedIsActive(userId: string): Promise<boolean> {
  const pin = await prisma.userMantraPin.findUnique({ where: { userId } });
  return !!(pin && pin.expiresAt > new Date());
}

/**
 * Picks a template, generates tie-backs, records UserMantraHistory. No cache or quota.
 */
async function serveNewMantra(userId: string, selectedTheme: string | null): Promise<MantraData> {
  const theme = selectedTheme ?? null;
  const excludeIds = await getExcludeIdsForFreshPick(userId);
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

  const selected = template;
  console.log("[mantra] writing history for userId:", userId, "templateId:", selected.id);
  await prisma.userMantraHistory.create({
    data: { userId, templateId: template.id },
  });
  console.log("[mantra] history write SUCCESS");

  const isPinned = await resolvePinnedIsActive(userId);
  return toMantraData(template, dominant, tieBackEn, tieBackFa, isPinned, theme);
}

export async function getOrCreateMantraCache(
  userId: string,
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
    return toMantraData(t, dominant, pin.tieBackEn, pin.tieBackFa, true, pin.selectedTheme);
  }

  return serveNewMantra(userId, theme);
}

export async function getNextMantra(userId: string, selectedTheme?: string | null): Promise<MantraData> {
  return serveNewMantra(userId, selectedTheme ?? null);
}

export async function refreshMantra(userId: string, selectedTheme?: string | null): Promise<MantraData> {
  return serveNewMantra(userId, selectedTheme ?? null);
}

export async function pinMantra(userId: string, isPremium: boolean): Promise<{ success: boolean; expiresAt: string }> {
  if (!isPremium) throw new MantraServiceError("Pin requires premium.", 403, true);
  const last = await prisma.userMantraHistory.findFirst({
    where: { userId },
    orderBy: { shownAt: "desc" },
  });
  if (!last) throw new MantraServiceError("No mantra to pin.", 400);
  const template = await prisma.mantraTemplate.findFirst({ where: { id: last.templateId } });
  if (!template) throw new MantraServiceError("No mantra to pin.", 400);
  const dominant = await getDominantTransit(userId);
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await prisma.userMantraPin.upsert({
    where: { userId },
    create: {
      userId,
      templateId: template.id,
      mantraEn: template.mantraEn,
      mantraFa: template.mantraFa,
      mantraEnExploratory: template.mantraEnExploratory,
      mantraFaExploratory: template.mantraFaExploratory,
      tieBackEn: GENERIC_TIE_BACK_EN,
      tieBackFa: GENERIC_TIE_BACK_FA,
      dominantTransit: dominant.dominantTransitDescription,
      planetLabel: dominant.planetLabelEn,
      qualityLabel: dominant.qualityLabelEn,
      selectedTheme: null,
      expiresAt,
    },
    update: {
      templateId: template.id,
      mantraEn: template.mantraEn,
      mantraFa: template.mantraFa,
      mantraEnExploratory: template.mantraEnExploratory,
      mantraFaExploratory: template.mantraFaExploratory,
      tieBackEn: GENERIC_TIE_BACK_EN,
      tieBackFa: GENERIC_TIE_BACK_FA,
      dominantTransit: dominant.dominantTransitDescription,
      planetLabel: dominant.planetLabelEn,
      qualityLabel: dominant.qualityLabelEn,
      selectedTheme: null,
      expiresAt,
    },
  });
  return { success: true, expiresAt: expiresAt.toISOString() };
}

export async function unpinMantra(userId: string): Promise<{ success: boolean }> {
  await prisma.userMantraPin.deleteMany({ where: { userId } });
  return { success: true };
}

async function loadLastServedMantraContext(userId: string): Promise<{
  template: MantraTemplate;
  dominant: DominantTransitContext;
} | null> {
  const last = await prisma.userMantraHistory.findFirst({
    where: { userId },
    orderBy: { shownAt: "desc" },
  });
  if (!last) return null;
  const template = await prisma.mantraTemplate.findFirst({ where: { id: last.templateId } });
  if (!template) return null;
  const dominant = await getDominantTransit(userId);
  return { template, dominant };
}

export async function saveMantraToJournal(
  userId: string,
  practiceMode: string,
  repetitionCount: number,
  userNote?: string,
): Promise<{ success: boolean; journalEntryId: string }> {
  const pin = await prisma.userMantraPin.findUnique({ where: { userId } });
  type JournalRow = {
    mantraEn: string;
    mantraFa: string;
    tieBackEn: string;
    tieBackFa: string;
    dominantTransit: string;
  };
  let row: JournalRow | null = null;
  if (pin && pin.expiresAt > new Date()) {
    row = {
      mantraEn: pin.mantraEn,
      mantraFa: pin.mantraFa,
      tieBackEn: pin.tieBackEn,
      tieBackFa: pin.tieBackFa,
      dominantTransit: pin.dominantTransit,
    };
  } else {
    const ctx = await loadLastServedMantraContext(userId);
    if (ctx) {
      row = {
        mantraEn: ctx.template.mantraEn,
        mantraFa: ctx.template.mantraFa,
        tieBackEn: GENERIC_TIE_BACK_EN,
        tieBackFa: GENERIC_TIE_BACK_FA,
        dominantTransit: ctx.dominant.dominantTransitDescription,
      };
    }
  }
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
  const ctx = await loadLastServedMantraContext(userId);
  if (!ctx) {
    throw new MantraServiceError("No active mantra to save.", 400, false);
  }
  const save = await prisma.userMantraSave.create({
    data: {
      userId,
      mantraEn: ctx.template.mantraEn,
      mantraFa: ctx.template.mantraFa,
      tieBackEn: GENERIC_TIE_BACK_EN,
      tieBackFa: GENERIC_TIE_BACK_FA,
      planetLabel: ctx.dominant.planetLabelEn,
      qualityLabel: ctx.dominant.qualityLabelEn,
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
