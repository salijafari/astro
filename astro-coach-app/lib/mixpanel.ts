import { Platform } from "react-native";

type MixpanelClient = import("mixpanel-react-native").Mixpanel;

let client: MixpanelClient | null = null;

/**
 * Initializes Mixpanel when EXPO_PUBLIC_MIXPANEL_TOKEN is set (native only — avoids bundling RN SDK on web).
 */
export async function initMixpanel(): Promise<void> {
  if (Platform.OS === "web") {
    console.log("[startup] Mixpanel skipped on web");
    return;
  }
  const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;
  if (!token) {
    console.log("[startup] Mixpanel skipped (EXPO_PUBLIC_MIXPANEL_TOKEN missing)");
    return;
  }
  try {
    const { Mixpanel } = await import("mixpanel-react-native");
    client = new Mixpanel(token, false);
    await client.init();
    console.log("[startup] Mixpanel initialized");
  } catch (error) {
    console.error("[startup] Mixpanel init failed", error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Tracks an analytics event (onboarding funnel, paywall, etc.).
 */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  try {
    client?.track(name, props);
  } catch {
    /* optional analytics */
  }
}
