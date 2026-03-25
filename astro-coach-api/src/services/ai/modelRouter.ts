export type RequestComplexity = "lightweight" | "standard" | "deep";
export type AnthropicModel = "claude-haiku-4-5-20251001" | "claude-sonnet-4-20250514";

/**
 * Deterministic model routing by complexity.
 */
export function routeModel(complexity: RequestComplexity): AnthropicModel {
  if (complexity === "lightweight") return "claude-haiku-4-5-20251001";
  if (complexity === "standard") return "claude-sonnet-4-20250514";
  return "claude-sonnet-4-20250514";
}
