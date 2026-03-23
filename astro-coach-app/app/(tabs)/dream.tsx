import { useAuth } from "@clerk/clerk-expo";
import { useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { apiGetJson, apiPostJson } from "@/lib/api";

type Row = { id: string; dreamText: string; interpretation: Record<string, string> };

export default function DreamScreen() {
  const { getToken } = useAuth();
  const [text, setText] = useState("");
  const [recent, setRecent] = useState<Row[]>([]);
  const [out, setOut] = useState("");

  const loadRecent = async () => {
    try {
      const r = await apiGetJson<{ entries: Row[] }>("/api/dream/recent", getToken);
      setRecent(r.entries ?? []);
    } catch {
      /* ignore */
    }
  };

  const interpret = async () => {
    if (text.length < 20) {
      setOut("Add a bit more detail (20+ characters).");
      return;
    }
    try {
      const r = await apiPostJson<{ interpretation: Record<string, string> }>(
        "/api/dream/interpret",
        getToken,
        { text },
      );
      setOut(JSON.stringify(r.interpretation, null, 2));
      setText("");
      void loadRecent();
    } catch {
      setOut("Premium required or API error.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
      <Text className="text-white text-2xl font-bold px-4 pt-4">Dreams</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Describe your dream…"
        placeholderTextColor="#64748b"
        multiline
        className="mx-4 mt-4 bg-slate-900 border border-slate-700 rounded-2xl p-4 text-white min-h-[140px]"
      />
      <Button title="Interpret my dream" onPress={() => void interpret()} />
      {out ? <Text className="text-slate-200 px-4 mt-2">{out}</Text> : null}
      <Text className="text-slate-500 px-4 mt-6">Recent</Text>
      <FlatList
        data={recent}
        keyExtractor={(i) => i.id}
        onLayout={() => void loadRecent()}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <View className="bg-slate-900 rounded-xl p-3 mb-2">
            <Text className="text-slate-400 text-xs">{item.dreamText.slice(0, 80)}…</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
