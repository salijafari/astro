import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { AuroraSafeArea } from "@/components/CosmicBackground";
import { useTheme } from "@/providers/ThemeProvider";

type SubStatus = {
  isPremium?: boolean;
  subscriptionStatus?: string;
};

/**
 * Stripe success redirect screen.
 * Polls subscription status until premium is confirmed or timeout.
 */
export default function SubscriptionSuccessScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const [confirmed, setConfirmed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const pollCount = useRef(0);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxPolls = 10;
  const pollInterval = 2000; // 2 seconds between polls

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      if (pollCount.current >= maxPolls) {
        if (!cancelled) setTimedOut(true);
        return;
      }
      pollCount.current += 1;

      try {
        const res = await apiRequest("/api/subscription/status", {
          method: "GET",
          getToken,
        });
        if (res.ok) {
          const data = (await res.json()) as SubStatus;
          if (data.isPremium || data.subscriptionStatus === "active") {
            if (!cancelled) setConfirmed(true);
            return;
          }
        }
      } catch {
        // ignore — keep polling
      }

      // Not confirmed yet — poll again
      if (cancelled) return;
      pollTimeoutRef.current = setTimeout(() => {
        void poll();
      }, pollInterval);
    };

    // Start polling after a short delay to give webhook time to fire
    pollTimeoutRef.current = setTimeout(() => {
      void poll();
    }, 1500);

    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [getToken]);

  const goHome = () => {
    router.replace("/(main)/home");
  };

  return (
    <AuroraSafeArea
      className="flex-1 items-center justify-center px-8"
      colorSchemeOverride="dark"
    >
      {confirmed ? (
        <View className="items-center gap-6">
          <Text style={{ fontSize: 64 }}>🌟</Text>
          <Text
            style={{
              color: theme.colors.onBackground,
              fontSize: 24,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {t("subscription.successTitle")}
          </Text>
          <Text
            style={{
              color: theme.colors.onSurfaceVariant,
              fontSize: 16,
              textAlign: "center",
              lineHeight: 24,
            }}
          >
            {t("subscription.successBody")}
          </Text>
          <Pressable
            onPress={goHome}
            style={{
              backgroundColor: theme.colors.primary,
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 32,
              marginTop: 8,
            }}
          >
            <Text
              style={{
                color: theme.colors.onPrimary,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              {t("subscription.goToDashboard")}
            </Text>
          </Pressable>
        </View>
      ) : timedOut ? (
        <View className="items-center gap-6">
          <Text style={{ fontSize: 48 }}>✅</Text>
          <Text
            style={{
              color: theme.colors.onBackground,
              fontSize: 22,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {t("subscription.paymentReceived")}
          </Text>
          <Text
            style={{
              color: theme.colors.onSurfaceVariant,
              fontSize: 15,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            {t("subscription.activatingBody")}
          </Text>
          <Pressable
            onPress={goHome}
            style={{
              backgroundColor: theme.colors.primary,
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 32,
              marginTop: 8,
            }}
          >
            <Text
              style={{
                color: theme.colors.onPrimary,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              {t("subscription.goToDashboard")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="items-center gap-6">
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text
            style={{
              color: theme.colors.onSurfaceVariant,
              fontSize: 16,
              textAlign: "center",
            }}
          >
            {t("subscription.activating")}
          </Text>
        </View>
      )}
    </AuroraSafeArea>
  );
}
