import { Stack } from "expo-router";

/**
 * Post-payment redirect screens from Stripe.
 * No header, no gestures — user arrived here from Stripe's hosted checkout.
 */
export default function SubscriptionResultLayout() {
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
