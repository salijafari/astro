import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { invalidateProfileCache } from "@/lib/userProfile";
import { useTheme } from "@/providers/ThemeProvider";
import { logEvent } from "@/lib/analytics";

const REDIRECT_DELAY_MS = 3000;

/**
 * Stripe redirects here after a successful checkout: https://app.akhtar.today/subscription/success
 *
 * On mount: invalidates the profile cache so the updated subscriptionStatus
 * (set by the Stripe webhook) is fetched fresh on the next API call.
 * Auto-navigates to the dashboard after 3 seconds.
 */
export default function SubscriptionSuccessScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    void invalidateProfileCache();
    logEvent("stripe_checkout_completed", { platform: "web" });

    const timer = setTimeout(() => {
      router.replace("/(main)/home");
    }, REDIRECT_DELAY_MS);

    const countdown = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(countdown);
    };
  }, []);

  return (
    <SafeAreaView
      className="flex-1 items-center justify-center px-6"
      style={{ backgroundColor: theme.colors.background }}
    >
      <Text style={{ fontSize: 80 }}>✅</Text>
      <Text
        className="mt-8 text-center text-4xl font-semibold"
        style={{ color: theme.colors.onBackground }}
      >
        You're all set!
      </Text>
      <Text
        className="mt-4 text-center text-xl"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        Your subscription is now active
      </Text>

      <Pressable
        onPress={() => router.replace("/(main)/home")}
        className="mt-10 min-h-[52px] justify-center rounded-full px-8 py-4"
        style={{ backgroundColor: theme.colors.onBackground }}
      >
        <Text
          className="text-center text-xl font-semibold"
          style={{ color: theme.colors.background }}
        >
          Go to Dashboard
        </Text>
      </Pressable>

      <Text
        className="mt-6 text-center text-sm"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        Redirecting in {secondsLeft}s…
      </Text>
    </SafeAreaView>
  );
}
