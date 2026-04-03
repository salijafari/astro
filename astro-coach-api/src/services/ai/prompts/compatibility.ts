import { withBaseStyle } from "../baseStyleGuide.js";
import type { PromptContext } from "../../../types/promptContext.js";
import { appendOutputCompliance } from "../systemPrompts.js";

export interface CompatibilityOutput {
  overallScore: number;            // 0–100
  summary: string;                 // 3–5 sentences on overall dynamic
  strengths: string[];             // 2–4 bullet items
  challenges: string[];            // 2–4 bullet items
  communicationAdvice: string;     // 2–3 sentences
  conflictStyle: string;           // 2–3 sentences on how they fight / resolve
  growthOpportunity: string;       // 1–2 sentences on what this pairing teaches
  bottomLine: string;              // 1 honest sentence — the core truth of this match
}

export interface CompatibilityChartInput {
  sunSign: string;
  moonSign: string;
  risingSign?: string;
  name?: string;
}

/**
 * Builds the compatibility analysis prompt.
 * Requires the user's natal context plus the partner's basic chart data.
 * Injects pre-computed synastry aspect strings if provided.
 */
export function buildCompatibilityPrompt(
  ctx: PromptContext,
  partner: CompatibilityChartInput,
  synastrySummary?: string[]   // pre-computed aspect labels from synastryScoringEngine
): { system: string; user: string } {
  const partnerName = partner.name ?? "your partner";
  const synastrySummaryText = synastrySummary?.length
    ? synastrySummary.slice(0, 8).join("\n- ")
    : "No synastry data provided.";

  const system = withBaseStyle(`
## FEATURE: COMPATIBILITY ANALYSIS

You are analysing the compatibility between ${ctx.userName} and ${partnerName}.

${ctx.userName.toUpperCase()}'S CHART:
- Sun: ${ctx.sunSign} | Moon: ${ctx.moonSign} | Rising: ${ctx.risingSign}
- Dominant element: ${ctx.dominantElement} | Modality: ${ctx.dominantModality}

${partnerName.toUpperCase()}'S CHART:
- Sun: ${partner.sunSign} | Moon: ${partner.moonSign} | Rising: ${partner.risingSign ?? "Unknown"}

SYNASTRY ASPECTS (pre-computed — use ONLY these, do not invent others):
- ${synastrySummaryText}

## OUTPUT FORMAT
Return ONLY valid JSON matching this exact structure — no markdown, no preamble:
{
  "overallScore": 0,
  "summary": "",
  "strengths": [],
  "challenges": [],
  "communicationAdvice": "",
  "conflictStyle": "",
  "growthOpportunity": "",
  "bottomLine": ""
}

RULES:
- overallScore is 0–100. Be honest — a 90+ score is rare and should only appear for genuinely harmonious charts.
- Strengths and challenges must each have 2–4 items.
- Never use astrology to validate toxic dynamics. If the chart shows difficult patterns, say so clearly but compassionately.
- Do NOT shame either person for their chart.
- Free tier: summary + bottomLine + overallScore only (other fields can be shorter placeholders).

${appendOutputCompliance(ctx.language)}
`.trim());

  const user = `Analyse the compatibility between ${ctx.userName} and ${partnerName}.`;

  return { system, user };
}
