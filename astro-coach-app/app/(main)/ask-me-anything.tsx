import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { AuroraSafeArea } from "@/components/CosmicBackground";
import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { useAuth } from "@/lib/auth";
import { fetchUserProfile, type UserProfile } from "@/lib/userProfile";
import { PaywallScreen } from "@/components/coaching/PaywallScreen";
import { useTheme } from "@/providers/ThemeProvider";
import { logEvent } from "@/lib/analytics";
import { useStreamingChat, type StreamingChatMessage } from "@/lib/useStreamingChat";

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
  onSuggestionTap: (text: string) => void;
  theme: ReturnType<typeof useTheme>["theme"];
}> = ({ firstName, rtl, onSuggestionTap, theme }) => {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center px-6 py-16">
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
            className="min-h-[48px] justify-center rounded-2xl border px-4 py-3"
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
  const { theme } = useTheme();
  const router = useRouter();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const { getToken, loading: authLoading, isSignedIn } = useAuth();

  const flatListRef = useRef<FlatList<StreamingChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);

  const [inputText, setInputText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
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

  useEffect(() => {
    const p = Array.isArray(prefill) ? prefill[0] : prefill;
    if (typeof p === "string" && p.length > 0) {
      setInputText((prev) => (prev.trim().length > 0 ? prev : p));
    }
  }, [prefill]);

  useEffect(() => {
    logEvent("feature_opened", { feature_key: "ask-me-anything" });
    const loadProfile = async () => {
      try {
        const idToken = await getToken();
        if (!idToken) return;
        const profile = await fetchUserProfile(idToken);
        setUserProfile(profile);
      } catch (err) {
        console.warn("[ask-me-anything] profile load failed:", err);
      } finally {
        setProfileLoaded(true);
      }
    };
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        className="flex-row items-center border-b px-4 py-3"
        style={{ borderBottomColor: theme.colors.outlineVariant }}
      >
        <Pressable
          onPress={() => router.back()}
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
          hitSlop={8}
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
        <View className="min-w-[44px]" />
      </View>

      {/* Profile incomplete banner */}
      {profileLoaded && !userProfile?.isProfileComplete ? (
        <Pressable
          onPress={() => router.push("/(profile-setup)/setup")}
          className="mx-4 mt-2 rounded-xl border p-3"
          style={{
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
        contentContainerStyle={{ padding: 16, paddingBottom: 8, flexGrow: 1 }}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        onLayout={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
        ListEmptyComponent={
          profileLoaded ? (
            <WelcomeEmptyState
              firstName={userProfile?.user?.name ?? userProfile?.user?.firstName ?? undefined}
              rtl={rtl}
              onSuggestionTap={handleSuggestionTap}
              theme={theme}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={theme.colors.primary} size="large" />
            </View>
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          className={`flex-row items-end gap-2 border-t px-4 py-3${Platform.OS === "web" ? " chat-input-bar" : ""}`}
          style={{ borderTopColor: theme.colors.outlineVariant }}
        >
          <TextInput
            ref={inputRef}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t("chat.inputPlaceholder")}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            selectionColor={theme.colors.primary}
            cursorColor={theme.colors.primary}
            className="flex-1 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: theme.colors.surfaceVariant,
              color: theme.colors.onBackground,
              fontSize: 16,
              textAlign: rtl ? "right" : "left",
              maxHeight: 120,
            }}
            multiline
            maxLength={2000}
            onSubmitEditing={() => void sendMessage()}
            editable={!isStreaming}
          />
          <Pressable
            onPress={() => void sendMessage()}
            disabled={!inputText.trim() || isStreaming}
            className="min-h-[48px] min-w-[48px] items-center justify-center rounded-full"
            style={{
              backgroundColor:
                inputText.trim() && !isStreaming
                  ? theme.colors.primary
                  : theme.colors.surfaceVariant,
            }}
          >
            {isStreaming ? (
              <ActivityIndicator size="small" color={theme.colors.onPrimary ?? "#fff"} />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={
                  inputText.trim()
                    ? theme.colors.onPrimary ?? "#fff"
                    : theme.colors.onSurfaceVariant
                }
              />
            )}
          </Pressable>
        </View>
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
