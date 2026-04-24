/**
 * Cached user profile fetcher — single source of truth for the frontend.
 * ALL features that need user/birth profile data call this module.
 * Returns a discriminated result; never throws.
 */
import { readPersistedValue, writePersistedValue, removePersistedValue } from "@/lib/storage";

const PROFILE_CACHE_KEY = "akhtar.cachedProfile";
const PROFILE_CACHE_EXPIRY_KEY = "akhtar.profileCacheTime";
const CACHE_DURATION_MS = 5 * 60 * 1000;

export type FetchProfileReason =
  | "no_api_url"
  | "no_token"
  | "rate_limited"
  | "http_error"
  | "network_error"
  | "parse_error";

export type FetchProfileResult =
  | { kind: "ok"; profile: UserProfile }
  | { kind: "empty" }
  | {
      kind: "error";
      reason: FetchProfileReason;
      staleProfile: UserProfile | null;
      httpStatus?: number;
    };

/** Mirrors `NotificationPreference` from GET /api/user/profile. */
export type NotificationPreferenceRow = {
  userId: string;
  dailyHoroscope: boolean;
  dailyMantra: boolean;
  preferredTimezone: string;
  preferredHour: number;
};

export type UserProfile = {
  user: {
    id: string;
    /** Canonical name from PostgreSQL `User.name` (preferred). */
    name?: string;
    nameFa?: string | null;
    /** Mirrors API `firstName` — PostgreSQL `User.name` only, null until set. */
    firstName: string | null;
    email: string;
    language?: string;
    onboardingComplete?: boolean;
    trialStartedAt: string | null;
    subscriptionStatus: string;
    stripeCustomerId?: string | null;
    /** Present when returned by GET /api/user/profile (computed server-side). */
    trialDaysLeft?: number;
    trialActive?: boolean;
    hasAccess?: boolean;
    /** Local reminder time HH:mm (24h) for mantra push; null if disabled. */
    mantraReminderTime?: string | null;
  } | null;
  birthProfile: {
    birthDate: string | null;
    birthTime: string | null;
    birthCity: string | null;
    birthLat?: number | null;
    birthLong?: number | null;
    birthTimezone?: string | null;
    sunSign: string | null;
    moonSign: string | null;
    risingSign: string | null;
    natalChartJson: unknown | null;
  } | null;
  isProfileComplete: boolean;
  notificationPreference?: NotificationPreferenceRow | null;
};

/** Internal fallback shape only — not exported. */
const EMPTY_PROFILE: UserProfile = {
  user: null,
  birthProfile: null,
  isProfileComplete: false,
  notificationPreference: null,
};

async function readStaleCache(): Promise<UserProfile | null> {
  try {
    const cached = await readPersistedValue(PROFILE_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached) as UserProfile;
  } catch {
    return null;
  }
}

async function writeProfileCache(profile: UserProfile): Promise<void> {
  await writePersistedValue(PROFILE_CACHE_KEY, JSON.stringify(profile));
  await writePersistedValue(PROFILE_CACHE_EXPIRY_KEY, Date.now().toString());
}

/**
 * Fetches the user profile from the API, with a 5-minute local cache.
 * Use `result.kind` to distinguish success, genuinely empty account, and errors.
 */
export async function fetchUserProfile(
  idToken: string,
  forceRefresh = false,
): Promise<FetchProfileResult> {
  if (!idToken?.trim()) {
    return { kind: "error", reason: "no_token", staleProfile: await readStaleCache() };
  }

  if (!forceRefresh) {
    try {
      const cached = await readPersistedValue(PROFILE_CACHE_KEY);
      const cacheTime = await readPersistedValue(PROFILE_CACHE_EXPIRY_KEY);
      if (cached && cacheTime) {
        const age = Date.now() - parseInt(cacheTime, 10);
        if (age < CACHE_DURATION_MS) {
          return { kind: "ok", profile: JSON.parse(cached) as UserProfile };
        }
      }
    } catch {
      /* cache miss */
    }
  }

  const apiBase = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  if (!apiBase) {
    console.warn("[userProfile] EXPO_PUBLIC_API_URL is not set — skipping fetch");
    return { kind: "error", reason: "no_api_url", staleProfile: await readStaleCache() };
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase}/api/user/profile`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.warn("[userProfile] fetch error:", err);
    return { kind: "error", reason: "network_error", staleProfile: await readStaleCache() };
  }

  if (res.status === 429) {
    console.warn("[userProfile] rate limited");
    return {
      kind: "error",
      reason: "rate_limited",
      staleProfile: await readStaleCache(),
      httpStatus: 429,
    };
  }

  if (!res.ok) {
    console.warn("[userProfile] fetch failed:", res.status);
    return {
      kind: "error",
      reason: "http_error",
      staleProfile: await readStaleCache(),
      httpStatus: res.status,
    };
  }

  let data: UserProfile;
  try {
    data = (await res.json()) as UserProfile;
  } catch (err) {
    console.warn("[userProfile] parse error:", err);
    return { kind: "error", reason: "parse_error", staleProfile: await readStaleCache() };
  }

  if (!data.user && !data.birthProfile) {
    await writeProfileCache(EMPTY_PROFILE);
    return { kind: "empty" };
  }

  await writeProfileCache(data);
  return { kind: "ok", profile: data };
}

/**
 * Call after any profile update (edit profile, onboarding, subscription, etc.).
 * Clears persisted cache so the next fetch hits the API unless forceRefresh is used.
 */
export async function invalidateProfileCache(): Promise<void> {
  try {
    await removePersistedValue(PROFILE_CACHE_KEY);
    await removePersistedValue(PROFILE_CACHE_EXPIRY_KEY);
  } catch (err) {
    console.warn("[userProfile] cache clear failed:", err);
  }
}
