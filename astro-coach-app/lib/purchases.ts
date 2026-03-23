import { Platform } from "react-native";

type PurchasesModule = {
  configure: (args: { apiKey: string }) => void;
  logIn: (userId: string) => Promise<unknown>;
  getOfferings: () => Promise<unknown>;
  purchasePackage: (pkg: unknown) => Promise<unknown>;
  restorePurchases: () => Promise<unknown>;
};

export type PurchasePackage = {
  packageType?: string;
  [key: string]: unknown;
};

let purchasesModulePromise: Promise<PurchasesModule | null> | null = null;

async function getPurchasesModule(): Promise<PurchasesModule | null> {
  if (Platform.OS === "web") return null;
  if (!purchasesModulePromise) {
    purchasesModulePromise = import("react-native-purchases")
      .then((m) => (m.default as unknown as PurchasesModule) ?? null)
      .catch((error) => {
        console.error("[startup] react-native-purchases unavailable", error);
        return null;
      });
  }
  return purchasesModulePromise;
}

async function requirePurchasesModule(): Promise<PurchasesModule> {
  const mod = await getPurchasesModule();
  if (mod) return mod;
  throw new Error("Purchases unavailable on this platform or failed to load.");
}

/**
 * Configures the RevenueCat SDK with the platform API key.
 */
export async function configurePurchases(apiKey: string): Promise<void> {
  const mod = await requirePurchasesModule();
  mod.configure({ apiKey });
}

/**
 * Links the current RevenueCat customer to an app user identifier.
 */
export async function logInPurchases(userId: string): Promise<void> {
  const mod = await requirePurchasesModule();
  await mod.logIn(userId);
}

/**
 * Loads currently available purchase packages from RevenueCat offerings.
 */
export async function getAvailablePackages(): Promise<PurchasePackage[]> {
  const mod = await getPurchasesModule();
  if (!mod) return [];
  const offerings = await mod.getOfferings();
  const current = (offerings as { current?: { availablePackages?: PurchasePackage[] } }).current;
  return current?.availablePackages ?? [];
}

/**
 * Purchases a specific RevenueCat package selected by the user.
 */
export async function purchaseSelectedPackage(pkg: PurchasePackage): Promise<void> {
  const mod = await requirePurchasesModule();
  await mod.purchasePackage(pkg);
}

/**
 * Restores existing purchases from the store account.
 */
export async function restorePurchasesAccess(): Promise<void> {
  const mod = await requirePurchasesModule();
  await mod.restorePurchases();
}