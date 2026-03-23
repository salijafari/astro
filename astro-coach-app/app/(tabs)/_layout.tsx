import { Tabs } from "expo-router";

/**
 * Primary navigation (Section 9 — mobile-first tab bar).
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#020617", borderTopColor: "#1e293b" },
        tabBarActiveTintColor: "#a5b4fc",
        tabBarInactiveTintColor: "#64748b",
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="chart" options={{ title: "Chart" }} />
      <Tabs.Screen name="compatibility" options={{ title: "Match" }} />
      <Tabs.Screen name="journal" options={{ title: "Journal" }} />
      <Tabs.Screen name="dream" options={{ title: "Dream" }} />
      <Tabs.Screen name="tarot" options={{ title: "Tarot" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="timeline" options={{ title: "Timeline" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
