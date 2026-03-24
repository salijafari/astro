import NativeDateTimePicker from "@/components/NativeDateTimePicker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/mixpanel";
import { useOnboardingStore } from "@/stores/onboardingStore";

function formatYmd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function ageYears(d: Date) {
  const diff = Date.now() - d.getTime();
  return diff / (365.25 * 24 * 60 * 60 * 1000);
}

export default function BirthDateScreen() {
  const router = useRouter();
  const birthDate = useOnboardingStore((s) => s.birthDate);
  const setPartial = useOnboardingStore((s) => s.setPartial);
  const [picker, setPicker] = useState(new Date(birthDate || "2000-01-01"));
  const [show, setShow] = useState(Platform.OS === "ios");
  const [error, setError] = useState("");

  useEffect(() => {
    trackEvent("onboarding_step_3_viewed");
  }, []);

  const next = () => {
    const ymd = formatYmd(picker);
    if (picker >= new Date()) {
      setError("Birth date must be in the past.");
      return;
    }
    if (ageYears(picker) < 13) {
      setError("You must be at least 13 years old.");
      return;
    }
    setPartial({ birthDate: ymd });
    trackEvent("onboarding_step_3_completed");
    router.replace("/(onboarding)/birth-time");
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <Text className="text-white text-2xl font-bold mt-10">When were you born?</Text>
      <Text className="text-slate-400 mt-2">Selected: {formatYmd(picker)}</Text>
      {Platform.OS === "web" ? (
        <View className="mt-4 rounded-2xl border border-slate-700 px-4 py-3 bg-slate-900">
          {/* eslint-disable-next-line react/no-unknown-property */}
          <input
            type="date"
            value={formatYmd(picker)}
            onChange={(e) => {
              const next = new Date(e.currentTarget.value);
              if (!Number.isNaN(next.getTime())) setPicker(next);
            }}
            className="w-full bg-transparent text-white text-lg"
            style={{ colorScheme: "dark" }}
          />
        </View>
      ) : show ? (
        <NativeDateTimePicker
          value={picker}
          mode="date"
          display="spinner"
          themeVariant="dark"
          onChange={(_, d) => {
            if (d) setPicker(d);
            if (Platform.OS === "android") setShow(false);
          }}
        />
      ) : null}
      {Platform.OS === "android" ? (
        <Button title="Pick date" variant="secondary" onPress={() => setShow(true)} />
      ) : null}
      {error ? <Text className="text-red-400 mt-2">{error}</Text> : null}
      <View className="flex-1" />
      <Button title="Continue" onPress={next} />
    </SafeAreaView>
  );
}
