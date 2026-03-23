import * as Device from "expo-device";
import { Platform } from "react-native";
import { apiPostJson } from "@/lib/api";

let notificationsConfigured = false;

async function getNotificationsModule() {
  if (Platform.OS === "web") return null;
  const mod = await import("expo-notifications");
  if (!notificationsConfigured) {
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationsConfigured = true;
  }
  return mod;
}

/**
 * Requests notification permission and registers the Expo push token with the API.
 */
export async function registerForPushAsync(getToken: () => Promise<string | null>): Promise<void> {
  if (Platform.OS === "web") return;
  if (!Device.isDevice) return;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await apiPostJson("/api/notifications/register", getToken, { token, enabled: true });
}
