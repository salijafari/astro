import { useCallback, useEffect, useRef, useState } from "react";
import { invalidateSubscriptionCache, useSubscription } from "@/lib/useSubscription";

/**
 * Gates feature navigation: runs `action` when `hasAccess`, otherwise opens paywall modal state.
 */
export function useFeatureAccess() {
  const { loading, hasAccess, refresh } = useSubscription();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [pendingFeature, setPendingFeature] = useState<string | undefined>();

  const hasAccessRef = useRef(hasAccess);
  const loadingRef = useRef(loading);
  useEffect(() => {
    hasAccessRef.current = hasAccess;
    loadingRef.current = loading;
  }, [hasAccess, loading]);

  const requireAccess = useCallback(
    (action: () => void, featureName?: string) => {
      if (loadingRef.current) {
        void refresh();
        setTimeout(() => {
          if (hasAccessRef.current) {
            action();
          } else {
            setPendingFeature(featureName);
            setPaywallVisible(true);
          }
        }, 500);
        return;
      }
      if (hasAccess) {
        action();
      } else {
        setPendingFeature(featureName);
        setPaywallVisible(true);
      }
    },
    [hasAccess, refresh],
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
