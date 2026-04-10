import type { FC } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { AppTheme } from "@/constants/theme";
import type { VoicePhase } from "@/lib/useVoiceMode";

export type VoiceInputBarProps = {
  phase: VoicePhase;
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
 * Immersive status strip above the composer when voice is active or assistant is streaming.
 */
export const VoiceInputBar: FC<VoiceInputBarProps> = ({
  phase,
  streamingAssistantText,
  theme,
  rtl,
  labels,
  errorDetail,
}) => {
  const hasStreamingText = !!streamingAssistantText?.trim();
  const isActive = phase !== "idle" || hasStreamingText;
  if (!isActive) return null;

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: theme.colors.outlineVariant,
        flexDirection: rtl ? "row-reverse" : "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: theme.colors.surface,
        minHeight: 44,
      }}
    >
      {phase === "transcribing" ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : null}

      <View style={{ flex: 1 }}>
        {phase === "error" ? (
          <Text
            numberOfLines={2}
            style={{
              color: theme.colors.error,
              fontSize: 13,
              textAlign: rtl ? "right" : "left",
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {labels.error}
            {errorDetail ? ` — ${errorDetail}` : ""}
          </Text>
        ) : phase === "transcribing" ? (
          <Text
            style={{
              color: theme.colors.onSurfaceVariant,
              fontSize: 13,
              textAlign: rtl ? "right" : "left",
            }}
          >
            {labels.transcribing}
          </Text>
        ) : phase === "listening" ? (
          <Text
            style={{
              color: theme.colors.primary,
              fontSize: 13,
              fontWeight: "600",
              textAlign: rtl ? "right" : "left",
            }}
          >
            {labels.listening}
          </Text>
        ) : hasStreamingText ? (
          <Text
            numberOfLines={3}
            style={{
              color: theme.colors.onBackground,
              fontSize: 14,
              lineHeight: 20,
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
