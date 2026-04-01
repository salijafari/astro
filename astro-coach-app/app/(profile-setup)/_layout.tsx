import { Stack } from "expo-router";

/**
 * Standalone profile setup (form) — bypasses chat onboarding; no headers.
 */
export default function ProfileSetupLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
