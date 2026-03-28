import { useAuth } from "@/lib/auth";
import { LANGUAGE_PREF_KEY } from "@/lib/i18n";
import { readPersistedValue } from "@/lib/storage";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

/**
 * Root router. ONLY place that navigates based on auth/onboarding state.
 * A ref guard prevents double-firing and infinite navigation loops.
 *
 * Storage keys checked:
 *   - 'akhtar.language'            -> null means language not selected
 *   - 'akhtar.onboardingCompleted' -> 'true' or '1' means done
 */
export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();
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
        if (onboardingDone === "true" || onboardingDone === "1") {
          router.replace("/(main)/home");
        } else {
          router.replace("/(onboarding)/get-set-up");
        }
      } catch (e) {
        console.warn("[index] routing persistence failed", e);
        router.replace("/(onboarding)/language-select");
      }
    })();
  }, [loading, user]);

  return null;
}
