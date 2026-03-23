import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { apiPostJson } from "@/lib/api";

type Msg = { id: string; role: "user" | "assistant"; content: string };

/**
 * AI coaching chat — uses `/api/chat/complete` for broad RN compatibility.
 */
export default function ChatScreen() {
  const { getToken } = useAuth();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState<number | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (prefill && typeof prefill === "string") setInput(prefill);
  }, [prefill]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    try {
      const res = await apiPostJson<{ response: string; followUpPrompts: string[]; conversationId: string }>(
        "/api/chat/complete",
        getToken,
        { message: text, conversationId },
      );
      setConversationId(res.conversationId);
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: "assistant", content: res.response },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("free_limit") || msg.includes("402")) {
        setUsed(3);
        setMessages((m) => [
          ...m,
          {
            id: `sys-${Date.now()}`,
            role: "assistant",
            content: "You have used your free questions for today. Upgrade for unlimited chat.",
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { id: `e-${Date.now()}`, role: "assistant", content: "Something went wrong. Check API URL and keys." },
        ]);
      }
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [busy, conversationId, getToken, input]);

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <Text className="text-white text-2xl font-bold px-4 pt-2">Ask me anything</Text>
        {used != null ? (
          <Text className="text-amber-300 px-4 text-sm mt-1">Free tier: daily question limit reached.</Text>
        ) : (
          <Text className="text-slate-500 px-4 text-sm mt-1">3 questions/day on free — server enforced.</Text>
        )}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <View className={`mb-3 max-w-[90%] ${item.role === "user" ? "self-end bg-indigo-600" : "self-start bg-slate-800 border border-slate-700"} rounded-2xl px-4 py-3`}>
              <Text className={item.role === "user" ? "text-white" : "text-slate-100"}>{item.content}</Text>
            </View>
          )}
        />
        <View className="flex-row items-end gap-2 px-4 pb-4 border-t border-slate-800 pt-3">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message…"
            placeholderTextColor="#64748b"
            multiline
            className="flex-1 bg-slate-900 text-white rounded-2xl px-4 py-3 max-h-32"
          />
          <Button title="Send" onPress={() => void send()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
