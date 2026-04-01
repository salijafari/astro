import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { LANGUAGE_PREF_KEY } from "@/lib/i18n";
import { readPersistedValue } from "@/lib/storage";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

type ProfileStatusResponse = {
  complete?: boolean;
  missingFields?: string[];
};

/**
 * Root router. ONLY place that navigates based on auth / language / profile / trial.
 * Ref guard prevents double-firing; `hasNavigated` is set only immediately before `router.replace`.
 */
export default function Index() {
  const router = useRouter();
  const { user, loading, getToken } = useAuth();
  const hasNavigated = useRef(false);
  const lastUid = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    const uidNow = user?.uid ?? null;
    if (lastUid.current !== uidNow) {
      lastUid.current = uidNow;
      hasNavigated.current = false;
    }

    if (hasNavigated.current) return;

    void (async () => {
      try {
        if (!user) {
          hasNavigated.current = true;
          router.replace("/(auth)/sign-in");
          return;
        }

        const language = await readPersistedValue(LANGUAGE_PREF_KEY);
        if (!language) {
          hasNavigated.current = true;
          router.replace("/(onboarding)/language-select");
          return;
        }

        const idToken = await getToken();
        if (!idToken) {
          hasNavigated.current = true;
          router.replace("/(auth)/sign-in");
          return;
        }

        const statusRes = await apiRequest("/api/user/profile/status", {
          method: "GET",
          getToken,
        });

        if (!statusRes.ok) {
          console.warn("[index] profile/status failed:", statusRes.status);
          hasNavigated.current = true;
          router.replace("/(profile-setup)/setup");
          return;
        }

        const status = (await statusRes.json()) as ProfileStatusResponse;
        const mf = status.missingFields ?? [];
        const needSetup =
          !status.complete &&
          (mf.includes("all") || mf.includes("name") || mf.includes("birthDate"));

        if (needSetup) {
          hasNavigated.current = true;
          router.replace("/(profile-setup)/setup");
          return;
        }

        if (Platform.OS !== "web") {
          hasNavigated.current = true;
          router.replace("/(main)/home");
          return;
        }

        try {
          const subRes = await apiRequest("/api/subscription/status", {
            method: "GET",
            getToken,
          });
          if (!subRes.ok) {
            console.warn("[index] subscription/status failed:", subRes.status);
            hasNavigated.current = true;
            router.replace("/(main)/home");
            return;
          }
          const sub = (await subRes.json()) as {
            trialStartedAt?: string | null;
            subscriptionStatus?: string;
          };
          const trialClaimed = Boolean(sub.trialStartedAt);
          const stripeOrActive = sub.subscriptionStatus === "active";
          if (!trialClaimed && !stripeOrActive) {
            hasNavigated.current = true;
            router.replace("/(subscription)/claim-trial");
            return;
          }
          hasNavigated.current = true;
          router.replace("/(main)/home");
        } catch (e) {
          console.warn("[index] subscription routing failed, defaulting to home", e);
          hasNavigated.current = true;
          router.replace("/(main)/home");
        }
      } catch (e) {
        console.warn("[index] routing failed", e);
        hasNavigated.current = true;
        router.replace("/(onboarding)/language-select");
      }
    })();
  }, [loading, user, getToken, router]);

  return null;
}
