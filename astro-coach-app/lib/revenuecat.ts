import { Platform } from "react-native";
import Purchases from "react-native-purchases";

/**
 * Configures RevenueCat before any purchase calls (Section 7 global rules).
 */
export function configureRevenueCat(): void {
  const ios = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  const android = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  if (Platform.OS === "ios" && ios) {
    Purchases.configure({ apiKey: ios });
  } else if (Platform.OS === "android" && android) {
    Purchases.configure({ apiKey: android });
  }
}
