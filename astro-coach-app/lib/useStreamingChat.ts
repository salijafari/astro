import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { apiRequest } from "@/lib/api";
import { authApiRef } from "@/lib/authApiRef";
import { sanitizeAccumulated, sanitizeStreamText } from "@/lib/sanitizeStreamText";
import { splitAssistantReply } from "@/lib/splitAssistantReply";

export type StreamingChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  followUpPrompts?: string[];
  isError?: boolean;
  isLoading?: boolean;
  isStreaming?: boolean;
  retryDraft?: string;
};

/** Optional voice metadata for chat persistence (server accepts on user turns). */
export type VoiceSendMeta = {
  inputMode?: "text" | "voice";
  transcript?: string;
  language?: "fa" | "en";
};

function mergeVoiceBody(meta?: VoiceSendMeta): Record<string, unknown> {
  if (!meta) return {};
  const o: Record<string, unknown> = {};
  if (meta.inputMode !== undefined) o.inputMode = meta.inputMode;
  if (meta.transcript !== undefined) o.transcript = meta.transcript;
  if (meta.language !== undefined) o.language = meta.language;
  return o;
}

export type UseStreamingChatOptions = {
  /** Full URL for SSE streaming (web only). */
  streamUrl: string;
  getToken: () => Promise<string | null>;
  /** Merged into POST JSON with `content`. */
  getExtraBody?: () => Record<string, unknown>;
  /** Native / non-stream fallback POST path (default `/api/chat/message`). */
  nonStreamingPath?: string;
  onConversationId?: (id: string) => void;
  onPaywall?: () => void;
  /** Shown on assistant error when there is no partial streamed text. */
  emptyErrorText?: string;
  /** e.g. restore the input field with the failed user draft (AMA / Dream). */
  onFailedTurn?: (userDraft: string) => void;
};

export type UseStreamingChatReturn = {
  messages: StreamingChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<StreamingChatMessage[]>>;
  isStreaming: boolean;
  sendMessage: (content: string, voiceMeta?: VoiceSendMeta) => Promise<void>;
  retryLastMessage: () => void;
  clearMessages: () => void;
};

const DISPLAY_MS = 40;

/**
 * Buffered SSE display + sanitization; web uses streaming, native uses POST fallback.
 */
