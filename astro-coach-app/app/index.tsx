import { useAuth } from "@/lib/auth";
import { LANGUAGE_PREF_KEY } from "@/lib/i18n";
import { readPersistedValue } from "@/lib/storage";
import { fetchUserProfile } from "@/lib/userProfile";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

const TRIAL_DURATION_DAYS = 7;

/**
 * Root router. ONLY place that navigates based on auth/onboarding state.
 * A ref guard prevents double-firing and infinite navigation loops.
 *
 * Storage keys checked:
 *   - 'akhtar.language'            -> null means language not selected
 *   - 'akhtar.onboardingCompleted' -> 'true' or '1' means done
 *
 * Web-only additional checks (after onboarding):
 *   - trialStartedAt null          -> show claim-trial screen (one time)
 *   - subscriptionStatus active    -> go to dashboard
 *   - trial < 7 days old           -> go to dashboard
 *   - trial >= 7 days old          -> show paywall (full lock)
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
      hasNavigated.current = true;

      if (!user) {
        router.replace("/(auth)/sign-in");
        return;
      }

      try {
        const language = await readPersistedValue(LANGUAGE_PREF_KEY);
        if (!language) {
          router.replace("/(onboarding)/language-select");
          return;
        }

        const onboardingDone = await readPersistedValue(
          "akhtar.onboardingCompleted",
        );

        if (onboardingDone !== "true" && onboardingDone !== "1") {
          router.replace("/(onboarding)/get-set-up");
          return;
        }

        // Onboarding complete — for native users, go straight to home.
        // RevenueCat handles native subscription gating.
        if (Platform.OS !== "web") {
          router.replace("/(main)/home");
          return;
        }

        // Web: check trial/subscription status from the backend to route correctly.
        // On any error, fail open (go to home) rather than blocking the user.
        try {
          const idToken = await getToken();
          if (!idToken) {
            router.replace("/(main)/home");
            return;
          }

          const profile = await fetchUserProfile(idToken, true);
          const u = profile.user;

          if (!u?.trialStartedAt) {
            // Trial never claimed — show the one-time claim screen
            router.replace("/(subscription)/claim-trial");
            return;
          }

          if (u.subscriptionStatus === "active") {
            router.replace("/(main)/home");
            return;
          }

          const trialStart = new Date(u.trialStartedAt);
          const daysSinceTrial =
            (Date.now() - trialStart.getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceTrial >= TRIAL_DURATION_DAYS) {
            router.replace("/(subscription)/paywall");
          } else {
            router.replace("/(main)/home");
          }
        } catch (e) {
          console.warn("[index] trial check failed, defaulting to home", e);
          router.replace("/(main)/home");
        }
      } catch (e) {
        console.warn("[index] routing persistence failed", e);
        router.replace("/(onboarding)/language-select");
      }
    })();
  }, [loading, user]);

  return null;
}
