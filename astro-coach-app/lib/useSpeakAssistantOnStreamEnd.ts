import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import type { StreamingChatMessage } from "@/lib/useStreamingChat";

/**
 * Speaks the latest assistant reply when streaming finishes.
 * Web: `window.speechSynthesis`. Native: expo-speech.
 */
export const useSpeakAssistantOnStreamEnd = (
  messages: StreamingChatMessage[],
  isStreaming: boolean,
  language: "fa" | "en",
) => {
  const prevStreaming = useRef(false);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  useEffect(() => {
    if (prevStreaming.current && !isStreaming) {
      const lastAssistant = [...messages]
        .reverse()
        .find(
          (m) =>
            m.role === "assistant" &&
            !m.isError &&
            (m.content?.trim()?.length ?? 0) > 0,
        );
      const text = lastAssistant?.content?.trim();
      if (text) {
        stopSpeech();
        speakText(text, language);
      }
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming, messages, language]);
};

function stopSpeech(): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    return;
  }
  void import("expo-speech")
    .then((expoSpeech) => {
      expoSpeech.stop();
    })
    .catch(() => {});
}

function speakText(text: string, language: "fa" | "en"): void {
  const lang = language === "fa" ? "fa-IR" : "en-US";

  if (Platform.OS === "web") {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    return;
  }

  void import("expo-speech")
    .then((expoSpeech) => {
      expoSpeech.speak(text, { language: lang, rate: 0.92 });
    })
    .catch(() => {});
}
