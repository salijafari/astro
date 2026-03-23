import { useAuth } from "@/lib/auth";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { apiPostJson } from "@/lib/api";
import { trackEvent } from "@/lib/mixpanel";
import { useOnboardingStore } from "@/stores/onboardingStore";

type ComputeRes = {
  sunSign: string;
  moonSign: string;
  risingSign: string | null;
  natalChartJson: Record<string, unknown>;
};

export default function InsightRevealScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const setPartial = useOnboardingStore((st) => st.setPartial);
  const displayName = useOnboardingStore((st) => st.displayName);
  const sunSign = useOnboardingStore((st) => st.sunSign);
  const moonSign = useOnboardingStore((st) => st.moonSign);
  const risingSign = useOnboardingStore((st) => st.risingSign);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    trackEvent("onboarding_step_7_viewed");
  }, []);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      try {
        const st = useOnboardingStore.getState();
        const res = await apiPostJson<ComputeRes>(
          "/api/chart/compute",
          getToken,
          {
            birthDate: st.birthDate,
            birthTime: st.birthTime,
            birthLat: st.birthLat,
            birthLong: st.birthLong,
            birthTimezone: st.birthTimezone,
          },
        );
        setPartial({
          sunSign: res.sunSign,
          moonSign: res.moonSign,
          risingSign: res.risingSign,
          natalChartJson: res.natalChartJson,
        });
        trackEvent("onboarding_step_7_completed");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not compute chart");
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken, setPartial]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator color="#a5b4fc" size="large" />
        <Text className="text-slate-400 mt-4">Calculating your sky map…</Text>
      </SafeAreaView>
    );
  }

  if (err) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950 px-6 justify-center">
        <Text className="text-red-400">{err}</Text>
        <Button title="Try again" onPress={() => router.replace("/(onboarding)/birth-date")} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-6 justify-between pb-10">
      <Animated.View entering={FadeInUp.duration(700)} className="mt-16">
        <Text className="text-indigo-300 text-sm uppercase">Your Big Three</Text>
        <Text className="text-white text-3xl font-bold mt-2">
          {displayName}, you shine as a {sunSign} Sun, {moonSign} Moon
          {risingSign ? `, ${risingSign} Rising` : ""}.
        </Text>
        <Text className="text-slate-400 mt-4 leading-6">
          Calculated with Swiss Ephemeris (sweph) — never guessed by AI.
        </Text>
      </Animated.View>
      <Button title="Continue" onPress={() => router.replace("/(onboarding)/paywall")} />
    </SafeAreaView>
  );
}
