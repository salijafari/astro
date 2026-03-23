import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DailyInsightCard } from "@/components/coaching/DailyInsightCard";
import { apiGetJson, apiPostJson } from "@/lib/api";
import { useSubscriptionStore } from "@/stores/subscriptionStore";

type Insight = {
  title: string;
  narrative: string;
  moodIndicator: string;
  date: string;
};

/**
 * Home: daily insight (always free) + subscription sync.
 */
export default function HomeScreen() {
  const { getToken } = useAuth();
  const setFromApi = useSubscriptionStore((s) => s.setFromApi);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, sub] = await Promise.all([
        apiGetJson<Insight>("/api/daily/insight", getToken),
        apiGetJson<{ status: string; expiresAt: string | null }>("/api/subscription/status", getToken),
      ]);
      setInsight(d);
      setFromApi(
        sub.status,
        sub.expiresAt ? new Date(typeof sub.expiresAt === "string" ? sub.expiresAt : String(sub.expiresAt)) : null,
      );
    } catch {
      setInsight(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, setFromApi]);

  useEffect(() => {
    void load();
  }, [load]);

  const shareCard = async () => {
    try {
      await apiPostJson<{ imageUrl: string }>("/api/cosmic-card/generate", getToken, { type: "daily-insight" });
      /* User can open imageUrl in browser or wire expo-sharing with downloaded file */
    } catch {
      /* ignore */
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
      <ScrollView className="px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-white text-3xl font-bold">Today</Text>
        {loading ? (
          <ActivityIndicator color="#a5b4fc" className="mt-8" />
        ) : insight ? (
          <DailyInsightCard
            title={insight.title}
            narrative={insight.narrative}
            mood={insight.moodIndicator}
            onShare={() => void shareCard()}
          />
        ) : (
          <Text className="text-slate-400 mt-6">Finish onboarding and connect the API to see your insight.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
