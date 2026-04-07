import { useRouter, type Href } from "expo-router";
import { useCallback } from "react";

/**
 * Opens the unified subscription paywall route (same UI as trial-expired / Stripe / RevenueCat).
 */
export function usePaywall() {
  const router = useRouter();

  const showPaywall = useCallback(() => {
    router.push("/(subscription)/paywall" as Href);
  }, [router]);

  return { showPaywall };
}
