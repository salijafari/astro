import { useAuth } from "@clerk/clerk-expo";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGetJson } from "@/lib/api";

type Conv = {
  id: string;
  title: string | null;
  category: string | null;
  updatedAt: string;
};

export default function HistoryScreen() {
  const { getToken } = useAuth();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Conv[]>([]);
  const [limited, setLimited] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiGetJson<{ conversations: Conv[]; limited: boolean }>(
        `/api/conversations?search=${encodeURIComponent(q)}`,
        getToken,
      );
      setRows(r.conversations ?? []);
      setLimited(r.limited ?? false);
    } catch {
      setRows([]);
    }
  }, [getToken, q]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
      <Text className="text-white text-2xl font-bold px-4 pt-4">History</Text>
      {limited ? <Text className="text-amber-300 px-4 text-sm">Free plan: last 3 conversations.</Text> : null}
      <TextInput
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => void load()}
        placeholder="Search messages…"
        placeholderTextColor="#64748b"
        className="mx-4 mt-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white"
      />
      <FlatList
        data={rows}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-2">
            <Text className="text-indigo-300 text-xs">{item.category ?? "General"}</Text>
            <Text className="text-white font-medium mt-1">{item.title ?? "Chat"}</Text>
            <Text className="text-slate-500 text-xs mt-1">{item.updatedAt}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
