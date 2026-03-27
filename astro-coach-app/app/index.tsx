import { useAuth } from "@/lib/auth";
import { LANGUAGE_PREF_KEY, ONBOARDING_LANG_SELECTED_KEY } from "@/lib/i18n";
import { readPersistedValue, writePersistedValue } from "@/lib/storage";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

/**
 * Root router. This is the ONLY place that navigates based on auth/onboarding state.
 * A ref guard prevents double-firing and infinite navigation loops.
 *
 * Language step: must match `language-select` (Continue writes `ONBOARDING_LANG_SELECTED_KEY`).
 * Legacy users may only have `LANGUAGE_PREF_KEY`; we backfill the flag once.
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
        let languageStepDone = (await readPersistedValue(ONBOARDING_LANG_SELECTED_KEY)) === "1";
        if (!languageStepDone) {
          const pref = await readPersistedValue(LANGUAGE_PREF_KEY);
          if (pref === "en" || pref === "fa") {
            await writePersistedValue(ONBOARDING_LANG_SELECTED_KEY, "1");
            languageStepDone = true;
          }
        }

        if (!languageStepDone) {
          router.replace("/(onboarding)/language-select");
          return;
        }

        const onboardingDone = await readPersistedValue("akhtar.onboardingCompleted");
        if (!onboardingDone || onboardingDone === "false") {
          router.replace("/(onboarding)/get-set-up");
        } else {
          router.replace("/(main)/home");
        }
      } catch (e) {
        console.warn("[index] onboarding routing persistence failed", e);
        router.replace("/(onboarding)/language-select");
      }
    })();
  }, [loading, user]); // Intentionally NOT depending on router/segments to avoid loops.

  return null;
}
