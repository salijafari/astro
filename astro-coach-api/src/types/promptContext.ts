import type { AssembledMeaning } from "../services/astrology/meaningAssembler.js";

/**
 * Extended PromptContext injected into every LLM call.
 *
 * - Core fields (userName → recentTopics) are populated by promptAssembler.ts
 *   from cached/stored user data — fast path, always present.
 * - assembledMeaning is populated by meaningAssembler.ts from natal chart +
 *   active transits — richer, async, optional for lightweight calls.
 * - sessionSummary is the most recent ChatSessionSummary for this user,
 *   providing conversational memory across sessions.
 */
export interface PromptContext {
  // ── User identity ─────────────────────────────────────────────────────────
  userName: string;
  subscriptionTier: "free" | "premium" | "vip";
  /** App UI / preferred response language from `User.language`. */
  language: "en" | "fa";

  // ── Core astrological profile ─────────────────────────────────────────────
  sunSign: string;
  moonSign: string;
  risingSign: string;
  dominantElement: string;
  dominantModality: string;
  topPlacements: string[];       // e.g. ["Sun in Aries (1st)", "Moon in Cancer (4th)"]
  activeTransits: string[];      // human-readable transit labels, e.g. "Jupiter conjunct natal Sun"

  // ── User context ──────────────────────────────────────────────────────────
  userInterests: string[];       // from birth profile interestTags
  recentTopics: string[];        // from last 6 conversation categories

  // ── Enriched meaning layer (optional — populated by meaningAssembler) ─────
  assembledMeaning?: AssembledMeaning;

  // ── Conversational memory (optional — populated by sessionSummarizer) ─────
  sessionSummary?: SessionSummaryContext;
}

/**
 * Lightweight subset of ChatSessionSummary used in prompt context.
 * Avoids loading the full DB record into every prompt call.
 */
export interface SessionSummaryContext {
  summary: string;
  themes: string[];
  emotionalTone: string;
  openLoops: string[];           // unresolved questions / topics to continue
  sessionDate: string;           // ISO date string of the summarized session
}
