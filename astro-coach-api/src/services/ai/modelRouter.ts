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
 * - Primary: Gemini 3 Flash Preview via google-ai-studio
 * - Fallback: Kimi K2.5 via chutes/int4
 */
export function getDashboardModelPolicy(complexity: RequestComplexity): RoutedModelConfig {
  return {
    complexity,
    supportsVision: true,
    primary: {
      model: "google/gemini-3-flash-preview",
      provider: {
        order: ["google-ai-studio"],
        allow_fallbacks: false,
      },
    },
    fallback: {
      model: "moonshotai/kimi-k2.5",
      provider: {
        order: ["chutes/int4"],
        allow_fallbacks: false,
      },
    },
  };
}
