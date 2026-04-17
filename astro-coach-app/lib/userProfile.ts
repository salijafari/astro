/**
 * Cached user profile fetcher — single source of truth for the frontend.
 * ALL features that need user/birth profile data call this module.
 * NEVER throws to the caller; returns a safe fallback on any error.
 */
import { readPersistedValue, writePersistedValue, removePersistedValue } from "@/lib/storage";

const PROFILE_CACHE_KEY = "akhtar.cachedProfile";
const PROFILE_CACHE_EXPIRY_KEY = "akhtar.profileCacheTime";
const CACHE_DURATION_MS = 5 * 60 * 1000;

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

const EMPTY_PROFILE: UserProfile = {
  user: null,
  birthProfile: null,
  isProfileComplete: false,
  notificationPreference: null,
};

/**
 * Fetches the user profile from the API, with a 5-minute local cache.
 * On any error (network, auth, 500), returns a minimal fallback —
 * the caller should NEVER redirect to onboarding based on this result.
 */
export async function fetchUserProfile(
  idToken: string,
  forceRefresh = false,
): Promise<UserProfile> {
  if (!forceRefresh) {
    try {
      const cached = await readPersistedValue(PROFILE_CACHE_KEY);
      const cacheTime = await readPersistedValue(PROFILE_CACHE_EXPIRY_KEY);
      if (cached && cacheTime) {
        const age = Date.now() - parseInt(cacheTime, 10);
        if (age < CACHE_DURATION_MS) {
          return JSON.parse(cached) as UserProfile;
        }
      }
    } catch {
      /* cache miss */
    }
  }

  try {
    const apiBase = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
    if (!apiBase) {
      console.warn("[userProfile] EXPO_PUBLIC_API_URL is not set — skipping fetch");
      return EMPTY_PROFILE;
    }
    const res = await fetch(`${apiBase}/api/user/profile`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 429) {
      console.warn("[userProfile] rate limited — backing off (no retry)");
      return EMPTY_PROFILE;
    }

    if (!res.ok) {
      console.warn("[userProfile] fetch failed:", res.status);
      return EMPTY_PROFILE;
    }

    const data = (await res.json()) as UserProfile;

    await writePersistedValue(PROFILE_CACHE_KEY, JSON.stringify(data));
    await writePersistedValue(PROFILE_CACHE_EXPIRY_KEY, Date.now().toString());

    return data;
  } catch (err) {
    console.warn("[userProfile] fetch error:", err);
    return EMPTY_PROFILE;
  }
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
