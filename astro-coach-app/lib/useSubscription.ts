import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export type SubscriptionStatus = {
  loading: boolean;
  hasAccess: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
  subscriptionStatus: string;
  trialStartedAt: string | null;
  isPremium: boolean;
  premiumUnlimited: boolean;
  premiumExpiresAt: string | null;
  premiumDaysLeft: number | null;
};

const defaultStatus: SubscriptionStatus = {
  loading: true,
  hasAccess: false,
  trialActive: false,
  trialDaysLeft: 0,
  subscriptionStatus: "free",
  trialStartedAt: null,
  isPremium: false,
  premiumUnlimited: false,
  premiumExpiresAt: null,
  premiumDaysLeft: null,
};

let cachedStatus: SubscriptionStatus | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 1000;

/** One shared network load; parallel hook mounts await this instead of duplicating requests. */
let inFlight: Promise<void> | null = null;

/** Clears the in-memory subscription snapshot (e.g. after purchase or claim). */
export function invalidateSubscriptionCache(): void {
  cachedStatus = null;
  cacheTime = 0;
}

/**
 * Loads snapshot into module cache only (no React setState).
 */
async function loadSubscriptionSnapshot(
  force: boolean,
  getToken: () => Promise<string | null>,
): Promise<void> {
  if (inFlight) {
    await inFlight;
  }

  if (!force && cachedStatus && Date.now() - cacheTime < CACHE_TTL_MS) {
    return;
  }

  const work = (async () => {
    try {
      const token = await getToken();
      if (!token) {
        return;
      }

      const res = await apiRequest("/api/subscription/status", {
        method: "GET",
        getToken,
      });

      if (res.status === 429) {
        console.warn("[useSubscription] rate limited — backing off (no retry)");
        return;
      }

      if (!res.ok) {
        console.warn("[useSubscription] status failed:", res.status);
        return;
      }

      const data = (await res.json()) as {
        hasAccess?: boolean;
        trialActive?: boolean;
        trialDaysLeft?: number;
        subscriptionStatus?: string;
        trialStartedAt?: string | null;
        isPremium?: boolean;
        premiumUnlimited?: boolean;
        premiumExpiresAt?: string | Date | null;
        premiumDaysLeft?: number | null;
      };

      const toIso = (v: string | Date | null | undefined): string | null => {
        if (v == null) return null;
        if (typeof v === "string") return v;
        return new Date(v as Date).toISOString();
      };

      cachedStatus = {
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
        isPremium: data.isPremium ?? false,
        premiumUnlimited: data.premiumUnlimited ?? false,
        premiumExpiresAt: toIso(data.premiumExpiresAt),
        premiumDaysLeft:
          data.premiumDaysLeft === undefined || data.premiumDaysLeft === null
            ? null
            : data.premiumDaysLeft,
      };
      cacheTime = Date.now();
    } catch (e) {
      console.warn("[useSubscription] fetch error:", e);
    } finally {
      inFlight = null;
    }
  })();

  inFlight = work;
  await work;
}

/**
 * Shared subscription / trial snapshot from `GET /api/subscription/status`.
 * Mount: one logical fetch per cache window (single-flight). No automatic retry on error or 429.
 */
export function useSubscription(): SubscriptionStatus & { refresh: () => Promise<void> } {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [status, setStatus] = useState<SubscriptionStatus>(() =>
    cachedStatus && Date.now() - cacheTime < CACHE_TTL_MS
      ? { ...cachedStatus, loading: false }
      : { ...defaultStatus },
  );

  const applyCacheToState = useCallback(() => {
    if (cachedStatus && Date.now() - cacheTime < CACHE_TTL_MS) {
      setStatus({ ...cachedStatus, loading: false });
    } else {
      setStatus((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await loadSubscriptionSnapshot(false, () => getTokenRef.current());
      if (cancelled) return;
      applyCacheToState();
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [applyCacheToState]);

  const refresh = useCallback(async () => {
    await loadSubscriptionSnapshot(true, () => getTokenRef.current());
    applyCacheToState();
  }, [applyCacheToState]);

  return {
    ...status,
    refresh,
  };
}
