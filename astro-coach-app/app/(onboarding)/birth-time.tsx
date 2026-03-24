import NativeDateTimePicker from "@/components/NativeDateTimePicker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/mixpanel";
import { useOnboardingStore } from "@/stores/onboardingStore";

function timeFromDate(d: Date) {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export default function BirthTimeScreen() {
  const router = useRouter();
  const birthTime = useOnboardingStore((s) => s.birthTime);
  const setPartial = useOnboardingStore((s) => s.setPartial);
  const [picker, setPicker] = useState(() => {
    const base = new Date();
    if (birthTime) {
      const [hh, mm] = birthTime.split(":").map(Number);
      base.setHours(hh ?? 12, mm ?? 0, 0, 0);
    } else {
      base.setHours(12, 0, 0, 0);
    }
    return base;
  });
  const [show, setShow] = useState(Platform.OS === "ios");

  useEffect(() => {
    trackEvent("onboarding_step_4_viewed");
  }, []);

  const next = () => {
    setPartial({ birthTime: timeFromDate(picker) });
    trackEvent("onboarding_step_4_completed");
    router.replace("/(onboarding)/birth-location");
  };

  const skip = () => {
    setPartial({ birthTime: null });
    trackEvent("onboarding_step_4_completed", { skipped: true });
    router.replace("/(onboarding)/birth-location");
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <Text className="text-white text-2xl font-bold mt-10">What time were you born?</Text>
      <Text className="text-slate-400 mt-3 leading-6">
        Birth time affects your Rising sign and house placements. If you are unsure, you can skip.
      </Text>
      {Platform.OS === "web" ? (
        <View className="mt-4 rounded-2xl border border-slate-700 px-4 py-3 bg-slate-900">
          {/* eslint-disable-next-line react/no-unknown-property */}
          <input
            type="time"
            value={`${String(picker.getHours()).padStart(2, "0")}:${String(picker.getMinutes()).padStart(2, "0")}`}
            onChange={(e) => {
              const [h, m] = e.currentTarget.value.split(":");
              const next = new Date(picker);
              next.setHours(Number(h ?? 0), Number(m ?? 0), 0, 0);
              setPicker(next);
            }}
            className="w-full bg-transparent text-white text-lg"
            style={{ colorScheme: "dark" }}
          />
        </View>
      ) : show ? (
        <NativeDateTimePicker
          value={picker}
          mode="time"
          display="spinner"
          themeVariant="dark"
          onChange={(_, d) => {
            if (d) setPicker(d);
            if (Platform.OS === "android") setShow(false);
          }}
        />
      ) : null}
      {Platform.OS === "android" ? (
        <Button title="Pick time" variant="secondary" onPress={() => setShow(true)} />
      ) : null}
      <View className="flex-1" />
      <View className="gap-3 mb-4">
        <Button title="Continue" onPress={next} />
        <Button title="I don't know my birth time" variant="ghost" onPress={skip} />
      </View>
    </SafeAreaView>
  );
}
