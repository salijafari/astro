import { useAuth } from "@/lib/auth";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { apiPostJson } from "@/lib/api";
import { PaywallScreen } from "@/components/coaching/PaywallScreen";
import { trackEvent } from "@/lib/mixpanel";
import { setOnboardingCompletedLocally } from "@/lib/onboardingState";
import { useOnboardingStore } from "@/stores/onboardingStore";

/**
 * Step 8 — RevenueCat paywall with always-visible free path.
 */
export default function PaywallOnboardingScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const sunSign = useOnboardingStore((s) => s.sunSign);

  useEffect(() => {
    trackEvent("onboarding_step_8_viewed");
  }, []);

  const finish = async () => {
    const st = useOnboardingStore.getState();
    await apiPostJson("/api/user/complete-onboarding", getToken, {
      name: st.displayName.trim(),
      birthDate: st.birthDate,
      birthTime: st.birthTime,
      birthCity: st.birthCity,
      birthLat: st.birthLat,
      birthLong: st.birthLong,
      birthTimezone: st.birthTimezone,
      interestTags: st.interestTags,
      consentVersion: "2026-03-01-v1",
      natalChartJson: st.natalChartJson,
      sunSign: st.sunSign,
      moonSign: st.moonSign,
      risingSign: st.risingSign,
    });
    await setOnboardingCompletedLocally(true);
    trackEvent("onboarding_step_8_completed");
    router.replace("/(main)/home");
  };

  return (
    <PaywallScreen
      context="onboarding"
      sunSign={sunSign}
      onContinueFree={() => void finish()}
      onSubscribed={() => void finish()}
    />
  );
}
