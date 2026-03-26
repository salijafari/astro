import { useFirebaseAuth } from "@/providers/FirebaseAuthProvider";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { readPersistedValue } from "@/lib/storage";

/**
 * Root router. This is the ONLY place that navigates based on auth/onboarding state.
 * A ref guard prevents double-firing and infinite navigation loops.
 */
export default function Index() {
  const router = useRouter();
  const { user, loading } = useFirebaseAuth();
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

      const language = await readPersistedValue("akhtar.language");
      const onboardingDone = await readPersistedValue("akhtar.onboardingCompleted");

      if (!language) {
        router.replace("/(onboarding)/language-select");
      } else if (!onboardingDone || onboardingDone === "false") {
        router.replace("/(onboarding)/get-set-up");
      } else {
        router.replace("/(main)/home");
      }
    })();
  }, [loading, user]); // Intentionally NOT depending on router/segments to avoid loops.

  return null;
}
