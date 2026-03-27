export type RequestComplexity = "lightweight" | "standard" | "deep";

/**
 * OpenRouter routing policy types for dashboard LLM calls.
 * Feature code should never embed model/provider strings directly.
 */
export type ProviderPolicy = {
  order: string[];
  allow_fallbacks: false;
  require_parameters?: boolean;
};

export type RoutedModelConfig = {
  primary: {
    model: string;
    provider: ProviderPolicy;
  };
  fallback: {
    model: string;
    provider: ProviderPolicy;
  };
  complexity: RequestComplexity;
  supportsVision?: boolean;
};

/**
 * Default dashboard model routing policy:
 * - Primary: Gemini 3 Flash Preview via Google AI Studio (confirmed live on OpenRouter 2026-03-27)
 * - Fallback: Kimi K2.5 via Chutes (confirmed live on OpenRouter 2026-03-27)
 *
 * Provider name strings are the exact values from the OpenRouter ProviderName enum —
 * do not lowercase or hyphenate them.
 */
export function getDashboardModelPolicy(complexity: RequestComplexity): RoutedModelConfig {
  return {
    complexity,
    supportsVision: true,
    primary: {
      model: "google/gemini-3-flash-preview",
      provider: {
        order: ["Google AI Studio"],
        allow_fallbacks: false,
      },
    },
    fallback: {
      model: "moonshotai/kimi-k2.5",
      provider: {
        order: ["Chutes"],
        allow_fallbacks: false,
      },
    },
  };
}
