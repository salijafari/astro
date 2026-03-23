import { Mixpanel } from "mixpanel-react-native";

let client: Mixpanel | null = null;

/**
 * Initializes Mixpanel when EXPO_PUBLIC_MIXPANEL_TOKEN is set.
 */
export async function initMixpanel(): Promise<void> {
  const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;
  if (!token) {
    console.log("[startup] Mixpanel skipped (EXPO_PUBLIC_MIXPANEL_TOKEN missing)");
    return;
  }
  try {
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
