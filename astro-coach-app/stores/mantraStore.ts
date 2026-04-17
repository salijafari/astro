import { create } from "zustand";
import type { MantraData, MantraRegister } from "@/types/mantra";

interface MantraState {
  mantra: MantraData | null;
  /** Resolved register for mantra text (Direct vs Exploratory lines). */
  register: MantraRegister;
  isLoading: boolean;
  error: string | null;
  setMantra: (mantra: MantraData) => void;
  setRegister: (register: MantraRegister) => void;
  setLoading: (v: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useMantraStore = create<MantraState>((set) => ({
  mantra: null,
  register: "direct",
  isLoading: false,
  error: null,
  setMantra: (mantra) => set({ mantra }),
  setRegister: (register) => set({ register }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      mantra: null,
      register: "direct",
      isLoading: false,
      error: null,
    }),
}));
