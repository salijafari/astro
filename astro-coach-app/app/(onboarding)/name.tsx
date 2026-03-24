import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/mixpanel";
import { useOnboardingStore } from "@/stores/onboardingStore";

export default function NameScreen() {
  const router = useRouter();
  const displayName = useOnboardingStore((s) => s.displayName);
  const setPartial = useOnboardingStore((s) => s.setPartial);
  const [error, setError] = useState("");

  useEffect(() => {
    trackEvent("onboarding_step_2_viewed");
  }, []);

  const next = () => {
    const t = displayName.trim();
    if (t.length < 1 || t.length > 50) {
      setError("Please enter 1–50 characters.");
      return;
    }
    trackEvent("onboarding_step_2_completed");
    router.replace("/(onboarding)/birth-date");
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <Text className="text-white text-2xl font-bold mt-10">What should we call you?</Text>
        <TextInput
          value={displayName}
          onChangeText={(v) => setPartial({ displayName: v })}
          placeholder="Your name"
          placeholderTextColor="#64748b"
          selectionColor="#8b8cff"
          cursorColor="#8b8cff"
          style={{ color: "#ffffff" }}
          className="mt-6 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-4 text-white text-lg"
        />
        {error ? <Text className="text-red-400 mt-2">{error}</Text> : null}
        <View className="flex-1" />
        <Button title="Continue" onPress={next} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
