import { useCallback, useState } from "react";
import { invalidateSubscriptionCache, useSubscription } from "@/lib/useSubscription";

/**
 * Gates feature navigation: runs `action` when `hasAccess`, otherwise opens paywall modal state.
 */
export function useFeatureAccess() {
  const { loading, hasAccess, refresh } = useSubscription();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [pendingFeature, setPendingFeature] = useState<string | undefined>();

  const requireAccess = useCallback(
    (action: () => void, featureName?: string) => {
      if (loading) return;
      if (hasAccess) {
        action();
      } else {
        setPendingFeature(featureName);
        setPaywallVisible(true);
      }
    },
    [hasAccess, loading],
  );

  const closePaywall = useCallback(() => {
    setPaywallVisible(false);
    setPendingFeature(undefined);
    invalidateSubscriptionCache();
    void refresh();
  }, [refresh]);

  return {
    requireAccess,
    paywallVisible,
    pendingFeature,
    closePaywall,
  };
}
