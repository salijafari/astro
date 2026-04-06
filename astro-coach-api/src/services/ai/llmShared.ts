import type { RequestComplexity } from "./modelRouter.js";

/**
 * Shared max-token policy for Anthropic and OpenRouter transports.
 */
export function maxTokensFor(feature: string, complexity: RequestComplexity, requested?: number): number {
  if (requested) return requested;
  const f = feature.toLowerCase();
  if (f.includes("daily_horoscope") || f.includes("daily_insight")) return 512;
  if (f.includes("tarot") || f.includes("events") || f.includes("personal_growth")) return 600;
  if (f.includes("transit_outlook")) return 512;
  if (f.includes("transit_detail")) return 500;
  if (f.includes("transit_summaries")) return 480;
  if (f.includes("ask_me_anything") || f.includes("chat_")) return 1024;
  if (complexity === "deep") return 1024;
  if (complexity === "standard") return 800;
  return 600;
}

export function safeExtractJsonObject(raw: string): unknown | undefined {
  const text = raw.replace(/```json/gi, "```").replace(/```/g, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return undefined;
  const candidate = text.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}

export function getLlmHttpStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as { status?: number; statusCode?: number; response?: { status?: number } };
  if (typeof e.status === "number") return e.status;
  if (typeof e.statusCode === "number") return e.statusCode;
  if (typeof e.response?.status === "number") return e.response.status;
  return null;
}
