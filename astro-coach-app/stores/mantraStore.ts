import { create } from "zustand";
import type { MantraData, MantraTheme } from "@/types/mantra";

interface MantraState {
  mantra: MantraData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  selectedTheme: MantraTheme | null;
  error: string | null;
  setMantra: (mantra: MantraData) => void;
  setLoading: (v: boolean) => void;
  setRefreshing: (v: boolean) => void;
  setSelectedTheme: (selectedTheme: MantraTheme | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useMantraStore = create<MantraState>((set) => ({
  mantra: null,
  isLoading: false,
  isRefreshing: false,
  selectedTheme: null,
  error: null,
  setMantra: (mantra) => set({ mantra }),
  setLoading: (isLoading) => set({ isLoading }),
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
  setSelectedTheme: (selectedTheme) => set({ selectedTheme }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      mantra: null,
      isLoading: false,
      isRefreshing: false,
      selectedTheme: null,
      error: null,
    }),
}));
