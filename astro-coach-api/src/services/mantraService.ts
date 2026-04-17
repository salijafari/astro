/**
 * Mantra v2 — deterministic transit→quality mapping, template selection, OpenRouter tie-backs, daily serve.
 */
import type { MantraTemplate, UserMantraPin } from "@prisma/client";
import { DateTime } from "luxon";
import { prisma } from "../lib/prisma.js";
import { hasFeatureAccess } from "../lib/revenuecat.js";
import { getDisplayName } from "../lib/displayName.js";
import { julianNow, planetLongitudesAt } from "./astrology/chartEngine.js";
import { generateCompletionViaOpenRouter } from "./ai/openrouterCompletion.js";
import { computeTransits, type TransitEvent } from "./transits/engine.js";
import {
  OUTER_PLANETS,
  PERSONAL_POINTS,
  qualityFromTransit,
  TRANSIT_QUALITY_MAP,
  type QualityTag,
} from "./transitQualityMap.js";
import {
  FALLBACK_TIEBACK_EN,
  FALLBACK_TIEBACK_FA,
  MOON_SIGN_QUALITY,
  QUALITY_LABELS,
} from "./moonQualityFallback.js";

const SIGNS_EN = [
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
};

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "☀",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
  Chiron: "⚷",
};

const PLANET_SLOW_RANK: Record<string, number> = {
  pluto: 6,
  neptune: 5,
  uranus: 4,
  saturn: 3,
  chiron: 2,
  jupiter: 1,
};

const GONE = {
  error: "endpoint_removed" as const,
  migrateTo: "/api/mantra/today" as const,
};

export { GONE as mantraEndpointRemovedBody };

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

export interface DominantTransitContext {
  planetTag: string | null;
  aspectTag: string | null;
  qualityTag: QualityTag;
  qualityLabelEn: string;
  qualityLabelFa: string;
  planetLabelEn: string | null;
  planetLabelFa: string | null;
  planetSymbol: string | null;
  transitSummary: string;
  tieBackContextEn: string;
  tieBackContextFa: string;
  validUntil: Date;
  isMoonFallback: boolean;
}

export type MantraTodayPayload = {
  templateId: string;
  mantraEnDirect: string;
  mantraEnExploratory: string;
  mantraFaDirect: string;
  mantraFaExploratory: string;
  tieBackEn: string;
  tieBackFa: string;
  qualityTag: string;
  qualityLabelEn: string;
  qualityLabelFa: string;
  transitHint: {
    planetLabelEn: string | null;
    planetLabelFa: string | null;
    planetSymbol: string | null;
  };
  isPinned: boolean;
  pinExpiresAt: string | null;
  isPremium: boolean;
  validForDate: string;
};

function isQualityTag(s: string): s is QualityTag {
  return (
    s === "patience" ||
    s === "boundaries" ||
    s === "rebuilding" ||
    s === "discipline" ||
    s === "clarity" ||
    s === "courage" ||
    s === "letting-go" ||
    s === "softness" ||
    s === "expansion" ||
    s === "groundedness" ||
    s === "worth" ||
    s === "connection"
  );
}

function natalBodyToPersonalKey(name: string): string | null {
  const n = name.toLowerCase().replace(/\s+/g, "");
  if (n.includes("asc")) return "asc";
  if (n.includes("midheaven") || n === "mc") return "mc";
  if (["sun", "moon", "mercury", "venus", "mars"].includes(n)) return n;
  return null;
}

function transitingPlanetKey(body: string): string {
  return body.toLowerCase();
}

function longitudeToSign(lon: number): string {
  const idx = Math.floor(((lon % 360) + 360) % 360 / 30) % 12;
  return SIGNS_EN[idx]!.toLowerCase();
}

function sunSignFromCalendarDate(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return "aries";
  if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return "taurus";
  if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return "gemini";
  if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return "cancer";
  if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return "leo";
  if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return "virgo";
  if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return "libra";
  if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return "scorpio";
  if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return "sagittarius";
  if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return "capricorn";
  if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return "aquarius";
  return "pisces";
}

