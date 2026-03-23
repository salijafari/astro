import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/mixpanel";

export default function WelcomeScreen() {
  const router = useRouter();

  useEffect(() => {
    trackEvent("onboarding_step_1_viewed");
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-6 justify-between pb-10">
      <View className="mt-20">
        <Text className="text-4xl font-bold text-white">Astra Coach</Text>
        <Text className="text-indigo-200 text-lg mt-4 leading-7">
          Personalized astrology guidance for relationships, career, and your inner world — in a warm chat, anytime.
        </Text>
      </View>
      <Button
        title="Begin Your Journey"
        onPress={() => {
          trackEvent("onboarding_step_1_completed");
          router.replace("/(onboarding)/name");
        }}
      />
    </SafeAreaView>
  );
}
