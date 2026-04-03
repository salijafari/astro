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
/**
 * Forceful output-language rule — append as the **last** segment of every system prompt.
 */
export function finalCriticalLanguageBlock(language: string): string {
  return language === "fa"
    ? `CRITICAL LANGUAGE RULE — NON-NEGOTIABLE:
You MUST write your ENTIRE response in Persian (Farsi).
Every single word must be in Persian script.
Do NOT write any English words.
Do NOT mix Persian and English.
Do NOT use any Latin characters.
If you write even one English word, the response fails.`
    : `CRITICAL LANGUAGE RULE — NON-NEGOTIABLE:
You MUST write your ENTIRE response in English.
Every single word must be in English.
Do NOT write any Persian or Farsi words.
Do NOT mix languages.`;
}

export function buildAskMeAnythingPrompt(
  userContext: string,
  transitHighlights?: string,
  language: string = "fa",
): string {
  const transitSection = transitHighlights
    ? `\nCURRENT TRANSIT HIGHLIGHTS (pre-computed — reference when relevant):\n${transitHighlights}\n`
    : "";

  return `You are Akhtar, a warm, insightful personal astrologer and life guide. You speak like a trusted friend who happens to have deep astrological knowledge.

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
What should I focus on this week?

${finalCriticalLanguageBlock(language)}`;
}

/**
 * Same as {@link finalCriticalLanguageBlock} — kept for existing imports (transit summaries in app.ts).
 */
export function transitCriticalLanguageInstruction(language: string): string {
  return finalCriticalLanguageBlock(language);
}

/* ─── Transit prompt types ─── */

type TransitForPrompt = {
  transitingBody: string;
  natalTargetBody: string | null;
  aspectType: string | null;
  significanceScore: number;
  themeTags: string[];
  emotionalTone: string | null;
  practicalExpression: string | null;
};

type TransitOutlookInput = {
  userName: string;
  sunSign: string;
  moonSign: string;
  risingSign: string | null;
  topTransits: TransitForPrompt[];
  language: string;
};

type TransitDetailInput = {
  userName: string;
  sunSign: string;
  moonSign: string;
  risingSign: string | null;
  transit: TransitForPrompt;
  language: string;
};

/**
 * Builds system + user prompt pair for the daily transit outlook.
 * The LLM receives pre-computed transit data and produces a title,
 * body text, and mood label — it NEVER calculates positions.
 */
export function buildTransitOutlookPrompt(ctx: TransitOutlookInput): {
  system: string;
  user: string;
} {
  const lang =
    ctx.language === "fa"
      ? "Persian (Farsi). Every word in Persian script, right-to-left."
      : "English. Every word in English, left-to-right.";

  const moodExamples =
    ctx.language === "fa"
      ? "مثال: متأمل، پرانرژی، کشش ملایم"
      : "e.g. Reflective, Energized, Gentle Tension";

  const system = `You are Akhtar, a warm and insightful personal astrologer.
You receive PRE-COMPUTED transit data. You NEVER calculate planetary positions or aspects — all astrological data is already computed.
Your job is to interpret this data into a short, meaningful daily outlook.

LANGUAGE: Respond ENTIRELY in ${lang}

OUTPUT FORMAT — respond with ONLY a valid JSON object, no markdown fences:
{
  "title": "A short evocative title (4-8 words)",
  "text": "A warm 2-3 sentence personal outlook for ${ctx.userName} (50-100 words). Reference specific transits naturally without jargon. Mention their name once.",
  "moodLabel": "One or two words describing the day's energy (${moodExamples})"
}

RULES:
- Do NOT invent transits or positions not in the data below.
- Do NOT give medical, legal, or financial advice.
- Use "the stars suggest" or "this energy invites" — never certainties.
- Keep it personal, grounded, and encouraging.

${finalCriticalLanguageBlock(ctx.language)}`;

  const transitLines = ctx.topTransits.map((t, i) => {
    const parts = [
      `Transit ${i + 1}: ${t.transitingBody} ${t.aspectType ?? "influence"} natal ${t.natalTargetBody ?? "chart"}`,
      `  Score: ${t.significanceScore}`,
      t.themeTags.length > 0 ? `  Themes: ${t.themeTags.join(", ")}` : null,
      t.emotionalTone ? `  Emotional tone: ${t.emotionalTone}` : null,
      t.practicalExpression ? `  Practical: ${t.practicalExpression}` : null,
    ];
    return parts.filter(Boolean).join("\n");
  }).join("\n\n");

  const user = `USER: ${ctx.userName}
Sun: ${ctx.sunSign} | Moon: ${ctx.moonSign}${ctx.risingSign ? ` | Rising: ${ctx.risingSign}` : ""}

ACTIVE TRANSITS (pre-computed):
${transitLines}

Generate the daily outlook JSON.`;

  return { system, user };
}

/**
 * Builds system + user prompt pair for a single transit's detailed interpretation.
 * The LLM NEVER calculates — only interprets the pre-computed transit.
 */
export function buildTransitDetailPrompt(ctx: TransitDetailInput): {
  system: string;
  user: string;
} {
  const lang =
    ctx.language === "fa"
      ? "Persian (Farsi). Every word in Persian script, right-to-left."
      : "English. Every word in English, left-to-right.";

  const t = ctx.transit;

  const system = `You are Akhtar, a warm and insightful personal astrologer.
You receive ONE pre-computed transit event. Interpret it deeply and personally for the user.
You NEVER calculate planetary positions or aspects — all data is pre-computed.

LANGUAGE: Respond ENTIRELY in ${lang}

OUTPUT FORMAT — respond with ONLY a valid JSON object, no markdown fences:
{
  "subtitle": "A concise astrological label (e.g. 'Saturn square natal Moon')",
  "whyThisIsHappening": "1-2 sentences explaining the cosmic mechanics in plain language",
  "whyItMattersForYou": "2-3 sentences making it personal to ${ctx.userName}'s chart. Reference their Sun/Moon/Rising when relevant.",
  "leanInto": ["3 short actionable suggestions, one sentence each"],
  "beMindfulOf": ["2-3 short cautions or things to watch for"]
}

RULES:
- Do NOT invent data not provided below.
- Do NOT give medical, legal, or financial advice.
- Keep it warm, specific, and grounded.
- Use "the stars suggest" language, never certainties.

${finalCriticalLanguageBlock(ctx.language)}`;

  const user = `USER: ${ctx.userName}
Sun: ${ctx.sunSign} | Moon: ${ctx.moonSign}${ctx.risingSign ? ` | Rising: ${ctx.risingSign}` : ""}

TRANSIT EVENT (pre-computed):
Body: ${t.transitingBody} ${t.aspectType ?? "influencing"} natal ${t.natalTargetBody ?? "chart"}
Significance: ${t.significanceScore}
Themes: ${t.themeTags.join(", ") || "general energy"}
${t.emotionalTone ? `Emotional tone: ${t.emotionalTone}` : ""}
${t.practicalExpression ? `Practical expression: ${t.practicalExpression}` : ""}

Generate the detailed interpretation JSON.`;

  return { system, user };
}
