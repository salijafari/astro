import { withBaseStyle } from "../baseStyleGuide.js";
import type { PromptContext } from "../../../types/promptContext.js";

export interface FutureSeerOutput {
  timeframe: string;               // e.g. "next 3 months", "this year"
  overarchingTheme: string;        // 2–3 sentences — the big picture energy
  opportunities: string[];         // 2–4 specific opportunities suggested by transits
  challenges: string[];            // 2–4 things to be mindful of
  bestTimeFor: string;             // 2–3 sentences — optimal timing suggestion
  caution: string;                 // 1–2 sentences — honest caveat about predictions
  focusQuestion: string;           // 1 reflective question to help user engage actively
}

/**
 * Builds the Future Seer (transit forecast) prompt.
 * Based entirely on active/upcoming transits — NEVER invents astrological data.
 *
 * IMPORTANT: This feature must carry a prominent disclaimer in the UI.
 * The LLM frames possibilities only, not certainties.
 */
export function buildFutureSeerPrompt(
  ctx: PromptContext,
  timeframe: string,
  upcomingTransits?: string[]   // pre-computed list of transits in the requested window
): { system: string; user: string } {
  const transitList = upcomingTransits?.length
    ? upcomingTransits.slice(0, 10).join("\n- ")
    : ctx.activeTransits.slice(0, 6).join("\n- ");

  const meaningBlocks =
    ctx.assembledMeaning?.transitSummaries
      .slice(0, 4)
      .map((t) => `${t.label}: ${t.themes.join(", ")} — ${t.practicalExpression}`)
      .join("\n") ?? "";

  const system = withBaseStyle(`
## FEATURE: FUTURE SEER (TRANSIT FORECAST)

You are generating a transit-based outlook for ${ctx.userName} for the timeframe: ${timeframe}.

${ctx.userName.toUpperCase()}'S CHART:
- Sun: ${ctx.sunSign} | Moon: ${ctx.moonSign} | Rising: ${ctx.risingSign}
- Dominant element: ${ctx.dominantElement} | Dominant modality: ${ctx.dominantModality}
- Subscription: ${ctx.subscriptionTier}

UPCOMING / ACTIVE TRANSITS (interpret ONLY these — never invent transits):
- ${transitList}
${meaningBlocks ? `\nTRANSIT MEANING CONTEXT:\n${meaningBlocks}` : ""}

## OUTPUT FORMAT
Return ONLY valid JSON — no markdown, no preamble:
{
  "timeframe": "${timeframe}",
  "overarchingTheme": "",
  "opportunities": [],
  "challenges": [],
  "bestTimeFor": "",
  "caution": "",
  "focusQuestion": ""
}

RULES:
- Base ALL interpretations on the transit data provided. If no transits are listed, say so clearly.
- NEVER make absolute predictions ("You will get the job"). Use possibility language ("This transit often supports…", "You may find…").
- opportunities and challenges: 2–4 items each.
- caution: include an honest reminder that transits show themes, not outcomes — free will shapes results.
- Free tier: overarchingTheme + caution + focusQuestion only (shorter for other fields).
- VIP: full detailed output with deeper transit interpretations.
`.trim());

  const user = `What does the ${timeframe} look like for me?`;

  return { system, user };
}
