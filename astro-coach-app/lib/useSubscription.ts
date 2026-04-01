import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export type SubscriptionStatus = {
  loading: boolean;
  hasAccess: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
  subscriptionStatus: string;
  trialStartedAt: string | null;
};

const defaultStatus: SubscriptionStatus = {
  loading: true,
  hasAccess: false,
  trialActive: false,
  trialDaysLeft: 0,
  subscriptionStatus: "free",
  trialStartedAt: null,
};

let cachedStatus: SubscriptionStatus | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 1000;

/** Clears the in-memory subscription snapshot (e.g. after purchase or claim). */
export function invalidateSubscriptionCache(): void {
  cachedStatus = null;
  cacheTime = 0;
}

/**
 * Shared subscription / trial snapshot from `GET /api/subscription/status`.
 * Uses a short module cache so multiple hook instances do not spam the API.
 */
export function useSubscription(): SubscriptionStatus & { refresh: () => Promise<void> } {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>(() =>
    cachedStatus && Date.now() - cacheTime < CACHE_TTL_MS
      ? { ...cachedStatus, loading: false }
      : { ...defaultStatus },
  );

  const fetchStatus = useCallback(
    async (force: boolean) => {
      if (
        !force &&
        cachedStatus &&
        Date.now() - cacheTime < CACHE_TTL_MS
      ) {
        setStatus({ ...cachedStatus, loading: false });
        return;
      }

      try {
        const token = await getToken();
        if (!token) {
          setStatus((s) => ({ ...s, loading: false }));
          return;
        }

        const res = await apiRequest("/api/subscription/status", {
          method: "GET",
          getToken,
        });

        if (!res.ok) {
          console.warn("[useSubscription] status failed:", res.status);
          setStatus((s) => ({ ...s, loading: false }));
          return;
        }

        const data = (await res.json()) as {
          hasAccess?: boolean;
          trialActive?: boolean;
          trialDaysLeft?: number;
          subscriptionStatus?: string;
          trialStartedAt?: string | null;
        };

        const next: SubscriptionStatus = {
          loading: false,
          hasAccess: data.hasAccess ?? false,
          trialActive: data.trialActive ?? false,
          trialDaysLeft: data.trialDaysLeft ?? 0,
          subscriptionStatus: data.subscriptionStatus ?? "free",
          trialStartedAt: data.trialStartedAt
            ? typeof data.trialStartedAt === "string"
              ? data.trialStartedAt
              : new Date(data.trialStartedAt as unknown as Date).toISOString()
            : null,
        };

        cachedStatus = next;
        cacheTime = Date.now();
        setStatus(next);
      } catch (e) {
        console.warn("[useSubscription] fetch error:", e);
        setStatus((s) => ({ ...s, loading: false }));
      }
    },
    [getToken],
  );

  useEffect(() => {
    void fetchStatus(false);
  }, [fetchStatus]);

  return {
    ...status,
    refresh: () => fetchStatus(true),
  };
}
