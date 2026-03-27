import { redis } from "../../lib/redis.js";
import { prisma } from "../../lib/prisma.js";

export interface SafetyResult {
  isSafe: boolean;
  flagType: "none" | "crisis" | "medical" | "legal" | "financial" | "abuse" | "spam" | "quota_exceeded";
  safeResponse?: string;
}

// English crisis keywords
const CRISIS_RE = /(suicid|self-harm|hurt myself|end my life|overdose|kill myself)/i;
// Persian crisis keywords (خودکشی = suicide, آسیب به خود = self-harm, etc.)
const CRISIS_FA_RE = /خودکشی|آسیب به خود|به خودم آسیب|کشتن خودم/;

const ABUSE_RE = /(hitting me|hurting me|scared of my partner|threatens me)/i;
const MEDICAL_RE = /(diagnose|medication|should i take|mental illness|therapy vs)/i;
const LEGAL_RE = /(should i sue|legal advice|lawyer|illegal)/i;
const FIN_RE = /(should i invest|stock|crypto advice|financial advisor)/i;

// Canadian-primary crisis response text.
const CRISIS_RESPONSE =
  "I hear that you're going through something really difficult. " +
  "Please reach out — you deserve real human support right now. " +
  "In Canada: Crisis Services Canada 1-833-456-4566. " +
  "International: findahelpline.com";

function response(flagType: SafetyResult["flagType"]): string {
  if (flagType === "crisis") return CRISIS_RESPONSE;
  if (flagType === "abuse") return "Your safety matters. If you feel at risk, please contact local emergency services or a trusted support line.";
  if (flagType === "medical") return "I cannot provide medical advice. A licensed medical professional can help with this safely.";
  if (flagType === "legal") return "I cannot provide legal advice. Please speak with a qualified lawyer in your area.";
  if (flagType === "financial") return "I cannot provide financial advice. Please consult a licensed financial advisor.";
  return "I can't process this request safely right now.";
}

/**
 * Returns today's date as YYYY-MM-DD in UTC.
 */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Checks the daily AI feature usage quota for free-tier users.
 * Premium users skip this check entirely.
 *
 * Redis key: ai_feature_usage:{userId}:{YYYY-MM-DD}  TTL: 86400s
 * Free-tier limit: 10 requests per day.
 *
 * Returns true if the quota is exceeded, false otherwise.
 */
async function isDailyQuotaExceeded(userId: string): Promise<boolean> {
  if (!redis) return false; // No Redis → no quota enforcement (dev/CI only)

  // Check subscription tier from DB — premium users are never quota-limited.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true },
  });
  const isPremium = user?.subscriptionStatus === "premium" || user?.subscriptionStatus === "vip";
  if (isPremium) return false;

  const key = `ai_feature_usage:${userId}:${todayUtc()}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, 86_400);
  return n > 10;
}

/**
 * Classify safety risk and daily quota before LLM calls.
 *
 * Two separate rate-limit checks coexist:
 *   1. Hourly spam check  — key: req_count:{userId}:{YYYY-MM-DDTHH}  (20/hour, safety measure)
 *   2. Daily feature quota — key: ai_feature_usage:{userId}:{YYYY-MM-DD}  (10/day, free-tier gate)
 */
export async function safetyClassifier(userId: string, text: string): Promise<SafetyResult> {
  // Crisis keywords — English and Persian
  if (CRISIS_RE.test(text) || CRISIS_FA_RE.test(text)) {
    return { isSafe: false, flagType: "crisis", safeResponse: response("crisis") };
  }
  if (ABUSE_RE.test(text)) return { isSafe: false, flagType: "abuse", safeResponse: response("abuse") };
  if (MEDICAL_RE.test(text)) return { isSafe: false, flagType: "medical", safeResponse: response("medical") };
  if (LEGAL_RE.test(text)) return { isSafe: false, flagType: "legal", safeResponse: response("legal") };
  if (FIN_RE.test(text)) return { isSafe: false, flagType: "financial", safeResponse: response("financial") };

  // Hourly spam check (safety measure — unchanged)
  if (redis) {
    const key = `req_count:${userId}:${new Date().toISOString().slice(0, 13)}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 3600);
    if (n > 20) {
      return { isSafe: false, flagType: "spam", safeResponse: "You have reached the hourly request safety limit. Please try again later." };
    }
  }

  // Daily feature usage quota (free-tier gate — separate from spam check)
  if (await isDailyQuotaExceeded(userId)) {
    return {
      isSafe: false,
      flagType: "quota_exceeded",
      safeResponse: "Daily limit reached. Upgrade for unlimited access.",
    };
  }

  return { isSafe: true, flagType: "none" };
}
