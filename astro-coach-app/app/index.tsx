import { LanguageSelector } from "@/components/LanguageSelector";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { useRouter, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

type ProfileStatusResponse = {
  complete?: boolean;
  missingFields?: string[];
};

type SubscriptionStatusPayload = {
  trialStartedAt?: string | null;
  subscriptionStatus?: string;
  premiumUnlimited?: boolean;
};

const API_BASE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

function isPremiumSubscriptionPayload(s: SubscriptionStatusPayload): boolean {
  return (
    s.subscriptionStatus === "premium" ||
    s.subscriptionStatus === "active" ||
    Boolean(s.premiumUnlimited)
  );
}

/** AbortSignal.timeout is missing on some RN runtimes — safe fallback. */
function abortAfter(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

/**
 * Root router. ONLY place that navigates based on auth / language / profile / trial.
 * Ref guards prevent concurrent routing and re-entry on React re-renders.
 *
 * Global rules: deps are `loading`, `user`, and `subscriptionCheckFailed` (retry); never `getToken` or `router` (unstable / loop risk).
 */
export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, loading, getToken } = useAuth();
  const hasNavigated = useRef(false);
  const isRouting = useRef(false);
  const lastUid = useRef<string | null>(null);
  const tokenRetryCount = useRef(0);
  const [subscriptionCheckFailed, setSubscriptionCheckFailed] = useState(false);

  useEffect(() => {
    if (loading || subscriptionCheckFailed) return;

    const uidNow = user?.uid ?? null;
    if (lastUid.current !== uidNow) {
      lastUid.current = uidNow;
      hasNavigated.current = false;
      isRouting.current = false;
      tokenRetryCount.current = 0;
    }

    if (hasNavigated.current || isRouting.current) {
      return;
    }

    const routeUser = async () => {
      if (hasNavigated.current || isRouting.current) {
        return;
      }
      isRouting.current = true;

      try {
        if (!user) {
          hasNavigated.current = true;
          router.replace("/intro" as Href);
          return;
        }

        const idToken = await getToken();
        if (!idToken) {
          if (tokenRetryCount.current < 3) {
            tokenRetryCount.current += 1;
            setTimeout(() => {
              void routeUser();
            }, 500);
            return;
          }
          console.warn("[index] no idToken after retries — routing to sign-in");
          hasNavigated.current = true;
          router.replace("/(auth)/sign-in" as Href);
          return;
        }
        tokenRetryCount.current = 0;

        let profileStatus: ProfileStatusResponse | null = null;
        try {
          const profileRes = await apiRequest("/api/user/profile/status", {
            getToken,
            method: "GET",
          });
          if (profileRes.ok) {
            profileStatus = (await profileRes.json()) as ProfileStatusResponse;
          } else if (profileRes.status === 401) {
            hasNavigated.current = true;
            router.replace("/(auth)/sign-in" as Href);
            return;
          } else {
            setSubscriptionCheckFailed(true);
            return;
          }
        } catch {
          setSubscriptionCheckFailed(true);
          return;
        }

        if (profileStatus && !profileStatus.complete) {
          const mf = profileStatus.missingFields ?? [];
          const needSetup =
            mf.includes("all") || mf.includes("name") || mf.includes("birthDate");
          if (needSetup) {
            hasNavigated.current = true;
            router.replace("/(profile-setup)/setup");
            return;
          }
        }

        let subscriptionPayload: SubscriptionStatusPayload | null = null;
        let subscriptionFetchFailed = false;

        if (profileStatus?.complete) {
          try {
            const res = await fetch(`${API_BASE}/api/subscription/status`, {
              headers: { Authorization: `Bearer ${idToken}` },
              signal: abortAfter(8000),
            });
            if (res.status === 429) {
              console.warn("[index] subscription/status rate limited — subscription unknown");
              subscriptionFetchFailed = true;
            } else if (res.ok) {
              subscriptionPayload = (await res.json()) as SubscriptionStatusPayload;
            } else {
              console.warn("[index] subscription/status returned:", res.status);
              subscriptionFetchFailed = true;
            }
          } catch (err) {
            console.warn("[index] subscription/status failed:", err);
            subscriptionFetchFailed = true;
          }
        }

        if (subscriptionFetchFailed) {
          setSubscriptionCheckFailed(true);
          return;
        }

        if (profileStatus?.complete && !subscriptionPayload) {
          setSubscriptionCheckFailed(true);
          return;
        }

        if (profileStatus?.complete && subscriptionPayload) {
          const trialClaimed = Boolean(subscriptionPayload.trialStartedAt);
          const isPremiumUser = isPremiumSubscriptionPayload(subscriptionPayload);
          if (!trialClaimed && !isPremiumUser) {
            hasNavigated.current = true;
            router.replace("/(subscription)/claim-trial");
            return;
          }
        }

        hasNavigated.current = true;
        router.replace("/(main)/home");
      } catch (err) {
        console.error("[index] routing error:", err);
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          router.replace("/(main)/home");
        }
      } finally {
        isRouting.current = false;
      }
    };

    void routeUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: auth + retry gate; getToken/router omitted to prevent loops
  }, [loading, user, subscriptionCheckFailed]);

  if (subscriptionCheckFailed) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0f172a",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text
          style={{
            color: "#ffffff",
            fontSize: 18,
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          {t("errors.connectionError") ?? "Connection error"}
        </Text>
        <Text
          style={{
            color: "#94a3b8",
            fontSize: 14,
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          {t("errors.retryMessage") ?? "Please check your connection and try again."}
        </Text>
        <Pressable
          onPress={() => {
            setSubscriptionCheckFailed(false);
            hasNavigated.current = false;
          }}
          style={{
            backgroundColor: "#7c3aed",
            borderRadius: 12,
            paddingHorizontal: 32,
            paddingVertical: 14,
          }}
        >
          <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>
            {t("errors.retry") ?? "Try again"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="relative flex-1 items-center justify-center bg-slate-950">
      <View
        className="absolute right-5 z-10"
        style={{ top: Math.max(insets.top, 8) + 12 }}
        pointerEvents="box-none"
      >
        <LanguageSelector variant="pills" />
      </View>
      <ActivityIndicator color="#8b8cff" size="large" />
    </View>
  );
}
