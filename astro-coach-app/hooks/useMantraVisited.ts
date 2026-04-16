import { useCallback, useEffect, useState } from "react";
import { readPersistedValue, writePersistedValue } from "@/lib/storage";

const MANTRA_VISITED_STORAGE_KEY = "akhtar.mantraVisitedDate";

function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Tracks whether the user has opened the mantra feature today (persisted client-side).
 * Uses the same storage layer as `useMantraBackground` (SecureStore / localStorage).
 *
 * @param skipAutomaticHydrate When true, skips the mount `useEffect` read so the caller can
 *   run `hydrateFromStorage` after dev-only storage resets (e.g. mantra screen).
 */
export function useMantraVisited(skipAutomaticHydrate = false) {
  /** Unread until we confirm today's visit; errors keep dot visible. */
  const [hasUnreadMantra, setHasUnreadMantra] = useState(true);

  const hydrateFromStorage = useCallback(async () => {
    try {
      const stored = await readPersistedValue(MANTRA_VISITED_STORAGE_KEY);
      const today = todayYmdUtc();
      setHasUnreadMantra(!stored || stored !== today);
    } catch {
      setHasUnreadMantra(true);
    }
  }, []);

  useEffect(() => {
    if (skipAutomaticHydrate) return;
    void hydrateFromStorage();
  }, [skipAutomaticHydrate, hydrateFromStorage]);

  const markMantraVisited = useCallback(() => {
    setHasUnreadMantra(false);
    void (async () => {
      try {
        await writePersistedValue(MANTRA_VISITED_STORAGE_KEY, todayYmdUtc());
      } catch {
        // ignore
      }
    })();
  }, []);

  return { hasUnreadMantra, markMantraVisited, hydrateFromStorage };
}
