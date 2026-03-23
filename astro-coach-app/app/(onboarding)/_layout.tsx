import { Stack } from "expo-router";

/**
 * Linear onboarding: no back stack mid-flow (use `router.replace` on each step).
 */
export default function OnboardingLayout() {
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
