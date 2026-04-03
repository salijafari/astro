import { withBaseStyle } from "../baseStyleGuide.js";
import type { PromptContext } from "../../../types/promptContext.js";
import type { TasseographySymbol } from "../../../constants/tasseographySymbols.js";
import { appendOutputCompliance } from "../systemPrompts.js";

export interface CoffeeReadingOutput {
  symbolName: string;
  location: "rim" | "middle" | "bottom" | "handle_side" | "opposite_handle";
  locationMeaning: string;         // 1 sentence on timing / proximity
  coreMessage: string;             // 2–3 sentences — symbol's primary meaning in context
  forYouSpecifically: string;      // 2–3 sentences personalised to user's chart
  reflectionQuestion: string;      // the symbol's reflection prompt, optionally adapted
  astrologyEcho: string;           // 1–2 sentences connecting symbol domain to user's chart
}

export interface CoffeeSymbolInput {
  symbol: TasseographySymbol;
  location: CoffeeReadingOutput["location"];
}

function textForCupLocation(
  mod: TasseographySymbol["locationModifier"],
  location: CoffeeReadingOutput["location"]
): string {
  switch (location) {
    case "rim":
      return mod.nearRim;
    case "bottom":
      return mod.nearBottom;
    case "handle_side":
      return mod.nearHandle;
    case "opposite_handle":
      return mod.oppositeHandle;
    case "middle":
    default:
      return "";
  }
}

export interface CoffeeVisionOutput {
  visionObservations: string[];
  symbolicMappings: Array<{ symbol: string; meaning: string }>;
  imageQualityFlag: boolean;
}

export type CoffeeReadingLang = "en" | "fa";

function coffeeOutputLanguageDirective(lang: CoffeeReadingLang): string {
  if (lang === "fa") {
    return `

## OUTPUT LANGUAGE (CRITICAL)
The user's app language is Persian (Farsi).
Every human-readable STRING VALUE inside the JSON must be written in fluent, natural Persian (formal–warm register).
JSON property names MUST stay exactly in English as shown in the schema (visionObservations, symbolicMappings, symbol, meaning, imageQualityFlag).
`.trim();
  }
  return `

## OUTPUT LANGUAGE
The user's app language is English.
All human-readable string values in the JSON must be in English.
`.trim();
}

/**
 * Builds the Step 1 (vision extraction) prompt for coffee cup image(s).
 *
 * @param twoImages - When true, first image is cup grounds inside the cup; second is the saucer (may show drips or residue).
 */
export function buildCoffeeVisionPrompt(
  lang: CoffeeReadingLang = "en",
  twoImages = false
): { system: string; user: string } {
  const userLine =
    lang === "fa"
      ? twoImages
        ? "دو تصویر به ترتیب ارسال شده: (۱) ته فنجان، (۲) زیرفنجانی. هر دو را برای فال قهوه در نظر بگیر. فقط JSON با visionObservations، symbolicMappings و imageQualityFlag برگردان."
        : "تصویر فنجان قهوه را تحلیل کن. فقط JSON با visionObservations، symbolicMappings و imageQualityFlag برگردان."
      : twoImages
        ? "Two images are provided in order: (1) coffee cup — interior grounds/patterns, (2) saucer — may show drips or residue. Consider both for tasseography. Return JSON with visionObservations[], symbolicMappings[{symbol, meaning}], and imageQualityFlag."
        : "Analyze the coffee cup image. Return JSON with visionObservations[], symbolicMappings[{symbol, meaning}], and imageQualityFlag.";

  const imageScope = twoImages
    ? `You are analyzing TWO images for tasseography (coffee cup reading): the FIRST image is the **cup interior** (grounds and patterns); the SECOND image is the **saucer** (may include drips, stains, or residue relevant to the reading). Combine observations from both when listing shapes and symbols.`
    : `You are analyzing a coffee cup image for tasseography (coffee cup reading).`;

  return {
    system: withBaseStyle(`
## FEATURE: COFFEE CUP READING — VISION EXTRACTION (STEP 1)

${imageScope}
Your job in this step is ONLY to extract visual observations — do not interpret them.

## OUTPUT FORMAT
Return ONLY valid JSON — no markdown, no preamble:
{
  "visionObservations": ["3–12 distinct visual observations"],
  "symbolicMappings": [
    { "symbol": "shape/pattern name", "meaning": "brief preliminary symbolic note" }
  ],
  "imageQualityFlag": false
}

RULES:
- visionObservations: describe shapes, patterns, clusters, lines, circles, outlines you see
- symbolicMappings: map each distinct shape to its traditional tasseography meaning
- imageQualityFlag: true ONLY if the image is too dark, blurry, or unclear to read
- Do NOT personalize or interpret in this step — that happens in step 2
${coffeeOutputLanguageDirective(lang)}

${appendOutputCompliance(lang)}
`.trim()),
    user: userLine,
  };
}

/**
 * System prompt for coffee reading step 2 (symbolic interpretation + follow-ups).
 */
/**
 * @param readerName - From `User.name` (never `firstName`); optional personalization.
 */
export function buildCoffeeStep2SystemPrompt(lang: CoffeeReadingLang, readerName?: string): string {
  const nameHint =
    readerName?.trim().length
      ? ` The reader's name is "${readerName.trim()}" — address them naturally by name once or twice in the interpretation when it fits; do not repeat every sentence.`
      : "";
  const base =
    "You are a traditional coffee reader who is gentle and non-deterministic. No doom. No medical/legal/financial advice. JSON only. Use the provided symbols to create symbolic-reflection interpretation and gentle next-step questions.";
  if (lang === "fa") {
    return `${base}${nameHint} The interpretation string and every followUpQuestion MUST be written in fluent Persian (Farsi). JSON keys stay in English.

${appendOutputCompliance(lang)}`;
  }
  return `${base}${nameHint} The interpretation and followUpQuestions must be in English.

${appendOutputCompliance(lang)}`;
}