function tryTransitingMoonSign(): string | null {
  try {
    const { jdEt } = julianNow();
    const pos = planetLongitudesAt(jdEt);
    const moonLon = pos.Moon;
    if (typeof moonLon !== "number") return null;
    return longitudeToSign(moonLon);
  } catch (e) {
    console.warn("[mantra] moon sign from ephemeris failed:", e);
    return null;
  }
}

function pickDominantEvent(events: TransitEvent[]): TransitEvent | null {
  const withOrb = events.map((e) => ({ e, orb: e.orbDegrees ?? 99 }));
  const outerPersonalExact = withOrb.filter(({ e, orb }) => {
    const pk = transitingPlanetKey(e.transitingBody);
    const nk = natalBodyToPersonalKey(e.natalTargetBody);
    return OUTER_PLANETS.has(pk) && nk != null && PERSONAL_POINTS.has(nk) && orb <= 1;
  });
  if (outerPersonalExact.length > 0) {
    outerPersonalExact.sort((a, b) => {
      if (a.orb !== b.orb) return a.orb - b.orb;
      const ra = PLANET_SLOW_RANK[transitingPlanetKey(a.e.transitingBody)] ?? 0;
      const rb = PLANET_SLOW_RANK[transitingPlanetKey(b.e.transitingBody)] ?? 0;
      return rb - ra;
    });
    return outerPersonalExact[0]!.e;
  }

  const outer3 = events.filter((e) => {
    const pk = transitingPlanetKey(e.transitingBody);
    return OUTER_PLANETS.has(pk) && (e.orbDegrees ?? 99) <= 3;
  });
  if (outer3.length > 0) {
    outer3.sort((a, b) => b.significanceScore - a.significanceScore);
    return outer3[0]!;
  }

  const inner = events.filter((e) => {
    const pk = transitingPlanetKey(e.transitingBody);
    return !OUTER_PLANETS.has(pk);
  });
  if (inner.length > 0) {
    inner.sort((a, b) => b.significanceScore - a.significanceScore);
    return inner[0]!;
  }

  return events[0] ?? null;
}

function buildContextFromEvent(event: TransitEvent): DominantTransitContext {
  const q = qualityFromTransit(event);
  const labels = QUALITY_LABELS[q];
  const plEn = event.transitingBody;
  const plFa = PLANET_FA_MAP[plEn] ?? plEn;
  const orb = event.orbDegrees ?? 0;
  const summary = `${plEn} ${event.aspectType} ${event.natalTargetBody}, orb ${orb.toFixed(1)}°`;
  const sym = PLANET_SYMBOLS[plEn] ?? null;
  const end = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return {
    planetTag: transitingPlanetKey(event.transitingBody),
    aspectTag: event.aspectType.toLowerCase(),
    qualityTag: q,
    qualityLabelEn: labels.en,
    qualityLabelFa: labels.fa,
    planetLabelEn: plEn,
    planetLabelFa: plFa,
    planetSymbol: sym,
    transitSummary: summary,
    tieBackContextEn: summary,
    tieBackContextFa: `${plFa} · ${labels.fa}`,
    validUntil: end,
    isMoonFallback: false,
  };
}

function moonFallbackContext(opts: {
  moonSign: string;
  calendarSunSign: string;
  hasBirthTime: boolean;
}): DominantTransitContext {
  const signKey = opts.hasBirthTime ? opts.moonSign : opts.calendarSunSign;
  const q = MOON_SIGN_QUALITY[signKey] ?? "patience";
  const labels = QUALITY_LABELS[q];
  const summary = opts.hasBirthTime
    ? `Moon in ${opts.moonSign} (fallback)`
    : `Moon-sign by calendar (${opts.calendarSunSign}) (fallback)`;
  return {
    planetTag: null,
    aspectTag: null,
    qualityTag: q,
    qualityLabelEn: labels.en,
    qualityLabelFa: labels.fa,
    planetLabelEn: "Moon",
    planetLabelFa: PLANET_FA_MAP.Moon ?? "ماه",
    planetSymbol: PLANET_SYMBOLS.Moon ?? "☽",
    transitSummary: summary,
    tieBackContextEn: summary,
    tieBackContextFa: `${PLANET_FA_MAP.Moon ?? "ماه"} · ${labels.fa}`,
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isMoonFallback: true,
  };
}

