import * as Speech from "expo-speech";
import { useEffect, useRef } from "react";
import type { StreamingChatMessage } from "@/lib/useStreamingChat";

/**
 * Speaks the latest assistant reply when streaming finishes (voice mode follow-up).
 */
export const useSpeakAssistantOnStreamEnd = (
  messages: StreamingChatMessage[],
  isStreaming: boolean,
  language: "fa" | "en",
) => {
  const prevStreaming = useRef(false);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (prevStreaming.current && !isStreaming) {
      const lastAssistant = [...messages]
        .reverse()
        .find((m) => m.role === "assistant" && !m.isError && (m.content?.trim()?.length ?? 0) > 0);
      const text = lastAssistant?.content?.trim();
      if (text) {
        Speech.stop();
        Speech.speak(text, {
          language: language === "fa" ? "fa-IR" : "en-US",
        });
      }
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming, messages, language]);
};
