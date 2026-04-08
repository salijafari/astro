import { prisma } from "./prisma.js";

/**
 * Returns true if RevenueCat reports active `premium` entitlement for this app user id (Firebase UID).
 */
export async function hasPremiumEntitlement(appUserId: string): Promise<boolean> {
  const key = process.env.REVENUECAT_API_KEY;
  if (!key) return false;
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) return false;
  const data = (await res.json()) as {
    subscriber?: { entitlements?: Record<string, { expires_date?: string | null }> };
  };
  const ent = data.subscriber?.entitlements?.premium;
  if (!ent) return false;
  if (!ent.expires_date) return true;
  return new Date(ent.expires_date) > new Date();
}

/**
 * Maps RevenueCat subscriber payload to a coarse subscription status for the User row.
 */
export async function fetchSubscriptionStatus(appUserId: string): Promise<{
  status: "free" | "trial" | "active" | "cancelled";
  expiresAt: Date | null;
}> {
  const key = process.env.REVENUECAT_API_KEY;
  if (!key) return { status: "free", expiresAt: null };
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) return { status: "free", expiresAt: null };
  const data = (await res.json()) as {
    subscriber?: {
      entitlements?: Record<string, { expires_date?: string | null; period_type?: string }>;
      subscriptions?: Record<string, { period_type?: string; unsubscribe_detected_at?: string | null }>;
    };
  };
  const ent = data.subscriber?.entitlements?.premium;
  if (!ent) return { status: "free", expiresAt: null };
  const exp = ent.expires_date ? new Date(ent.expires_date) : null;
  if (ent.period_type === "trial") return { status: "trial", expiresAt: exp };
  if (data.subscriber?.subscriptions && Object.values(data.subscriber.subscriptions).some((s) => s.unsubscribe_detected_at)) {
    return { status: "cancelled", expiresAt: exp };
  }
  return { status: "active", expiresAt: exp };
}

const TRIAL_DURATION_DAYS = 7;

/**
 * Unified entitlement check that works for both native (RevenueCat) and web (database trial/Stripe).
 * Use this instead of hasPremiumEntitlement for all feature-gating route handlers.
 *
 * Priority order:
 *   1. RevenueCat active premium → allow (native subscribers)
 *   2. DB subscriptionStatus === 'active' → allow (Stripe subscribers)
 *   3. Admin-granted premium (unlimited, dated, or legacy premium row)
 *   4. DB trialStartedAt set and < 7 days ago → allow (claimed trial still active)
 *   5. Otherwise → deny (includes “no trial claimed yet”: not premium, free tier / route-specific limits apply)
 */
export async function hasFeatureAccess(firebaseUid: string, dbId: string): Promise<boolean> {
  if (await hasPremiumEntitlement(firebaseUid)) return true;

  const user = await prisma.user.findUnique({
    where: { id: dbId },
    select: {
      subscriptionStatus: true,
      trialStartedAt: true,
      premiumExpiresAt: true,
      premiumUnlimited: true,
    },
  });

  if (!user) return false;
  if (user.subscriptionStatus === "active") return true;

  if (user.premiumUnlimited) return true;

  if (user.subscriptionStatus === "premium" && user.premiumExpiresAt) {
    if (new Date() < new Date(user.premiumExpiresAt)) return true;
  } else if (
    user.subscriptionStatus === "premium" &&
    !user.premiumExpiresAt &&
    !user.premiumUnlimited
  ) {
    return true;
  }

  // Trial access: user has claimed trial and it's still active
  if (user.trialStartedAt) {
    const daysSinceTrial =
      (Date.now() - new Date(user.trialStartedAt).getTime()) / 86_400_000;
    if (daysSinceTrial < TRIAL_DURATION_DAYS) return true;
  }

  // No trial claimed yet — not premium for gated features (free routes still work)
  return false;
}
