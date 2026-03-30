/**
 * Maps conversation category strings (stored in Conversation.category) to
 * display metadata used by the history list and detail screens.
 *
 * labelKey → pass to t() at render time so language switching works.
 * icon     → Ionicons name from @expo/vector-icons.
 * color    → accent hex; use with opacity variants for backgrounds.
 */

export type FeatureConfig = {
  labelKey: string;
  icon: string;
  color: string;
};

const CONFIG: Record<string, FeatureConfig> = {
  ask_me_anything:        { labelKey: "features.askAnything",          icon: "chatbubble-ellipses", color: "#8b8cff" },
  dream_interpreter:      { labelKey: "features.dreamInterpreter",     icon: "moon",                color: "#68d5ff" },
  coffee_reading:         { labelKey: "features.coffeeReading",        icon: "cafe",                color: "#c4a882" },
  romantic_compatibility: { labelKey: "features.romanticCompatibility", icon: "heart",              color: "#ff6b8a" },
  tarot:                  { labelKey: "features.tarotInterpreter",     icon: "sparkles",            color: "#b07fff" },
  conflict_advice:        { labelKey: "features.conflictAdvice",       icon: "shield-half",         color: "#fbbf24" },
  life_challenges:        { labelKey: "features.lifeChallenges",       icon: "trending-up",         color: "#34d399" },
};

/**
 * Returns display config for a conversation category.
 * Falls back to the Ask Me Anything config for unknown categories.
 */
export const getFeatureConfig = (category: string): FeatureConfig =>
  CONFIG[category] ?? { labelKey: "features.askAnything", icon: "chatbubble", color: "#8b8cff" };
