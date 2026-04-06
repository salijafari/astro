import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { CosmicBackground } from "@/components/CosmicBackground";
import { useRouter, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const INTRO_NAV_DELAY_MS = 2500;
const INTRO_NAV_MAX_MS = 3000;

const WELCOME_HREF = "/welcome" as Href;

/**
 * In-app intro after JS load: centered logo, then replace to auth welcome.
 * Native splash in app.json is unchanged.
 */
const IntroScreen = () => {
  const router = useRouter();
  const hasNavigated = useRef(false);

  const goToWelcome = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    try {
      router.replace(WELCOME_HREF);
    } catch (e) {
      console.warn("[intro] replace to welcome failed", e);
    }
  };

  useEffect(() => {
    const primary = setTimeout(goToWelcome, INTRO_NAV_DELAY_MS);
    const maxWait = setTimeout(goToWelcome, INTRO_NAV_MAX_MS);
    return () => {
      clearTimeout(primary);
      clearTimeout(maxWait);
    };
  }, []);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: "transparent" }}>
      <View className="relative flex-1 overflow-hidden">
        <CosmicBackground colorSchemeOverride="dark" subtleDrift />
        <View className="flex-1 items-center justify-center">
          <Animated.View entering={FadeIn.duration(600)}>
            <AkhtarWordmark size="home" />
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default IntroScreen;
