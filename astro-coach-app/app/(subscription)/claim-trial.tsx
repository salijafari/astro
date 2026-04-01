import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { invalidateProfileCache } from "@/lib/userProfile";
import { invalidateSubscriptionCache } from "@/lib/useSubscription";
import { useTheme } from "@/providers/ThemeProvider";
import { logEvent } from "@/lib/analytics";
import { requestPermission } from "@/lib/notifications";

/**
 * Web-only: one-time free week claim after profile is complete.
 * Idempotent on the server — safe to retry.
 */
export default function ClaimTrialScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  if (Platform.OS !== "web") {
    router.replace("/(main)/home");
    return null;
  }

  const redirectIfAlreadyClaimed = useCallback(async () => {
    try {
      const res = await apiRequest("/api/subscription/status", { method: "GET", getToken });
      if (!res.ok) return;
      const s = (await res.json()) as {
        trialStartedAt?: string | null;
        subscriptionStatus?: string;
      };
      if (s.trialStartedAt || s.subscriptionStatus === "active") {
        router.replace("/(main)/home");
      }
    } catch {
      /* stay on screen */
    } finally {
      setChecking(false);
    }
  }, [getToken, router]);

  useEffect(() => {
    logEvent("claim_trial_shown", { platform: "web" });
    void redirectIfAlreadyClaimed();
  }, [redirectIfAlreadyClaimed]);

  const handleClaim = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("/api/subscription/claim-trial", {
        method: "POST",
        getToken,
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      logEvent("trial_claimed", { platform: "web" });
      invalidateSubscriptionCache();
      await invalidateProfileCache();
      await requestPermission(getToken);
      router.replace("/(main)/home");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 justify-between px-6 py-10"
      style={{ backgroundColor: theme.colors.background }}
      edges={["top", "left", "right"]}
    >
      <View className="items-center pt-4">
        <AkhtarWordmark size="hero" />
        <Text
          className="mt-10 text-center text-3xl font-semibold"
          style={{ color: theme.colors.onBackground }}
        >
          {t("trial.claimTitle")}
        </Text>
        <Text
          className="mt-3 text-center text-lg leading-7"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("trial.claimSubtitle")}
        </Text>

        <View className="mt-10 w-full gap-3">
          {[t("trial.benefit1"), t("trial.benefit2"), t("trial.benefit3"), t("trial.benefit4")].map((line, i) => (
            <View key={i} className="flex-row items-start gap-3">
              <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} style={{ marginTop: 2 }} />
              <Text className="flex-1 text-base" style={{ color: theme.colors.onBackground }}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View>
        {error ? (
          <Text className="mb-3 text-center text-sm" style={{ color: theme.colors.error }}>
            {error}
          </Text>
        ) : null}
        {loading ? (
          <View className="items-center py-6">
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => void handleClaim()}
              className="min-h-[52px] items-center justify-center rounded-2xl py-4"
              style={{ backgroundColor: "#6366f1" }}
            >
              <Text className="text-center text-lg font-semibold text-white">{t("trial.cta")}</Text>
            </Pressable>
            <Text className="mt-3 text-center text-sm" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("trial.noCard")}
            </Text>
            <Pressable onPress={() => router.replace("/(auth)/sign-in")} className="mt-6 py-2">
              <Text className="text-center text-base underline" style={{ color: theme.colors.onSurfaceVariant }}>
                {t("trial.signInLink")}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
