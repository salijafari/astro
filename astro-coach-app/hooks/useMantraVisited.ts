import { useCallback, useEffect, useState } from "react";
import { MANTRA_UX_KEYS, readMantraUx, writeMantraUx } from "@/lib/mantraUxStorage";

function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Home-dot style “opened mantra today” using AsyncStorage (mantra UX, not secrets).
 */
export function useMantraVisited(skipAutomaticHydrate = false) {
  const [hasUnreadMantra, setHasUnreadMantra] = useState(true);

  const hydrateFromStorage = useCallback(async () => {
    try {
      const stored = await readMantraUx(MANTRA_UX_KEYS.lastOpenedDateUtc);
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
        await writeMantraUx(MANTRA_UX_KEYS.lastOpenedDateUtc, todayYmdUtc());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return { hasUnreadMantra, markMantraVisited, hydrateFromStorage };
}
