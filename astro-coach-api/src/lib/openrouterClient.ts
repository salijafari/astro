import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

const DEFAULT_REFERER = "https://api.akhtar.today";
const DEFAULT_TITLE = "Akhtar";

/**
 * Returns a singleton OpenRouter-backed OpenAI client (server-only).
 *
 * Uses OPENROUTER_API_KEY. Attribution headers default to Akhtar production URLs;
 * override with APP_BASE_URL and APP_NAME when set.
 */
export function getOpenRouterClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      [
        "Missing OPENROUTER_API_KEY.",
        "Set it in Railway for production, and for local dev set the same env var in your local environment.",
      ].join(" "),
    );
  }

  const referer = (process.env.APP_BASE_URL ?? DEFAULT_REFERER).trim() || DEFAULT_REFERER;
  const title = (process.env.APP_NAME ?? DEFAULT_TITLE).trim() || DEFAULT_TITLE;

  cachedClient = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": referer,
      "X-OpenRouter-Title": title,
    },
  });

  return cachedClient;
}
