import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, TextInput } from "react-native";
import { KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/mixpanel";
import { useOnboardingStore } from "@/stores/onboardingStore";

/**
 * Birth city — free text only (no Places/geocode). Coords stay placeholder until a future Places integration.
 */
export default function BirthLocationScreen() {
  const router = useRouter();
  const setPartial = useOnboardingStore((s) => s.setPartial);
  const [q, setQ] = useState("");

  useEffect(() => {
    trackEvent("onboarding_step_5_viewed");
  }, []);

  const next = () => {
    const city = q.trim();
    setPartial({
      birthCity: city.length > 0 ? city : "",
      birthLat: 0,
      birthLong: 0,
      birthTimezone: "UTC",
    });
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
          placeholder="City name"
          placeholderTextColor="#64748b"
          selectionColor="#8b8cff"
          cursorColor="#8b8cff"
          style={{ color: "#ffffff" }}
          className="mt-4 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-4 text-white"
          returnKeyType="done"
          onSubmitEditing={next}
          blurOnSubmit
        />
        <Text className="text-slate-400 text-sm mt-3">Type any city name — you can change this later.</Text>
        <Button title="Continue" onPress={next} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
