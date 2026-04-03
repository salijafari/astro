import { useEffect, useMemo } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import type { AppTheme } from "@/constants/theme";
import type { StreamingChatMessage } from "@/lib/useStreamingChat";
import { StreamingCursor } from "./StreamingCursor";

const TypingDots: React.FC<{ color: string }> = ({ color }) => {
  const anim1 = useMemo(() => new Animated.Value(0.3), []);
  const anim2 = useMemo(() => new Animated.Value(0.3), []);
  const anim3 = useMemo(() => new Animated.Value(0.3), []);

  useEffect(() => {
    const loop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        ]),
      );
    loop(anim1, 0).start();
    loop(anim2, 150).start();
    loop(anim3, 300).start();
  }, [anim1, anim2, anim3]);

  return (
    <View className="flex-row items-center gap-1 py-1">
      {[anim1, anim2, anim3].map((a, i) => (
        <Animated.View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
            opacity: a,
          }}
        />
      ))}
    </View>
  );
};

type Props = {
  message: StreamingChatMessage;
  rtl: boolean;
  theme: AppTheme;
  onFollowUpTap: (text: string) => void;
  onRetry?: () => void;
};

/**
 * Shared assistant/user bubble: typing dots, streaming cursor, follow-up chips, retry (AMA parity).
 */
export const ChatMessageBubble: React.FC<Props> = ({
  message,
  rtl,
  theme,
  onFollowUpTap,
  onRetry,
}) => {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  if (message.isLoading) {
    return (
      <View className="mb-3 items-start">
        <View
          className="rounded-3xl border px-4 py-3"
          style={{
            borderColor: theme.colors.outline,
            backgroundColor: theme.colors.surface,
          }}
        >
          <TypingDots color={theme.colors.onSurfaceVariant} />
        </View>
      </View>
    );
  }

  if (message.isStreaming && !message.content) {
    return (
      <View className="mb-3 items-start">
        <View
          className="min-h-[44px] justify-center rounded-3xl border px-4 py-3"
          style={{
            borderColor: theme.colors.outline,
            backgroundColor: theme.colors.surface,
          }}
        >
          <StreamingCursor cursorColor={`${theme.colors.onBackground}b3`} />
        </View>
      </View>
    );
  }

  return (
    <View className={`mb-3 ${isUser ? "items-end" : "items-start"}`}>
      <View
        className="max-w-[90%] rounded-3xl border px-4 py-3"
        style={{
          borderColor: isUser ? theme.colors.primary : theme.colors.outline,
          backgroundColor: isUser
            ? theme.colors.primaryContainer
            : message.isError
              ? `${theme.colors.error}15`
              : theme.colors.surface,
        }}
      >
        {!isUser && message.isStreaming && message.content ? (
          <View className="flex-row flex-wrap items-end" style={{ alignSelf: "stretch" }}>
            <Text
              className="text-base leading-6"
              style={{
                color: theme.colors.onBackground,
                writingDirection: rtl ? "rtl" : "ltr",
              }}
            >
              {message.content}
            </Text>
            <StreamingCursor cursorColor={`${theme.colors.onBackground}b3`} />
          </View>
        ) : (
          <Text
            className="text-base leading-6"
            style={{
              color: isUser
                ? theme.colors.onPrimaryContainer
                : message.isError
                  ? theme.colors.error
                  : theme.colors.onBackground,
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {message.content}
          </Text>
        )}
      </View>

      {message.isError && message.retryDraft && onRetry ? (
        <Pressable
          onPress={onRetry}
          className="mt-2 min-h-[44px] justify-center"
          accessibilityRole="button"
          accessibilityLabel={t("chat.tapToRetry")}
        >
          <Text className="text-xs" style={{ color: theme.colors.primary }}>
            {t("chat.tapToRetry")}
          </Text>
        </Pressable>
      ) : null}

      {message.followUpPrompts && message.followUpPrompts.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-2"
          contentContainerStyle={{ gap: 8 }}
        >
          {message.followUpPrompts.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => onFollowUpTap(prompt)}
              className="min-h-[36px] justify-center rounded-full border px-3 py-2"
              style={{ borderColor: theme.colors.outline }}
            >
              <Text
                className="text-sm"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {prompt}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
};
