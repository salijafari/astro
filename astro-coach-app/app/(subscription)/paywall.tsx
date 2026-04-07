import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/api";
import { logEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import {
  getAvailablePackages,
  purchaseSelectedPackage,
  restorePurchasesAccess,
  type PurchasePackage,
} from "@/lib/purchases";
import { invalidateProfileCache } from "@/lib/userProfile";
import { invalidateSubscriptionCache } from "@/lib/useSubscription";

const STRIPE_PRICE_MONTHLY = "price_1TG884Rv8vuaHOxlRFbLpO5y";
const STRIPE_PRICE_ANNUAL = "price_1TJR2VRv8vuaHOxlVYdKbnwU";

const PURPLE = "#7c3aed";
const GRADIENT_CARD = ["#1a0533", "#0d1f3c", "#0a1628"] as const;
const BTN_GRADIENT = ["#7c3aed", "#6d28d9"] as const;

function packageIdentifier(pkg: PurchasePackage): string {
  const id = pkg.identifier;
  return typeof id === "string" ? id.toLowerCase() : "";
}

function findMonthlyPackage(packages: PurchasePackage[]): PurchasePackage | null {
  return packages.find((p) => packageIdentifier(p).includes("monthly")) ?? null;
}

function findAnnualPackage(packages: PurchasePackage[]): PurchasePackage | null {
  return (
    packages.find((p) => {
      const s = packageIdentifier(p);
      return s.includes("yearly") || s.includes("annual");
    }) ?? null
  );
}

/**
 * Full-screen paywall: web uses Stripe Checkout; native uses RevenueCat.
 * Layout: bottom sheet (narrow width) or centered modal (wide).
 */
export default function SubscriptionPaywallScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rtl = i18n.language === "fa";

  const isMobileLayout = windowWidth < 768;
  const isWeb = Platform.OS === "web";

  const [selectedPlan, setSelectedPlan] = useState<"annual" | "monthly">("annual");
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [offeringsLoading, setOfferingsLoading] = useState(!isWeb);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasePackage | null>(null);
  const [annualPkg, setAnnualPkg] = useState<PurchasePackage | null>(null);

  const translateY = useSharedValue(isMobileLayout ? windowHeight : 0);

  const loadOfferings = useCallback(async () => {
    if (isWeb) return;
    setOfferingsLoading(true);
    setOfferingsError(null);
    try {
      const avail = await getAvailablePackages();
      setMonthlyPkg(findMonthlyPackage(avail));
      setAnnualPkg(findAnnualPackage(avail));
      if (!findMonthlyPackage(avail) && !findAnnualPackage(avail)) {
        setOfferingsError(t("paywall.checkoutError"));
      }
    } catch (e) {
      setOfferingsError(e instanceof Error ? e.message : t("paywall.checkoutError"));
    } finally {
      setOfferingsLoading(false);
    }
  }, [isWeb, t]);

  useEffect(() => {
    if (!isWeb) void loadOfferings();
  }, [isWeb, loadOfferings]);

  useEffect(() => {
    if (!isMobileLayout) {
      translateY.value = 0;
      return;
    }
    translateY.value = windowHeight;
    translateY.value = withSpring(windowHeight * 0.1, { damping: 20, stiffness: 200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- translateY is a Reanimated shared value (stable ref)
  }, [isMobileLayout, windowHeight]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const navigateBack = useCallback(() => {
    router.back();
  }, [router]);

  const closeWithAnimation = useCallback(() => {
    if (isMobileLayout) {
      translateY.value = withSpring(
        windowHeight,
        { damping: 20, stiffness: 200 },
        (finished) => {
          if (finished) runOnJS(navigateBack)();
        },
      );
    } else {
      navigateBack();
    }
  }, [isMobileLayout, navigateBack, translateY, windowHeight]);

  const startWebCheckout = async () => {
    setCheckoutError(null);
    setSubscribeLoading(true);
    const priceId = selectedPlan === "annual" ? STRIPE_PRICE_ANNUAL : STRIPE_PRICE_MONTHLY;
    try {
      const idToken = await getToken();
      if (!idToken) {
        Alert.alert("Error", "Please sign in again and try.");
        return;
      }
      const res = await apiRequest("/api/billing/checkout", {
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
        setCheckoutError(data.details ?? data.error ?? t("paywall.checkoutError"));
        return;
      }
      if (data.url) {
        logEvent("stripe_checkout_opened", { platform: "web", plan: selectedPlan });
        if (typeof window !== "undefined") window.location.href = data.url;
      } else {
        setCheckoutError(t("paywall.checkoutError"));
      }
    } catch {
      setCheckoutError(t("paywall.checkoutError"));
    } finally {
      setSubscribeLoading(false);
    }
  };

  const startNativePurchase = async () => {
    const pkg = selectedPlan === "annual" ? annualPkg : monthlyPkg;
    if (!pkg) {
      setCheckoutError(t("paywall.checkoutError"));
      return;
    }
    setCheckoutError(null);
    setSubscribeLoading(true);
    try {
      await purchaseSelectedPackage(pkg);
      await invalidateProfileCache();
      invalidateSubscriptionCache();
      logEvent("trial_or_purchase_started", { platform: Platform.OS, plan: selectedPlan });
      navigateBack();
    } catch {
      setCheckoutError(t("paywall.checkoutError"));
    } finally {
      setSubscribeLoading(false);
    }
  };

  const onSubscribe = () => {
    if (isWeb) void startWebCheckout();
    else void startNativePurchase();
  };

  const onRestore = async () => {
    if (isWeb) return;
    try {
      await restorePurchasesAccess();
      await invalidateProfileCache();
      invalidateSubscriptionCache();
      Alert.alert("Restored", "Your subscription has been restored.");
      navigateBack();
    } catch {
      Alert.alert("Error", "Could not restore purchases. Please try again.");
    }
  };

  const headlineSize = isMobileLayout ? 28 : 32;
  const writingDir = rtl ? "rtl" : "ltr";
  const rowDir = rtl ? "flex-row-reverse" : "flex-row";

  const renderPlanSelector = () => (
    <View className="w-full gap-3">
      {/* Annual first — default selected */}
      <Pressable
        accessibilityRole="button"
        onPress={() => setSelectedPlan("annual")}
        className="rounded-2xl border-2 p-4"
        style={{
          borderColor: selectedPlan === "annual" ? PURPLE : "rgba(148,163,184,0.35)",
        }}
      >
        <View className={`items-center ${rowDir} justify-between`}>
          <View className="flex-1">
            <View className="items-center self-stretch">
              <View className="rounded-full px-3 py-0.5" style={{ backgroundColor: `${PURPLE}33` }}>
                <Text className="text-xs font-semibold" style={{ color: "#e9d5ff" }}>
                  {t("paywall.mostPopular")}
                </Text>
              </View>
            </View>
            <Text className="mt-2 text-lg font-semibold text-white">{t("paywall.annualLabel")}</Text>
            <Text className="mt-1 text-sm text-slate-400 line-through">$129.99 CAD</Text>
            <Text className="mt-0.5 text-base font-semibold text-white">$77.99 CAD / year</Text>
            <Text className="mt-1 text-sm text-slate-300">$6.50 / mo</Text>
          </View>
          {selectedPlan === "annual" ? (
            <Ionicons name="checkmark-circle" size={28} color={PURPLE} style={{ marginStart: 8 }} />
          ) : (
            <View className="h-7 w-7 rounded-full border-2 border-slate-500" style={{ marginStart: 8 }} />
          )}
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => setSelectedPlan("monthly")}
        className="rounded-2xl border-2 p-4"
        style={{
          borderColor: selectedPlan === "monthly" ? PURPLE : "rgba(148,163,184,0.35)",
        }}
      >
        <View className={`items-center ${rowDir} justify-between`}>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-white">{t("paywall.monthlyLabel")}</Text>
            <Text className="mt-2 text-base text-slate-200">$9.99 CAD / mo</Text>
          </View>
          {selectedPlan === "monthly" ? (
            <Ionicons name="checkmark-circle" size={28} color={PURPLE} style={{ marginStart: 8 }} />
          ) : (
            <View className="h-7 w-7 rounded-full border-2 border-slate-500" style={{ marginStart: 8 }} />
          )}
        </View>
      </Pressable>
    </View>
  );

  const renderHeaderAndFeatures = () => (
    <View className="w-full">
      <View className="self-start rounded-full px-3 py-1" style={{ backgroundColor: PURPLE }}>
        <Text className="text-xs font-semibold text-white">{t("paywall.badge")}</Text>
      </View>
      <Text
        className="mt-4 font-bold text-white"
        style={{ fontSize: headlineSize, writingDirection: writingDir, textAlign: rtl ? "right" : "left" }}
      >
        {t("paywall.headline")}
      </Text>
      <View className="mt-5 gap-3">
        {(["feature1", "feature2", "feature3"] as const).map((key) => (
          <View key={key} className={`${rowDir} items-start gap-3`}>
            <Ionicons name="checkmark-circle" size={22} color={PURPLE} style={{ marginTop: 2 }} />
            <Text
              className="flex-1 text-base leading-6 text-slate-200"
              style={{ writingDirection: writingDir, textAlign: rtl ? "right" : "left" }}
            >
              {t(`paywall.${key}`)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderCardInner = () => (
    <>
      <View
        className="absolute z-10"
        style={{
          top: Math.max(insets.top, 12),
          ...(rtl ? { left: 12 } : { right: 12 }),
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={closeWithAnimation}
          className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
        >
          <Text className="text-lg text-white">✕</Text>
        </Pressable>
      </View>

      {!isWeb && offeringsLoading ? (
        <View className="min-h-[200px] flex-1 items-center justify-center py-12">
          <ActivityIndicator color={PURPLE} size="large" />
          <Text className="mt-4 text-center text-slate-300" style={{ writingDirection: writingDir }}>
            {t("paywall.loadingPlans")}
          </Text>
        </View>
      ) : !isWeb && offeringsError ? (
        <View className="min-h-[200px] flex-1 items-center justify-center gap-4 px-4 py-12">
          <Text className="text-center text-red-300" style={{ writingDirection: writingDir }}>
            {offeringsError}
          </Text>
          <Pressable
            onPress={() => void loadOfferings()}
            className="rounded-xl px-6 py-3"
            style={{ backgroundColor: PURPLE }}
          >
            <Text className="font-semibold text-white">{t("common.tryAgain")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
          paddingTop: 52,
          paddingHorizontal: 20,
          paddingBottom: Math.max(28, insets.bottom + 16),
        }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {windowWidth >= 768 ? (
            <View className={`${rowDir} gap-8`}>
              <View className="min-w-0 flex-1">{renderHeaderAndFeatures()}</View>
              <View className="min-w-0 flex-1">{renderPlanSelector()}</View>
            </View>
          ) : (
            <View className="gap-8">
              {renderHeaderAndFeatures()}
              {renderPlanSelector()}
            </View>
          )}

          <View className="mt-8">
            <Pressable
              accessibilityRole="button"
              disabled={
                subscribeLoading ||
                (!isWeb &&
                  (offeringsLoading ||
                    (selectedPlan === "annual" ? !annualPkg : !monthlyPkg)))
              }
              onPress={onSubscribe}
              className="overflow-hidden rounded-[14px]"
              style={{ minHeight: 52, opacity: subscribeLoading ? 0.85 : 1 }}
            >
              <LinearGradient
                colors={[...BTN_GRADIENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  minHeight: 52,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 16,
                }}
              >
                {subscribeLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-base font-bold text-white">
                    {selectedPlan === "annual" ? t("paywall.subscribeAnnual") : t("paywall.subscribeMonthly")}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            {checkoutError ? (
              <Text className="mt-3 text-center text-sm text-red-400" style={{ writingDirection: writingDir }}>
                {checkoutError}
              </Text>
            ) : null}

            <Text
              className="mt-4 text-center text-xs text-slate-400"
              style={{ writingDirection: writingDir }}
            >
              {t("paywall.cancelAnytime")}
            </Text>

            {!isWeb ? (
              <Pressable accessibilityRole="button" onPress={() => void onRestore()} className="mt-4 py-2">
                <Text className="text-center text-sm text-violet-300">{t("paywall.restorePurchases")}</Text>
              </Pressable>
            ) : null}

            <Pressable accessibilityRole="button" onPress={closeWithAnimation} className="mt-2 py-2">
              <Text className="text-center text-sm text-slate-500 underline">{t("paywall.notNow")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </>
  );

  return (
    <View className="flex-1 bg-black">
      <BlurView
        intensity={isWeb ? 40 : 50}
        tint="dark"
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View className="absolute inset-0 bg-black/40" />

      {isMobileLayout ? (
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: windowHeight * 0.9,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
            },
            sheetAnimatedStyle,
          ]}
        >
          <LinearGradient
            colors={[...GRADIENT_CARD]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ flex: 1 }}
          >
            {renderCardInner()}
          </LinearGradient>
        </Animated.View>
      ) : (
        <View className="flex-1 items-center justify-center px-4">
          <View
            style={{
              width: "100%",
              maxWidth: 680,
              maxHeight: windowHeight - 48,
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={[...GRADIENT_CARD]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ flex: 1, minHeight: 400 }}
            >
              {renderCardInner()}
            </LinearGradient>
          </View>
        </View>
      )}
    </View>
  );
}
