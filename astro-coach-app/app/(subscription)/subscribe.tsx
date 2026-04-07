import { useRouter, type Href } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Legacy route: bookmarks or old links may still open /subscribe.
 * Native users use RevenueCat from the unified paywall; web users get plan selection there.
 */
export default function SubscribeScreen() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== "web") {
      router.replace("/(main)/home" as Href);
      return;
    }
    router.replace("/(subscription)/paywall" as Href);
  }, [router]);

  return null;
}
