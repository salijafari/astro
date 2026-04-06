import type OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getOpenRouterClient } from "../../lib/openrouterClient.js";
import { getLlmHttpStatus, maxTokensFor, safeExtractJsonObject } from "./llmShared.js";
import type { RequestComplexity } from "./modelRouter.js";
import type {
  GenerateCompletionError,
  GenerateCompletionResponseFormat,
  GenerateCompletionResult,
  GenerateCompletionSuccess,
  ImageInput,
} from "./generateCompletion.js";

const OR_PRIMARY_MODEL = "google/gemini-3-flash-preview";
const OR_FALLBACK_MODEL = "moonshotai/kimi-k2.5";

const OR_PRIMARY_PROVIDER = { order: ["google-ai-studio"] as string[], allow_fallbacks: false };
const OR_FALLBACK_PROVIDER = { order: ["chutes/int4"] as string[], allow_fallbacks: false };

type OpenRouterProviderBody = { order: string[]; allow_fallbacks: boolean };

type OpenRouterChatParams = {
  model: string;
  messages: ChatCompletionMessageParam[];
  max_tokens: number;
  temperature?: number;
  stream?: boolean;
  provider: OpenRouterProviderBody;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout_after_${ms}ms`)), ms);
  });
  try {
    return Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type ImagePayload = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" };

async function toImagePayload(input: ImageInput): Promise<ImagePayload | null> {
  if (input.type === "base64") {
    const mediaType = (input.mimeType ?? "image/jpeg") as ImagePayload["mediaType"];
    return { base64: input.data, mediaType };
  }
  try {
    const res = await fetch(input.data);
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0] as ImagePayload["mediaType"];
    const buf = Buffer.from(await res.arrayBuffer());
    return { base64: buf.toString("base64"), mediaType: contentType };
  } catch {
    return null;
  }
}

function openAiAssistantText(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part: { type?: string; text?: string }) => (part?.type === "text" && part.text ? part.text : ""))
      .join("")
      .trim();
  }
  return "";
}

async function buildOpenAiMessages(
  messages: Array<{ role: string; content: string }>,
  imageInputs?: ImageInput[],
): Promise<ChatCompletionMessageParam[]> {
  const out: ChatCompletionMessageParam[] = [];
  let lastUserIndex = -1;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]?.role === "user") lastUserIndex = i;
  }

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!message) continue;
    const role = message.role === "assistant" ? "assistant" : "user";

    if (i === lastUserIndex && imageInputs && imageInputs.length > 0 && role === "user") {
      const parts: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      > = [{ type: "text", text: message.content }];
      for (const imageInput of imageInputs) {
        const img = await toImagePayload(imageInput);
        if (!img) continue;
        const url = `data:${img.mediaType};base64,${img.base64}`;
        parts.push({ type: "image_url", image_url: { url } });
      }
      out.push({ role: "user", content: parts });
    } else {
      out.push({ role, content: message.content });
    }
  }

  return out;
}

function splitSystemAndContent(messages: Array<{ role: string; content: string }>): {
  systemPrompt: string | undefined;
  contentMessages: Array<{ role: string; content: string }>;
} {
  const systemPrompt =
    messages[0]?.role === "system" && typeof messages[0]?.content === "string" ? messages[0].content : undefined;
  const contentMessages = messages[0]?.role === "system" ? messages.slice(1) : messages;
  return { systemPrompt, contentMessages };
}

function classifyError(err: unknown): GenerateCompletionError["errorType"] {
  const status = getLlmHttpStatus(err);
  const isTimeout = err instanceof Error && err.message.includes("timeout_after_");
  if (isTimeout) return "timeout";
  if (status === 429) return "rate_limited";
  if (typeof status === "number" && status >= 500) return "provider_error";
  return "unknown";
}

function isUsable(content: string, wantsJson: boolean, json: unknown | undefined): boolean {
  return (
    content.trim().length > 0 &&
    (!wantsJson || (typeof json === "object" && json !== null && !Array.isArray(json)))
  );
}

async function callOpenRouterCompletionInner(args: {
  model: string;
  provider: OpenRouterProviderBody;
  openAiMessages: ChatCompletionMessageParam[];
  maxTokens: number;
  temperature?: number;
  timeoutMs: number;
  feature: string;
  responseFormat?: GenerateCompletionResponseFormat;
}): Promise<
  | { ok: true; content: string; json?: unknown; usage?: GenerateCompletionSuccess["usage"]; model: string }
  | { ok: false; error: Error | unknown }
> {
  const client = getOpenRouterClient();
  const body: OpenRouterChatParams = {
    model: args.model,
    messages: args.openAiMessages,
    max_tokens: args.maxTokens,
    temperature: args.temperature,
    stream: false,
    provider: args.provider,
  };

  try {
    const response = (await withTimeout(
      client.chat.completions.create({
        ...body,
        stream: false,
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming),
      args.timeoutMs,
    )) as OpenAI.Chat.Completions.ChatCompletion;
    const text = openAiAssistantText(response.choices[0]?.message?.content);
    const wantsJson = args.responseFormat?.type === "json_object";
    const json = wantsJson ? safeExtractJsonObject(text) : undefined;
    const u = response.usage;
    const usage = u
      ? {
          prompt_tokens: u.prompt_tokens ?? undefined,
          completion_tokens: u.completion_tokens ?? undefined,
          total_tokens: u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0),
        }
      : undefined;
    return { ok: true, content: text, json, usage, model: args.model };
  } catch (e) {
    return { ok: false, error: e };
  }
}

/**
 * Non-streaming completion via OpenRouter (Gemini primary, Kimi one retry). No safety checks.
 */
export async function generateCompletionViaOpenRouter(args: {
  feature: string;
  complexity: RequestComplexity;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: GenerateCompletionResponseFormat;
  timeoutMs?: number;
  imageInputs?: ImageInput[];
}): Promise<GenerateCompletionResult> {
  const startMs = Date.now();
  const timeoutMs = args.timeoutMs ?? 25_000;
  const maxTokens = maxTokensFor(args.feature, args.complexity, args.maxTokens);
  const wantsJson = args.responseFormat?.type === "json_object";

  const { systemPrompt, contentMessages } = splitSystemAndContent(args.messages);
  const openAiMessages: ChatCompletionMessageParam[] = [];
  if (systemPrompt) {
    openAiMessages.push({ role: "system", content: systemPrompt });
  }
  openAiMessages.push(...(await buildOpenAiMessages(contentMessages, args.imageInputs)));

  const tryModel = async (
    model: string,
    provider: OpenRouterProviderBody,
  ): Promise<
    | { ok: true; content: string; json?: unknown; usage?: GenerateCompletionSuccess["usage"] }
    | { ok: false; error: unknown }
  > => {
    const r = await callOpenRouterCompletionInner({
      model,
      provider,
      openAiMessages,
      maxTokens,
      temperature: args.temperature,
      timeoutMs,
      feature: args.feature,
      responseFormat: args.responseFormat,
    });
    if (!r.ok) return r;
    const json = wantsJson ? safeExtractJsonObject(r.content) : r.json;
    if (!isUsable(r.content, wantsJson, json)) {
      return { ok: false, error: new Error("Model returned unusable output") };
    }
    return { ok: true, content: r.content, json, usage: r.usage };
  };

  let first = await tryModel(OR_PRIMARY_MODEL, OR_PRIMARY_PROVIDER);
  if (first.ok) {
    const latencyMs = Date.now() - startMs;
    console.log(`[OpenRouter] success model=${OR_PRIMARY_MODEL} feature=${args.feature}`);
    console.log(
      JSON.stringify({
        event: "ai.complete",
        feature: args.feature,
        complexity: args.complexity,
        model: OR_PRIMARY_MODEL,
        latencyMs,
        provider: "openrouter",
      }),
    );
    return {
      ok: true,
      kind: "success",
      content: first.content,
      json: first.json,
      model: OR_PRIMARY_MODEL,
      provider: "openrouter",
      latencyMs,
      usage: first.usage,
    };
  }

  const second = await tryModel(OR_FALLBACK_MODEL, OR_FALLBACK_PROVIDER);
  if (second.ok) {
    const latencyMs = Date.now() - startMs;
    console.log(`[OpenRouter] success model=${OR_FALLBACK_MODEL} feature=${args.feature}`);
    console.log(
      JSON.stringify({
        event: "ai.complete",
        feature: args.feature,
        complexity: args.complexity,
        model: OR_FALLBACK_MODEL,
        latencyMs,
        provider: "openrouter",
      }),
    );
    return {
      ok: true,
      kind: "success",
      content: second.content,
      json: second.json,
      model: OR_FALLBACK_MODEL,
      provider: "openrouter",
      latencyMs,
      usage: second.usage,
    };
  }

  const latencyMs = Date.now() - startMs;
  const err = !first.ok ? first.error : second.error;
  return {
    ok: false,
    kind: "error",
    errorType: classifyError(err),
    message: err instanceof Error ? err.message : "openrouter_failed",
    latencyMs,
  };
}

export type OpenRouterStreamOutcome =
  | { status: "success"; result: GenerateCompletionSuccess & { kind: "success" } }
  | { status: "error_after_tokens"; error: GenerateCompletionError & { kind: "error" } }
  | { status: "exhausted_openrouter" };

async function runOneOpenRouterStream(args: {
  model: string;
  provider: OpenRouterProviderBody;
  openAiMessages: ChatCompletionMessageParam[];
  maxTokens: number;
  temperature?: number;
  timeoutMs: number;
  feature: string;
  onToken: (token: string) => Promise<void> | void;
  signal: AbortSignal;
}): Promise<
  | { status: "success"; content: string; usage?: GenerateCompletionSuccess["usage"] }
  | { status: "failed_before_tokens"; error: unknown }
  | { status: "failed_after_tokens"; error: unknown; contentSoFar: string }
> {
  const client = getOpenRouterClient();
  let emittedAnyToken = false;
  let full = "";

  const body: OpenRouterChatParams = {
    model: args.model,
    messages: args.openAiMessages,
    max_tokens: args.maxTokens,
    temperature: args.temperature,
    stream: true,
    provider: args.provider,
  };

  try {
    const stream = (await client.chat.completions.create(
      {
        ...body,
        stream: true,
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
      { signal: args.signal },
    )) as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

    for await (const chunk of stream) {
      const piece = chunk.choices[0]?.delta?.content;
      if (piece) {
        emittedAnyToken = true;
        full += piece;
        await args.onToken(piece);
      }
    }

    const usageRaw = (stream as unknown as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } })
      .usage;
    const usage = usageRaw
      ? {
          prompt_tokens: usageRaw.prompt_tokens,
          completion_tokens: usageRaw.completion_tokens,
          total_tokens:
            usageRaw.total_tokens ?? (usageRaw.prompt_tokens ?? 0) + (usageRaw.completion_tokens ?? 0),
        }
      : undefined;

    if (!full.trim()) {
      if (emittedAnyToken) {
        return { status: "failed_after_tokens", error: new Error("empty_after_stream"), contentSoFar: full };
      }
      return { status: "failed_before_tokens", error: new Error("Model returned empty stream") };
    }

    return { status: "success", content: full.trim(), usage };
  } catch (err: unknown) {
    if (emittedAnyToken) {
      return { status: "failed_after_tokens", error: err, contentSoFar: full };
    }
    return { status: "failed_before_tokens", error: err };
  }
}

/**
 * Streaming via OpenRouter: tries Gemini then Kimi; only if both fail before any token does caller fall back to Anthropic.
 */
export async function streamChatCompletionViaOpenRouter(args: {
  feature: string;
  complexity: RequestComplexity;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  timeoutMs?: number;
  maxTokens?: number;
  onToken: (token: string) => Promise<void> | void;
}): Promise<OpenRouterStreamOutcome> {
  const startMs = Date.now();
  const timeoutMs = args.timeoutMs ?? 60_000;
  const maxTokens = maxTokensFor(args.feature, args.complexity, args.maxTokens);

  const { systemPrompt, contentMessages } = splitSystemAndContent(args.messages);
  const openAiMessages: ChatCompletionMessageParam[] = [];
  if (systemPrompt) {
    openAiMessages.push({ role: "system", content: systemPrompt });
  }
  openAiMessages.push(...(await buildOpenAiMessages(contentMessages, undefined)));

  const runWithTimeout = async (
    model: string,
    provider: OpenRouterProviderBody,
  ): Promise<
    | { status: "success"; content: string; usage?: GenerateCompletionSuccess["usage"] }
    | { status: "failed_before_tokens"; error: unknown }
    | { status: "failed_after_tokens"; error: unknown; contentSoFar: string }
  > => {
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), timeoutMs);
    try {
      return await runOneOpenRouterStream({
        model,
        provider,
        openAiMessages,
        maxTokens,
        temperature: args.temperature,
        timeoutMs,
        feature: args.feature,
        onToken: args.onToken,
        signal: abortController.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  const primary = await runWithTimeout(OR_PRIMARY_MODEL, OR_PRIMARY_PROVIDER);
  if (primary.status === "success") {
    const latencyMs = Date.now() - startMs;
    console.log(`[OpenRouter] stream complete model=${OR_PRIMARY_MODEL} feature=${args.feature}`);
    console.log(
      JSON.stringify({
        event: "ai.stream_complete",
        feature: args.feature,
        complexity: args.complexity,
        model: OR_PRIMARY_MODEL,
        latencyMs,
        provider: "openrouter",
        usage: primary.usage,
      }),
    );
    return {
      status: "success",
      result: {
        ok: true,
        kind: "success",
        content: primary.content,
        model: OR_PRIMARY_MODEL,
        provider: "openrouter",
        latencyMs,
        usage: primary.usage,
      },
    };
  }

  if (primary.status === "failed_after_tokens") {
    const latencyMs = Date.now() - startMs;
    return {
      status: "error_after_tokens",
      error: {
        ok: false,
        kind: "error",
        errorType: classifyError(primary.error),
        message: primary.error instanceof Error ? primary.error.message : "openrouter_stream_failed",
        latencyMs,
      },
    };
  }

  const fallback = await runWithTimeout(OR_FALLBACK_MODEL, OR_FALLBACK_PROVIDER);
  if (fallback.status === "success") {
    const latencyMs = Date.now() - startMs;
    console.log(`[OpenRouter] stream complete model=${OR_FALLBACK_MODEL} feature=${args.feature}`);
    console.log(
      JSON.stringify({
        event: "ai.stream_complete",
        feature: args.feature,
        complexity: args.complexity,
        model: OR_FALLBACK_MODEL,
        latencyMs,
        provider: "openrouter",
        usage: fallback.usage,
      }),
    );
    return {
      status: "success",
      result: {
        ok: true,
        kind: "success",
        content: fallback.content,
        model: OR_FALLBACK_MODEL,
        provider: "openrouter",
        latencyMs,
        usage: fallback.usage,
      },
    };
  }

  if (fallback.status === "failed_after_tokens") {
    const latencyMs = Date.now() - startMs;
    return {
      status: "error_after_tokens",
      error: {
        ok: false,
        kind: "error",
        errorType: classifyError(fallback.error),
        message: fallback.error instanceof Error ? fallback.error.message : "openrouter_stream_failed",
        latencyMs,
      },
    };
  }

  return { status: "exhausted_openrouter" };
}
