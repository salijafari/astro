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
 * - Primary: Gemini 2.5 Flash via Google AI Studio (fast, cheap, confirmed on OpenRouter)
 * - Fallback: GPT-4o Mini via OpenAI (reliable fallback for any Google outage)
 */
export function getDashboardModelPolicy(complexity: RequestComplexity): RoutedModelConfig {
  return {
    complexity,
    supportsVision: true,
    primary: {
      model: "google/gemini-2.5-flash",
      provider: {
        order: ["Google AI Studio"],
        allow_fallbacks: false,
      },
    },
    fallback: {
      model: "openai/gpt-4o-mini",
      provider: {
        order: ["OpenAI"],
        allow_fallbacks: false,
      },
    },
  };
}
