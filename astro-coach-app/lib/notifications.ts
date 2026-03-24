import { Platform } from "react-native";
import { apiPostJson } from "@/lib/api";
import { getMessaging } from "@/lib/firebase";

/**
 * Requests notification permission, registers FCM token, and sends it to the API.
 * Safe to skip — the app works without push.
 */
export async function requestPermission(getToken: () => Promise<string | null>): Promise<void> {
  try {
    if (Platform.OS === "web") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) return;
      const { getToken: fcmGetToken } = await import("firebase/messaging");
      const messaging = getMessaging();
      if (!messaging) return;
      const token = await fcmGetToken(messaging, { vapidKey });
      if (token) {
        await apiPostJson("/api/user/fcm-token", getToken, { token, platform: "web" });
      }
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rnMessaging = require("@react-native-firebase/messaging").default as typeof import("@react-native-firebase/messaging").default;
    const authStatus = await rnMessaging().requestPermission();
    const { AuthorizationStatus } = rnMessaging;
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED || authStatus === AuthorizationStatus.PROVISIONAL;
    if (!enabled) return;

    await rnMessaging().registerDeviceForRemoteMessages?.();
    const token = await rnMessaging().getToken();
    if (token) {
      await apiPostJson("/api/user/fcm-token", getToken, { token, platform: Platform.OS });
    }
  } catch (e) {
    console.warn("[notifications] requestPermission skipped", e);
  }
}

/**
 * Foreground / background handlers — extend when you add in-app banners and deep links.
 */
export function setupNotificationHandlers(_router: { push: (href: string) => void }): void {
  if (Platform.OS === "web") return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rnMessaging = require("@react-native-firebase/messaging").default as typeof import("@react-native-firebase/messaging").default;
  rnMessaging().onMessage(async () => {
    /* TODO: show in-app banner */
  });
  rnMessaging().onNotificationOpenedApp((msg) => {
    const type = msg.data?.type;
    if (type === "daily_horoscope") {
      _router.push("/(main)/home");
    }
  });
}
