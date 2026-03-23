import { Mixpanel } from "mixpanel-react-native";

let client: Mixpanel | null = null;

/**
 * Initializes Mixpanel when EXPO_PUBLIC_MIXPANEL_TOKEN is set.
 */
export async function initMixpanel(): Promise<void> {
  const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;
  if (!token) return;
  client = new Mixpanel(token, false);
  await client.init();
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
