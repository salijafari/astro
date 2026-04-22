import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { generateCompletionViaOpenRouter } from "../ai/openrouterCompletion.js";
import type { NatalChartResult } from "../astrology/chartEngine.js";
import type { SalienceMap } from "../astrology/salienceEngine.js";

const PROMPT_VERSION = "v1";

export type ThemeCard = {
  id: string;
  titleEn: string;
  titleFa: string;
  teaserEn: string;
  teaserFa: string;
  planet: string;
  sign: string;
  house: number;
  salienceScore: number;
};

export type NatalInterpretation = {
  synthesisParagraph: string;
  themeCards: ThemeCard[];
};

function buildBirthDataHash(birthDate: string, birthTime: string | null, birthCity: string): string {
  const raw = `${birthDate}|${birthTime ?? ""}|${birthCity}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function buildSystemPrompt(locale: "en" | "fa"): string {
  if (locale === "en") {
    return `You are Akhtar's natal chart interpreter. You receive a structured JSON chart payload and output a JSON object only — no prose, no markdown, no explanation outside the JSON.

Your output must follow this exact schema:
{
  "synthesis": "<80-120 word portrait in warm, literary English. No astrology jargon in the synthesis. Use second person (you/your). Italicize key phrases with *asterisks*.>",
  "themes": [
    {
      "titleEn": "<plain-language title, no jargon, max 5 words>",
      "titleFa": "<Persian native title, same meaning, no translation>",
      "teaserEn": "<one sentence, brand voice, specific, poetic>",
      "teaserFa": "<Persian native teaser, not a translation>",
      "planet": "<planet name in English>",
      "sign": "<sign name in English>",
      "house": <house number as integer>,
      "salienceScore": <integer 1-100>
    }
    // exactly 5 theme objects
  ]
}

Rules:
- Synthesis must be 80-120 words. Not a list. Not bullet points. A portrait.
- Synthesis uses *asterisks* for emphasis phrases only (they will be italicized in UI).
- 5 theme cards ranked by salienceScore descending. Each theme must map to a real placement in the payload.
- Theme titles must be plain English — no sign names, house numbers, or planet names visible in the title itself.
- Theme teasers must be one sentence, warm, specific. Not generic.
- Persian titles and teasers must be written natively — not translated from English.
- The LLM must NEVER calculate or invent any placement not present in the payload.
- Output valid JSON only. No markdown fences.`;
  }

  return `تو مفسر زایچهٔ تولد در اختر هستی. یک payload ساختاریافته JSON دریافت می‌کنی و یک شیء JSON خروجی می‌دهی — فقط JSON، بدون متن اضافه.

خروجی باید دقیقاً این ساختار را داشته باشد:
{
  "synthesis": "<پرتره‌ای ۸۰ تا ۱۲۰ کلمه‌ای به فارسی محاوره‌ای ایرانی. بدون اصطلاح تخصصی نجومی در متن. دوم شخص مفرد (تو / برات / توئی). عبارات کلیدی را با *ستاره* مشخص کن.>",
  "themes": [
    {
      "titleEn": "<عنوان ساده انگلیسی، بدون اصطلاح نجومی، حداکثر ۵ کلمه>",
      "titleFa": "<عنوان فارسی محاوره‌ای، معنای یکسان، نوشته‌شده به طور مستقل>",
      "teaserEn": "<یک جمله به انگلیسی، سبک برند، مشخص و شاعرانه>",
      "teaserFa": "<یک جمله به فارسی محاوره‌ای ایرانی، مستقل از ترجمه>",
      "planet": "<نام سیاره به انگلیسی>",
      "sign": "<نام برج به انگلیسی>",
      "house": <عدد خانه به صورت integer>,
      "salienceScore": <عدد ۱ تا ۱۰۰>
    }
    // دقیقاً ۵ آیتم
  ]
}

قوانین:
- Synthesis باید ۸۰ تا ۱۲۰ کلمه باشد. نه لیست، نه بولت. یک پرتره.
- عبارات کلیدی با *ستاره* مشخص می‌شوند.
- دقیقاً ۵ کارت تم، مرتب‌شده بر اساس salienceScore نزولی.
- عنوان‌های تم باید ساده باشند — نه نام برج، نه شماره خانه.
- LLM هرگز موضعی را که در payload نیست محاسبه یا اختراع نمی‌کند.
- فقط JSON معتبر خروجی بده. بدون markdown.`;
}

function buildUserMessage(chart: NatalChartResult, salience: SalienceMap, locale: "en" | "fa"): string {
  return JSON.stringify({
    locale,
    chartRuler: salience.chartRuler,
    angularPlanets: salience.angularPlanets,
    elementBalance: salience.elementBalance,
    modalityBalance: salience.modalityBalance,
    stellia: salience.stellia,
    topPlanetsByHouseWeight: salience.topPlanetsByHouseWeight,
    placements: chart.planets.map((p) => ({
      planet: p.planet,
      sign: p.sign,
      house: p.house,
      degree: p.degree,
    })),
    bigThree: {
      sun: chart.sunSign,
      moon: chart.moonSign,
      rising: chart.risingSign,
    },
    tightestAspects: chart.aspects.slice(0, 6).map((a) => ({
      body1: a.body1,
      body2: a.body2,
      type: a.type,
      orb: Number(a.orb.toFixed(2)),
    })),
  });
}

function mapThemeRows(themes: unknown[]): ThemeCard[] {
  return themes.slice(0, 5).map((row, i) => {
    const t = row as Record<string, unknown>;
    return {
      id: `theme_${i + 1}`,
      titleEn: String(t.titleEn ?? ""),
      titleFa: String(t.titleFa ?? ""),
      teaserEn: String(t.teaserEn ?? ""),
      teaserFa: String(t.teaserFa ?? ""),
      planet: String(t.planet ?? ""),
      sign: String(t.sign ?? ""),
      house: Number(t.house ?? 0),
      salienceScore: Number(t.salienceScore ?? 0),
    };
  });
}

/**
 * Returns cached or freshly generated natal synthesis + five theme cards (OpenRouter JSON mode).
 */
export async function getOrGenerateInterpretation(
  userId: string,
  locale: "en" | "fa",
  chart: NatalChartResult,
  salience: SalienceMap,
  birthDate: string,
  birthTime: string | null,
  birthCity: string,
): Promise<NatalInterpretation> {
  const birthDataHash = buildBirthDataHash(birthDate, birthTime, birthCity);

  const cached = await prisma.natalChartInterpretation.findUnique({
    where: {
      userId_locale_birthDataHash_promptVersion: {
        userId,
        locale,
        birthDataHash,
        promptVersion: PROMPT_VERSION,
      },
    },
  });

  if (cached) {
    return {
      synthesisParagraph: cached.synthesisParagraph,
      themeCards: cached.themeCardsJson as ThemeCard[],
    };
  }

  const systemPrompt = buildSystemPrompt(locale);
  const userMessage = buildUserMessage(chart, salience, locale);

  const result = await generateCompletionViaOpenRouter({
    feature: "natal_chart_interpretation",
    complexity: "standard",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    responseFormat: { type: "json_object" },
    timeoutMs: 55_000,
    maxTokens: 4096,
    temperature: 0.55,
  });

  if (!result.ok || result.kind !== "success") {
    console.error("[natalInterpretation] LLM generation failed:", result);
    throw new Error("Interpretation generation failed");
  }

  let parsed: { synthesis?: string; themes?: unknown[] };
  try {
    const raw =
      result.json && typeof result.json === "object" && !Array.isArray(result.json)
        ? result.json
        : JSON.parse(result.content.replace(/```json|```/g, "").trim());
    parsed = raw as { synthesis?: string; themes?: unknown[] };
  } catch (e) {
    console.error("[natalInterpretation] JSON parse failed:", e, result.content?.slice(0, 400));
    throw new Error("Interpretation parse failed");
  }

  const themeCards = mapThemeRows(Array.isArray(parsed.themes) ? parsed.themes : []);

  await prisma.natalChartInterpretation.upsert({
    where: {
      userId_locale_birthDataHash_promptVersion: {
        userId,
        locale,
        birthDataHash,
        promptVersion: PROMPT_VERSION,
      },
    },
    create: {
      userId,
      locale,
      birthDataHash,
      promptVersion: PROMPT_VERSION,
      synthesisParagraph: parsed.synthesis ?? "",
      themeCardsJson: themeCards,
    },
    update: {
      synthesisParagraph: parsed.synthesis ?? "",
      themeCardsJson: themeCards,
    },
  });

  return {
    synthesisParagraph: parsed.synthesis ?? "",
    themeCards,
  };
}
