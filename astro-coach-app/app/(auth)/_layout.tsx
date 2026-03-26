import { Stack } from "expo-router";

/**
 * Auth group layout should not perform navigation.
 * All routing decisions happen in `app/index.tsx` to avoid re-render loops.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
