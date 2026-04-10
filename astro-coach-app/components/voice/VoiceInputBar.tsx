import type { FC } from "react";
import { Text, View } from "react-native";
import type { AppTheme } from "@/constants/theme";
import type { VoicePhase } from "@/lib/useVoiceMode";
import { VoiceOrb } from "@/components/voice/VoiceOrb";

export type VoiceInputBarProps = {
  phase: VoicePhase;
  /** Last assistant bubble text while streaming (from messages + isStreaming). */
  streamingAssistantText?: string;
  interimText?: string;
  theme: AppTheme;
  rtl: boolean;
  labels: {
    listening: string;
    transcribing: string;
    error: string;
  };
  errorDetail?: string | null;
};

/**
 * Compact status row: orb + labels; streaming line mirrors the assistant bubble while SSE runs.
 */
export const VoiceInputBar: FC<VoiceInputBarProps> = ({
  phase,
  streamingAssistantText,
  interimText,
  theme,
  rtl,
  labels,
  errorDetail,
}) => {
  if (phase === "idle" && !streamingAssistantText?.trim()) return null;

  const showOrb = phase === "listening" || phase === "transcribing";
  const statusLabel =
    phase === "error"
      ? `${labels.error}${errorDetail ? ` (${errorDetail})` : ""}`
      : phase === "transcribing"
        ? labels.transcribing
        : phase === "listening"
          ? labels.listening
          : "";

  return (
    <View
      className="border-b px-3 py-2"
      style={{
        borderBottomColor: theme.colors.outlineVariant,
        flexDirection: rtl ? "row-reverse" : "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      {showOrb ? (
        <VoiceOrb
          active={phase === "listening"}
          accentColor={theme.colors.primary}
          dimColor={theme.colors.outline}
        />
      ) : null}
      <View className="min-w-0 flex-1">
        {statusLabel ? (
          <Text
            className="text-sm"
            numberOfLines={2}
            style={{
              color: phase === "error" ? theme.colors.error : theme.colors.onSurfaceVariant,
              textAlign: rtl ? "right" : "left",
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {statusLabel}
          </Text>
        ) : null}
        {phase === "listening" && interimText?.trim() ? (
          <Text
            className="mt-1 text-xs"
            numberOfLines={3}
            style={{
              color: theme.colors.onSurfaceVariant,
              textAlign: rtl ? "right" : "left",
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {interimText}
          </Text>
        ) : null}
        {streamingAssistantText?.trim() ? (
          <Text
            className="mt-1 text-xs opacity-80"
            numberOfLines={4}
            style={{
              color: theme.colors.onBackground,
              textAlign: rtl ? "right" : "left",
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {streamingAssistantText}
          </Text>
        ) : null}
      </View>
    </View>
  );
};