export const useStreamingChat = (options: UseStreamingChatOptions): UseStreamingChatReturn => {
  const {
    streamUrl,
    getToken,
    getExtraBody,
    nonStreamingPath = "/api/chat/message",
    onConversationId,
    onPaywall,
    emptyErrorText = "Something went wrong. Please try again.",
    onFailedTurn,
  } = options;

  const [messages, setMessages] = useState<StreamingChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const rawBufferRef = useRef("");
  const displayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);
  const lastUserMessageRef = useRef("");

  const stopDisplayInterval = useCallback(() => {
    if (displayIntervalRef.current) {
      clearInterval(displayIntervalRef.current);
      displayIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopDisplayInterval();
    };
  }, [stopDisplayInterval]);

  const sendMessage = useCallback(
    async (content: string, voiceMeta?: VoiceSendMeta) => {
      const text = content.trim();
      if (!text || isStreaming) return;

      const idTokenEarly = await getToken();
      if (!idTokenEarly) return;

      lastUserMessageRef.current = text;
      setIsStreaming(true);

      const userMsgId = `u_${Date.now()}`;
      const assistantMsgId = `assistant_${Date.now()}`;
      currentAssistantIdRef.current = assistantMsgId;

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: text },
        { id: assistantMsgId, role: "assistant", content: "", isStreaming: true },
      ]);

      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), 30_000);

      const cleanupStreamRefs = () => {
        stopDisplayInterval();
        rawBufferRef.current = "";
        currentAssistantIdRef.current = null;
      };

      const failTurn = (partialRaw?: string) => {
        onFailedTurn?.(text);
        cleanupStreamRefs();
        const partialClean =
          partialRaw && partialRaw.length > 0
            ? sanitizeStreamText(splitAssistantReply(partialRaw).body)
            : "";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: partialClean.length > 0 ? partialClean : emptyErrorText,
                  isError: true,
                  isStreaming: false,
                  isLoading: false,
                  retryDraft: text,
                }
              : m,
          ),
        );
        setIsStreaming(false);
      };

      const removeAssistantOnly = () => {
        cleanupStreamRefs();
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
        setIsStreaming(false);
      };

      try {
        const idToken = idTokenEarly;

        const extra = getExtraBody?.() ?? {};
        const voice = mergeVoiceBody(voiceMeta);

        if (Platform.OS === "web") {
          let authToken = idToken;
          const postStream = () =>
            fetch(streamUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ content: text, ...extra, ...voice }),
              signal: ac.signal,
            });

          let res = await postStream();
          if (res.status === 401 && authApiRef.refreshToken) {
            const t2 = await authApiRef.refreshToken();
            if (t2) {
              authToken = t2;
              res = await postStream();
            }
          }
          if (res.status === 401 && authApiRef.onAuthFailure) {
            await authApiRef.onAuthFailure();
          }
          if (res.status === 402) {
            removeAssistantOnly();
            onPaywall?.();
            return;
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          if (!res.body) throw new Error("No response body");

          stopDisplayInterval();
          rawBufferRef.current = "";
          currentAssistantIdRef.current = assistantMsgId;
          displayIntervalRef.current = setInterval(() => {
            const id = currentAssistantIdRef.current;
            if (!id || rawBufferRef.current.length === 0) return;
            const sanitized = sanitizeAccumulated(rawBufferRef.current);
            setMessages((prev) =>
              prev.map((m) => (m.id === id ? { ...m, content: sanitized, isStreaming: true } : m)),
            );
          }, DISPLAY_MS);

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let sseBuffer = "";
          let streamDoneReceived = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const blocks = sseBuffer.split("\n\n");
            sseBuffer = blocks.pop() ?? "";
            for (const block of blocks) {
              const lines = block.split("\n");
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const payload = line.slice(6).trim();
                if (!payload) continue;
                let parsed: {
                  type?: string;
                  text?: string;
                  conversationId?: string;
                  content?: string;
                  followUpPrompts?: string[];
                  error?: string;
                };
                try {
                  parsed = JSON.parse(payload) as typeof parsed;
                } catch {
                  continue;
                }
                if (parsed.type === "token" && parsed.text) {
                  rawBufferRef.current += parsed.text;
                }
                if (parsed.type === "done") {
                  streamDoneReceived = true;
                  stopDisplayInterval();
                  currentAssistantIdRef.current = null;
                  const raw = rawBufferRef.current;
                  rawBufferRef.current = "";
                  const split = splitAssistantReply(raw);
                  const displayBody =
                    typeof parsed.content === "string" && parsed.content.length > 0
                      ? parsed.content
                      : sanitizeStreamText(split.body);
                  const followUps =
                    parsed.followUpPrompts && parsed.followUpPrompts.length > 0
                      ? parsed.followUpPrompts
                      : split.followUps;
                  if (parsed.conversationId) onConversationId?.(parsed.conversationId);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            content: displayBody,
                            followUpPrompts: followUps,
                            isStreaming: false,
                            isLoading: false,
                          }
                        : m,
                    ),
                  );
                  setIsStreaming(false);
                }
                if (parsed.type === "error") {
                  throw new Error(parsed.error ?? "chat_failed");
                }
              }
            }
          }

          if (!streamDoneReceived) {
            stopDisplayInterval();
            currentAssistantIdRef.current = null;
            const raw = rawBufferRef.current;
            rawBufferRef.current = "";
            if (raw.length > 0) {
              const split = splitAssistantReply(raw);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: sanitizeStreamText(split.body),
                        followUpPrompts: split.followUps,
                        isStreaming: false,
                        isLoading: false,
                      }
                    : m,
                ),
              );
            }
            setIsStreaming(false);
          }
          return;
        }

        cleanupStreamRefs();
        const res = await apiRequest(nonStreamingPath, {
          method: "POST",
          getToken: async () => idToken,
          body: JSON.stringify({ content: text, ...extra, ...voice }),
          signal: ac.signal,
        });

        if (res.status === 402) {
          let body: { error?: string } = {};
          try {
            body = (await res.json()) as { error?: string };
          } catch {
            /* ignore */
          }
          if (body.error === "free_limit") {
            removeAssistantOnly();
            onPaywall?.();
            return;
          }
        }

        if (!res.ok) {
          const err = await res.text();
          throw new Error(err || res.statusText);
        }

        const data = (await res.json()) as {
          content?: string;
          response?: string;
          followUpPrompts?: string[];
          sessionId?: string;
          conversationId?: string;
        };
        const nextId = data.sessionId ?? data.conversationId;
        if (nextId) onConversationId?.(nextId);
        const rawAssistant = data.content ?? data.response ?? "";
        if (!rawAssistant.trim()) {
          onFailedTurn?.(text);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: emptyErrorText,
                    isError: true,
                    isStreaming: false,
                    isLoading: false,
                    retryDraft: text,
                  }
                : m,
            ),
          );
        } else {
          const assistantContent = sanitizeStreamText(rawAssistant);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: assistantContent,
                    followUpPrompts: data.followUpPrompts ?? [],
                    isStreaming: false,
                    isLoading: false,
                  }
                : m,
            ),
          );
        }
        setIsStreaming(false);
      } catch (e) {
        const s = e instanceof Error ? e.message : String(e);
        if (s.includes("free_limit")) {
          removeAssistantOnly();
          onPaywall?.();
        } else {
          failTurn(Platform.OS === "web" ? rawBufferRef.current : undefined);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [
      emptyErrorText,
      getToken,
      getExtraBody,
      isStreaming,
      nonStreamingPath,
      onConversationId,
      onFailedTurn,
      onPaywall,
      stopDisplayInterval,
      streamUrl,
    ],
  );

  const retryLastMessage = useCallback(() => {
    if (!lastUserMessageRef.current || isStreaming) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.isError && prev.length >= 2) {
        return prev.slice(0, -2);
      }
      return prev;
    });
    void sendMessage(lastUserMessageRef.current);
  }, [isStreaming, sendMessage]);

  const clearMessages = useCallback(() => {
    stopDisplayInterval();
    rawBufferRef.current = "";
    lastUserMessageRef.current = "";
    currentAssistantIdRef.current = null;
    setMessages([]);
    setIsStreaming(false);
  }, [stopDisplayInterval]);

  return {
    messages,
    setMessages,
    isStreaming,
    sendMessage,
    retryLastMessage,
    clearMessages,
  };
};
