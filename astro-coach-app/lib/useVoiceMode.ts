import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
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

/**
 * Web: MediaRecorder → POST /api/voice/transcribe.
 * Native: expo-audio → same API.
 * No Web Speech API (avoids Google network dependency).
 */
export const useVoiceMode = (options: UseVoiceModeOptions) => {
  const { onTranscript } = options;
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const getTokenRef = useRef(options.getToken);
  getTokenRef.current = options.getToken;
  const languageRef = useRef(options.language);
  languageRef.current = options.language;

  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);
  const isRecordingRef = useRef(false);

  const isSupported = true;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelledRef.current = true;
      if (isRecordingRef.current) {
        void audioRecorder.stop().catch(() => {});
        isRecordingRef.current = false;
      }
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") {
        try { mr.stop(); } catch { /* */ }
      }
      mediaRecorderRef.current = null;
      if (webStreamRef.current) {
        webStreamRef.current.getTracks().forEach((t) => t.stop());
        webStreamRef.current = null;
      }
    };
  }, [audioRecorder]);

  // ─── WEB ────────────────────────────────────────────────────────────────────

  const startWebListening = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorKey("unsupported");
      setPhase("error");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorKey("permission");
      setPhase("error");
      return;
    }
    cancelledRef.current = false;
    audioChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        setErrorKey("unsupported");
        setPhase("error");
        return;
      }
    }
    webStreamRef.current = stream;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      webStreamRef.current = null;
      if (cancelledRef.current) {
        if (mountedRef.current) setPhase("idle");
        return;
      }
      if (!mountedRef.current) return;
      setPhase("transcribing");
      void (async () => {
        try {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          if (blob.size < 256) throw new Error("empty_recording");
          const base64 = await blobToBase64(blob);
          const cleanMime = mimeType.split(";")[0] ?? "audio/webm";
          const out = await apiPostJson<{ transcript: string }>(
            "/api/voice/transcribe",
            () => getTokenRef.current(),
            { audioBase64: base64, mimeType: cleanMime, language: languageRef.current },
          );
          const text = out.transcript?.trim() ?? "";
          if (text && mountedRef.current) onTranscriptRef.current(text);
          if (mountedRef.current) setPhase("idle");
        } catch (e) {
          console.warn("[useVoiceMode] web transcribe", e);
          if (mountedRef.current) {
            setErrorKey("transcribe");
            setPhase("error");
          }
        }
      })();
    };
    mediaRecorderRef.current = recorder;
    try {
      recorder.start();
    } catch (e) {
      console.warn("[useVoiceMode] MediaRecorder.start", e);
      stream.getTracks().forEach((t) => t.stop());
      webStreamRef.current = null;
      mediaRecorderRef.current = null;
      setErrorKey("unsupported");
      setPhase("error");
      return;
    }
    if (mountedRef.current) {
      setErrorKey(null);
      setPhase("listening");
    }
  }, []);

  const stopWebListening = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    try { recorder.stop(); } catch { /* */ }
    mediaRecorderRef.current = null;
  }, []);

  // ─── NATIVE ─────────────────────────────────────────────────────────────────

  const startNativeListening = useCallback(async () => {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (!status.granted) {
      setErrorKey("permission");
      setPhase("error");
      return;
    }
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
    isRecordingRef.current = true;
    cancelledRef.current = false;
    if (mountedRef.current) {
      setErrorKey(null);
      setPhase("listening");
    }
  }, [audioRecorder]);

  const stopNativeListeningAndTranscribe = useCallback(async () => {
    if (!isRecordingRef.current) {
      if (mountedRef.current) setPhase("idle");
      return;
    }
    if (cancelledRef.current) {
      try { await audioRecorder.stop(); } catch { /* */ }
      isRecordingRef.current = false;
      if (mountedRef.current) setPhase("idle");
      return;
    }
    if (mountedRef.current) setPhase("transcribing");
    try {
      await audioRecorder.stop();
      isRecordingRef.current = false;
      const uri = audioRecorder.uri;
      if (!uri) throw new Error("no_recording_uri");
      const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
      const mimeType = Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";
      const out = await apiPostJson<{ transcript: string }>(
        "/api/voice/transcribe",
        () => getTokenRef.current(),
        { audioBase64: base64, mimeType, language: languageRef.current },
      );
      const text = out.transcript?.trim() ?? "";
      if (text && mountedRef.current) onTranscriptRef.current(text);
      if (mountedRef.current) setPhase("idle");
    } catch (e) {
      console.warn("[useVoiceMode] native transcribe", e);
      isRecordingRef.current = false;
      if (mountedRef.current) {
        setErrorKey("transcribe");
        setPhase("error");
      }
    }
  }, [audioRecorder]);

  // ─── PUBLIC API ─────────────────────────────────────────────────────────────

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
        await startWebListening();
      } else {
        await startNativeListening();
      }
      return;
    }
    if (phase === "listening") {
      cancelledRef.current = false;
      if (Platform.OS === "web") {
        stopWebListening();
      } else {
        await stopNativeListeningAndTranscribe();
      }
    }
  }, [phase, startWebListening, startNativeListening, stopWebListening, stopNativeListeningAndTranscribe]);

  const cancelListening = useCallback(() => {
    if (phase === "transcribing") return;
    cancelledRef.current = true;
    if (Platform.OS === "web") {
      stopWebListening();
    } else {
      if (isRecordingRef.current) {
        void audioRecorder.stop().catch(() => {});
        isRecordingRef.current = false;
      }
      if (mountedRef.current) setPhase("idle");
    }
  }, [phase, stopWebListening, audioRecorder]);

  const resetError = useCallback(() => {
    setPhase("idle");
    setErrorKey(null);
  }, []);

  return {
    phase,
    interimText: "",
    errorKey,
    isSupported,
    toggleListening,
    cancelListening,
    resetError,
  };
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
