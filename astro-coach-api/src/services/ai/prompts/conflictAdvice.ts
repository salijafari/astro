import { withBaseStyle } from "../baseStyleGuide.js";
import type { PromptContext } from "../../../types/promptContext.js";
import type { ConflictType } from "../../../constants/conflictFramework.js";

export interface ConflictAdviceOutput {
  conflictType: string;            // identified conflict type label
  whatIsHappening: string;         // 2–3 sentences explaining the dynamic neutrally
  yourNeeds: string;               // 2–3 sentences on what the user likely needs
  theirNeeds: string;              // 2–3 sentences on what the other person likely needs
  betterPhrase: string;            // reframed version of something the user said (if provided)
  actionableStep: string;          // 1 concrete thing to try in the next 24 hours
  astrologyLens: string;           // 2 sentences connecting conflict pattern to user's chart
  caution: string;                 // 1 sentence on what not to do
}

/**
 * Builds the conflict advice prompt.
 * Optionally injects a matching ConflictType framework entry for deeper guidance.
 */
export function buildConflictAdvicePrompt(
  ctx: PromptContext,
  situation: string,
  conflictFramework?: ConflictType | null
): { system: string; user: string } {
  const frameworkBlock = conflictFramework
    ? `CONFLICT FRAMEWORK MATCH — "${conflictFramework.label}":
- Likely dynamic: ${conflictFramework.likelyDynamic}
- User's underlying need: ${conflictFramework.whatPersonANeeds}
- Other person's underlying need: ${conflictFramework.whatPersonBMightNeed}
- De-escalation strategies: ${conflictFramework.deEscalates.slice(0, 3).join("; ")}
- Better phrasing example: ${conflictFramework.betterPhrasing[0] ?? "n/a"}
- Astrological lens: ${conflictFramework.astrologicalLens}`
    : "No conflict framework match — interpret from context.";

  const system = withBaseStyle(`
## FEATURE: CONFLICT ADVICE

You are helping ${ctx.userName} navigate a relationship conflict.

${ctx.userName.toUpperCase()}'S CHART:
- Sun: ${ctx.sunSign} | Moon: ${ctx.moonSign} | Rising: ${ctx.risingSign}
- Dominant element: ${ctx.dominantElement}
- Communication style (from chart): ${ctx.assembledMeaning?.sun?.communicationStyle ?? "not available"}

${frameworkBlock}

## CRITICAL SAFETY RULE
If the situation describes abuse, threats, coercive control, or physical danger,
DO NOT give relationship advice. Instead, respond with warmth and direct the user to professional help.

## OUTPUT FORMAT
Return ONLY valid JSON matching this exact structure — no markdown, no explanation:
{
  "conflictType": "",
  "whatIsHappening": "",
  "yourNeeds": "",
  "theirNeeds": "",
  "betterPhrase": "",
  "actionableStep": "",
  "astrologyLens": "",
  "caution": ""
}

RULES:
- Be neutral — do NOT take sides or validate the user's framing automatically.
- betterPhrase: if the user quoted themselves, reframe it. If not, offer a general opener.
- astrologyLens: tie to the user's actual Sun/Moon/Rising from the profile above only.
- Tone: compassionate, direct, non-judgmental.
`.trim());

  const user = situation;

  return { system, user };
}
