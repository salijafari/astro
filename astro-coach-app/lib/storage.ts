import { Platform } from "react-native";

const secureStoreModulePromise =
  Platform.OS === "web"
    ? Promise.resolve(null)
    : import("expo-secure-store")
        .then((mod) => mod)
        .catch(() => null);

export async function readPersistedValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    console.warn(`[storage] Falling back to localStorage for key "${key}"`);
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  const secureStore = await secureStoreModulePromise;
  if (!secureStore) return null;
  return secureStore.getItemAsync(key);
}

export async function writePersistedValue(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    console.warn(`[storage] Falling back to localStorage for key "${key}"`);
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  const secureStore = await secureStoreModulePromise;
  if (!secureStore) return;
  await secureStore.setItemAsync(key, value);
}

export async function removePersistedValue(key: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  const secureStore = await secureStoreModulePromise;
  if (!secureStore) return;
  await secureStore.deleteItemAsync(key);
}
