import type { SafetyResult } from "./safetyClassifier.js";
import { safetyClassifier } from "./safetyClassifier.js";
import { getOpenRouterClient } from "./openrouterClient.js";
import { getDashboardModelPolicy, type RequestComplexity } from "./modelRouter.js";

export type GenerateCompletionResponseFormat = { type: "json_object" };

export type GenerateCompletionSuccess = {
  ok: true;
  kind: "success";
  content: string;
  json?: unknown;
  model: string;
  provider: "openrouter";
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

export type GenerateCompletionResult = GenerateCompletionSuccess | GenerateCompletionUnsafe | GenerateCompletionError;

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
  // Best-effort JSON extraction: strip code fences, then parse the outermost {...}.
  const text = raw
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();

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

/**
 * Generates a chat completion via OpenRouter, with safety checks and retries.
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
}): Promise<GenerateCompletionResult> {
  const startMs = Date.now();
  const provider: GenerateCompletionSuccess["provider"] = "openrouter";

  const timeoutMs = args.timeoutMs ?? 25_000;
  const primaryTransientRetries = Math.min(args.maxRetries ?? 1, 1);
  const fallbackTransientRetries = 0;

  const policy = getDashboardModelPolicy(args.complexity);

  let safetyResult: SafetyResult | undefined;
  if (args.safety) {
    if (args.safety.mode === "result") safetyResult = args.safety.result;
    if (args.safety.mode === "check") safetyResult = await safetyClassifier(args.safety.userId, args.safety.text);

    if (safetyResult && !safetyResult.isSafe) {
      console.log(
        JSON.stringify({
          event: "ai.safety.unsafe",
          feature: args.feature,
          complexity: args.complexity,
          model: policy.primary.model,
          attemptedProviderOrder: policy.primary.provider.order,
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

  const client = getOpenRouterClient();

  const tryModelOnce = async (modelCfg: {
    model: string;
    providerOrder: string[];
    requestProvider: { order: string[]; allow_fallbacks: false; require_parameters?: boolean };
    transientRetries: number;
  }): Promise<GenerateCompletionResult & { usable: boolean }> => {
    const attemptedProviderOrder = modelCfg.providerOrder;
    let transientAttempt = 0;

    // Primary: small transient retries; fallback: no transient retry beyond this call.
    while (transientAttempt <= primaryTransientRetries) {
      try {
        const completionPromise = client.chat.completions.create({
          model: modelCfg.model,
          messages: args.messages as any,
          temperature: args.temperature,
          max_tokens: args.maxTokens,
          response_format: args.responseFormat ? { type: args.responseFormat.type } : undefined,
          // OpenRouter routing policy via `provider` object.
          provider: {
            order: modelCfg.requestProvider.order,
            allow_fallbacks: modelCfg.requestProvider.allow_fallbacks,
            require_parameters: modelCfg.requestProvider.require_parameters,
          },
        } as any);

        const completion = await withTimeout(completionPromise, timeoutMs);
        const content = completion.choices?.[0]?.message?.content ?? "";

        const usage = completion.usage;
        const latencyMs = Date.now() - startMs;

        const wantsJson = args.responseFormat?.type === "json_object";
        let json: unknown | undefined;
        let usable = true;

        if (content.trim().length === 0) usable = false;
        if (wantsJson) {
          json = safeExtractJsonObject(content);
          const isObject = typeof json === "object" && json !== null && !Array.isArray(json);
          if (!isObject) usable = false;
        }

        const okLog = {
          event: "ai.complete",
          feature: args.feature,
          complexity: args.complexity,
          model: modelCfg.model,
          attemptedProviderOrder,
          latencyMs,
          provider,
          usage: usage
            ? {
                prompt_tokens: usage.prompt_tokens,
                completion_tokens: usage.completion_tokens,
                total_tokens: usage.total_tokens,
              }
            : undefined,
          attempt: transientAttempt,
        };
        console.log(JSON.stringify(okLog));

        if (!usable) {
          return {
            ok: true,
            kind: "success",
            usable,
            content,
            json,
            model: modelCfg.model,
            provider,
            latencyMs,
            attemptedProviderOrder,
            usage: usage
              ? {
                  prompt_tokens: usage.prompt_tokens,
                  completion_tokens: usage.completion_tokens,
                  total_tokens: usage.total_tokens,
                }
              : undefined,
          };
        }

        return {
          ok: true,
          kind: "success",
          usable,
          content,
          json,
          model: modelCfg.model,
          provider,
          latencyMs,
          attemptedProviderOrder,
          usage: usage
            ? {
                prompt_tokens: usage.prompt_tokens,
                completion_tokens: usage.completion_tokens,
                total_tokens: usage.total_tokens,
              }
            : undefined,
        };
      } catch (err: unknown) {
        const latencyMs = Date.now() - startMs;
        const status = getStatusCode(err);
        const isTimeout = err instanceof Error && err.message.includes("timeout_after_");
        const retryable = isRetryableError(err);

        console.log(
          JSON.stringify({
            event: "ai.complete.failure",
            feature: args.feature,
            complexity: args.complexity,
            model: modelCfg.model,
            attemptedProviderOrder,
            latencyMs,
            attempt: transientAttempt,
            status,
            retryable,
            error: err instanceof Error ? err.message : "unknown_error",
          })
        );

        // Only transiently retry on retryable errors; otherwise bubble up as unusable.
        if (!retryable || transientAttempt >= modelCfg.transientRetries) {
          const errorType: GenerateCompletionError["errorType"] = isTimeout
            ? "timeout"
            : status === 429
              ? "rate_limited"
              : status && status >= 500
                ? "provider_error"
                : "unknown";

          const message = err instanceof Error ? err.message : "unknown_error";
          return {
            ok: false,
            kind: "error",
            errorType,
            message,
            latencyMs,
            usable: false,
          };
        }

        transientAttempt++;
        const backoffMs = 500 * Math.pow(2, transientAttempt) + Math.floor(Math.random() * 200);
        await sleep(backoffMs);
      }
    }

    return {
      ok: false,
      kind: "error",
      errorType: "unknown",
      message: "unreachable_retry_exhausted",
      latencyMs: Date.now() - startMs,
      usable: false,
    };
  };

  const primaryResult = await tryModelOnce({
    model: policy.primary.model,
    providerOrder: policy.primary.provider.order,
    requestProvider: policy.primary.provider,
    transientRetries: primaryTransientRetries,
  });

  if (primaryResult.ok && "usable" in primaryResult && primaryResult.usable && args.responseFormat?.type === "json_object") {
    // In JSON mode: usable already implies valid JSON extraction.
    return primaryResult;
  }

  if (primaryResult.ok && "usable" in primaryResult && primaryResult.usable) {
    return primaryResult;
  }

  // Fallback exactly once if the primary errored or produced an unusable response.
  const fallbackResult = await tryModelOnce({
    model: policy.fallback.model,
    providerOrder: policy.fallback.provider.order,
    requestProvider: policy.fallback.provider,
    transientRetries: fallbackTransientRetries,
  });

  return fallbackResult;

  // Should be unreachable; kept for type-safety.
  return {
    ok: false,
    kind: "error",
    errorType: "unknown",
    message: "unreachable_retry_exhausted",
    latencyMs: Date.now() - startMs,
  };
}

/**
 * Streams chat tokens from OpenRouter and returns the full concatenated text.
 */
export async function streamChatCompletion(args: {
  feature: string;
  complexity: RequestComplexity;
  messages: Array<any>;
  temperature?: number;
  safety?: SafetyCheckInput;
  timeoutMs?: number;
  maxRetries?: number;
  onToken: (token: string) => Promise<void> | void;
}): Promise<
  | (GenerateCompletionSuccess & { kind: "success" })
  | GenerateCompletionUnsafe
  | (GenerateCompletionError & { kind: "error" })
>
{
  const startMs = Date.now();
  const timeoutMs = args.timeoutMs ?? 25_000;
  const primaryTransientRetries = Math.min(args.maxRetries ?? 1, 1);
  const fallbackTransientRetries = 0;

  const policy = getDashboardModelPolicy(args.complexity);
  const provider: GenerateCompletionSuccess["provider"] = "openrouter";

  let safetyResult: SafetyResult | undefined;
  if (args.safety) {
    if (args.safety.mode === "result") safetyResult = args.safety.result;
    if (args.safety.mode === "check") safetyResult = await safetyClassifier(args.safety.userId, args.safety.text);

    if (safetyResult && !safetyResult.isSafe) {
      return { ok: false, kind: "unsafe", flagType: safetyResult.flagType, safeResponse: safetyResult.safeResponse };
    }
  }

  const client = getOpenRouterClient();

  const streamOnce = async (modelCfg: {
    model: string;
    providerOrder: string[];
    requestProvider: { order: string[]; allow_fallbacks: false; require_parameters?: boolean };
    transientRetries: number;
  }): Promise<
    | ({ ok: true; kind: "success"; content: string; model: string; provider: "openrouter"; latencyMs: number } & {
        usable: boolean;
      })
    | ({ ok: false; kind: "error"; errorType: GenerateCompletionError["errorType"]; message: string; latencyMs: number } & {
        usable: boolean;
      })
  > => {
    const attemptedProviderOrder = modelCfg.providerOrder;
    let full = "";
    let wroteAnyTokens = false;
    let transientAttempt = 0;

    while (transientAttempt <= modelCfg.transientRetries) {
      try {
        const completionPromise = client.chat.completions.create({
          model: modelCfg.model,
          messages: args.messages as any,
          temperature: args.temperature,
          stream: true,
          provider: {
            order: modelCfg.requestProvider.order,
            allow_fallbacks: modelCfg.requestProvider.allow_fallbacks,
            require_parameters: modelCfg.requestProvider.require_parameters,
          },
        } as any);

        const latencyStartAttempt = Date.now();
        const stream = await withTimeout(completionPromise as any, timeoutMs);

        for await (const chunk of stream as any) {
          const token = chunk.choices?.[0]?.delta?.content ?? "";
          if (token) {
            wroteAnyTokens = true;
            full += token;
            await args.onToken(token);
          }
        }

        const latencyMs = Date.now() - startMs;
        console.log(
          JSON.stringify({
            event: "ai.stream.complete",
            feature: args.feature,
            complexity: args.complexity,
            model: modelCfg.model,
            provider,
            latencyMs,
            wroteAnyTokens,
            attemptedProviderOrder,
            attemptLatencyMs: Date.now() - latencyStartAttempt,
            transientAttempt,
          })
        );

        const usable = wroteAnyTokens && full.trim().length > 0;
        return {
          ok: true,
          kind: "success",
          content: full,
          model: modelCfg.model,
          provider,
          latencyMs,
          usable,
        };
      } catch (err: unknown) {
        const latencyMs = Date.now() - startMs;
        const status = getStatusCode(err);
        const isTimeout = err instanceof Error && err.message.includes("timeout_after_");
        const retryable = !wroteAnyTokens && isRetryableError(err);

        console.log(
          JSON.stringify({
            event: "ai.stream.failure",
            feature: args.feature,
            complexity: args.complexity,
            model: modelCfg.model,
            provider,
            latencyMs,
            transientAttempt,
            status,
            retryable,
            wroteAnyTokens,
            attemptedProviderOrder,
            error: err instanceof Error ? err.message : "unknown_error",
          })
        );

        const errorType: GenerateCompletionError["errorType"] = isTimeout
          ? "timeout"
          : status === 429
            ? "rate_limited"
            : status && status >= 500
              ? "provider_error"
              : "unknown";

        if (retryable && transientAttempt < modelCfg.transientRetries) {
          const backoffMs = 500 * Math.pow(2, transientAttempt) + Math.floor(Math.random() * 200);
          await sleep(backoffMs);
          transientAttempt++;
          continue;
        }

        const usable = false;
        return {
          ok: false,
          kind: "error",
          errorType,
          message: err instanceof Error ? err.message : "unknown_error",
          latencyMs,
          usable,
        };
      }
    }

    return {
      ok: false,
      kind: "error",
      errorType: "unknown",
      message: "unreachable_stream_retry_exhausted",
      latencyMs: Date.now() - startMs,
      usable: false,
    };
  };

  const primaryStream = await streamOnce({
    model: policy.primary.model,
    providerOrder: policy.primary.provider.order,
    requestProvider: policy.primary.provider,
    transientRetries: primaryTransientRetries,
  });

  if (primaryStream.ok && "usable" in primaryStream && primaryStream.usable) {
    const { content, latencyMs, model, provider } = primaryStream;
    return { ok: true, kind: "success", content, latencyMs, model, provider };
  }

  // Fallback exactly once: only if the primary produced no usable streamed output.
  const fallbackStream = await streamOnce({
    model: policy.fallback.model,
    providerOrder: policy.fallback.provider.order,
    requestProvider: policy.fallback.provider,
    transientRetries: fallbackTransientRetries,
  });

  if (fallbackStream.ok && "usable" in fallbackStream && fallbackStream.usable) {
    const { content, latencyMs, model, provider } = fallbackStream;
    return { ok: true, kind: "success", content, latencyMs, model, provider };
  }

  if (!fallbackStream.ok) return fallbackStream;

  return {
    ok: false,
    kind: "error",
    errorType: "unknown",
    message: "stream_unusable",
    latencyMs: Date.now() - startMs,
  };
}

