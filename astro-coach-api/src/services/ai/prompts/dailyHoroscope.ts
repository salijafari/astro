import { withBaseStyle } from "../baseStyleGuide.js";
import type { PromptContext } from "../../../types/promptContext.js";

/**
 * JSON output schema for the daily horoscope response.
 */
export interface DailyHoroscopeOutput {
  headline: string;         // 1 punchy sentence, ≤12 words
  overview: string;         // 3–5 sentences, the main daily energy
  love: string;             // 2–3 sentences on relationships / connection
  career: string;           // 2–3 sentences on work / productivity
  energy: string;           // 2–3 sentences on body / wellbeing / environment
  affirmation: string;      // 1 short affirmation sentence in second person
  luckyElement: string;     // e.g. "water", "earth" or a colour / number
  transitHighlight: string; // 1–2 sentences about the most significant active transit
}

/**
 * Builds the daily horoscope prompt pair.
 * Returns ONLY valid JSON matching DailyHoroscopeOutput.
 */
export function buildDailyHoroscopePrompt(
  ctx: PromptContext,
  todayDate: string
): { system: string; user: string } {
  const transitsText = ctx.activeTransits.length
    ? ctx.activeTransits.slice(0, 5).join("\n- ")
    : "No major transits today.";

  const meaningBlocks =
    ctx.assembledMeaning?.contextBlocks.slice(0, 3).join("\n") ?? "";

  const system = withBaseStyle(`
## FEATURE: DAILY HOROSCOPE

You are generating a personalised daily horoscope for ${ctx.userName}.

ASTROLOGICAL PROFILE:
- Sun: ${ctx.sunSign} | Moon: ${ctx.moonSign} | Rising: ${ctx.risingSign}
- Dominant element: ${ctx.dominantElement} | Dominant modality: ${ctx.dominantModality}
- Date: ${todayDate}

ACTIVE TRANSITS (use these as the primary driver of today's energy):
- ${transitsText}
${meaningBlocks ? `\nMEANING CONTEXT:\n${meaningBlocks}` : ""}

## OUTPUT FORMAT
Return ONLY a valid JSON object matching this exact structure — no markdown, no explanation:
{
  "headline": "",
  "overview": "",
  "love": "",
  "career": "",
  "energy": "",
  "affirmation": "",
  "luckyElement": "",
  "transitHighlight": ""
}

RULES:
- Base interpretations exclusively on the transit data above. Never invent transits.
- Free tier: overview + affirmation + transitHighlight only (keep other fields present but shorter).
- Premium/VIP: full detailed output.
- Affirmation must be in second person ("You are…", "Today, you…").
- Do not repeat the user's name in every field — use it once in overview at most.
`.trim());

  const user = `Generate today's horoscope for ${ctx.userName} (${todayDate}).`;

  return { system, user };
}
