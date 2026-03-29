import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { getSunSign } from "@/lib/intl";
import { invalidateProfileCache } from "@/lib/userProfile";
import { readPersistedValue, removePersistedValue, writePersistedValue } from "@/lib/storage";
import { useTheme } from "@/providers/ThemeProvider";
import { logEvent } from "@/lib/analytics";
import { requestPermission } from "@/lib/notifications";

type PendingData = {
  firstName?: string;
  birthDate?: string | null;
  birthTime?: string | null;
  birthCity?: string | null;
};

const ZODIAC_EMOJI: Record<string, string> = {
  Aries: "♈",
  Taurus: "♉",
  Gemini: "♊",
  Cancer: "♋",
  Leo: "♌",
  Virgo: "♍",
  Libra: "♎",
  Scorpio: "♏",
  Sagittarius: "♐",
  Capricorn: "♑",
  Aquarius: "♒",
  Pisces: "♓",
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

/**
 * Web-only screen shown after the onboarding chat completes.
 *
 * Combines the welcome design (zodiac, name, pricing card) with the
 * claim-trial action — creating a single cohesive paywall for web users.
 *
 * On tap:
 *   1. Sends onboarding data to the backend (fire-and-forget)
 *   2. Marks onboarding as complete in local storage
 *   3. Calls POST /api/subscription/claim-trial (idempotent)
 *   4. Navigates to the dashboard
 */
export default function ClaimTrialScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingData>({});

  // Safety guard: this screen is web-only.
  if (Platform.OS !== "web") {
    router.replace("/(main)/home");
    return null;
  }

  useEffect(() => {
    logEvent("paywall_shown");
    void (async () => {
      const raw = await readPersistedValue("akhtar.pendingOnboarding");
      if (raw) {
        try {
          setPending(JSON.parse(raw) as PendingData);
        } catch {
          /* corrupt data — proceed with empty */
        }
      }
    })();
  }, []);

  const zodiacEmoji =
    pending.birthDate
      ? (ZODIAC_EMOJI[getSunSign(new Date(pending.birthDate))] ?? "♒")
      : "♒";

  const handleClaimTrial = async () => {
    setLoading(true);
    try {
      // Send onboarding data to backend (fire-and-forget — never blocks)
      void sendOnboardingToBackend(getToken, pending);

      // Mark onboarding complete and clear pending data
      await writePersistedValue("akhtar.onboardingCompleted", "true");
      await removePersistedValue("akhtar.pendingOnboarding");
      await invalidateProfileCache();

      // Claim the free trial
      const idToken = await getToken();
      if (idToken) {
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
      }
    } catch (err) {
      console.error("[claim-trial] error:", err);
      // Never block the user on a network error
    } finally {
      setLoading(false);
      void requestPermission(getToken);
      router.replace("/(main)/home");
    }
  };

  const handleRestore = async () => {
    // On web there are no App Store purchases to restore —
    // completing onboarding and navigating home is the correct action.
    await handleClaimTrial();
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
              {zodiacEmoji}
            </Text>
          </LinearGradient>
        </View>

        <Text
          className="mt-10 text-center text-4xl font-semibold"
          style={{ color: theme.colors.onBackground }}
        >
          {t("onboarding.welcomeTitle", { name: pending.firstName || t("brand.name") })}
        </Text>
        <Text
          className="mt-6 text-center text-xl leading-8"
          style={{ color: theme.colors.onSurfaceVariant }}
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
              onPress={() => void handleClaimTrial()}
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
            <Pressable onPress={() => void handleRestore()} className="mt-4 py-2">
              <Text
                className="text-center text-lg underline"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("onboarding.restorePurchases")}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