/**
 * User-side request text for step 2 (bundled into JSON payload in app.ts).
 */
export function buildCoffeeStep2UserRequest(lang: CoffeeReadingLang): string {
  if (lang === "fa") {
    return "تفسیر (۸۰ تا ۲۵۰۰ نویسه) و followUpQuestions (۲ تا ۵ سؤال) بنویس. لحن ملایم، غیرقطعی و تأملی باشد. همه متن‌ها فارسی باشند.";
  }
  return "Write interpretation (80-2500 chars) and followUpQuestions (2-5 questions). Keep it gentle, non-deterministic, and reflective.";
}

/** Fallback payload when the model fails or API key is missing — matches app language. */
export function getCoffeeReadingDefaultPayload(lang: CoffeeReadingLang): {
  visionObservations: string[];
  symbolicMappings: Array<{ symbol: string; meaning: string }>;
  interpretation: string;
  followUpQuestions: string[];
  imageQualityFlag: boolean;
} {
  if (lang === "fa") {
    return {
      visionObservations: [
        "کنتراست کلی فنجان متوسط به نظر می‌رسد",
        "اشکال بیشتر نزدیک لبه فنجان جمع شده‌اند",
        "یک ناحیه تیره برجسته دیده می‌شود",
      ],
      symbolicMappings: [
        { symbol: "خوشه", meaning: "چند اولویت هم‌زمان برای توجه رقابت می‌کنند" },
        { symbol: "خط", meaning: "مسیری در میان عدم‌قطعیت شکل می‌گیرد" },
        { symbol: "حلقه", meaning: "تم تعهد یا مرز در زندگی" },
      ],
      interpretation:
        "فنجان تو دورانی از گذار را نشان می‌دهد؛ وقتی یک قدم کوچک بعدی را انتخاب کنی و با ملایمت آن را تکرار کنی، روشنی بیشتری پیدا می‌کنی. این هفته تمرکزت را نگه دار.",
      followUpQuestions: [
        "الان کدام حوزه از زندگی‌ات فوریت بیشتری دارد؟",
        "می‌خواهی دربارهٔ عشق، کار یا رشد شخصی راهنمایی بیشتری بگیری؟",
      ],
      imageQualityFlag: false,
    };
  }
  return {
    visionObservations: ["Contrast looks medium", "Shapes cluster near the rim", "One dominant dark region"],
    symbolicMappings: [
      { symbol: "cluster", meaning: "Multiple priorities competing for attention" },
      { symbol: "line", meaning: "A path forming through uncertainty" },
      { symbol: "ring", meaning: "A commitment or boundary theme" },
    ],
    interpretation:
      "Your cup suggests a transition period where clarity comes from choosing one small next step and repeating it consistently. Keep your focus narrow this week.",
    followUpQuestions: [
      "What area of life feels most urgent right now?",
      "Do you want guidance for love, work, or personal growth?",
    ],
    imageQualityFlag: false,
  };
}

/**
 * Builds a coffee (tasseography) reading prompt for one or more symbols.
 */
export function buildCoffeeReadingPrompt(
  ctx: PromptContext,
  symbols: CoffeeSymbolInput[],
  question?: string
): { system: string; user: string } {
  const symbolBlocks = symbols
    .slice(0, 6)
    .map(({ symbol, location }) => {
      const locationNote = textForCupLocation(symbol.locationModifier, location);
      return `SYMBOL: ${symbol.symbol}${symbol.alternateNames.length ? ` (also: ${symbol.alternateNames.slice(0, 2).join(", ")})` : ""}
- Location: ${location} — ${locationNote}
- Domain: ${symbol.domains.join(", ")}
- Positive meaning: ${symbol.positiveMeaning}
- Shadow meaning: ${symbol.shadowMeaning}
- Reflection question: ${symbol.reflectionQuestion}`;
    })
    .join("\n\n");

  const system = withBaseStyle(`
## FEATURE: COFFEE CUP READING (TASSEOGRAPHY)

You are delivering a coffee cup reading for ${ctx.userName}.

${ctx.userName.toUpperCase()}'S CHART:
- Sun: ${ctx.sunSign} | Moon: ${ctx.moonSign} | Rising: ${ctx.risingSign}
- Dominant element: ${ctx.dominantElement}

SYMBOLS IDENTIFIED:
${symbolBlocks}

## OUTPUT FORMAT
Return a JSON ARRAY — one object per symbol, in the order listed above. No markdown, no preamble:
[
  {
    "symbolName": "",
    "location": "",
    "locationMeaning": "",
    "coreMessage": "",
    "forYouSpecifically": "",
    "reflectionQuestion": "",
    "astrologyEcho": ""
  }
]

RULES:
- Use the location modifier to set timing context (rim = near future, bottom = distant or deep).
- forYouSpecifically: connect to Sun/Moon/Rising and the user's dominant element.
- reflectionQuestion: use the symbol's question from the data, adapted for the user if natural.
- astrologyEcho: if the symbol's domain overlaps with an active transit, mention it briefly.
- Tasseography is a reflective tool — frame all messages as possibilities, not predictions.
- Keep tone warm, curious, and grounded. Avoid dramatic or ominous language.

${appendOutputCompliance(ctx.language)}
`.trim());

  const user = question
    ? `My question for the reading: ${question}`
    : `Please interpret the symbols in my coffee cup.`;

  return { system, user };
}
