import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { logEvent } from "@/lib/analytics";
import { useTheme } from "@/providers/ThemeProvider";

const STRIPE_PRICE_MONTHLY = "price_1TG884Rv8vuaHOxlRFbLpO5y";
const STRIPE_PRICE_ANNUAL = "price_1TJR2VRv8vuaHOxlVYdKbnwU";

type PlanLoading = "monthly" | "annual" | null;

/**
 * Web-only full-screen paywall after trial: two Stripe subscription plans (monthly / annual).
 * HARD LOCK — exit via successful Stripe Checkout only.
 */
export default function PaywallScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;

  const [loadingPlan, setLoadingPlan] = useState<PlanLoading>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  if (Platform.OS !== "web") {
    router.replace("/(main)/home");
    return null;
  }

  const title = t("paywall.webPremiumTitle", { defaultValue: "Unlock Akhtar Premium" });

  const startCheckout = async (priceId: string, plan: "monthly" | "annual") => {
    setCheckoutError(null);
    setLoadingPlan(plan);
    try {
      const idToken = await getToken();
      if (!idToken) {
        Alert.alert("Error", "Please sign in again and try.");
        return;
      }

      const res = await apiRequest("/api/subscription/create-checkout-session", {
        method: "POST",
        getToken,
        body: JSON.stringify({ priceId }),
      });

      let data: { url?: string; error?: string; details?: string } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        data = { error: `Server error ${res.status}` };
      }

      if (!res.ok) {
        console.error("[paywall] checkout error response:", data);
        setCheckoutError(
          data.details ?? data.error ?? t("paywall.webCheckoutError", { defaultValue: "Could not start checkout. Please try again." }),
        );
        return;
      }

      if (data.url) {
        logEvent("stripe_checkout_opened", { platform: "web", plan });
        if (typeof window !== "undefined") {
          window.location.href = data.url;
        }
      } else {
        setCheckoutError(t("paywall.webCheckoutError", { defaultValue: "Could not start checkout. Please try again." }));
      }
    } catch (err) {
      console.error("[paywall] checkout error:", err);
      setCheckoutError(t("paywall.webCheckoutError", { defaultValue: "Could not start checkout. Please try again." }));
    } finally {
      setLoadingPlan(null);
    }
  };

  const cardBase =
    "flex-1 min-w-[160px] rounded-3xl border p-5";
  const rowLayout = isWide ? "flex-row gap-4" : "flex-col gap-4";

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }} edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 40, paddingBottom: 64, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          className="text-center text-3xl font-semibold leading-tight"
          style={{ color: theme.colors.onBackground }}
        >
          {title}
        </Text>
        <Text
          className="mt-3 text-center text-lg leading-7"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("paywall.webChoosePlan", { defaultValue: "Choose the plan that works for you" })}
        </Text>

        <View className={`mt-10 ${rowLayout}`}>
          {/* Monthly */}
          <View className={cardBase} style={{ borderColor: theme.colors.outline, minHeight: 220 }}>
            <Text className="text-lg font-semibold" style={{ color: theme.colors.onBackground }}>
              {t("paywall.webMonthlyLabel", { defaultValue: "Monthly" })}
            </Text>
            <Text className="mt-2 text-base" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("paywall.webMonthlyPrice", { defaultValue: "$9.99 CAD / month" })}
            </Text>
            <View className="mt-6 flex-1 justify-end">
              <Pressable
                accessibilityRole="button"
                disabled={loadingPlan !== null}
                onPress={() => void startCheckout(STRIPE_PRICE_MONTHLY, "monthly")}
                className="min-h-[52px] items-center justify-center rounded-full px-4 py-3"
                style={{ backgroundColor: theme.colors.onBackground, opacity: loadingPlan !== null && loadingPlan !== "monthly" ? 0.5 : 1 }}
              >
                {loadingPlan === "monthly" ? (
                  <ActivityIndicator color={theme.colors.background} />
                ) : (
                  <Text className="text-center text-base font-semibold" style={{ color: theme.colors.background }}>
                    {t("paywall.webSubscribeMonthly", { defaultValue: "Subscribe Monthly" })}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* Annual */}
          <View className={cardBase} style={{ borderColor: theme.colors.outline, minHeight: 220 }}>
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-lg font-semibold" style={{ color: theme.colors.onBackground }}>
                {t("paywall.webAnnualLabel", { defaultValue: "Annual" })}
              </Text>
              <View className="rounded-full bg-indigo-500/25 px-2 py-0.5">
                <Text className="text-xs font-semibold text-indigo-200">
                  {t("paywall.webSaveBadge", { defaultValue: "Save 35%" })}
                </Text>
              </View>
            </View>
            <Text className="mt-2 text-base" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("paywall.webAnnualPrice", { defaultValue: "$77.99 CAD / year" })}
            </Text>
            <View className="mt-6 flex-1 justify-end">
              <Pressable
                accessibilityRole="button"
                disabled={loadingPlan !== null}
                onPress={() => void startCheckout(STRIPE_PRICE_ANNUAL, "annual")}
                className="min-h-[52px] items-center justify-center rounded-full px-4 py-3"
                style={{ backgroundColor: theme.colors.primary, opacity: loadingPlan !== null && loadingPlan !== "annual" ? 0.5 : 1 }}
              >
                {loadingPlan === "annual" ? (
                  <ActivityIndicator color={theme.colors.onPrimary} />
                ) : (
                  <Text className="text-center text-base font-semibold" style={{ color: theme.colors.onPrimary }}>
                    {t("paywall.webSubscribeAnnual", { defaultValue: "Subscribe Annually" })}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {checkoutError ? (
          <Text className="mt-6 text-center text-sm leading-5" style={{ color: theme.colors.error }}>
            {checkoutError}
          </Text>
        ) : null}

        <Text className="mt-8 text-center text-sm" style={{ color: theme.colors.onSurfaceVariant }}>
          {t("paywall.cancelAnytime")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
