import { redis } from "../../lib/redis.js";

export interface SafetyResult {
  isSafe: boolean;
  flagType: "none" | "crisis" | "medical" | "legal" | "financial" | "abuse" | "spam";
  safeResponse?: string;
}

const CRISIS_RE = /(suicid|self-harm|hurt myself|end my life|overdose|kill myself)/i;
const ABUSE_RE = /(hitting me|hurting me|scared of my partner|threatens me)/i;
const MEDICAL_RE = /(diagnose|medication|should i take|mental illness|therapy vs)/i;
const LEGAL_RE = /(should i sue|legal advice|lawyer|illegal)/i;
const FIN_RE = /(should i invest|stock|crypto advice|financial advisor)/i;

function response(flagType: SafetyResult["flagType"]): string {
  if (flagType === "crisis") return "I care about your safety. If you may hurt yourself, please contact emergency support now (US/Canada: 988).";
  if (flagType === "abuse") return "Your safety matters. If you feel at risk, please contact local emergency services or a trusted support line.";
  if (flagType === "medical") return "I cannot provide medical advice. A licensed medical professional can help with this safely.";
  if (flagType === "legal") return "I cannot provide legal advice. Please speak with a qualified lawyer in your area.";
  if (flagType === "financial") return "I cannot provide financial advice. Please consult a licensed financial advisor.";
  return "I can't process this request safely right now.";
}

/**
 * Classify safety risk before LLM calls.
 */
export async function safetyClassifier(userId: string, text: string): Promise<SafetyResult> {
  if (CRISIS_RE.test(text)) return { isSafe: false, flagType: "crisis", safeResponse: response("crisis") };
  if (ABUSE_RE.test(text)) return { isSafe: false, flagType: "abuse", safeResponse: response("abuse") };
  if (MEDICAL_RE.test(text)) return { isSafe: false, flagType: "medical", safeResponse: response("medical") };
  if (LEGAL_RE.test(text)) return { isSafe: false, flagType: "legal", safeResponse: response("legal") };
  if (FIN_RE.test(text)) return { isSafe: false, flagType: "financial", safeResponse: response("financial") };

  if (redis) {
    const key = `req_count:${userId}:${new Date().toISOString().slice(0, 13)}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 3600);
    if (n > 20) {
      return { isSafe: false, flagType: "spam", safeResponse: "You have reached the hourly request safety limit. Please try again later." };
    }
  }

  return { isSafe: true, flagType: "none" };
}
