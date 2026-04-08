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
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { ChatComposerBar } from "@/components/chat/ChatComposerBar";
import { AuroraSafeArea } from "@/components/CosmicBackground";
import { useChatScreenHorizontalPadding } from "@/constants/chatLayout";
import { useAuth } from "@/lib/auth";
import { apiGetJson, apiPostJson } from "@/lib/api";
import { getFeatureConfig } from "@/lib/featureConfig";
import { useTheme } from "@/providers/ThemeProvider";

type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  isLoading?: boolean;
  isTemp?: boolean;
};

type ConversationDetail = {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  messages: MessageRow[];
};

type DetailResponse = { conversation: ConversationDetail };
type ChatResponse   = { content?: string; response?: string };

/**
 * Conversation detail screen — shows the full message thread and allows
 * the user to continue chatting using the existing /api/chat/message endpoint.
 * Claude automatically loads the last 20 messages from the conversation
 * history so it has full context of the thread.
 */
export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { getToken } = useAuth();
  const router = useRouter();
  const rtl = i18n.language === "fa";
  const horizontalPadding = useChatScreenHorizontalPadding();

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<MessageRow>>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiGetJson<DetailResponse>(`/api/history/${id}`, getToken);
        setConversation(data.conversation);
        setMessages(data.conversation.messages);
      } catch (err) {
        console.warn("[history/detail] load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, getToken]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending || !id) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const loadingId = `loading_${Date.now()}`;
    const tempUserId = `u_${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: text, createdAt: new Date().toISOString(), isTemp: true },
      { id: loadingId, role: "assistant", content: "", createdAt: new Date().toISOString(), isLoading: true },
    ]);
    setInputText("");
    setSending(true);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const data = await apiPostJson<ChatResponse>("/api/chat/message", getToken, {
        sessionId:  id,
        content:    text,
        featureKey: conversation?.category ?? "ask_me_anything",
      });

      const reply = data.content ?? data.response ?? t("dreamInterpreter.genericError");

      setMessages((prev) =>
        prev
          .filter((m) => !m.isTemp && !m.isLoading)
          .concat([
            { id: tempUserId, role: "user",      content: text,  createdAt: new Date().toISOString() },
            { id: loadingId,  role: "assistant",  content: reply, createdAt: new Date().toISOString() },
          ]),
      );

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (err) {
      console.warn("[history/detail] send error:", err);
      setMessages((prev) => prev.filter((m) => !m.isTemp && !m.isLoading));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: MessageRow }) => {
    const isUser = item.role === "user";
    return (
      <View className={`mb-2 max-w-[80%] ${isUser ? "self-end" : "self-start"}`}>
        {!isUser && (
          <Text
            className="mb-2 text-xs"
            style={{
              color: theme.colors.onSurfaceVariant,
              marginLeft: rtl ? 0 : 4,
              marginRight: rtl ? 4 : 0,
            }}
          >
            ✦ Akhtar
          </Text>
        )}
        <View
          className="rounded-xl border px-3 py-2"
          style={{
            backgroundColor: isUser ? theme.colors.primaryContainer : theme.colors.surface,
            borderColor: isUser ? theme.colors.primary : theme.colors.outline,
          }}
        >
          {item.isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.onSurfaceVariant} />
          ) : (
            <Text
              className="text-base leading-6"
              style={{
                color: isUser ? theme.colors.onPrimaryContainer : theme.colors.onBackground,
                writingDirection: rtl ? "rtl" : "ltr",
              }}
            >
              {item.content}
            </Text>
          )}
        </View>
        {!item.isLoading && (
          <Text
            className="mt-2 text-xs"
            style={{
              color: `${theme.colors.onSurfaceVariant}60`,
              textAlign: isUser ? "right" : "left",
            }}
          >
            {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <AuroraSafeArea className="flex-1 items-center justify-center">
        <ActivityIndicator color={theme.colors.primary} />
      </AuroraSafeArea>
    );
  }

  const featureConfig = getFeatureConfig(conversation?.category ?? "ask_me_anything");

  return (
    <AuroraSafeArea className="flex-1">
      {/* Header */}
      <View
        className="flex-row items-center border-b py-3"
        style={{
          borderColor: theme.colors.outlineVariant,
          paddingHorizontal: horizontalPadding,
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
          className="h-10 w-10 items-center justify-center rounded-[20px]"
        >
          <Ionicons
            name={rtl ? "chevron-forward" : "chevron-back"}
            size={24}
            color={theme.colors.onBackground}
          />
        </Pressable>
        <View className="flex-1">
          {/* Feature badge */}
          <View
            className="mb-1 flex-row items-center self-start rounded-full px-2 py-0.5"
            style={{ backgroundColor: `${featureConfig.color}20` }}
          >
            <Ionicons name={featureConfig.icon as any} size={10} color={featureConfig.color} />
            <Text className="ml-1 text-xs font-medium" style={{ color: featureConfig.color }}>
              {t(featureConfig.labelKey)}
            </Text>
          </View>
          <Text
            className="text-sm font-semibold"
            numberOfLines={1}
            style={{ color: theme.colors.onBackground, textAlign: rtl ? "right" : "left" }}
          >
            {conversation?.title ?? t("history.title")}
          </Text>
        </View>
      </View>

      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: 16,
          paddingBottom: 12,
        }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ChatComposerBar
          value={inputText}
          onChangeText={setInputText}
          onSend={() => void handleSend()}
          placeholder={t("chat.inputPlaceholder")}
          theme={theme}
          rtl={rtl}
          horizontalPadding={horizontalPadding}
          inputDisabled={sending}
          sending={sending}
          maxLength={2000}
        />
      </KeyboardAvoidingView>
    </AuroraSafeArea>
  );
}
