import type { Router } from "expo-router";
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

type NotificationRouter = Pick<Router, "replace">;

function navigateFromNotificationPayload(msg: unknown, router: NotificationRouter): void {
  try {
    const data =
      msg && typeof msg === "object" && "data" in msg
        ? (msg as { data?: Record<string, unknown> }).data
        : undefined;
    // TODO: customize notification routing for deep links (e.g. data.route, data.screen, data.url).
    void data;
    // Today: always land on home (covers daily_horoscope, empty payload, and unknown types).
    router.replace("/(main)/home");
  } catch (e) {
    console.warn("[notifications] navigateFromNotificationPayload failed", e);
  }
}

/**
 * Firebase Messaging: foreground message, background tap, and cold-start tap.
 * No-op on web. Failures are logged; never thrown.
 */
export function setupNotificationHandlers(router: NotificationRouter): void {
  if (Platform.OS === "web") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rnMessaging = require("@react-native-firebase/messaging").default as typeof import("@react-native-firebase/messaging").default;
    const messaging = rnMessaging();

    messaging.onMessage(async () => {
      try {
        /* TODO: show in-app banner */
      } catch (e) {
        console.warn("[notifications] onMessage handler failed", e);
      }
    });

    messaging.onNotificationOpenedApp((remoteMessage) => {
      try {
        navigateFromNotificationPayload(remoteMessage, router);
      } catch (e) {
        console.warn("[notifications] onNotificationOpenedApp failed", e);
      }
    });

    void messaging
      .getInitialNotification()
      .then((remoteMessage) => {
        try {
          if (remoteMessage) {
            navigateFromNotificationPayload(remoteMessage, router);
          }
        } catch (e) {
          console.warn("[notifications] getInitialNotification handler failed", e);
        }
      })
      .catch((e) => {
        console.warn("[notifications] getInitialNotification failed", e);
      });
  } catch (e) {
    console.warn("[notifications] setupNotificationHandlers failed", e);
  }
}
