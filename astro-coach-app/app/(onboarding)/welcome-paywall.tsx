import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getAvailablePackages, purchaseSelectedPackage, restorePurchasesAccess } from "@/lib/purchases";
import { startWebStripeCheckout } from "@/lib/stripe-web";
import { useOnboardingFlowStore } from "@/stores/onboardingFlowStore";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/lib/auth";
import { useSubscriptionStore } from "@/stores/subscriptionStore";

export default function WelcomePaywallScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { theme } = useTheme();
  const { getToken } = useAuth();
  const firstName = useOnboardingFlowStore((s) => s.firstName);
  const setPremium = useSubscriptionStore((s) => s.setPremium);
  const rtl = i18n.language === "fa";

  const claimTrial = async () => {
    try {
      if (Platform.OS === "web") {
        await startWebStripeCheckout(getToken);
      } else {
        const available = await getAvailablePackages();
        const preferred = available.find((p) => p.packageType === "MONTHLY") ?? available[0];
        if (!preferred) throw new Error("No package available.");
        await purchaseSelectedPackage(preferred);
      }
      setPremium(true);
      router.replace("/(main)/home");
    } catch {
      router.replace("/(main)/home");
    }
  };

  const restore = async () => {
    try {
      if (Platform.OS !== "web") await restorePurchasesAccess();
      setPremium(true);
      router.replace("/(main)/home");
    } catch {
      // no-op
    }
  };

  return (
    <View className="flex-1 justify-between px-6 py-12" style={{ backgroundColor: theme.colors.background }}>
      <View className="pt-6">
        <View className="items-center">
          <LinearGradient
            colors={[`${theme.colors.primary}aa`, `${theme.colors.secondary}55`, "transparent"]}
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
            <Text style={{ fontSize: 80, lineHeight: 88, color: theme.colors.onBackground }}>♒</Text>
          </LinearGradient>
        </View>
        <Text
          className="mt-10 text-center text-4xl font-semibold"
          style={{ color: theme.colors.onBackground, writingDirection: rtl ? "rtl" : "ltr" }}
        >
          {t("paywall.welcome", { name: firstName || t("brand.name") })}
        </Text>
        <Text
          className="mt-6 text-center text-xl leading-8"
          style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr" }}
        >
          {t("paywall.body")}
        </Text>
      </View>

      <View>
        <View className="rounded-3xl border p-5" style={{ borderColor: theme.colors.outline }}>
          <Text className="text-center text-2xl font-semibold" style={{ color: theme.colors.onBackground }}>
            {t("paywall.trial")}
          </Text>
          <Text className="mt-3 text-center text-xl" style={{ color: theme.colors.onSurfaceVariant }}>
            {t("paywall.price")}
          </Text>
          <Text className="mt-2 text-center text-sm" style={{ color: theme.colors.onSurfaceVariant }}>
            {t("paywall.renewal")}
          </Text>
          <Text className="mt-2 text-center text-sm" style={{ color: theme.colors.onSurfaceVariant }}>
            {t("paywall.cancelAnytime")}
          </Text>
        </View>
        <Pressable onPress={() => void claimTrial()} className="mt-6 rounded-full px-4 py-4" style={{ backgroundColor: theme.colors.onBackground }}>
          <Text className="text-center text-2xl font-semibold" style={{ color: theme.colors.background }}>
            {t("paywall.cta")}
          </Text>
        </Pressable>
        <Pressable onPress={() => void restore()} className="mt-4 py-2">
          <Text className="text-center text-lg underline" style={{ color: theme.colors.onSurfaceVariant }}>
            {t("paywall.restore")}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/(main)/home")} className="mt-2 py-2">
          <Text className="text-center text-lg" style={{ color: theme.colors.onSurfaceVariant }}>
            {t("paywall.maybeLater")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