/**
 * Resolves the user's dominant transit context for mantra selection.
 */
export async function getDominantTransit(userId: string): Promise<DominantTransitContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { birthProfile: true },
  });
  if (!user?.birthProfile) {
    const cal = sunSignFromCalendarDate(new Date());
    return moonFallbackContext({
      moonSign: cal,
      calendarSunSign: cal,
      hasBirthTime: false,
    });
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

  const dominant = pickDominantEvent(events);
  if (dominant) {
    return buildContextFromEvent(dominant);
  }

  const hasBirthTime = Boolean(bp.birthTime?.trim());
  const moonFromChart = bp.moonSign?.trim();
  const ephemMoon = tryTransitingMoonSign();
  const moonSign =
    hasBirthTime && moonFromChart
      ? moonFromChart.toLowerCase()
      : ephemMoon
        ? ephemMoon
        : sunSignFromCalendarDate(new Date());
  const calSun = sunSignFromCalendarDate(new Date());
  return moonFallbackContext({
    moonSign,
    calendarSunSign: calSun,
    hasBirthTime,
  });
}

function adjacentQualitiesFor(q: QualityTag): QualityTag[] {
  const out = new Set<QualityTag>();
  for (const body of Object.keys(TRANSIT_QUALITY_MAP)) {
    const m = TRANSIT_QUALITY_MAP[body];
    if (!m) continue;
    const rows = [m.hard, m.soft];
    for (const row of rows) {
      if (row.primary === q) row.adjacent.forEach((a) => out.add(a));
    }
  }
  return [...out];
}

async function templateLastShownMap(userId: string): Promise<Map<string, Date>> {
  const rows = await prisma.userMantraHistory.findMany({
    where: { userId },
    select: { templateId: true, shownAt: true },
    orderBy: { shownAt: "desc" },
    take: 500,
  });
  const m = new Map<string, Date>();
  for (const r of rows) {
    if (!m.has(r.templateId)) m.set(r.templateId, r.shownAt);
  }
  return m;
}

