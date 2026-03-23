import { useAuth } from "@clerk/clerk-expo";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { apiPostJson } from "@/lib/api";

export default function TarotScreen() {
  const { getToken } = useAuth();
  const [intention, setIntention] = useState("");
  const [summary, setSummary] = useState("");

  const draw = async (spread: "single" | "three" | "celtic") => {
    try {
      const r = await apiPostJson<{ summary: string }>("/api/tarot/reading", getToken, {
        spread,
        intention: intention || undefined,
      });
      setSummary(r.summary);
    } catch {
      setSummary("Premium required or API error.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-4" edges={["top"]}>
      <Text className="text-white text-2xl font-bold pt-4">Tarot</Text>
      <TextInput
        value={intention}
        onChangeText={setIntention}
        placeholder="Optional intention (max 200 chars)"
        placeholderTextColor="#64748b"
        maxLength={200}
        className="mt-4 bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white"
      />
      <View className="gap-2 mt-4">
        <Button title="Single card" onPress={() => void draw("single")} />
        <Button title="Three card" variant="secondary" onPress={() => void draw("three")} />
        <Button title="Celtic cross (5 cards)" variant="secondary" onPress={() => void draw("celtic")} />
      </View>
      {summary ? <Text className="text-slate-200 mt-6 leading-6">{summary}</Text> : null}
    </SafeAreaView>
  );
}
