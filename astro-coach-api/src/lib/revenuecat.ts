/**
 * Returns true if RevenueCat reports active `premium` entitlement for this app user id (Clerk id).
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