function weightedPick(templates: MantraTemplate[], lastShown: Map<string, Date>): MantraTemplate {
  const now = Date.now();
  const weights = templates.map((t) => {
    const last = lastShown.get(t.id);
    if (!last) return 3;
    const days = (now - last.getTime()) / (1000 * 60 * 60 * 24);
    return 1 + Math.min(days / 30, 2);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < templates.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return templates[i]!;
  }
  return templates[templates.length - 1]!;
}

/**
 * Picks a mantra template for the given quality tag, excluding recent history.
 */
export async function selectTemplate(qualityTag: QualityTag, userId: string): Promise<MantraTemplate> {
  const since = new Date(Date.now() - 21 * 86400000);
  const recent = await prisma.userMantraHistory.findMany({
    where: { userId, shownAt: { gte: since } },
    select: { templateId: true },
  });
  const exclude = new Set(recent.map((x) => x.templateId));

  const poolActive = async (where: { primaryQuality?: string; secondaryQualities?: { has: string } }) => {
    const list = await prisma.mantraTemplate.findMany({
      where: { isActive: true, ...where },
    });
    return list.filter((t) => !exclude.has(t.id));
  };

  let pool = await poolActive({ primaryQuality: qualityTag });
  if (pool.length < 4) {
    const sec = await prisma.mantraTemplate.findMany({
      where: { isActive: true, secondaryQualities: { has: qualityTag } },
    });
    for (const t of sec) {
      if (!exclude.has(t.id) && !pool.some((p) => p.id === t.id)) pool.push(t);
    }
  }

  if (pool.length < 4) {
    for (const adj of adjacentQualitiesFor(qualityTag)) {
      if (adj === qualityTag) continue;
      const more = await poolActive({ primaryQuality: adj });
      for (const t of more) {
        if (!exclude.has(t.id) && !pool.some((p) => p.id === t.id)) pool.push(t);
        if (pool.length >= 4) break;
      }
      if (pool.length >= 4) break;
    }
  }

  if (pool.length < 4) {
    const all = await prisma.mantraTemplate.findMany({ where: { isActive: true } });
    for (const t of all) {
      if (!exclude.has(t.id) && !pool.some((p) => p.id === t.id)) pool.push(t);
    }
  }

  if (pool.length === 0) {
    const any = await prisma.mantraTemplate.findFirst({ where: { isActive: true } });
    if (!any) throw new MantraServiceError("No mantra templates available.", 500);
    pool = [any];
  }

  const lastMap = await templateLastShownMap(userId);
  return weightedPick(pool, lastMap);
}

async function oneTieBackLine(args: {
  systemPrompt: string;
  userBlock: string;
  languageLabel: "English" | "Persian";
  qualityTag: QualityTag;
}): Promise<string> {
  const result = await generateCompletionViaOpenRouter({
    feature: "mantra_tieback",
    complexity: "lightweight",
    messages: [
      { role: "system", content: args.systemPrompt },
      { role: "user", content: args.userBlock },
    ],
    timeoutMs: 25_000,
  });
  if (result.ok && result.kind === "success" && result.content.trim()) {
    return result.content.trim();
  }
  console.error("[mantra] tie-back LLM failed", {
    ok: result.ok,
    kind: result.ok ? result.kind : (result as { kind?: string }).kind,
  });
  return args.languageLabel === "Persian"
    ? FALLBACK_TIEBACK_FA[args.qualityTag]
    : FALLBACK_TIEBACK_EN[args.qualityTag];
}

/**
 * Generates EN and FA tie-back lines in parallel via OpenRouter.
 */
export async function generateTieBack(
  template: MantraTemplate,
  dominant: DominantTransitContext,
  userName: string,
  mantraTextForPrompt: string,
): Promise<{ tieBackEn: string; tieBackFa: string }> {
  const q = dominant.qualityTag;
  const qEn = dominant.qualityLabelEn;
  const systemEn = `You are Akhtar, a warm and grounded personal guide. Write exactly one sentence — maximum 20 words — that gently connects the user to why this mantra phrase fits their current moment. Speak directly to them in second person. Reference their life, not the planets. No astrology jargon. Do not start with "This mantra" or "Based on". No markdown, no asterisks, no quotes, no headers. Return plain text only. Respond in English.`;
  const systemFa = `تو اختر هستی، یک راهنمای شخصی گرم و متین. دقیقاً یک جمله بنویس — حداکثر ۲۰ کلمه — که به آرامی کاربر را به دلیل تناسب این مانترا با لحظه‌ی فعلی‌اش متصل کند. مستقیماً با دوم‌شخص با آن‌ها صحبت کن. به زندگی‌شان اشاره کن، نه به سیارات. بدون اصطلاحات طالع‌بینی. جمله را با «این مانترا» یا «بر اساس» شروع نکن. بدون مارک‌داون، بدون ستاره، بدون نقل‌قول، بدون سرتیتر. فقط متن ساده برگردان. به فارسی پاسخ بده.`;
  const userMsg = `User: ${userName}
Current theme: ${q} (${qEn})
Context: ${dominant.transitSummary}
Mantra: ${mantraTextForPrompt}`;

  const [tieBackEn, tieBackFa] = await Promise.all([
    oneTieBackLine({
      systemPrompt: systemEn,
      userBlock: userMsg,
      languageLabel: "English",
      qualityTag: q,
    }),
    oneTieBackLine({
      systemPrompt: systemFa,
      userBlock: userMsg,
      languageLabel: "Persian",
      qualityTag: q,
    }),
  ]);
  return { tieBackEn, tieBackFa };
}

function userTimezone(user: {
  birthProfile: { birthTimezone: string } | null;
  id: string;
}): string {
  return user.birthProfile?.birthTimezone?.trim() || "UTC";
}

function localDateBounds(userTz: string, ymd: string): { start: Date; end: Date } {
  const start = DateTime.fromISO(`${ymd}T00:00:00`, { zone: userTz });
  const end = DateTime.fromISO(`${ymd}T23:59:59.999`, { zone: userTz });
  if (!start.isValid || !end.isValid) {
    const u = DateTime.utc().startOf("day");
    return { start: u.toJSDate(), end: u.endOf("day").toJSDate() };
  }
  return { start: start.toUTC().toJSDate(), end: end.toUTC().toJSDate() };
}

function toTodayPayload(args: {
  template: MantraTemplate;
  tieBackEn: string;
  tieBackFa: string;
  dominant: DominantTransitContext;
  isPinned: boolean;
  pinExpiresAt: Date | null;
  isPremium: boolean;
  validForDate: string;
}): MantraTodayPayload {
  const t = args.template;
  const hintEn = args.dominant.planetLabelEn;
  const hintFa = args.dominant.planetLabelFa;
  return {
    templateId: t.id,
    mantraEnDirect: t.mantraEnDirect || t.mantraEn,
    mantraEnExploratory: t.mantraEnExploratory,
    mantraFaDirect: t.mantraFaDirect || t.mantraFa,
    mantraFaExploratory: t.mantraFaExploratory,
    tieBackEn: args.tieBackEn,
    tieBackFa: args.tieBackFa,
    qualityTag: args.dominant.qualityTag,
    qualityLabelEn: args.dominant.qualityLabelEn,
    qualityLabelFa: args.dominant.qualityLabelFa,
    transitHint: {
      planetLabelEn: hintEn,
      planetLabelFa: hintFa,
      planetSymbol: args.dominant.planetSymbol,
    },
    isPinned: args.isPinned,
    pinExpiresAt: args.pinExpiresAt ? args.pinExpiresAt.toISOString() : null,
    isPremium: args.isPremium,
    validForDate: args.validForDate,
  };
}

function pinToPayload(pin: UserMantraPin, isPremium: boolean, validForDate: string): MantraTodayPayload {
  const dominant: DominantTransitContext = {
    planetTag: null,
    aspectTag: null,
    qualityTag: isQualityTag(pin.qualityTag) ? pin.qualityTag : "patience",
    qualityLabelEn: pin.qualityLabel,
    qualityLabelFa: pin.qualityLabel,
    planetLabelEn: pin.planetLabel,
    planetLabelFa: PLANET_FA_MAP[pin.planetLabel] ?? pin.planetLabel,
    planetSymbol: PLANET_SYMBOLS[pin.planetLabel] ?? null,
    transitSummary: pin.dominantTransit,
    tieBackContextEn: pin.dominantTransit,
    tieBackContextFa: pin.dominantTransit,
    validUntil: pin.expiresAt,
    isMoonFallback: false,
  };
  const fakeTemplate = {
    id: pin.templateId,
    mantraEnDirect: pin.mantraEn,
    mantraFaDirect: pin.mantraFa,
    mantraEnExploratory: pin.mantraEnExploratory,
    mantraFaExploratory: pin.mantraFaExploratory,
    mantraEn: pin.mantraEn,
    mantraFa: pin.mantraFa,
  } as MantraTemplate;
  return toTodayPayload({
    template: fakeTemplate,
    tieBackEn: pin.tieBackEn,
    tieBackFa: pin.tieBackFa,
    dominant,
    isPinned: true,
    pinExpiresAt: pin.expiresAt,
    isPremium,
    validForDate,
  });
}

/**
 * Returns today's mantra for the user, keyed by `${userId}:${userLocalDate}` (calendar day in user TZ).
 */
export async function getOrServeMantra(
  userId: string,
  userLocalDate: string,
  isPremium: boolean,
): Promise<MantraTodayPayload> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { birthProfile: true },
  });
  if (!user) throw new MantraServiceError("User not found", 404);

  const tz = userTimezone(user);
  const pin = await prisma.userMantraPin.findUnique({ where: { userId } });
  if (pin && pin.expiresAt > new Date()) {
    return pinToPayload(pin, isPremium, userLocalDate);
  }

  const { start, end } = localDateBounds(tz, userLocalDate);
  const todayRow = await prisma.userMantraHistory.findFirst({
    where: {
      userId,
      shownAt: { gte: start, lte: end },
    },
    orderBy: { shownAt: "desc" },
  });

  if (todayRow) {
    const template = await prisma.mantraTemplate.findUnique({ where: { id: todayRow.templateId } });
    if (!template) throw new MantraServiceError("Mantra template missing for history row.", 500);
    const dominant = await getDominantTransit(userId);
    const qTag = isQualityTag(todayRow.qualityTag) ? todayRow.qualityTag : dominant.qualityTag;
    const labels = QUALITY_LABELS[qTag];
    dominant.qualityTag = qTag;
    dominant.qualityLabelEn = labels.en;
    dominant.qualityLabelFa = labels.fa;
    if (todayRow.transitSummary) {
      dominant.transitSummary = todayRow.transitSummary;
    }
    const tieBackEn = todayRow.tieBackEn?.trim() || FALLBACK_TIEBACK_EN[qTag];
    const tieBackFa = todayRow.tieBackFa?.trim() || FALLBACK_TIEBACK_FA[qTag];
    return toTodayPayload({
      template,
      tieBackEn,
      tieBackFa,
      dominant,
      isPinned: false,
      pinExpiresAt: null,
      isPremium,
      validForDate: userLocalDate,
    });
  }

  const dominant = await getDominantTransit(userId);
  const q = dominant.qualityTag;
  const template = await selectTemplate(q, userId);
  const name = getDisplayName(user, user.language);
  const mantraTextForPrompt = template.mantraEnDirect || template.mantraEn;

  const { tieBackEn, tieBackFa } = await generateTieBack(template, dominant, name, mantraTextForPrompt);

  await prisma.userMantraHistory.create({
    data: {
      userId,
      templateId: template.id,
      qualityTag: q,
      transitSummary: dominant.transitSummary,
      registerShown: "exploratory",
      tieBackEn,
      tieBackFa,
    },
  });

  return toTodayPayload({
    template,
    tieBackEn,
    tieBackFa,
    dominant,
    isPinned: false,
    pinExpiresAt: null,
    isPremium,
    validForDate: userLocalDate,
  });
}

