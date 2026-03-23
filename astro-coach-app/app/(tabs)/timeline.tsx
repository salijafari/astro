import { useAuth } from "@clerk/clerk-expo";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { apiGetJson, apiPostJson } from "@/lib/api";

type Entry = { id: string; theme: string | null; summary: string | null; date: string };

export default function TimelineScreen() {
  const { getToken } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await apiGetJson<{ entries: Entry[] }>("/api/timeline", getToken);
      setEntries(r.entries ?? []);
    } catch {
      setEntries([]);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const generate = async () => {
    try {
      await apiPostJson("/api/timeline/generate-weekly", getToken, {});
      void load();
    } catch {
      /* ignore */
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
      <Text className="text-white text-2xl font-bold px-4 pt-4">Growth timeline</Text>
      <Button title="Generate weekly summary" variant="secondary" onPress={() => void generate()} />
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text className="text-slate-500">No entries yet.</Text>}
        renderItem={({ item }) => (
          <View className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-3">
            <Text className="text-slate-500 text-xs">{item.date}</Text>
            {item.theme ? <Text className="text-pink-300 text-sm mt-1">{item.theme}</Text> : null}
            <Text className="text-slate-100 mt-2">{item.summary}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
