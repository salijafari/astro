import { withBaseStyle } from "../baseStyleGuide.js";
import type { PromptContext } from "../../../types/promptContext.js";

export interface PersonalGrowthOutput {
  focusArea: string;               // e.g. "emotional intelligence", "boundaries", "self-trust"
  currentPattern: string;          // 2–3 sentences on the pattern showing up now (chart + transit)
  growthEdge: string;              // 2–3 sentences on the next developmental step
  practicalPractice: string;       // 1–2 concrete practices for the week
  astrologySupport: string;        // 2 sentences on how current transits support this growth
  journalPrompt: string;           // 1 reflective journaling question
  affirmation: string;             // 1 short affirmation
}

/**
 * Builds the personal growth coaching prompt.
 * Draws heavily from assembled meaning context blocks.
 */
export function buildPersonalGrowthPrompt(
  ctx: PromptContext,
  userIntent?: string   // optional: what the user wants to work on
): { system: string; user: string } {
  const meaningBlocks =
    ctx.assembledMeaning?.contextBlocks.slice(0, 5).join("\n") ?? "";

  const transitHighlights = ctx.activeTransits.slice(0, 3).join(", ");

  const memoryBlock = ctx.sessionSummary
    ? `PREVIOUS SESSION:\nThemes: ${ctx.sessionSummary.themes.join(", ")}.\nOpen threads: ${ctx.sessionSummary.openLoops.join("; ")}.`
    : "";

  const system = withBaseStyle(`
## FEATURE: PERSONAL GROWTH COACHING

You are a personal growth coach helping ${ctx.userName} develop through their astrological lens.

${ctx.userName.toUpperCase()}'S PROFILE:
- Sun: ${ctx.sunSign} | Moon: ${ctx.moonSign} | Rising: ${ctx.risingSign}
- Dominant element: ${ctx.dominantElement} | Dominant modality: ${ctx.dominantModality}
- Growth edge (Sun): ${ctx.assembledMeaning?.sun?.growthEdge ?? "not available"}
- Growth edge (Moon): ${ctx.assembledMeaning?.moon?.growthEdge ?? "not available"}
- Active transits: ${transitHighlights || "none"}
${meaningBlocks ? `\nDETAILED CHART CONTEXT:\n${meaningBlocks}` : ""}
${memoryBlock ? `\n${memoryBlock}` : ""}

## OUTPUT FORMAT
Return ONLY valid JSON — no markdown, no preamble:
{
  "focusArea": "",
  "currentPattern": "",
  "growthEdge": "",
  "practicalPractice": "",
  "astrologySupport": "",
  "journalPrompt": "",
  "affirmation": ""
}

RULES:
- Base focusArea on what the chart and transits genuinely suggest — not just what sounds good.
- practicalPractice: 1–2 real-world micro-actions (not "meditate more" — be specific).
- journalPrompt: open-ended, non-leading, invites self-reflection.
- If resuming a previous session, build on the open threads from memory.
`.trim());

  const user = userIntent
    ? `I want to work on: ${userIntent}`
    : `What's my most important area for personal growth right now?`;

  return { system, user };
}
