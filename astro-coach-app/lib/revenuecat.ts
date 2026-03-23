import { Platform } from "react-native";
import { configurePurchases } from "@/lib/purchases";

/**
 * Configures RevenueCat before any purchase calls (Section 7 global rules).
 */
export async function configureRevenueCat(): Promise<void> {
  const ios = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  const android = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  if (Platform.OS === "ios" && ios) {
    const ok = await configurePurchases(ios);
    if (!ok) throw new Error("RevenueCat initialization failed on iOS.");
    console.log(ok ? "[startup] RevenueCat configured for iOS" : "[startup] RevenueCat unavailable on this platform");
  } else if (Platform.OS === "android" && android) {
    const ok = await configurePurchases(android);
    if (!ok) throw new Error("RevenueCat initialization failed on Android.");
    console.log(ok ? "[startup] RevenueCat configured for Android" : "[startup] RevenueCat unavailable on this platform");
  } else {
    console.log("[startup] RevenueCat skipped (missing key or unsupported platform)");
  }
}
