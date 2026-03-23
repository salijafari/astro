import OpenAI from "openai";

/**
 * OpenAI client for interpretation endpoints (never used for ephemeris math).
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});
