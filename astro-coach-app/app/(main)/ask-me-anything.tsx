import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { ChatComposerBar } from "@/components/chat/ChatComposerBar";
import { AuroraSafeArea } from "@/components/CosmicBackground";
import { Button } from "@/components/ui/Button";
import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { useChatScreenHorizontalPadding } from "@/constants/chatLayout";
import { useAuth } from "@/lib/auth";
import { fetchUserProfile, type UserProfile } from "@/lib/userProfile";
import { PaywallScreen } from "@/components/coaching/PaywallScreen";
import { useTheme } from "@/providers/ThemeProvider";
import { logEvent } from "@/lib/analytics";
import { useSpeakAssistantOnStreamEnd } from "@/lib/useSpeakAssistantOnStreamEnd";
import { useStreamingChat, type StreamingChatMessage } from "@/lib/useStreamingChat";
import { useVoiceMode } from "@/lib/useVoiceMode";
import { VoiceInputBar } from "@/components/voice/VoiceInputBar";

const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

const STARTER_KEYS = [
  "chat.starter1",
  "chat.starter2",
  "chat.starter3",
  "chat.starter4",
] as const;

const WelcomeEmptyState: React.FC<{
  firstName?: string;
  rtl: boolean;
  horizontalPadding: number;
  onSuggestionTap: (text: string) => void;
  theme: ReturnType<typeof useTheme>["theme"];
}> = ({ firstName, rtl, horizontalPadding, onSuggestionTap, theme }) => {
  const { t } = useTranslation();
  return (
    <View
      className="flex-1 items-center justify-center py-16"
      style={{ paddingHorizontal: horizontalPadding }}
    >
      <Text className="text-5xl">✦</Text>
      <Text
        className="mt-4 text-center text-2xl font-semibold"
        style={{
          color: theme.colors.onBackground,
          writingDirection: rtl ? "rtl" : "ltr",
        }}
      >
        {firstName
          ? t("chat.welcomeGreeting", { name: firstName })
          : t("features.askAnything")}
      </Text>
      <Text
        className="mt-2 text-center text-base"
        style={{
          color: theme.colors.onSurfaceVariant,
          writingDirection: rtl ? "rtl" : "ltr",
        }}
      >
        {t("chat.welcomeHint")}
      </Text>

      <View className="mt-8 w-full gap-2">
        {STARTER_KEYS.map((key) => (
          <Pressable
            key={key}
            onPress={() => onSuggestionTap(t(key))}
            className="min-h-[48px] justify-center rounded-[20px] border px-3 py-2"
            style={{ borderColor: theme.colors.outline }}
          >
            <Text
              className="text-base"
              style={{
                color: theme.colors.onSurfaceVariant,
                writingDirection: rtl ? "rtl" : "ltr",
              }}
            >
              {t(key)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

export default function AskMeAnythingScreen() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === "fa";
  const appLanguage = i18n.language.startsWith("fa") ? "fa" : "en";
  const { theme } = useTheme();
  const router = useRouter();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const { getToken, loading: authLoading, isSignedIn } = useAuth();
  const horizontalPadding = useChatScreenHorizontalPadding();

  const flatListRef = useRef<FlatList<StreamingChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);

  const [inputText, setInputText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const { messages, setMessages, isStreaming, sendMessage: hookSendMessage, retryLastMessage } =
    useStreamingChat({
      streamUrl: `${apiBase}/api/chat/stream`,
      getToken,
      getExtraBody: () => ({
        ...(sessionId != null ? { sessionId } : {}),
        featureKey: "ask_me_anything",
      }),
      onConversationId: setSessionId,
      onPaywall: () => setPaywallOpen(true),
      emptyErrorText: t("chat.errorMessage"),
      onFailedTurn: (draft) => setInputText(draft),
    });

  const voice = useVoiceMode({
    getToken,
    language: appLanguage,
    onTranscript: (text) => {
      void hookSendMessage(text, {
        inputMode: "voice",
        transcript: text,
        language: appLanguage,
      });
    },
  });

  useSpeakAssistantOnStreamEnd(messages, isStreaming, appLanguage);

  const streamingAssistantPreview = useMemo(() => {
    if (!isStreaming) return "";
    const last = [...messages].reverse().find((m) => m.role === "assistant" && m.isStreaming);
    return last?.content ?? "";
  }, [messages, isStreaming]);

  const voiceErrorDetail =
    voice.errorKey === "permission"
      ? t("voice.errorPermission")
      : voice.errorKey === "transcribe"
        ? t("voice.errorTranscribe")
        : voice.errorKey === "unsupported"
          ? t("voice.errorUnsupported")
          : voice.errorKey === "speech"
            ? t("voice.errorSpeech")
            : null;

  useEffect(() => {
    const p = Array.isArray(prefill) ? prefill[0] : prefill;
    if (typeof p === "string" && p.length > 0) {
      setInputText((prev) => (prev.trim().length > 0 ? prev : p));
    }
  }, [prefill]);

  const loadProfile = useCallback(async () => {
    setProfileError(false);
    setProfileLoaded(false);
    try {
      const idToken = await getToken();
      if (!idToken) {
        setProfileLoaded(true);
        return;
      }
      const profile = await fetchUserProfile(idToken);
      setUserProfile(profile);
    } catch (err) {
      console.warn("[ask-me-anything] profile load failed:", err);
      setProfileError(true);
    } finally {
      setProfileLoaded(true);
    }
  }, [getToken]);

  useEffect(() => {
    logEvent("feature_opened", { feature_key: "ask-me-anything" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- analytics once per screen open
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handleViewportResize = () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };
    window.visualViewport?.addEventListener("resize", handleViewportResize);
    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
    };
  }, []);

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
    if (!text || isStreaming) return;
    if (authLoading || !isSignedIn) {
      setMessages((prev) => [
        ...prev,
        {
          id: `auth_${Date.now()}`,
          role: "assistant",
          content: t("chat.authRequired"),
          isError: true,
        },
      ]);
      return;
    }

    const idToken = await getToken();
    if (!idToken) {
      setMessages((prev) => [
        ...prev,
        {
          id: `auth_${Date.now()}`,
          role: "assistant",
          content: t("chat.authRequired"),
          isError: true,
        },
      ]);
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInputText("");
    await hookSendMessage(text);
  };

  const handleFollowUpTap = (prompt: string) => {
    setInputText(prompt);
    inputRef.current?.focus();
  };

  const handleSuggestionTap = (text: string) => {
    void sendMessage(text);
  };

  return (
    <AuroraSafeArea className={`flex-1${Platform.OS === "web" ? " keyboard-aware-container" : ""}`}>
      {/* Header */}
      <View
        className="flex-row items-center border-b py-3"
        style={{
          borderBottomColor: theme.colors.outlineVariant,
          paddingHorizontal: horizontalPadding,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-[20px]"
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <Ionicons
            name={rtl ? "chevron-forward" : "chevron-back"}
            size={24}
            color={theme.colors.onBackground}
          />
        </Pressable>
        <Text
          className="flex-1 text-center text-lg font-semibold"
          style={{ color: theme.colors.onBackground }}
        >
          {t("features.askAnything")}
        </Text>
        <View className="h-10 w-10" />
      </View>

      {/* Profile incomplete banner */}
      {profileLoaded && !profileError && !userProfile?.isProfileComplete ? (
        <Pressable
          onPress={() => router.push("/(profile-setup)/setup")}
          className="mt-2 rounded-xl border p-4"
          style={{
            marginHorizontal: horizontalPadding,
            borderColor: `${theme.colors.primary}40`,
            backgroundColor: `${theme.colors.primaryContainer}30`,
          }}
        >
          <Text
            className="text-center text-sm"
            style={{
              color: theme.colors.primary,
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {t("chat.completeProfileBanner")}
          </Text>
        </Pressable>
      ) : null}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: 16,
          paddingBottom: 12,
          flexGrow: 1,
        }}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        onLayout={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
        ListEmptyComponent={
          !profileLoaded ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={theme.colors.primary} size="large" />
            </View>
          ) : profileError ? (
            <View
              className="flex-1 items-center justify-center py-16"
              style={{ paddingHorizontal: horizontalPadding }}
            >
              <Text
                className="text-center text-base"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  writingDirection: rtl ? "rtl" : "ltr",
                }}
              >
                {t("account.errors.generic")}
              </Text>
              <Button title={t("common.tryAgain")} onPress={() => void loadProfile()} className="mt-4" />
            </View>
          ) : (
            <WelcomeEmptyState
              firstName={userProfile?.user?.name ?? userProfile?.user?.firstName ?? undefined}
              rtl={rtl}
              horizontalPadding={horizontalPadding}
              onSuggestionTap={handleSuggestionTap}
              theme={theme}
            />
          )
        }
        renderItem={({ item }) => (
          <ChatMessageBubble
            message={item}
            rtl={rtl}
            onFollowUpTap={handleFollowUpTap}
            theme={theme}
            onRetry={retryLastMessage}
          />
        )}
      />

      {/* Input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <VoiceInputBar
          phase={voice.phase}
          interimText={voice.interimText}
          streamingAssistantText={streamingAssistantPreview}
          theme={theme}
          rtl={rtl}
          labels={{
            listening: t("voice.listening"),
            transcribing: t("voice.transcribing"),
            error: t("voice.error"),
          }}
          errorDetail={voiceErrorDetail}
        />
        <ChatComposerBar
          ref={inputRef}
          value={inputText}
          onChangeText={setInputText}
          onSend={() => void sendMessage()}
          placeholder={t("chat.inputPlaceholder")}
          theme={theme}
          rtl={rtl}
          horizontalPadding={horizontalPadding}
          inputDisabled={isStreaming}
          sending={isStreaming}
          maxLength={2000}
          outerClassName={Platform.OS === "web" ? "chat-input-bar" : ""}
          leadingAccessory={
            voice.isSupported ? (
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  void voice.toggleListening();
                }}
                disabled={
                  isStreaming || voice.phase === "transcribing" || authLoading || !isSignedIn
                }
                accessibilityRole="button"
                accessibilityLabel={t("voice.micA11y")}
                hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
                className="h-11 w-11 items-center justify-center rounded-[22px]"
                style={{
                  backgroundColor:
                    voice.phase === "listening" ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                }}
              >
                <Ionicons
                  name={voice.phase === "listening" ? "stop-circle" : "mic"}
                  size={24}
                  color={
                    voice.phase === "listening" ? theme.colors.primary : theme.colors.onSurfaceVariant
                  }
                />
              </Pressable>
            ) : undefined
          }
        />
      </KeyboardAvoidingView>

      {/* Paywall overlay */}
      {paywallOpen ? (
        <PaywallScreen
          context="chat_limit"
          onContinueFree={() => setPaywallOpen(false)}
        />
      ) : null}
    </AuroraSafeArea>
  );
}
