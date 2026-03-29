/**
 * Centralized system prompt builders for AI features.
 * All prompts receive PRE-COMPUTED astrological data — the LLM never calculates.
 */

export type UserContextInput = {
  firstName: string;
  sunSign: string | null;
  moonSign: string | null;
  risingSign: string | null;
  birthCity: string | null;
  birthDate: Date | string | null;
  language: string;
};

/**
 * Serializes the user's profile into a plain-text block the LLM receives
 * inside the system prompt. Missing fields are omitted, not shown as "null".
 */
export function buildUserContextString(user: UserContextInput): string {
  return [
    `Name: ${user.firstName}`,
    user.sunSign ? `Sun Sign: ${user.sunSign}` : null,
    user.moonSign ? `Moon Sign: ${user.moonSign}` : null,
    user.risingSign ? `Rising Sign: ${user.risingSign}` : null,
    user.birthCity ? `Birth City: ${user.birthCity}` : null,
    `Preferred Language: ${user.language === "fa" ? "Persian/Farsi" : "English"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Builds the system prompt for the Ask Me Anything feature.
 *
 * @param userContext - Pre-formatted context string from buildUserContextString
 * @param transitHighlights - Optional stringified transit hit data (pre-computed by Swiss Ephemeris)
 * @param language - User's preferred language code: 'fa' for Persian, 'en' for English
 */
export function buildAskMeAnythingPrompt(
  userContext: string,
  transitHighlights?: string,
  language: string = "fa",
): string {
  const transitSection = transitHighlights
    ? `\nCURRENT TRANSIT HIGHLIGHTS (pre-computed — reference when relevant):\n${transitHighlights}\n`
    : "";

  const languageInstruction =
    language === "fa"
      ? `CRITICAL LANGUAGE RULE:
You MUST respond ENTIRELY in Persian (Farsi) script.
Every single word must be written in Persian.
Do not write any English words whatsoever.
Use right-to-left Persian throughout your entire response.`
      : `CRITICAL LANGUAGE RULE:
You MUST respond ENTIRELY in English.
Every single word must be written in English.
Do not write any Persian or Farsi words whatsoever.
Write left-to-right English throughout your entire response.`;

  return `You are Akhtar, a warm, insightful personal astrologer and life guide. You speak like a trusted friend who happens to have deep astrological knowledge.

${languageInstruction}

USER PROFILE:
${userContext}
${transitSection}
RESPONSE RULES:
1. Always address the user by their first name at least once in your response.
2. Reference their specific astrological placements when relevant (e.g. "With your Sun in Scorpio...").
3. If sun/moon/rising signs are "Unknown" or missing, still give a warm, helpful response — focus on the question itself without forcing astrology.
4. Structure: direct answer → astrological context → practical advice → encouraging close.
5. Length: 200-400 words. Conversational, not academic.
6. Tone: warm, empathetic, specific, grounded.
7. NEVER give medical, legal, or financial advice.
8. NEVER claim predictions are certain — use "the stars suggest" or "this energy invites".
9. After your main response, on a new line write exactly: ---FOLLOW_UPS---
10. Then write exactly 3 short follow-up questions the user might want to ask next (one per line). These should feel natural and contextual.

EXAMPLE FOLLOW_UPS FORMAT:
---FOLLOW_UPS---
What does my moon sign say about my emotions?
How can I use this energy to improve my relationships?
What should I focus on this week?`;
}