/**
 * Premium-only: pins current snapshot for 7 days.
 */
export async function pinMantraForUser(userId: string, firebaseUid: string): Promise<{ pinId: string; expiresAt: string }> {
  const allowed = await hasFeatureAccess(firebaseUid, userId);
  if (!allowed) {
    throw new MantraServiceError("premium_required", 403, true);
  }

  const last = await prisma.userMantraHistory.findFirst({
    where: { userId },
    orderBy: { shownAt: "desc" },
  });
  if (!last) throw new MantraServiceError("No mantra to pin.", 400);

  const template = await prisma.mantraTemplate.findUnique({ where: { id: last.templateId } });
  if (!template) throw new MantraServiceError("No mantra to pin.", 400);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new MantraServiceError("User not found", 404);

  const dominant = await getDominantTransit(userId);
  let tieBackEn = last.tieBackEn?.trim() ?? "";
  let tieBackFa = last.tieBackFa?.trim() ?? "";
  if (!tieBackEn || !tieBackFa) {
    const name = getDisplayName(user, user.language);
    const mantraTextForPrompt = template.mantraEnDirect || template.mantraEn;
    const gen = await generateTieBack(template, dominant, name, mantraTextForPrompt);
    tieBackEn = gen.tieBackEn;
    tieBackFa = gen.tieBackFa;
  }

  const expiresAt = new Date(Date.now() + 7 * 86400000);

  const row = await prisma.userMantraPin.upsert({
    where: { userId },
    create: {
      userId,
      templateId: template.id,
      mantraEn: template.mantraEnDirect || template.mantraEn,
      mantraFa: template.mantraFaDirect || template.mantraFa,
      mantraEnExploratory: template.mantraEnExploratory,
      mantraFaExploratory: template.mantraFaExploratory,
      tieBackEn,
      tieBackFa,
      dominantTransit: dominant.transitSummary,
      planetLabel: dominant.planetLabelEn ?? "—",
      qualityLabel: dominant.qualityLabelEn,
      qualityTag: dominant.qualityTag,
      selectedTheme: null,
      expiresAt,
    },
    update: {
      templateId: template.id,
      mantraEn: template.mantraEnDirect || template.mantraEn,
      mantraFa: template.mantraFaDirect || template.mantraFa,
      mantraEnExploratory: template.mantraEnExploratory,
      mantraFaExploratory: template.mantraFaExploratory,
      tieBackEn,
      tieBackFa,
      dominantTransit: dominant.transitSummary,
      planetLabel: dominant.planetLabelEn ?? "—",
      qualityLabel: dominant.qualityLabelEn,
      qualityTag: dominant.qualityTag,
      selectedTheme: null,
      expiresAt,
    },
  });

  return { pinId: row.id, expiresAt: expiresAt.toISOString() };
}

