import { withBaseStyle } from "../baseStyleGuide.js";
import type { PromptContext } from "../../../types/promptContext.js";
import type { LifeChallenge } from "../../../constants/challengeLibrary.js";

export interface LifeChallengesOutput {
  challengeId: string;              // matched challenge ID
  challengeLabel: string;           // human-readable label
  howItFeelsForYou: string;         // 2–3 sentences personalised to the user's chart
  whereItShowsUp: string;           // 2–3 sentences on patterns in their life
  hiddenStrength: string;           // 1–2 sentences on the gift inside this challenge
  nextStep: string;                 // 1 concrete, doable action this week
  astrologyRoots: string;           // 2 sentences connecting challenge to their chart
  affirmation: string;              // 1 short affirmation
}

/**
 * Builds the life challenges coaching prompt.
 * Requires a matched LifeChallenge entry from the challenge library.
 */
export function buildLifeChallengesPrompt(
  ctx: PromptContext,
  challenge: LifeChallenge,
  userDescription?: string   // optional: what the user said about their challenge
): { system: string; user: string } {
  const system = withBaseStyle(`
## FEATURE: LIFE CHALLENGES COACHING

You are helping ${ctx.userName} work through a persistent life challenge.

${ctx.userName.toUpperCase()}'S CHART:
- Sun: ${ctx.sunSign} | Moon: ${ctx.moonSign} | Rising: ${ctx.risingSign}
- Dominant element: ${ctx.dominantElement} | Dominant modality: ${ctx.dominantModality}
- Emotional style: ${ctx.assembledMeaning?.sun?.emotionalStyle ?? "not available"}
- Growth edge: ${ctx.assembledMeaning?.sun?.growthEdge ?? "not available"}

CHALLENGE FRAMEWORK — "${challenge.label}":
- How it feels: ${challenge.howItFeels}
- Where it shows up: ${challenge.whereItShowsUp.join("; ")}
- Common triggers: ${challenge.triggers.join("; ")}
- Hidden strength: ${challenge.hiddenStrength}
- Astrological roots: ${challenge.astrologicalRoots}

## OUTPUT FORMAT
Return ONLY valid JSON — no markdown, no preamble:
{
  "challengeId": "${challenge.id}",
  "challengeLabel": "${challenge.label}",
  "howItFeelsForYou": "",
  "whereItShowsUp": "",
  "hiddenStrength": "",
  "nextStep": "",
  "astrologyRoots": "",
  "affirmation": ""
}

RULES:
- Personalise every field using the chart data above — do not give generic advice.
- nextStep must be specific and achievable in 7 days.
- Never pathologise the challenge — frame it as a pattern that can be worked with.
- If the user's description suggests a mental health crisis, follow safety guidelines instead.
`.trim());

  const user = userDescription
    ? `Here's what I'm experiencing: ${userDescription}`
    : `Help me understand and work through the challenge of ${challenge.label}.`;

  return { system, user };
}
