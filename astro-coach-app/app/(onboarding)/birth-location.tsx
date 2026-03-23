import { useAuth } from "@/lib/auth";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { apiGetJson } from "@/lib/api";
import { trackEvent } from "@/lib/mixpanel";
import { useOnboardingStore } from "@/stores/onboardingStore";

type Pred = { description: string; place_id: string };

export default function BirthLocationScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const setPartial = useOnboardingStore((s) => s.setPartial);
  const birthCity = useOnboardingStore((s) => s.birthCity);
  const [q, setQ] = useState("");
  const [preds, setPreds] = useState<Pred[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEvent("onboarding_step_5_viewed");
  }, []);

  const search = useCallback(async () => {
    if (q.length < 2) {
      setPreds([]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiGetJson<{ predictions: Pred[] }>(
        `/api/places/autocomplete?q=${encodeURIComponent(q)}`,
        getToken,
      );
      setPreds(res.predictions ?? []);
    } catch {
      setPreds([]);
    } finally {
      setLoading(false);
    }
  }, [q, getToken]);

  useEffect(() => {
    const t = setTimeout(() => void search(), 350);
    return () => clearTimeout(t);
  }, [search]);

  const pick = async (p: Pred) => {
    setLoading(true);
    try {
      const d = await apiGetJson<{
        birthCity: string;
        birthLat: number;
        birthLong: number;
        birthTimezone: string;
      }>(`/api/places/details?place_id=${encodeURIComponent(p.place_id)}`, getToken);
      setPartial({
        birthCity: d.birthCity,
        birthLat: d.birthLat,
        birthLong: d.birthLong,
        birthTimezone: d.birthTimezone,
      });
      trackEvent("onboarding_step_5_completed");
      router.replace("/(onboarding)/interests");
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (!birthCity) return;
    trackEvent("onboarding_step_5_completed");
    router.replace("/(onboarding)/interests");
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <Text className="text-white text-2xl font-bold mt-10">Where were you born?</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search city"
          placeholderTextColor="#64748b"
          className="mt-4 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-4 text-white"
        />
        {loading ? <ActivityIndicator color="#a5b4fc" className="mt-4" /> : null}
        <FlatList
          data={preds}
          keyExtractor={(item) => item.place_id}
          className="mt-4 flex-1"
          renderItem={({ item }) => (
            <Pressable onPress={() => void pick(item)} className="py-3 border-b border-slate-800">
              <Text className="text-slate-200">{item.description}</Text>
            </Pressable>
          )}
        />
        {birthCity ? <Text className="text-indigo-300 mt-2">Selected: {birthCity}</Text> : null}
        <Button title="Continue" onPress={next} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
