import { Platform } from "react-native";
import { configurePurchases } from "@/lib/purchases";

/**
 * Configures RevenueCat before any purchase calls (Section 7 global rules).
 */
export async function configureRevenueCat(): Promise<void> {
  const ios = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  const android = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  if (Platform.OS === "ios" && ios) {
    await configurePurchases(ios);
    console.log("[startup] RevenueCat configured for iOS");
  } else if (Platform.OS === "android" && android) {
    await configurePurchases(android);
    console.log("[startup] RevenueCat configured for Android");
  } else {
    console.log("[startup] RevenueCat skipped (missing key or unsupported platform)");
  }
}
