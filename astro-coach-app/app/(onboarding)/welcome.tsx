import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { getAvailablePackages, purchaseSelectedPackage, restorePurchasesAccess } from "@/lib/purchases";
import { readPersistedValue, removePersistedValue, writePersistedValue } from "@/lib/storage";
import { startWebStripeCheckout } from "@/lib/stripe-web";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useTheme } from "@/providers/ThemeProvider";
import { logEvent } from "@/lib/analytics";
import { requestPermission } from "@/lib/notifications";

type PendingData = {
  firstName?: string;
  birthDate?: string | null;
  birthTime?: string | null;
  birthCity?: string | null;
};

/**
 * Sends onboarding data to backend. Fire-and-forget: never blocks navigation.
 */
const sendOnboardingToBackend = async (
  getToken: () => Promise<string | null>,
  pending: PendingData,
) => {
  try {
    const idToken = await getToken();
    if (!idToken) return;
    const lang = (await readPersistedValue("akhtar.language")) ?? "fa";
    const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

    fetch(`${apiBase}/api/onboarding/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        firstName: pending.firstName ?? "",
        birthDate: pending.birthDate ?? "2000-01-01",
        birthTime: pending.birthTime ?? null,
        birthCity: pending.birthCity ?? null,
        birthLatitude: null,
        birthLongitude: null,
        birthTimezone: null,
        languagePreference: lang,
      }),
    }).catch((err) => {
      console.warn("[onboarding] backend save failed:", err);
    });
  } catch (err) {
    console.warn("[onboarding] token error:", err);
  }
};

export default function WelcomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { theme } = useTheme();
  const { getToken } = useAuth();
  const setPremium = useSubscriptionStore((s) => s.setPremium);
  const rtl = i18n.language === "fa";

  const [pending, setPending] = useState<PendingData>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    logEvent("paywall_shown");
    void (async () => {
      const raw = await readPersistedValue("akhtar.pendingOnboarding");
      if (raw) {
        try {
          setPending(JSON.parse(raw) as PendingData);
        } catch {
          /* corrupt data -- proceed with empty */
        }
      }
    })();
  }, []);

  const completeAndNavigate = async () => {
    setLoading(true);
    try {
      void sendOnboardingToBackend(getToken, pending);
    } catch {
      /* never block */
    } finally {
      await writePersistedValue("akhtar.onboardingCompleted", "true");
      await removePersistedValue("akhtar.pendingOnboarding");
      setLoading(false);
      void requestPermission(getToken);
      router.replace("/(main)/home");
    }
  };

  const claimTrial = async () => {
    setLoading(true);
    try {
      if (Platform.OS === "web") {
        await startWebStripeCheckout(getToken);
      } else {
        const available = await getAvailablePackages();
        const preferred =
          available.find((p) => p.packageType === "MONTHLY") ?? available[0];
        if (!preferred) throw new Error("No package available.");
        await purchaseSelectedPackage(preferred);
      }
      setPremium(true);
      logEvent("subscription_started", {
        platform: Platform.OS,
        product_id: "trial_or_monthly",
      });
    } catch {
      /* User cancelled or purchase failed -- still complete onboarding */
    }
    await completeAndNavigate();
  };

  const restore = async () => {
    try {
      if (Platform.OS !== "web") await restorePurchasesAccess();
      setPremium(true);
    } catch {
      /* no-op */
    }
    await completeAndNavigate();
  };

  const maybeLater = async () => {
    await writePersistedValue("akhtar.paywallDismissed", "true");
    await completeAndNavigate();
  };

  return (
    <View
      className="flex-1 justify-between px-6 py-12"
      style={{ backgroundColor: theme.colors.background }}
    >
      <View className="pt-6">
        <View className="items-center">
          <LinearGradient
            colors={[
              `${theme.colors.primary}aa`,
              `${theme.colors.secondary}55`,
              "transparent",
            ]}
            locations={[0, 0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{
              width: 240,
              height: 240,
              borderRadius: 120,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 80,
                lineHeight: 88,
                color: theme.colors.onBackground,
              }}
            >
              ♒
            </Text>
          </LinearGradient>
        </View>
        <Text
          className="mt-10 text-center text-4xl font-semibold"
          style={{
            color: theme.colors.onBackground,
            writingDirection: rtl ? "rtl" : "ltr",
          }}
        >
          {t("onboarding.welcomeTitle", { name: pending.firstName || t("brand.name") })}
        </Text>
        <Text
          className="mt-6 text-center text-xl leading-8"
          style={{
            color: theme.colors.onSurfaceVariant,
            writingDirection: rtl ? "rtl" : "ltr",
          }}
        >
          {t("onboarding.welcomeSubtitle")}
        </Text>
      </View>

      <View>
        <View
          className="rounded-3xl border p-5"
          style={{ borderColor: theme.colors.outline }}
        >
          <Text
            className="text-center text-2xl font-semibold"
            style={{ color: theme.colors.onBackground }}
          >
            {t("paywall.trial")}
          </Text>
          <Text
            className="mt-3 text-center text-xl"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("paywall.price")}
          </Text>
          <Text
            className="mt-2 text-center text-sm"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("paywall.renewal")}
          </Text>
          <Text
            className="mt-2 text-center text-sm"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("paywall.cancelAnytime")}
          </Text>
        </View>

        {loading ? (
          <View className="mt-6 items-center py-4">
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => void claimTrial()}
              className="mt-6 min-h-[52px] justify-center rounded-full px-4 py-4"
              style={{ backgroundColor: theme.colors.onBackground }}
            >
              <Text
                className="text-center text-2xl font-semibold"
                style={{ color: theme.colors.background }}
              >
                {t("onboarding.claimFreeWeek")}
              </Text>
            </Pressable>
            <Pressable onPress={() => void restore()} className="mt-4 py-2">
              <Text
                className="text-center text-lg underline"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("onboarding.restorePurchases")}
              </Text>
            </Pressable>
            <Pressable onPress={() => void maybeLater()} className="mt-2 py-2">
              <Text
                className="text-center text-lg"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("onboarding.maybeLater")}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
