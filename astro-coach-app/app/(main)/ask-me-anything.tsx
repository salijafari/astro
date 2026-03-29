import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { apiPostJson } from "@/lib/api";
import { fetchUserProfile, type UserProfile } from "@/lib/userProfile";
import { PaywallScreen } from "@/components/coaching/PaywallScreen";
import { useTheme } from "@/providers/ThemeProvider";
import { logEvent } from "@/lib/analytics";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  followUpPrompts?: string[];
  isError?: boolean;
  isLoading?: boolean;
};

type ChatResponse = {
  content?: string;
  response?: string;
  followUpPrompts?: string[];
  sessionId?: string;
  conversationId?: string;
  error?: string;
};

const STARTER_KEYS = [
  "chat.starter1",
  "chat.starter2",
  "chat.starter3",
  "chat.starter4",
] as const;

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

const MessageBubble: React.FC<{
  message: Message;
  rtl: boolean;
  onFollowUpTap: (text: string) => void;
  theme: ReturnType<typeof useTheme>["theme"];
}> = ({ message, rtl, onFollowUpTap, theme }) => {
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
      </View>

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

export default function AskMeAnythingScreen() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === "fa";
  const { theme } = useTheme();
  const router = useRouter();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const { getToken, loading: authLoading, isSignedIn } = useAuth();

  const flatListRef = useRef<FlatList<Message>>(null);
  const inputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

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

  const isFreeLimit = (e: unknown) => {
    const s = e instanceof Error ? e.message : String(e);
    return s.includes("free_limit");
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
    if (!text || isLoading) return;
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

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    const loadingId = `loading_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: loadingId, role: "assistant", content: "", isLoading: true },
    ]);

    try {
      const res = await apiPostJson<ChatResponse>(
        "/api/chat/message",
        async () => idToken,
        { sessionId, content: text, featureKey: "ask_me_anything" },
      );

      const nextSessionId = res.sessionId ?? res.conversationId ?? null;
      if (nextSessionId) {
        setSessionId(nextSessionId);
      }
      const assistantContent = res.content ?? res.response ?? t("chat.errorMessage");

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingId
            ? {
                id: loadingId,
                role: "assistant" as const,
                content: assistantContent,
                followUpPrompts: res.followUpPrompts ?? [],
                isError: false,
                isLoading: false,
              }
            : msg,
        ),
      );
    } catch (e) {
      if (isFreeLimit(e)) {
        setMessages((prev) => prev.filter((msg) => msg.id !== loadingId));
        setPaywallOpen(true);
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingId
              ? {
                  id: loadingId,
                  role: "assistant" as const,
                  content: t("chat.errorMessage"),
                  isError: true,
                  isLoading: false,
                }
              : msg,
          ),
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowUpTap = (prompt: string) => {
    setInputText(prompt);
    inputRef.current?.focus();
  };

  const handleSuggestionTap = (text: string) => {
    void sendMessage(text);
  };

  return (
    <SafeAreaView
      className={`flex-1${Platform.OS === "web" ? " keyboard-aware-container" : ""}`}
      style={{ backgroundColor: theme.colors.background }}
    >
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
          onPress={() => router.push("/(onboarding)/get-set-up")}
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
              // Name source: `userProfile.user.firstName` from GET /api/user/profile.
              firstName={userProfile?.user?.firstName ?? undefined}
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
          <MessageBubble
            message={item}
            rtl={rtl}
            onFollowUpTap={handleFollowUpTap}
            theme={theme}
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
            editable={!isLoading}
          />
          <Pressable
            onPress={() => void sendMessage()}
            disabled={!inputText.trim() || isLoading}
            className="min-h-[48px] min-w-[48px] items-center justify-center rounded-full"
            style={{
              backgroundColor:
                inputText.trim() && !isLoading
                  ? theme.colors.primary
                  : theme.colors.surfaceVariant,
            }}
          >
            {isLoading ? (
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
    </SafeAreaView>
  );
}
