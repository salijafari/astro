import type { TokenCache } from "@clerk/clerk-expo";
import { Platform } from "react-native";

const webTokenCache = new Map<string, string>();

async function getSecureStore() {
  if (Platform.OS === "web") return null;
  const mod = await import("expo-secure-store");
  return mod;
}

/**
 * Persists Clerk session tokens in the device keychain (Section 1 global rules).
 */
export const tokenCache: TokenCache = {
  async getToken(key: string) {
    if (Platform.OS === "web") return webTokenCache.get(key) ?? null;
    const secureStore = await getSecureStore();
    if (!secureStore) return null;
    try {
      return await secureStore.getItemAsync(key);
    } catch (error) {
      console.warn("[startup] tokenCache get failed", error);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    if (Platform.OS === "web") {
      webTokenCache.set(key, value);
      return;
    }
    const secureStore = await getSecureStore();
    if (!secureStore) return;
    try {
      await secureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn("[startup] tokenCache save failed", error);
    }
  },
};
