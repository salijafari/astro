import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/providers/ThemeProvider";
import { logEvent } from "@/lib/analytics";

/**
 * Web-only full-screen paywall shown when the 7-day trial has expired.
 *
 * This is a HARD LOCK — no back button, no skip, no close.
 * The only exit is a successful Stripe checkout which sets subscriptionStatus = 'active'.
 *
 * On tap: calls POST /api/subscription/create-checkout-session, then redirects
 * to Stripe's hosted checkout page via window.location.href.
 *
 * After payment, Stripe redirects to /subscription/success which unlocks the app.
 */
export default function PaywallScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  // Safety guard: this screen is web-only.
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

      const data = (await res.json()) as { url?: string };
      if (data.url) {
        logEvent("stripe_checkout_opened", { platform: "web" });
        if (typeof window !== "undefined") {
          window.location.href = data.url;
        }
      } else {
        Alert.alert("Error", "Could not open checkout. Please try again.");
      }
    } catch (err) {
      console.error("[paywall] checkout error:", err);
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
      <View className="items-center pt-10">
        <Text style={{ fontSize: 64 }}>🔒</Text>
        <Text
          className="mt-8 text-center text-4xl font-semibold"
          style={{ color: theme.colors.onBackground }}
        >
          Your free week has ended
        </Text>
        <Text
          className="mt-4 text-center text-xl leading-8"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          Subscribe to continue your journey
        </Text>
      </View>

      <View>
        <View
          className="rounded-3xl border p-6 items-center"
          style={{ borderColor: theme.colors.outline }}
        >
          <Text
            className="text-3xl font-semibold"
            style={{ color: theme.colors.onBackground }}
          >
            {priceDisplay}
          </Text>
          <Text
            className="mt-2 text-center text-sm"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Unlimited access to all features
          </Text>
        </View>

        {loading ? (
          <View className="mt-8 items-center py-4">
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => void handleSubscribe()}
              className="mt-6 min-h-[52px] justify-center rounded-full px-4 py-4"
              style={{ backgroundColor: theme.colors.onBackground }}
            >
              <Text
                className="text-center text-2xl font-semibold"
                style={{ color: theme.colors.background }}
              >
                Subscribe Now — {priceDisplay}
              </Text>
            </Pressable>
            <Text
              className="mt-4 text-center text-sm"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Cancel anytime
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
