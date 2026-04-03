import Anthropic, { APIUserAbortError } from "@anthropic-ai/sdk";
import type { SafetyResult } from "./safetyClassifier.js";
import { safetyClassifier } from "./safetyClassifier.js";
import type { RequestComplexity } from "./modelRouter.js";

export type GenerateCompletionResponseFormat = { type: "json_object" };

export type GenerateCompletionSuccess = {
  ok: true;
  kind: "success";
  content: string;
  json?: unknown;
  model: string;
  provider: "anthropic";
  latencyMs: number;
  attemptedProviderOrder?: string[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export type GenerateCompletionUnsafe = {
  ok: false;
  kind: "unsafe";
  flagType: SafetyResult["flagType"];
  safeResponse?: string;
};

export type GenerateCompletionError = {
  ok: false;
  kind: "error";
  errorType: "timeout" | "rate_limited" | "provider_error" | "unknown";
  message: string;
  latencyMs: number;
};

export type GenerateCompletionResult =
  | GenerateCompletionSuccess
  | GenerateCompletionUnsafe
  | GenerateCompletionError;

export type SafetyCheckInput =
  | {
      mode: "check";
      userId: string;
      /**
       * Text used only for regex-based safety classification (no logging should include this text).
       */
      text: string;
    }
  | { mode: "result"; result: SafetyResult };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatusCode(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as { status?: number; statusCode?: number; response?: { status?: number } };
  if (typeof e.status === "number") return e.status;
  if (typeof e.statusCode === "number") return e.statusCode;
  if (typeof e.response?.status === "number") return e.response.status;
  return null;
}

function isRetryableError(err: unknown): boolean {
  const s = getStatusCode(err);
  if (s === 429) return true;
  if (typeof s === "number" && s >= 500) return true;
  return false;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout_after_${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function safeExtractJsonObject(raw: string): unknown | undefined {
  const text = raw.replace(/```json/gi, "```").replace(/```/g, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return undefined;
  const candidate = text.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SONNET_MODEL = "claude-sonnet-4-6";

/**
 * Resolves the Anthropic model id for logging and streaming (server-only).
 */
export function getAnthropicModelForFeature(
  feature: string,
  complexity: RequestComplexity,
  hasVision: boolean,
): string {
  return modelFor(feature, complexity, hasVision);
}

function modelFor(feature: string, complexity: RequestComplexity, hasVision: boolean): string {
  const f = feature.toLowerCase();
  if (hasVision || f.includes("coffee")) return SONNET_MODEL;
  if (
    f.includes("ask_me_anything") ||
    f.includes("chat_") ||
    f.includes("compatibility") ||
    f.includes("conflict") ||
    f.includes("life_challenges") ||
    f.includes("future")
  ) {
    return SONNET_MODEL;
  }
  if (
    f.includes("daily_horoscope") ||
    f.includes("daily_insight") ||
    f.includes("astrological_events") ||
    f.includes("tarot") ||
    f.includes("personal_growth") ||
    f.includes("transit_summaries")
  ) {
    return HAIKU_MODEL;
  }
  return complexity === "deep" ? SONNET_MODEL : HAIKU_MODEL;
}

function maxTokensFor(feature: string, complexity: RequestComplexity, requested?: number): number {
  if (requested) return requested;
  const f = feature.toLowerCase();
  if (f.includes("daily_horoscope") || f.includes("daily_insight")) return 512;
  if (f.includes("tarot") || f.includes("events") || f.includes("personal_growth")) return 600;
  if (f.includes("transit_outlook")) return 512;
  if (f.includes("transit_detail")) return 500;
  if (f.includes("transit_summaries")) return 480;
  if (f.includes("ask_me_anything") || f.includes("chat_")) return 1024;
  if (complexity === "deep") return 1024;
  if (complexity === "standard") return 800;
  return 600;
}

export type ImageInput = {
  type: "base64" | "url";
  /** Base64-encoded image data (without the data URI prefix) or a public URL. */
  data: string;
  mimeType?: string;
};

type AnthropicImagePayload = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
};

async function toAnthropicImagePayload(input: ImageInput): Promise<AnthropicImagePayload | null> {
  if (input.type === "base64") {
    const mediaType = (input.mimeType ?? "image/jpeg") as AnthropicImagePayload["mediaType"];
    return { base64: input.data, mediaType };
  }

  try {
    const res = await fetch(input.data);
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0] as AnthropicImagePayload["mediaType"];
    const buf = Buffer.from(await res.arrayBuffer());
    return { base64: buf.toString("base64"), mediaType: contentType };
  } catch {
    return null;
  }
}

async function buildAnthropicMessages(
  messages: Array<{ role: string; content: string }>,
  imageInputs?: ImageInput[]
): Promise<Array<Anthropic.MessageParam>> {
  const converted: Array<Anthropic.MessageParam> = [];

  let lastUserIndex = -1;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]?.role === "user") lastUserIndex = i;
  }

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!message) continue;
    const role = message.role === "assistant" ? "assistant" : "user";

    if (i === lastUserIndex && imageInputs && imageInputs.length > 0) {
      const content: Anthropic.ContentBlockParam[] = [];
      for (const imageInput of imageInputs) {
        const img = await toAnthropicImagePayload(imageInput);
        if (!img) continue;
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mediaType,
            data: img.base64,
          },
        });
      }
      content.push({ type: "text", text: message.content });
      converted.push({ role, content });
    } else {
      converted.push({ role, content: message.content });
    }
  }

  return converted;
}

