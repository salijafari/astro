import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { apiGetJson, apiPostJson } from "@/lib/api";

type Entry = { id: string; content: string; moodTag: string | null; createdAt: string };

export default function JournalScreen() {
  const { getToken } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);

  const refresh = useCallback(async () => {
    try {
      const r = await apiGetJson<{ entries: Entry[] }>("/api/journal/entries", getToken);
      setEntries(r.entries ?? []);
    } catch {
      /* ignore */
    }
  }, [getToken]);

  const loadPrompt = async () => {
    try {
      const r = await apiGetJson<{ prompt: string }>("/api/journal/prompt", getToken);
      setPrompt(r.prompt);
    } catch {
      setPrompt("What shifted your perspective today?");
    }
  };

  const save = async () => {
    if (!content.trim()) return;
    try {
      await apiPostJson("/api/journal/entry", getToken, {
        content: content.trim(),
        moodTag: "Reflective",
        promptUsed: prompt,
      });
      setContent("");
      void refresh();
    } catch {
      /* limit or error */
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
      <Text className="text-white text-2xl font-bold px-4 pt-4">Journal</Text>
      <Button title="Refresh prompt" variant="secondary" onPress={() => void loadPrompt()} />
      <Text className="text-indigo-200 px-4 mt-2">{prompt || "Tap refresh for a prompt."}</Text>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="Write freely…"
        placeholderTextColor="#64748b"
        multiline
        className="mx-4 mt-4 bg-slate-900 border border-slate-700 rounded-2xl p-4 text-white min-h-[120px]"
      />
      <Button title="Save entry" onPress={() => void save()} />
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        onLayout={() => void refresh()}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View className="bg-slate-900 rounded-xl p-3 mb-2">
            <Text className="text-slate-500 text-xs">{item.createdAt}</Text>
            <Text className="text-slate-200 mt-1" numberOfLines={3}>
              {item.content}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
