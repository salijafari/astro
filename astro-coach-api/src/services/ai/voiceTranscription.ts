/**
 * Transcribes base64 audio via OpenRouter / Gemini Flash.
 * Uses the same OpenAI-SDK client as openrouterCompletion.ts.
 */

import type OpenAI from "openai";
import { getOpenRouterClient } from "../../lib/openrouterClient.js";
import { OR_PRIMARY_MODEL } from "./openrouterCompletion.js";

const ALLOWED_BASE_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/m4a",
  "audio/x-m4a",
] as const;

function normalizeMimeBase(mimeType: string): string {
  return mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isAllowedMimeType(mimeType: string): boolean {
  const base = normalizeMimeBase(mimeType);
  if (!base.startsWith("audio/")) return false;
  return ALLOWED_BASE_TYPES.some((a) => base === a || base.startsWith(a));
}

function mimeToFormat(mimeType: string): string {
  const b = normalizeMimeBase(mimeType);
  if (b.includes("webm")) return "wav";
  if (b.includes("mp4") || b.includes("m4a") || b.includes("x-m4a")) return "mp4";
  if (b.includes("mpeg") || b.includes("mp3")) return "mp3";
  if (b.includes("wav")) return "wav";
  if (b.includes("ogg")) return "ogg";
  if (b.includes("aac")) return "aac";
  return "mp4";
}

export type TranscriptionResult =
  | { ok: true; transcript: string }
  | { ok: false; error: string; status: 400 | 422 | 503 };

export async function transcribeAudio(params: {
  audioBase64: string;
  mimeType: string;
  language: "fa" | "en";
}): Promise<TranscriptionResult> {
  const { audioBase64, mimeType, language } = params;

  if (!isAllowedMimeType(mimeType)) {
    return { ok: false, error: `Unsupported audio format: ${mimeType}`, status: 400 };
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return { ok: false, error: "Voice transcription unavailable", status: 503 };
  }

  const langInstruction =
    language === "fa"
      ? "The audio is in Persian (Farsi). Transcribe it accurately in Persian script. Return ONLY the transcription with no labels, formatting, or commentary."
      : "The audio is in English. Transcribe it accurately in English. Return ONLY the transcription with no labels, formatting, or commentary.";

  const format = mimeToFormat(mimeType);

  try {
    const client = getOpenRouterClient();

    const response = (await client.chat.completions.create({
      model: OR_PRIMARY_MODEL,
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: langInstruction },
            {
              type: "input_audio" as OpenAI.Chat.ChatCompletionContentPart["type"],
              input_audio: {
                data: audioBase64,
                format,
              },
            } as OpenAI.Chat.ChatCompletionContentPart,
          ],
        },
      ],
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming)) as OpenAI.Chat.Completions.ChatCompletion;

    const transcript = response.choices?.[0]?.message?.content;

    if (typeof transcript !== "string" || !transcript.trim()) {
      return { ok: false, error: "Empty transcription result", status: 422 };
    }

    return { ok: true, transcript: transcript.trim() };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[voiceTranscription] OpenRouter error:", msg);
    return { ok: false, error: "Transcription failed", status: 503 };
  }
}