export async function unpinMantra(userId: string): Promise<void> {
  await prisma.userMantraPin.deleteMany({ where: { userId } });
}

export async function createMantraPractice(args: {
  userId: string;
  templateId: string;
  mantraText: string;
  language: "en" | "fa";
  register: "direct" | "exploratory";
  practiceMode: string;
  durationSec: number;
  journalNote?: string | null;
  qualityTag: string;
  qualityLabelEn: string;
  qualityLabelFa: string;
}): Promise<{ practiceId: string; completedAt: string }> {
  const row = await prisma.userMantraPractice.create({
    data: {
      userId: args.userId,
      templateId: args.templateId,
      mantraText: args.mantraText,
      language: args.language,
      register: args.register,
      practiceMode: args.practiceMode,
      durationSec: args.durationSec,
      journalNote: args.journalNote?.slice(0, 2000) ?? null,
      qualityTag: args.qualityTag,
      qualityLabelEn: args.qualityLabelEn,
      qualityLabelFa: args.qualityLabelFa,
    },
  });
  return { practiceId: row.id, completedAt: row.completedAt.toISOString() };
}

export async function deleteMantraPractice(userId: string, practiceId: string): Promise<void> {
  const r = await prisma.userMantraPractice.deleteMany({
    where: { id: practiceId, userId },
  });
  if (r.count === 0) {
    const exists = await prisma.userMantraPractice.findUnique({ where: { id: practiceId } });
    if (!exists) throw new MantraServiceError("Not found", 404);
    throw new MantraServiceError("Forbidden", 403);
  }
}

