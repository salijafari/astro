import { Ionicons } from "@expo/vector-icons";
import { useState, type FC } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { getAvailablePackages, purchaseSelectedPackage, restorePurchasesAccess } from "@/lib/purchases";
import { invalidateProfileCache } from "@/lib/userProfile";
import { invalidateSubscriptionCache } from "@/lib/useSubscription";

type Props = {
  visible: boolean;
  onClose: () => void;
  featureName?: string;
};

/**
 * Modal paywall: Stripe Checkout on web, RevenueCat package purchase on native.
 */
export const PaywallGate: FC<Props> = ({ visible, onClose, featureName }) => {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      if (Platform.OS === "web") {
        const res = await apiRequest("/api/subscription/create-checkout-session", {
          method: "POST",
          getToken,
        });
        const data = (await res.json()) as { url?: string; error?: string; details?: string };
        if (!res.ok) {
          throw new Error(data.details ?? data.error ?? `HTTP ${res.status}`);
        }
        if (data.url && typeof window !== "undefined") {
          window.location.href = data.url;
        } else {
          throw new Error("No checkout URL returned");
        }
      } else {
        const packages = await getAvailablePackages();
        const pkg =
          packages.find((p) => p.packageType === "MONTHLY") ??
          packages.find((p) => p.packageType === "ANNUAL") ??
          packages[0];
        if (!pkg) {
          Alert.alert("", t("paywall.unlockError"));
          return;
        }
        await purchaseSelectedPackage(pkg);
        await invalidateProfileCache();
        invalidateSubscriptionCache();
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[PaywallGate]", msg);
      Alert.alert("", t("paywall.unlockError"));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (Platform.OS === "web") return;
    try {
      await restorePurchasesAccess();
      await invalidateProfileCache();
      invalidateSubscriptionCache();
      onClose();
    } catch {
      Alert.alert("", t("paywall.unlockError"));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="rounded-t-xl bg-slate-900 px-4 pb-8 pt-6">
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
            className="mb-2 h-10 w-10 items-center justify-center self-end rounded-[20px]"
          >
            <Ionicons name="close" size={24} color="rgba(255,255,255,0.5)" />
          </Pressable>

          <View className="mb-6 items-center">
            <View className="mb-2 h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20">
              <Ionicons name="lock-closed" size={28} color="#8b8cff" />
            </View>
            <Text className="text-center text-xl font-bold text-white">{t("paywall.unlockTitle")}</Text>
            {featureName ? (
              <Text className="mt-1 text-center text-sm text-white/50">
                {t("paywall.unlockFeatureSubtitle", { feature: featureName })}
              </Text>
            ) : null}
          </View>

          <View className="mb-6 gap-2">
            {[t("paywall.unlockBenefit1"), t("paywall.unlockBenefit2"), t("paywall.unlockBenefit3")].map(
              (line, i) => (
                <View key={i} className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={18} color="#8b8cff" />
                  <Text className="flex-1 text-sm text-white/80">{line}</Text>
                </View>
              ),
            )}
          </View>

          <Text className="mb-2 text-center text-xs text-white/50">{t("paywall.unlockPriceLine")}</Text>

          <Pressable
            onPress={() => void handleSubscribe()}
            disabled={loading}
            className="mb-2 min-h-[48px] items-center justify-center rounded-[20px] bg-indigo-500 px-6 py-2"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-sm font-medium text-white" style={{ letterSpacing: 0.1 }}>
                {t("paywall.unlockCta")}
              </Text>
            )}
          </Pressable>

          {Platform.OS !== "web" ? (
            <Pressable
              onPress={() => void handleRestore()}
              className="min-h-[48px] items-center justify-center px-3 py-2"
              accessibilityRole="button"
            >
              <Text className="text-sm text-white/40">{t("paywall.unlockRestore")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};
