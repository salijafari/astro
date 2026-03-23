import { useAuth } from "@/lib/auth";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { INTEREST_OPTIONS } from "@/constants/interests";
import { trackEvent } from "@/lib/mixpanel";
import { registerForPushAsync } from "@/services/pushNotifications";
import { useOnboardingStore } from "@/stores/onboardingStore";

export default function InterestsScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const interestTags = useOnboardingStore((s) => s.interestTags);
  const setPartial = useOnboardingStore((s) => s.setPartial);

  useEffect(() => {
    trackEvent("onboarding_step_6_viewed");
  }, []);

  const toggle = (tag: string) => {
    if (interestTags.includes(tag)) {
      setPartial({ interestTags: interestTags.filter((t) => t !== tag) });
    } else {
      setPartial({ interestTags: [...interestTags, tag] });
    }
  };

  const next = async () => {
    if (interestTags.length < 1) return;
    trackEvent("onboarding_step_6_completed");
    await registerForPushAsync(getToken);
    router.replace("/(onboarding)/insight-reveal");
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <Text className="text-white text-2xl font-bold mt-10">What are you curious about?</Text>
      <Text className="text-slate-400 mt-2">Pick at least one.</Text>
      <View className="flex-row flex-wrap gap-2 mt-6">
        {INTEREST_OPTIONS.map((tag) => {
          const on = interestTags.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => toggle(tag)}
              className={`px-4 py-2 rounded-full border ${on ? "bg-indigo-600 border-indigo-400" : "border-slate-600"}`}
            >
              <Text className={on ? "text-white" : "text-slate-300"}>{tag}</Text>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-1" />
      <Button title="Continue" onPress={() => void next()} />
    </SafeAreaView>
  );
}
