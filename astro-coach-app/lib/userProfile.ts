/**
 * Cached user profile fetcher — single source of truth for the frontend.
 * ALL features that need user/birth profile data call this module.
 * NEVER throws to the caller; returns a safe fallback on any error.
 */
import { readPersistedValue, writePersistedValue, removePersistedValue } from "@/lib/storage";

const PROFILE_CACHE_KEY = "akhtar.cachedProfile";
const PROFILE_CACHE_EXPIRY_KEY = "akhtar.profileCacheTime";
const CACHE_DURATION_MS = 5 * 60 * 1000;
const DEBUG_RUN_ID = "pre-fix-1";

export type UserProfile = {
  user: {
    id: string;
    firstName: string;
    email: string;
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
  // #region agent log
  fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:DEBUG_RUN_ID,hypothesisId:'B/E',location:'lib/userProfile.ts:fetchUserProfile:start',message:'profile fetch entry',data:{forceRefresh,hasToken:!!idToken,tokenLength:idToken?.length ?? 0},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!forceRefresh) {
    try {
      const cached = await readPersistedValue(PROFILE_CACHE_KEY);
      const cacheTime = await readPersistedValue(PROFILE_CACHE_EXPIRY_KEY);
      if (cached && cacheTime) {
        const age = Date.now() - parseInt(cacheTime, 10);
        if (age < CACHE_DURATION_MS) {
          let parsed: UserProfile | null = null;
          try {
            parsed = JSON.parse(cached) as UserProfile;
          } catch {
            parsed = null;
          }
          // #region agent log
          fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:DEBUG_RUN_ID,hypothesisId:'D/C',location:'lib/userProfile.ts:fetchUserProfile:cache-hit',message:'returning cached profile',data:{cacheAgeMs:age,hasBirthProfile:!!parsed?.birthProfile,isProfileComplete:parsed?.isProfileComplete ?? null},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          return parsed ?? EMPTY_PROFILE;
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
      // #region agent log
      fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:DEBUG_RUN_ID,hypothesisId:'B/E',location:'lib/userProfile.ts:fetchUserProfile:non-ok',message:'profile fetch non-ok response',data:{status:res.status,apiBasePresent:!!apiBase},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      console.warn("[userProfile] fetch failed:", res.status);
      return EMPTY_PROFILE;
    }

    const data = (await res.json()) as UserProfile;
    // #region agent log
    fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:DEBUG_RUN_ID,hypothesisId:'C/B',location:'lib/userProfile.ts:fetchUserProfile:success',message:'profile fetch success',data:{isProfileComplete:data?.isProfileComplete ?? null,hasUser:!!data?.user,hasBirthProfile:!!data?.birthProfile,sunSign:data?.birthProfile?.sunSign ?? null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    await writePersistedValue(PROFILE_CACHE_KEY, JSON.stringify(data));
    await writePersistedValue(PROFILE_CACHE_EXPIRY_KEY, Date.now().toString());

    return data;
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:DEBUG_RUN_ID,hypothesisId:'B/E',location:'lib/userProfile.ts:fetchUserProfile:catch',message:'profile fetch exception',data:{error:err instanceof Error ? err.message : String(err)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.warn("[userProfile] fetch error:", err);
    return EMPTY_PROFILE;
  }
}

/** Call after onboarding completes to invalidate stale cached profile. */
export async function invalidateProfileCache(): Promise<void> {
  await removePersistedValue(PROFILE_CACHE_KEY);
  await removePersistedValue(PROFILE_CACHE_EXPIRY_KEY);
}
