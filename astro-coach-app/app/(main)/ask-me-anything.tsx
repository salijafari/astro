import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useTranslation } from "react-i18next";
import { AuroraSafeArea } from "@/components/CosmicBackground";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { authApiRef } from "@/lib/authApiRef";
import { fetchUserProfile, type UserProfile } from "@/lib/userProfile";
import { PaywallScreen } from "@/components/coaching/PaywallScreen";
import { useTheme } from "@/providers/ThemeProvider";
import { logEvent } from "@/lib/analytics";
import { sanitizeAccumulated, sanitizeStreamText } from "@/lib/sanitizeStreamText";

const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  followUpPrompts?: string[];
  isError?: boolean;
  isLoading?: boolean;
  isStreaming?: boolean;
  /** When the assistant fails, one-tap retry re-sends this user text. */
  retryDraft?: string;
};

/** Match server-side follow-up extraction so the bubble stays clean after streaming. */
const splitAssistantReply = (raw: string): { body: string; followUps: string[] } => {
  let full = raw;
  let followUps: string[] = [];
  const followUpSplit = full.split("---FOLLOW_UPS---");
  if (followUpSplit.length > 1) {
    full = followUpSplit[0]!.trim();
    followUps = followUpSplit[1]!
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } else {
    const jmatch = full.match(/\{[\s\S]*"followUpPrompts"[\s\S]*\}\s*$/);
    if (jmatch) {
      try {
        const j = JSON.parse(jmatch[0]) as { followUpPrompts?: string[] };
        followUps = j.followUpPrompts ?? [];
      } catch {
        /* ignore */
      }
    }
  }
  return { body: full, followUps };
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

const StreamingCursor: React.FC<{ cursorColor: string }> = ({ cursorColor }) => {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{
        width: 2,
        height: 16,
        marginLeft: 2,
        borderRadius: 1,
        backgroundColor: cursorColor,
        alignSelf: "flex-end",
        opacity,
      }}
    />
  );
};

