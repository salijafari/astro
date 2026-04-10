import { Audio } from "expo-av";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { apiPostJson } from "@/lib/api";

export type VoicePhase = "idle" | "listening" | "transcribing" | "error";

export type UseVoiceModeOptions = {
  getToken: () => Promise<string | null>;
  language: "fa" | "en";
  onTranscript: (text: string) => void;
};

const webSpeechAvailable = () =>
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

/**
 * Web: Web Speech API. Native: record with expo-av → POST /api/voice/transcribe.
 * Call `cancelListening` to discard without sending; `toggleListening` finalizes native recording with transcribe.
 */
export const useVoiceMode = (options: UseVoiceModeOptions) => {
  const { getToken, language, onTranscript } = options;
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const languageRef = useRef(language);
  languageRef.current = language;

  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [interimText, setInterimText] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const cancelledRef = useRef(false);
  const finalChunksRef = useRef<string[]>([]);
  const interimRef = useRef("");

  const isSupported = Platform.OS === "web" ? webSpeechAvailable() : true;

  const cleanupRecognition = useCallback(() => {
    const r = recognitionRef.current;
    recognitionRef.current = null;
    if (!r) return;
    try {
      r.onresult = null;
      r.onend = null;
      r.onerror = null;
      r.abort();
    } catch {
      /* already stopped */
    }
  }, []);

  const discardNativeRecording = useCallback(async () => {
    const r = recordingRef.current;
    recordingRef.current = null;
    if (!r) return;
    try {
      await r.stopAndUnloadAsync();
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      cleanupRecognition();
      void discardNativeRecording();
    };
  }, [cleanupRecognition, discardNativeRecording]);

  const transcribeNativeFile = useCallback(async (uri: string) => {
    const base64 = await readAsStringAsync(uri, {
      encoding: EncodingType.Base64,
    });
    const mimeType = Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";
    const out = await apiPostJson<{ transcript: string }>(
      "/api/voice/transcribe",
      () => getTokenRef.current(),
      { audioBase64: base64, mimeType, language: languageRef.current },
    );
    return out.transcript?.trim() ?? "";
  }, []);

  const startNativeListening = useCallback(async () => {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      setErrorKey("permission");
      setPhase("error");
      return;
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    recordingRef.current = recording;
    cancelledRef.current = false;
    interimRef.current = "";
    setInterimText("");
    setErrorKey(null);
    setPhase("listening");
  }, []);

  const stopNativeListeningAndTranscribe = useCallback(async () => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) {
      setPhase("idle");
      return;
    }
    if (cancelledRef.current) {
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        /* */
      }
      setPhase("idle");
      return;
    }
    setPhase("transcribing");
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error("no_recording_uri");
      const text = await transcribeNativeFile(uri);
      if (text) onTranscriptRef.current(text);
      setPhase("idle");
      interimRef.current = "";
      setInterimText("");
    } catch (e) {
      console.warn("[useVoiceMode] transcribe", e);
      setErrorKey("transcribe");
      setPhase("error");
    }
  }, [transcribeNativeFile]);

  const startWebListening = useCallback(() => {
    if (!webSpeechAvailable()) {
      setErrorKey("unsupported");
      setPhase("error");
      return;
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      setErrorKey("unsupported");
      setPhase("error");
      return;
    }
    cancelledRef.current = false;
    finalChunksRef.current = [];
    interimRef.current = "";
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = languageRef.current === "fa" ? "fa-IR" : "en-US";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const line = ev.results[i];
        const piece = line[0]?.transcript ?? "";
        if (line.isFinal) {
          finalChunksRef.current.push(piece);
        } else {
          interim = piece;
        }
      }
      interimRef.current = interim;
      setInterimText(interim);
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === "aborted" || ev.error === "no-speech") {
        if (cancelledRef.current) {
          setPhase("idle");
          interimRef.current = "";
          setInterimText("");
        }
        return;
      }
      console.warn("[useVoiceMode] web speech", ev.error);
      setErrorKey("speech");
      setPhase("error");
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (cancelledRef.current) {
        cancelledRef.current = false;
        setPhase("idle");
        interimRef.current = "";
        setInterimText("");
        return;
      }
      const interim = interimRef.current;
      const text = [...finalChunksRef.current, interim].join(" ").replace(/\s+/g, " ").trim();
      finalChunksRef.current = [];
      interimRef.current = "";
      setInterimText("");
      if (text) onTranscriptRef.current(text);
      setPhase("idle");
    };

    setErrorKey(null);
    setPhase("listening");
    try {
      rec.start();
    } catch (e) {
      console.warn("[useVoiceMode] rec.start", e);
      recognitionRef.current = null;
      setErrorKey("speech");
      setPhase("error");
    }
  }, []);

  const cancelListening = useCallback(() => {
    if (phase === "transcribing") return;
    cancelledRef.current = true;
    if (Platform.OS === "web") {
      const r = recognitionRef.current;
      if (r) {
        try {
          r.abort();
        } catch {
          /* */
        }
      } else {
        cleanupRecognition();
        setPhase("idle");
        interimRef.current = "";
        setInterimText("");
      }
      return;
    }
    void discardNativeRecording();
    setPhase("idle");
    interimRef.current = "";
    setInterimText("");
  }, [cleanupRecognition, discardNativeRecording, phase]);

  const toggleListening = useCallback(async () => {
    if (phase === "transcribing") return;
    if (phase === "error") {
      setErrorKey(null);
      setPhase("idle");
      return;
    }
    setErrorKey(null);
    if (phase === "idle") {
      if (Platform.OS === "web") {
        startWebListening();
      } else {
        await startNativeListening();
      }
      return;
    }
    if (phase === "listening") {
      if (Platform.OS === "web") {
        const r = recognitionRef.current;
        if (r) {
          try {
            r.stop();
          } catch {
            /* */
          }
        }
      } else {
        await stopNativeListeningAndTranscribe();
      }
    }
  }, [phase, startNativeListening, startWebListening, stopNativeListeningAndTranscribe]);

  const resetError = useCallback(() => {
    setPhase("idle");
    setErrorKey(null);
  }, []);

  return {
    phase,
    interimText,
    errorKey,
    isSupported,
    toggleListening,
    cancelListening,
    resetError,
  };
};
