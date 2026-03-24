import { Platform } from "react-native";
import { getAnalytics } from "@/lib/firebase";

/**
 * Cross-platform analytics — no PII in params (Section 7 / privacy).
 */
export function logEvent(eventName: string, params?: Record<string, string | number | boolean>): void {
  try {
    if (Platform.OS === "web") {
      const a = getAnalytics();
      if (!a) return;
      const { logEvent: webLog } = require("firebase/analytics") as typeof import("firebase/analytics");
      webLog(a, eventName, params);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const analytics = require("@react-native-firebase/analytics").default as typeof import("@react-native-firebase/analytics").default;
    void analytics().logEvent(eventName, params);
  } catch {
    /* analytics optional */
  }
}
