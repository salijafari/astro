import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

/**
 * Returns a singleton OpenRouter-backed OpenAI client (server-only).
 *
 * Uses OPENROUTER_API_KEY from environment and OpenRouter's unified API.
 */
export function getOpenRouterClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      [
        "Missing OPENROUTER_API_KEY.",
        "Set it in Railway for production, and for local dev set the same env var in your local environment.",
      ].join(" ")
    );
  }

  const defaultHeaders: Record<string, string> = {};
  const referer = process.env.APP_BASE_URL;
  const title = process.env.APP_NAME;
  if (referer) defaultHeaders["HTTP-Referer"] = referer;
  if (title) defaultHeaders["X-OpenRouter-Title"] = title;

  cachedClient = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: Object.keys(defaultHeaders).length ? defaultHeaders : undefined,
  });

  return cachedClient;
}

