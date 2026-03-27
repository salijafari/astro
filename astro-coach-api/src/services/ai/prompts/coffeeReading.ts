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
      const locationModifier = symbol.locationModifiers[location] ?? "";
      return `SYMBOL: ${symbol.symbol}${symbol.alternateNames.length ? ` (also: ${symbol.alternateNames.slice(0, 2).join(", ")})` : ""}
- Location: ${location} — ${locationModifier}
- Domain: ${symbol.domain.join(", ")}
- Meaning: ${symbol.meaning}
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
