import { streamChatCompletion } from "../services/ai/generateCompletion.js";
import type { SafetyCheckInput } from "../services/ai/generateCompletion.js";
import type { RequestComplexity } from "../services/ai/modelRouter.js";

/** Minimal Hono SSE stream surface used by chat routes. */
export type SSEStreamWriter = {
  writeSSE: (message: { data: string; event?: string }) => Promise<void>;
};

export const defaultSseDataStringify = (obj: Record<string, unknown>): string => JSON.stringify(obj);

/**
 * Streams Claude deltas over SSE using the project's {@link streamChatCompletion} (not generateCompletion).
 * Each delta is written as `data: <json>` with `{ type: "token", text }`.
 */
export async function streamClaudeCompletionAsSSE(
  stream: SSEStreamWriter,
  params: {
    sseStringify?: (obj: Record<string, unknown>) => string;
    feature: string;
    complexity: RequestComplexity;
    messages: Array<Record<string, unknown>>;
    safety: SafetyCheckInput;
    timeoutMs?: number;
    maxRetries?: number;
    maxTokens?: number;
    temperature?: number;
  },
) {
  const stringify = params.sseStringify ?? defaultSseDataStringify;
  return streamChatCompletion({
    feature: params.feature,
    complexity: params.complexity,
    messages: params.messages,
    safety: params.safety,
    timeoutMs: params.timeoutMs,
    maxRetries: params.maxRetries,
    maxTokens: params.maxTokens,
    temperature: params.temperature,
    onToken: async (text) => {
      await stream.writeSSE({ data: stringify({ type: "token", text }) });
    },
  });
}
