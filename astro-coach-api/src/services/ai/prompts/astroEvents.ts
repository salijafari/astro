import { withBaseStyle } from "../baseStyleGuide.js";
import type { PromptContext } from "../../../types/promptContext.js";
import type { EventRule } from "../../../constants/eventRules.js";

export interface AstroEventsOutput {
  eventTitle: string;              // e.g. "Mercury Retrograde in Virgo"
  whatThisMeans: string;           // 2–3 sentences, plain-English explanation
  howItAffectsYou: string;         // 2–3 sentences personalised to user's chart
  doThis: string;                  // 1–2 concrete actions to take
  avoidThis: string;               // 1–2 things to be careful about
  duration: string;                // how long this event lasts
  intensity: "low" | "medium" | "high";  // relative impact on this user's chart
}

/**
 * Builds the astrological events explanation prompt.
 * Requires a matched EventRule plus optional personalisation context.
 */
export function buildAstroEventsPrompt(
  ctx: PromptContext,
  event: EventRule,
  personalTransitNote?: string   // any transit directly connecting this event to user's natal chart
): { system: string; user: string } {
  const system = withBaseStyle(`
## FEATURE: ASTROLOGICAL EVENTS

You are explaining an upcoming or current astrological event to ${ctx.userName}.

${ctx.userName.toUpperCase()}'S CHART:
- Sun: ${ctx.sunSign} | Moon: ${ctx.moonSign} | Rising: ${ctx.risingSign}
- Dominant element: ${ctx.dominantElement}
- Interests: ${ctx.userInterests.slice(0, 4).join(", ")}

ASTROLOGICAL EVENT:
- Title: ${event.titlePattern}
- Category: ${event.category}
- Plain meaning: ${event.plainEnglishMeaning}
- Significance: ${event.significanceBase}
- Suggested action: ${event.suggestedActionStyle}
- Caution: ${event.cautionNote}
- Duration: ${event.durationNote}
${personalTransitNote ? `\nPERSONAL TRANSIT CONNECTION: ${personalTransitNote}` : ""}

## OUTPUT FORMAT
Return ONLY valid JSON — no markdown, no preamble:
{
  "eventTitle": "",
  "whatThisMeans": "",
  "howItAffectsYou": "",
  "doThis": "",
  "avoidThis": "",
  "duration": "",
  "intensity": "medium"
}

RULES:
- whatThisMeans: assume the user has no astrology knowledge — explain in plain English first.
- howItAffectsYou: personalise to the user's chart — if there's a direct transit connection, lead with that.
- intensity: set "high" only if there is a direct transit to a personal planet. Default to "medium" for background events.
- Avoid doom-and-gloom framing. Astrological events are not catastrophes.
`.trim());

  const user = `Tell me about: ${event.titlePattern}`;

  return { system, user };
}