export async function listMantraPracticeJournal(args: {
  userId: string;
  limit: number;
  before: Date | null;
}): Promise<{
  entries: Array<{
    practiceId: string;
    templateId: string | null;
    mantraText: string;
    language: "en" | "fa";
    register: "direct" | "exploratory";
    practiceMode: string;
    durationSec: number;
    completedAt: string;
    journalNote: string | null;
    qualityTag: string;
    qualityLabelEn: string;
    qualityLabelFa: string;
  }>;
  nextBefore: string | null;
}> {
  const rows = await prisma.userMantraPractice.findMany({
    where: {
      userId: args.userId,
      ...(args.before ? { completedAt: { lt: args.before } } : {}),
    },
    orderBy: { completedAt: "desc" },
    take: args.limit + 1,
  });
  const slice = rows.slice(0, args.limit);
  const next = rows.length > args.limit ? rows[args.limit]!.completedAt.toISOString() : null;
  return {
    entries: slice.map((r) => ({
      practiceId: r.id,
      templateId: r.templateId,
      mantraText: r.mantraText,
      language: r.language as "en" | "fa",
      register: r.register as "direct" | "exploratory",
      practiceMode: r.practiceMode,
      durationSec: r.durationSec,
      completedAt: r.completedAt.toISOString(),
      journalNote: r.journalNote,
      qualityTag: r.qualityTag,
      qualityLabelEn: r.qualityLabelEn,
      qualityLabelFa: r.qualityLabelFa,
    })),
    nextBefore: next,
  };
}

export async function updatePracticeJournalNote(
  userId: string,
  practiceId: string,
  note: string | null,
): Promise<void> {
  const n = note?.slice(0, 2000) ?? null;
  const u = await prisma.userMantraPractice.updateMany({
    where: { id: practiceId, userId },
    data: { journalNote: n },
  });
  if (u.count === 0) {
    const exists = await prisma.userMantraPractice.findUnique({ where: { id: practiceId } });
    if (!exists) throw new MantraServiceError("Not found", 404);
    throw new MantraServiceError("Forbidden", 403);
  }
}

export async function countCompletedPractices(userId: string): Promise<number> {
  return prisma.userMantraPractice.count({ where: { userId } });
}
