import { create } from "zustand";

type SubState = {
  status: string;
  expiresAt: string | null;
  setFromApi: (status: string, expiresAt: Date | null) => void;
};

/**
 * Mirrors `/api/subscription/status` for UI gating hints (server always verifies).
 */
export const useSubscriptionStore = create<SubState>((set) => ({
  status: "free",
  expiresAt: null,
  setFromApi: (status, expiresAt) =>
    set({ status, expiresAt: expiresAt ? expiresAt.toISOString() : null }),
}));
