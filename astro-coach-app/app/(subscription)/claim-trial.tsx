import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { invalidateProfileCache } from "@/lib/userProfile";
import { useTheme } from "@/providers/ThemeProvider";
import { logEvent } from "@/lib/analytics";

/**
 * Web-only one-time claim screen shown after onboarding completes.
 *
 * This screen appears exactly once:
 *   - Only on Platform.OS === 'web'
 *   - Only when the user's trialStartedAt is null (never claimed)
 *
 * On tap: calls POST /api/subscription/claim-trial (idempotent),
 * writes trialStartedAt to the DB, then navigates to the dashboard.
 */
export default function ClaimTrialScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  // Safety guard: this screen is web-only.
  // index.tsx already enforces this, but belt-and-suspenders here too.
  if (Platform.OS !== "web") {
    router.replace("/(main)/home");
    return null;
  }

  /**
   * Calls the backend claim-trial endpoint, invalidates the profile cache so
   * the new trialStartedAt is picked up on the next profile fetch, then
   * navigates to the dashboard.
   */
  const handleClaimTrial = async () => {
    setLoading(true);
    try {
      const idToken = await getToken();
      if (!idToken) {
        router.replace("/(main)/home");
        return;
      }

      const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${apiBase}/api/subscription/claim-trial`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      const data = (await res.json()) as { success?: boolean };
      if (data.success) {
        logEvent("trial_claimed", { platform: "web" });
        await invalidateProfileCache();
      }
    } catch (err) {
      console.error("[claim-trial] error:", err);
      // Still navigate — never block the user on a network error
    } finally {
      setLoading(false);
      router.replace("/(main)/home");
    }
  };

  return (
    <SafeAreaView
      className="flex-1 justify-between px-6 py-12"
      style={{ backgroundColor: theme.colors.background }}
    >
      <View className="items-center pt-10">
        <Text style={{ fontSize: 64 }}>✦</Text>
        <Text
          className="mt-8 text-center text-4xl font-semibold"
          style={{ color: theme.colors.onBackground }}
        >
          Your First Week is Free
        </Text>
        <Text
          className="mt-4 text-center text-xl leading-8"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          Start exploring your cosmic guide
        </Text>
      </View>

      <View>
        <View
          className="rounded-3xl border p-6 gap-4"
          style={{ borderColor: theme.colors.outline }}
        >
          <Text
            className="text-lg"
            style={{ color: theme.colors.onBackground }}
          >
            ✦ Unlimited AI conversations
          </Text>
          <Text
            className="text-lg"
            style={{ color: theme.colors.onBackground }}
          >
            ✦ Daily personalised horoscope
          </Text>
          <Text
            className="text-lg"
            style={{ color: theme.colors.onBackground }}
          >
            ✦ Coffee cup & tarot readings
          </Text>
        </View>

        {loading ? (
          <View className="mt-8 items-center py-4">
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => void handleClaimTrial()}
              className="mt-6 min-h-[52px] justify-center rounded-full px-4 py-4"
              style={{ backgroundColor: theme.colors.onBackground }}
            >
              <Text
                className="text-center text-2xl font-semibold"
                style={{ color: theme.colors.background }}
              >
                Claim My Free Week
              </Text>
            </Pressable>
            <Text
              className="mt-4 text-center text-sm"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              No credit card required
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