function extractText(response: Anthropic.Messages.Message): string {
  return response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter((s) => s.length > 0)
    .join("\n")
    .trim();
}

/**
 * Generates a chat completion via Anthropic Claude, with safety checks and retries.
 *
 * Exported for server-side usage only; never import this module in the frontend.
 */
export async function generateCompletion(args: {
  feature: string;
  complexity: RequestComplexity;
  messages: Array<any>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: GenerateCompletionResponseFormat;
  safety?: SafetyCheckInput;
  timeoutMs?: number;
  maxRetries?: number;
  /**
   * Optional image inputs for multimodal requests (e.g. Coffee Reading vision step).
   * When provided, the content of the LAST user message is replaced with a
   * multimodal array: [image blocks..., text block].
   */
  imageInputs?: ImageInput[];
}): Promise<GenerateCompletionResult> {
  const startMs = Date.now();
  const provider: GenerateCompletionSuccess["provider"] = "anthropic";

  const timeoutMs = args.timeoutMs ?? 25_000;
  /** maxRetries === 0 → single attempt (no retry). Default remains up to 2 attempts. */
  const maxAttempts = args.maxRetries === 0 ? 1 : Math.min(args.maxRetries ?? 1, 1) + 1;
  const model = modelFor(args.feature, args.complexity, !!args.imageInputs?.length);
  const maxTokens = maxTokensFor(args.feature, args.complexity, args.maxTokens);

  let safetyResult: SafetyResult | undefined;
  if (args.safety) {
    if (args.safety.mode === "result") safetyResult = args.safety.result;
    if (args.safety.mode === "check") {
      safetyResult = await safetyClassifier(args.safety.userId, args.safety.text);
    }

    if (safetyResult && !safetyResult.isSafe) {
      console.log(
        JSON.stringify({
          event: "ai.safety.unsafe",
          feature: args.feature,
          complexity: args.complexity,
          model,
          flagType: safetyResult.flagType,
        })
      );
      return {
        ok: false,
        kind: "unsafe",
        flagType: safetyResult.flagType,
        safeResponse: safetyResult.safeResponse,
      };
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      kind: "error",
      errorType: "unknown",
      message: "Missing ANTHROPIC_API_KEY",
      latencyMs: Date.now() - startMs,
    };
  }

  const systemPrompt =
    args.messages[0]?.role === "system" && typeof args.messages[0]?.content === "string"
      ? args.messages[0].content
      : undefined;
  const contentMessages = args.messages[0]?.role === "system" ? args.messages.slice(1) : args.messages;

  if (!contentMessages.length || contentMessages[contentMessages.length - 1]?.role !== "user") {
    return {
      ok: false,
      kind: "error",
      errorType: "unknown",
      message: "Messages array must contain at least one user message and end with role=user",
      latencyMs: Date.now() - startMs,
    };
  }

  const anthropicMessages = await buildAnthropicMessages(contentMessages, args.imageInputs);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Claude] calling model: ${model} for feature: ${args.feature}`);

      const response = await withTimeout(
        anthropic.messages.create({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: anthropicMessages,
          temperature: args.temperature,
        }),
        timeoutMs
      );

      const content = extractText(response);
      const usage = response.usage;
      const latencyMs = Date.now() - startMs;
      const wantsJson = args.responseFormat?.type === "json_object";
      const json = wantsJson ? safeExtractJsonObject(content) : undefined;

      const usable =
        content.trim().length > 0 &&
        (!wantsJson || (typeof json === "object" && json !== null && !Array.isArray(json)));

      console.log(`[Claude] success - tokens used: ${(usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0)}`);
      console.log(
        JSON.stringify({
          event: "ai.complete",
          feature: args.feature,
          complexity: args.complexity,
          model,
          latencyMs,
          provider,
          usage: usage
            ? {
                prompt_tokens: usage.input_tokens,
                completion_tokens: usage.output_tokens,
                total_tokens: usage.input_tokens + usage.output_tokens,
              }
            : undefined,
          attempt,
        })
      );

      if (!usable) {
        return {
          ok: false,
          kind: "error",
          errorType: "unknown",
          message: "Model returned unusable output",
          latencyMs,
        };
      }

      return {
        ok: true,
        kind: "success",
        content,
        json,
        model,
        provider,
        latencyMs,
        usage: usage
          ? {
              prompt_tokens: usage.input_tokens,
              completion_tokens: usage.output_tokens,
              total_tokens: usage.input_tokens + usage.output_tokens,
            }
          : undefined,
      };
    } catch (err: unknown) {
      const status = getStatusCode(err);
      const isTimeout = err instanceof Error && err.message.includes("timeout_after_");
      const retryable = isRetryableError(err);

      console.error(`[Claude] attempt ${attempt} failed:`, {
        message: err instanceof Error ? err.message : "unknown_error",
        status,
        feature: args.feature,
        model,
      });

      if (!retryable || attempt >= maxAttempts) {
        return {
          ok: false,
          kind: "error",
          errorType: isTimeout
            ? "timeout"
            : status === 429
              ? "rate_limited"
              : status && status >= 500
                ? "provider_error"
                : "unknown",
          message: err instanceof Error ? err.message : "unknown_error",
          latencyMs: Date.now() - startMs,
        };
      }

      await sleep(status === 429 ? 2000 : 1000);
    }
  }

  return {
    ok: false,
    kind: "error",
    errorType: "unknown",
    message: "Claude API failed unexpectedly",
    latencyMs: Date.now() - startMs,
  };
}

/**
 * Streams chat text deltas from Anthropic (SSE consumers receive incremental `onToken` calls).
 * Uses the Messages streaming API; `maxRetries` is ignored (single stream, no retry).
 */
export async function streamChatCompletion(args: {
  feature: string;
  complexity: RequestComplexity;
  messages: Array<any>;
  temperature?: number;
  safety?: SafetyCheckInput;
  timeoutMs?: number;
  maxRetries?: number;
  maxTokens?: number;
  onToken: (token: string) => Promise<void> | void;
}): Promise<
  | (GenerateCompletionSuccess & { kind: "success" })
  | GenerateCompletionUnsafe
  | (GenerateCompletionError & { kind: "error" })
> {
  const startMs = Date.now();
  const timeoutMs = args.timeoutMs ?? 60_000;
  const model = modelFor(args.feature, args.complexity, false);
  const provider: GenerateCompletionSuccess["provider"] = "anthropic";
  const maxTokens = maxTokensFor(args.feature, args.complexity, args.maxTokens);

  let safetyResult: SafetyResult | undefined;
  if (args.safety) {
    if (args.safety.mode === "result") safetyResult = args.safety.result;
    if (args.safety.mode === "check") {
      safetyResult = await safetyClassifier(args.safety.userId, args.safety.text);
    }

    if (safetyResult && !safetyResult.isSafe) {
      return {
        ok: false,
        kind: "unsafe",
        flagType: safetyResult.flagType,
        safeResponse: safetyResult.safeResponse,
      };
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      kind: "error",
      errorType: "unknown",
      message: "Missing ANTHROPIC_API_KEY",
      latencyMs: Date.now() - startMs,
    };
  }

  const systemPrompt =
    args.messages[0]?.role === "system" && typeof args.messages[0]?.content === "string"
      ? args.messages[0].content
      : undefined;
  const contentMessages = args.messages[0]?.role === "system" ? args.messages.slice(1) : args.messages;

  if (!contentMessages.length || contentMessages[contentMessages.length - 1]?.role !== "user") {
    return {
      ok: false,
      kind: "error",
      errorType: "unknown",
      message: "Messages array must contain at least one user message and end with role=user",
      latencyMs: Date.now() - startMs,
    };
  }

  const anthropicMessages = await buildAnthropicMessages(contentMessages as Array<{ role: string; content: string }>);

  const abortController = new AbortController();
  const abortTimer = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    console.log(`[Claude] stream start model: ${model} feature: ${args.feature}`);

    const msgStream = anthropic.messages.stream(
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: anthropicMessages,
        temperature: args.temperature,
      },
      { signal: abortController.signal },
    );

    for await (const event of msgStream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        const piece = event.delta.text;
        if (piece) await args.onToken(piece);
      }
    }

    const finalMessage = await msgStream.finalMessage();
    const content = extractText(finalMessage);
    const usage = finalMessage.usage;

    const latencyMs = Date.now() - startMs;
    console.log(
      JSON.stringify({
        event: "ai.stream_complete",
        feature: args.feature,
        complexity: args.complexity,
        model,
        latencyMs,
        provider,
        usage: usage
          ? {
              prompt_tokens: usage.input_tokens,
              completion_tokens: usage.output_tokens,
              total_tokens: usage.input_tokens + usage.output_tokens,
            }
          : undefined,
      }),
    );

    if (!content.trim()) {
      return {
        ok: false,
        kind: "error",
        errorType: "unknown",
        message: "Model returned empty stream",
        latencyMs,
      };
    }

    return {
      ok: true,
      kind: "success",
      content,
      model,
      provider,
      latencyMs,
      usage: usage
        ? {
            prompt_tokens: usage.input_tokens,
            completion_tokens: usage.output_tokens,
            total_tokens: usage.input_tokens + usage.output_tokens,
          }
        : undefined,
    };
  } catch (err: unknown) {
    const status = getStatusCode(err);
    const isAbort = err instanceof APIUserAbortError || (err instanceof Error && err.name === "AbortError");
    const isTimeout = isAbort || (err instanceof Error && err.message.includes("timeout_after_"));

    console.error(`[Claude] stream failed:`, {
      message: err instanceof Error ? err.message : "unknown_error",
      status,
      feature: args.feature,
      model,
    });

    return {
      ok: false,
      kind: "error",
      errorType: isTimeout
        ? "timeout"
        : status === 429
          ? "rate_limited"
          : status && status >= 500
            ? "provider_error"
            : "unknown",
      message: err instanceof Error ? err.message : "unknown_error",
      latencyMs: Date.now() - startMs,
    };
  } finally {
    clearTimeout(abortTimer);
  }
}
