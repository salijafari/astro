import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/providers/ThemeProvider";
import { logEvent } from "@/lib/analytics";

/**
 * Web-only subscribe screen for users who have no Stripe account yet.
 *
 * Shown when:
 *   - User opens Settings → taps subscription button
 *   - Backend returns { hasStripeAccount: false }
 *   - User wants to subscribe during their trial or after trial expired
 *
 * Calls POST /api/subscription/create-checkout-session (already built)
 * and redirects to Stripe hosted checkout.
 */
export default function SubscribeScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  // Safety guard: this screen is web-only.
  // Native users go through RevenueCat from the welcome/paywall screen.
  if (Platform.OS !== "web") {
    router.replace("/(main)/home");
    return null;
  }

  const priceDisplay =
    process.env.EXPO_PUBLIC_SUBSCRIPTION_PRICE_DISPLAY ?? "$9.99/month";

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const idToken = await getToken();
      if (!idToken) {
        Alert.alert("Error", "Please sign in again and try.");
        return;
      }

      const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(
        `${apiBase}/api/subscription/create-checkout-session`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok) throw new Error(data.error ?? "Request failed");

      if (data.url) {
        logEvent("stripe_checkout_opened", { platform: "web", source: "settings" });
        if (typeof window !== "undefined") {
          window.location.href = data.url;
        } else {
          await Linking.openURL(data.url);
        }
      }
    } catch (err) {
      console.error("[subscribe] error:", err);
      Alert.alert("Error", "Could not open checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      className="flex-1 justify-between px-6 py-12"
      style={{ backgroundColor: theme.colors.background }}
    >
      {/* Back button */}
      <Pressable
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(main)/settings");
          }
        }}
        className="absolute left-6 top-12 min-h-[44px] min-w-[44px] items-center justify-center"
      >
        <Text className="text-2xl" style={{ color: theme.colors.onBackground }}>
          ‹
        </Text>
      </Pressable>

      <View className="items-center pt-10">
        <Text style={{ fontSize: 64 }}>✦</Text>
        <Text
          className="mt-8 text-center text-4xl font-semibold"
          style={{ color: theme.colors.onBackground }}
        >
          Subscribe to Akhtar
        </Text>
        <Text
          className="mt-4 text-center text-xl leading-8"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          Unlock your full cosmic experience
        </Text>
      </View>

      <View>
        <View
          className="rounded-3xl border p-6 gap-4"
          style={{ borderColor: theme.colors.outline }}
        >
          <Text
            className="text-center text-3xl font-semibold"
            style={{ color: theme.colors.onBackground }}
          >
            {priceDisplay}
          </Text>
          <View className="gap-3 mt-2">
            <Text className="text-lg" style={{ color: theme.colors.onBackground }}>
              ✦ Unlimited AI conversations
            </Text>
            <Text className="text-lg" style={{ color: theme.colors.onBackground }}>
              ✦ Daily personalised horoscope
            </Text>
            <Text className="text-lg" style={{ color: theme.colors.onBackground }}>
              ✦ Coffee cup & tarot readings
            </Text>
            <Text className="text-lg" style={{ color: theme.colors.onBackground }}>
              ✦ Cancel anytime
            </Text>
          </View>
        </View>

        {loading ? (
          <View className="mt-8 items-center py-4">
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : (
          <Pressable
            onPress={() => void handleSubscribe()}
            className="mt-6 min-h-[52px] justify-center rounded-full px-4 py-4"
            style={{ backgroundColor: theme.colors.onBackground }}
          >
            <Text
              className="text-center text-2xl font-semibold"
              style={{ color: theme.colors.background }}
            >
              Subscribe Now
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
