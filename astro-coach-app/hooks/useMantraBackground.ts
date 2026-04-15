import { useCallback, useEffect, useState } from "react";
import { readPersistedValue, writePersistedValue } from "@/lib/storage";
import { MANTRA_BACKGROUNDS, BACKGROUND_STORAGE_KEY } from "@/data/mantraBackgrounds";

export function useMantraBackground() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted selection on mount
  useEffect(() => {
    void (async () => {
      try {
        const saved = await readPersistedValue(BACKGROUND_STORAGE_KEY);
        if (saved && saved.length > 0) {
          setSelectedId(saved);
        } else {
          setSelectedId(null);
        }
      } catch {
        // ignore
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const selectBackground = useCallback(async (id: string | null) => {
    setSelectedId(id);
    try {
      if (id) {
        await writePersistedValue(BACKGROUND_STORAGE_KEY, id);
      } else {
        await writePersistedValue(BACKGROUND_STORAGE_KEY, "");
      }
    } catch {
      // ignore
    }
  }, []);

  // Resolve the actual image source from the ID
  const selectedBg = selectedId ? MANTRA_BACKGROUNDS.find((b) => b.id === selectedId) : null;

  const backgroundSource = selectedBg?.source ?? null;

  return {
    selectedId,
    selectedBg,
    backgroundSource,
    selectBackground,
    isLoaded,
  };
}
