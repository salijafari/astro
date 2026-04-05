import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/mixpanel";
import { getAvailablePackages, purchaseSelectedPackage, restorePurchasesAccess, type PurchasePackage } from "@/lib/purchases";
import { themes } from "@/constants/theme";

type PaywallContext = "onboarding" | "chat_limit" | "compatibility" | "feature";

type Props = {
  context: PaywallContext;
  sunSign?: string;
  onContinueFree: () => void;
  onSubscribed?: () => void;
};

/**
 * Reusable paywall with visible free path and restore (Section 7 global rules).
 */
export const PaywallScreen: React.FC<Props> = ({ context, sunSign, onContinueFree, onSubscribed }) => {
  const theme = themes.dark;
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState<PurchasePackage | null>(null);
  const [annual, setAnnual] = useState<PurchasePackage | null>(null);
  const [annualSelected, setAnnualSelected] = useState(true);

  useEffect(() => {
    trackEvent("paywall_shown", { context });
    void (async () => {
      try {
        const avail = await getAvailablePackages();
        setMonthly(avail.find((p) => p.packageType === "MONTHLY") ?? avail[0] ?? null);
        setAnnual(avail.find((p) => p.packageType === "ANNUAL") ?? avail[1] ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [context]);

  const buy = async () => {
    const pkg = annualSelected ? annual : monthly;
    if (!pkg) return;
    trackEvent("paywall_cta_tapped", { context, plan: annualSelected ? "annual" : "monthly" });
    try {
      await purchaseSelectedPackage(pkg);
      trackEvent("trial_or_purchase_started", { context });
      onSubscribed?.();
    } catch {
      trackEvent("paywall_cancelled_or_error", { context });
    }
  };

  const restore = async () => {
    try {
      await restorePurchasesAccess();
      onSubscribed?.();
    } catch {
      /* ignore */
    }
  };

  const header =
    context === "onboarding"
      ? `As a ${sunSign ?? "seeker"}, your cosmic toolkit is waiting.`
      : "Unlock unlimited guidance";

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (Platform.OS === "web") {
    return (
      <SafeAreaView className="flex-1 bg-slate-950 px-4">
        <Text className="text-3xl font-bold text-white mt-6">{header}</Text>
        <Text className="text-indigo-200 mt-2 text-base leading-6">
          Subscriptions on the web use checkout separate from the App Store. Stripe-powered web billing is coming soon — use the iOS or
          Android app for RevenueCat trials and purchases today.
        </Text>
        <View className="mt-6 gap-2">
          <Button title="Continue with Free Plan" variant="secondary" onPress={onContinueFree} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-4">
      <Text className="text-3xl font-bold text-white mt-6">{header}</Text>
      <Text className="text-indigo-200 mt-2 text-base">
        Unlimited chat, compatibility, daily insights, dream reading, and tarot — $9.99/mo or $59.99/yr (save ~50%).
      </Text>

      <View className="mt-6 flex-row gap-2">
        <Pressable
          onPress={() => setAnnualSelected(false)}
          className={`min-h-[48px] flex-1 justify-center rounded-xl border p-4 ${!annualSelected ? "border-indigo-400 bg-indigo-950" : "border-slate-700"}`}
        >
          <Text className="text-white font-semibold">Monthly</Text>
          <Text className="text-slate-300 text-sm">$9.99 / mo</Text>
        </Pressable>
        <Pressable
          onPress={() => setAnnualSelected(true)}
          className={`min-h-[48px] flex-1 justify-center rounded-xl border p-4 ${annualSelected ? "border-indigo-400 bg-indigo-950" : "border-slate-700"}`}
        >
          <Text className="text-white font-semibold">Annual</Text>
          <Text className="text-indigo-300 text-sm">$59.99 / yr · Best value</Text>
        </Pressable>
      </View>

      <View className="mt-6 gap-2">
        <Button title="Start 7-Day Free Trial" onPress={() => void buy()} />
        <Button title="Continue with Free Plan" variant="secondary" onPress={onContinueFree} />
      </View>

      <Text className="text-slate-500 text-xs mt-6 leading-5">
        7-day free trial, then billed at the selected price. Subscription auto-renews until cancelled in App Store or
        Google Play settings. Cancel anytime.
      </Text>

      <Pressable
        onPress={() => void restore()}
        className="mb-6 mt-6 min-h-[48px] items-center justify-center px-3 py-2"
        accessibilityRole="button"
      >
        <Text className="text-indigo-300">Restore Purchases</Text>
      </Pressable>
    </SafeAreaView>
  );
};
