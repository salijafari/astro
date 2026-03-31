/**
 * Cached user profile fetcher — single source of truth for the frontend.
 * ALL features that need user/birth profile data call this module.
 * NEVER throws to the caller; returns a safe fallback on any error.
 */
import { readPersistedValue, writePersistedValue, removePersistedValue } from "@/lib/storage";

const PROFILE_CACHE_KEY = "akhtar.cachedProfile";
const PROFILE_CACHE_EXPIRY_KEY = "akhtar.profileCacheTime";
const CACHE_DURATION_MS = 5 * 60 * 1000;

export type UserProfile = {
  user: {
    id: string;
    firstName: string;
    email: string;
    trialStartedAt: string | null;
    subscriptionStatus: string;
  } | null;
  birthProfile: {
    birthDate: string | null;
    birthTime: string | null;
    birthCity: string | null;
    sunSign: string | null;
    moonSign: string | null;
    risingSign: string | null;
    natalChartJson: unknown | null;
  } | null;
  isProfileComplete: boolean;
};

const EMPTY_PROFILE: UserProfile = {
  user: null,
  birthProfile: null,
  isProfileComplete: false,
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
    const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
    const res = await fetch(`${apiBase}/api/user/profile`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });

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

/** Call after onboarding completes to invalidate stale cached profile. */
export async function invalidateProfileCache(): Promise<void> {
  await removePersistedValue(PROFILE_CACHE_KEY);
  await removePersistedValue(PROFILE_CACHE_EXPIRY_KEY);
}
