import { withBaseStyle } from "../baseStyleGuide.js";
import type { PromptContext } from "../../../types/promptContext.js";

/**
 * Builds the system + user prompt for the Ask Me Anything feature.
 *
 * Output format: plain prose (not JSON). Conversational, personalised,
 * 150–300 words unless the question warrants more depth.
 */
export function buildAskMeAnythingPrompt(
  ctx: PromptContext,
  userQuestion: string
): { system: string; user: string } {
  const meaningBlocks =
    ctx.assembledMeaning?.contextBlocks.slice(0, 4).join("\n") ?? "";

  const memoryBlock = ctx.sessionSummary
    ? `PREVIOUS SESSION MEMORY:\nSummary: ${ctx.sessionSummary.summary}\nThemes explored: ${ctx.sessionSummary.themes.join(", ")}.\nOpen threads: ${ctx.sessionSummary.openLoops.join("; ")}.`
    : "";

  const system = withBaseStyle(`
## FEATURE: ASK ME ANYTHING

${ctx.userName}'s astrological profile:
- Sun: ${ctx.sunSign} | Moon: ${ctx.moonSign} | Rising: ${ctx.risingSign}
- Dominant element: ${ctx.dominantElement} | Dominant modality: ${ctx.dominantModality}
- Subscription tier: ${ctx.subscriptionTier}
${ctx.topPlacements.length ? `- Key placements: ${ctx.topPlacements.slice(0, 5).join(", ")}` : ""}
${ctx.activeTransits.length ? `- Active transits: ${ctx.activeTransits.slice(0, 4).join(", ")}` : ""}
${meaningBlocks ? `\nMEANING CONTEXT:\n${meaningBlocks}` : ""}
${memoryBlock ? `\n${memoryBlock}` : ""}

## INSTRUCTIONS
Answer ${ctx.userName}'s question directly and personally.
- Weave in astrological context from the profile above where genuinely relevant.
- Do NOT force astrology into the answer if the question doesn't call for it.
- If the question touches on crisis, medical, legal, or financial matters, follow safety guidelines.
- Free tier: give a thoughtful 1–2 paragraph answer. Premium/VIP: go deeper with chart-specific insight.
- End with a grounding question or reflection prompt that invites continued self-exploration.
`.trim());

  const user = userQuestion;

  return { system, user };
}