const MessageBubble: React.FC<{
  message: Message;
  rtl: boolean;
  onFollowUpTap: (text: string) => void;
  theme: ReturnType<typeof useTheme>["theme"];
  onRetrySend?: (draft: string) => void;
}> = ({ message, rtl, onFollowUpTap, theme, onRetrySend }) => {
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

      {message.isError && message.retryDraft && onRetrySend ? (
        <Pressable
          onPress={() => onRetrySend(message.retryDraft!)}
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

  const streamRawBufferRef = useRef("");
  const streamDisplayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamAssistantIdRef = useRef<string | null>(null);

  const stopStreamDisplay = useCallback(() => {
    if (streamDisplayIntervalRef.current) {
      clearInterval(streamDisplayIntervalRef.current);
      streamDisplayIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopStreamDisplay();
    };
  }, [stopStreamDisplay]);

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

    const assistantMsgId = `assistant_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
        isLoading: false,
      },
    ]);

    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 30_000);

    const removeAssistantPlaceholder = () => {
      stopStreamDisplay();
      streamRawBufferRef.current = "";
      streamAssistantIdRef.current = null;
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMsgId));
    };

    const failTurn = (partialRaw?: string) => {
      stopStreamDisplay();
      streamAssistantIdRef.current = null;
      streamRawBufferRef.current = "";
      setInputText(text);
      const partialClean =
        partialRaw && partialRaw.length > 0
          ? sanitizeStreamText(splitAssistantReply(partialRaw).body)
          : "";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                id: assistantMsgId,
                role: "assistant" as const,
                content: partialClean.length > 0 ? partialClean : t("chat.errorMessage"),
                isError: true,
                isStreaming: false,
                isLoading: false,
                retryDraft: text,
              }
            : msg,
        ),
      );
    };

    try {
      if (Platform.OS === "web") {
        const url = `${apiBase}/api/chat/stream`;
        let authToken = idToken;
        const postStream = () =>
          fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: text,
              sessionId,
              featureKey: "ask_me_anything",
            }),
            signal: ac.signal,
          });

        let res = await postStream();
        if (res.status === 401 && authApiRef.refreshToken) {
          const t2 = await authApiRef.refreshToken();
          if (t2) {
            authToken = t2;
            res = await postStream();
          }
        }
        if (res.status === 401 && authApiRef.onAuthFailure) {
          await authApiRef.onAuthFailure();
        }
        if (res.status === 402) {
          removeAssistantPlaceholder();
          setPaywallOpen(true);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.body) throw new Error("No response body");

        stopStreamDisplay();
        streamRawBufferRef.current = "";
        streamAssistantIdRef.current = assistantMsgId;
        streamDisplayIntervalRef.current = setInterval(() => {
          const id = streamAssistantIdRef.current;
          if (!id || streamRawBufferRef.current.length === 0) return;
          const sanitized = sanitizeAccumulated(streamRawBufferRef.current);
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, content: sanitized, isStreaming: true } : m)),
          );
        }, 40);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamDoneReceived = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            const lines = block.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (!payload) continue;
              let parsed: {
                type?: string;
                text?: string;
                conversationId?: string;
                messageId?: string;
                content?: string;
                followUpPrompts?: string[];
                error?: string;
              };
              try {
                parsed = JSON.parse(payload) as typeof parsed;
              } catch {
                continue;
              }
              if (parsed.type === "token" && parsed.text) {
                streamRawBufferRef.current += parsed.text;
              }
              if (parsed.type === "done") {
                streamDoneReceived = true;
                stopStreamDisplay();
                streamAssistantIdRef.current = null;
                const raw = streamRawBufferRef.current;
                streamRawBufferRef.current = "";
                const split = splitAssistantReply(raw);
                const displayBody =
                  typeof parsed.content === "string" && parsed.content.length > 0
                    ? parsed.content
                    : sanitizeStreamText(split.body);
                const followUps =
                  parsed.followUpPrompts && parsed.followUpPrompts.length > 0
                    ? parsed.followUpPrompts
                    : split.followUps;
                if (parsed.conversationId) setSessionId(parsed.conversationId);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: displayBody,
                          followUpPrompts: followUps,
                          isStreaming: false,
                          isLoading: false,
                        }
                      : m,
                  ),
                );
              }
              if (parsed.type === "error") {
                throw new Error(parsed.error ?? "chat_failed");
              }
            }
          }
        }

        if (!streamDoneReceived) {
          stopStreamDisplay();
          streamAssistantIdRef.current = null;
          const raw = streamRawBufferRef.current;
          streamRawBufferRef.current = "";
          if (raw.length > 0) {
            const split = splitAssistantReply(raw);
            const displayBody = sanitizeStreamText(split.body);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content: displayBody,
                      followUpPrompts: split.followUps,
                      isStreaming: false,
                      isLoading: false,
                    }
                  : m,
              ),
            );
          }
        }
        return;
      }

      stopStreamDisplay();
      streamRawBufferRef.current = "";
      streamAssistantIdRef.current = null;

      const res = await apiRequest("/api/chat/message", {
        method: "POST",
        getToken: async () => idToken,
        body: JSON.stringify({
          sessionId,
          content: text,
          featureKey: "ask_me_anything",
        }),
        signal: ac.signal,
      });

      if (res.status === 402) {
        let body: { error?: string } = {};
        try {
          body = (await res.json()) as { error?: string };
        } catch {
          /* ignore */
        }
        if (body.error === "free_limit") {
          removeAssistantPlaceholder();
          setPaywallOpen(true);
          return;
        }
      }

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || res.statusText);
      }

      const chatRes = (await res.json()) as ChatResponse;
      const nextSessionId = chatRes.sessionId ?? chatRes.conversationId ?? null;
      if (nextSessionId) {
        setSessionId(nextSessionId);
      }
      const rawAssistant = chatRes.content ?? chatRes.response ?? t("chat.errorMessage");
      const assistantContent = sanitizeStreamText(rawAssistant);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                id: assistantMsgId,
                role: "assistant" as const,
                content: assistantContent,
                followUpPrompts: chatRes.followUpPrompts ?? [],
                isError: false,
                isStreaming: false,
                isLoading: false,
              }
            : msg,
        ),
      );
    } catch (e) {
      if (isFreeLimit(e)) {
        removeAssistantPlaceholder();
        setPaywallOpen(true);
      } else {
        failTurn(Platform.OS === "web" ? streamRawBufferRef.current : undefined);
      }
    } finally {
      clearTimeout(timeoutId);
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
          <MessageBubble
            message={item}
            rtl={rtl}
            onFollowUpTap={handleFollowUpTap}
            theme={theme}
            onRetrySend={(draft) => void sendMessage(draft)}
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
    </AuroraSafeArea>
  );
}
