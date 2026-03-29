import { Stack } from "expo-router";

/**
 * Subscription flow: no header, no back gesture (paywall is a hard lock on web).
 */
export default function SubscriptionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animation: "fade",
      }}
    />
  );
}
