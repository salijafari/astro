import { Stack } from "expo-router";

export default function TarotLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="reading" />
      <Stack.Screen name="history" />
    </Stack>
  );
}
