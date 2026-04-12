import type { TarotReadingResult } from "@/types/tarot";

/** Short-lived handoff from draw screen → reading screen (too large for route params). */
export const tarotReadingCache: { pending: TarotReadingResult | null } = { pending: null };
