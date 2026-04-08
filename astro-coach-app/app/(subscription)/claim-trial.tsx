import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { invalidateProfileCache } from "@/lib/userProfile";
import { invalidateSubscriptionCache, useSubscription } from "@/lib/useSubscription";
import { useTheme } from "@/providers/ThemeProvider";
import { logEvent } from "@/lib/analytics";

/**
 * One-time free week claim after profile is complete (web + native).
 * Idempotent on the server — safe to retry.
 */
export default function ClaimTrialScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    loading: subLoading,
    hasAccess,
    trialStartedAt,
    subscriptionStatus,
    premiumUnlimited,
  } = useSubscription();

  const shouldSkipClaimScreen = useMemo(
    () =>
      Boolean(trialStartedAt) ||
      subscriptionStatus === "premium" ||
      subscriptionStatus === "active" ||
      premiumUnlimited ||
      hasAccess,
    [trialStartedAt, subscriptionStatus, premiumUnlimited, hasAccess],
  );

  useEffect(() => {
    logEvent("claim_trial_shown", { platform: Platform.OS });
  }, []);

  useEffect(() => {
    if (subLoading || !shouldSkipClaimScreen) return;
    router.replace("/(main)/home");
  }, [subLoading, shouldSkipClaimScreen, router]);

  const handleClaim = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("/api/subscription/claim-trial", {
        method: "POST",
        getToken,
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      logEvent("trial_claimed", { platform: Platform.OS });
      invalidateSubscriptionCache();
      await invalidateProfileCache();
      router.replace("/(main)/home");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [getToken, router]);

  const bottomPad = Math.max(insets.bottom, 24);

  if (subLoading || shouldSkipClaimScreen) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.colors.background, paddingBottom: bottomPad }}
      >
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: theme.colors.background, paddingBottom: bottomPad }}
      edges={["top", "left", "right"]}
    >
      <View
        className="flex-1 justify-between"
        style={{
          width: "100%",
          maxWidth: 460,
          alignSelf: "center",
          paddingHorizontal: 24,
        }}
      >
        <View className="w-full items-start">
          <AkhtarWordmark size="hero" />
          <Text
            className="text-3xl font-semibold"
            style={{ color: theme.colors.onBackground, marginTop: 20, textAlign: "left", width: "100%" }}
          >
            {t("trial.claimTitle")}
          </Text>
          <Text
            className="text-lg leading-7"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 10, textAlign: "left", width: "100%" }}
          >
            {t("trial.claimSubtitle")}
          </Text>

          <View className="w-full" style={{ marginTop: 24 }}>
            {[t("trial.benefit1"), t("trial.benefit2"), t("trial.benefit3"), t("trial.benefit4")].map((line, i) => (
              <View
                key={i}
                className="w-full flex-row"
                style={{
                  alignItems: "center",
                  marginBottom: i < 3 ? 14 : 0,
                  gap: 12,
                }}
              >
                <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                <Text className="flex-1 text-base" style={{ color: theme.colors.onBackground, textAlign: "left" }}>
                  {line}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="w-full" style={{ marginTop: 32 }}>
          {error ? (
            <Text className="mb-3 text-sm" style={{ color: theme.colors.error, textAlign: "left", width: "100%" }}>
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
                className="min-h-[52px] w-full items-center justify-center rounded-2xl py-4"
                style={{ backgroundColor: "#6366f1" }}
              >
                <Text className="text-center text-lg font-semibold text-white">{t("trial.cta")}</Text>
              </Pressable>
              <Text
                className="text-sm"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: "left", width: "100%" }}
              >
                {t("trial.noCard")}
              </Text>
              <Pressable onPress={() => router.replace("/welcome")} className="py-2" style={{ marginTop: 20 }}>
                <Text className="text-base underline" style={{ color: theme.colors.onSurfaceVariant, textAlign: "left" }}>
                  {t("trial.signInLink")}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
