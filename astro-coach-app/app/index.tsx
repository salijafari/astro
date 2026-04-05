import { LanguageSelector } from "@/components/LanguageSelector";
import { useAuth } from "@/lib/auth";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ProfileStatusResponse = {
  complete?: boolean;
  missingFields?: string[];
};

type SubscriptionStatusPayload = {
  trialStartedAt?: string | null;
  subscriptionStatus?: string;
};

const API_BASE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

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
 * Global rules: deps are ONLY `loading` + `user` — never `getToken` or `router` (unstable / loop risk).
 */
export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading, getToken } = useAuth();
  const hasNavigated = useRef(false);
  const isRouting = useRef(false);
  const lastUid = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    const uidNow = user?.uid ?? null;
    if (lastUid.current !== uidNow) {
      lastUid.current = uidNow;
      hasNavigated.current = false;
      isRouting.current = false;
    }

    if (hasNavigated.current || isRouting.current) {
      return;
    }

    const routeUser = async () => {
      if (hasNavigated.current || isRouting.current) {
        return;
      }
      isRouting.current = true;
      console.log("[index] routing started");

      try {
        if (!user) {
          hasNavigated.current = true;
          router.replace("/welcome");
          return;
        }

        const idToken = await getToken();
        if (!idToken) {
          console.warn("[index] no idToken, aborting");
          return;
        }

        let profileStatus: ProfileStatusResponse | null = null;
        try {
          const res = await fetch(`${API_BASE}/api/user/profile/status`, {
            headers: { Authorization: `Bearer ${idToken}` },
            signal: abortAfter(8000),
          });
          if (res.status === 429) {
            console.warn("[index] profile/status rate limited — defaulting to home");
          } else if (res.ok) {
            profileStatus = (await res.json()) as ProfileStatusResponse;
          } else {
            console.warn("[index] profile/status returned:", res.status);
          }
        } catch (err) {
          console.warn("[index] profile/status failed:", err);
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

        if (Platform.OS === "web" && profileStatus?.complete) {
          let subStatus: SubscriptionStatusPayload | null = null;
          try {
            const res = await fetch(`${API_BASE}/api/subscription/status`, {
              headers: { Authorization: `Bearer ${idToken}` },
              signal: abortAfter(8000),
            });
            if (res.status === 429) {
              console.warn("[index] subscription/status rate limited — defaulting to home");
            } else if (res.ok) {
              subStatus = (await res.json()) as SubscriptionStatusPayload;
            }
          } catch (err) {
            console.warn("[index] subscription/status failed:", err);
          }

          if (subStatus) {
            const trialClaimed = Boolean(subStatus.trialStartedAt);
            const stripeOrActive = subStatus.subscriptionStatus === "active";
            if (!trialClaimed && !stripeOrActive) {
              hasNavigated.current = true;
              router.replace("/(subscription)/claim-trial");
              return;
            }
          }
        }

        console.log("[index] routing to home");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only auth identity; getToken/router omitted to prevent loops
  }, [loading, user]);

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
