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
      <View className={`mx-4 mb-3 max-w-[85%] ${isUser ? "self-end" : "self-start"}`}>
        {!isUser && (
          <Text className="mb-1 ml-1 text-xs" style={{ color: theme.colors.onSurfaceVariant }}>
            ✦ Akhtar
          </Text>
        )}
        <View
          className="rounded-2xl px-4 py-3"
          style={{
            backgroundColor: isUser ? theme.colors.primaryContainer : theme.colors.surface,
            borderWidth: 1,
            borderColor:    isUser ? theme.colors.primary         : theme.colors.outline,
            borderTopRightRadius: isUser ? 4  : 16,
            borderTopLeftRadius:  isUser ? 16 : 4,
          }}
        >
          {item.isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.onSurfaceVariant} />
          ) : (
            <Text
              className="text-sm leading-6"
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
          <Text className="mt-1 px-1 text-xs" style={{ color: `${theme.colors.onSurfaceVariant}60`, textAlign: isUser ? "right" : "left" }}>
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
        className="flex-row items-center border-b px-4 py-3"
        style={{ borderColor: theme.colors.outlineVariant }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="mr-3 rounded-full p-1"
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
        contentContainerStyle={{ paddingVertical: 16 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View
          className="flex-row items-end gap-2 border-t px-4 py-3"
          style={{ borderColor: theme.colors.outlineVariant }}
        >
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder={t("chat.inputPlaceholder")}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            multiline
            textAlignVertical="top"
            maxLength={2000}
            editable={!sending}
            className="flex-1 rounded-2xl border px-4 py-3 text-sm"
            style={{
              maxHeight: 100,
              borderColor: theme.colors.outline,
              color: theme.colors.onBackground,
              writingDirection: rtl ? "rtl" : "ltr",
              textAlign: rtl ? "right" : "left",
            }}
            returnKeyType="send"
            onSubmitEditing={() => void handleSend()}
          />
          <Pressable
            onPress={() => void handleSend()}
            disabled={!inputText.trim() || sending}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor:
                inputText.trim() && !sending ? theme.colors.primary : theme.colors.surfaceVariant,
            }}
          >
            {sending ? (
              <ActivityIndicator size="small" color={theme.colors.onSurfaceVariant} />
            ) : (
              <Ionicons
                name="send"
                size={16}
                color={inputText.trim() ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </AuroraSafeArea>
  );
}
