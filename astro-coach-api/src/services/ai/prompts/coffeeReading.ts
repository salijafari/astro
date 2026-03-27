import { withBaseStyle } from "../baseStyleGuide.js";
import type { PromptContext } from "../../../types/promptContext.js";
import type { TasseographySymbol } from "../../../constants/tasseographySymbols.js";

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

/**
 * Builds the Step 1 (vision extraction) prompt for a coffee cup image.
 *
 * The caller passes the returned { system, user } to generateCompletion
 * along with imageInputs: [{ type: 'url', data: imageUrl }].
 * The image is formatted by generateCompletion — NOT embedded manually in the message.
 */
export function buildCoffeeVisionPrompt(): { system: string; user: string } {
  return {
    system: withBaseStyle(`
## FEATURE: COFFEE CUP READING — VISION EXTRACTION (STEP 1)

You are analyzing a coffee cup image for tasseography (coffee cup reading).
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
`.trim()),
    user: "Analyze the coffee cup image. Return JSON with visionObservations[], symbolicMappings[{symbol, meaning}], and imageQualityFlag.",
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
`.trim());

  const user = question
    ? `My question for the reading: ${question}`
    : `Please interpret the symbols in my coffee cup.`;

  return { system, user };
}
