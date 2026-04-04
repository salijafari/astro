import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { auroraCanvasBackground } from "@/lib/auroraPalette";
import { useThemeColors } from "@/lib/themeColors";
import { useTheme } from "@/providers/ThemeProvider";

export default function MainLayout() {
  const { isDark } = useTheme();
  const headerBg = auroraCanvasBackground(isDark);
  const tc = useThemeColors();
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: headerBg,
          borderBottomWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitle: () => null,
        headerLeft: () => (
          <Pressable onPress={() => router.push("/(main)/history")} className="px-4">
            <MaterialCommunityIcons name="history" size={24} color={tc.navIcon} />
          </Pressable>
        ),
        headerRight: () => (
          <Pressable onPress={() => router.push("/(main)/settings")} className="px-4">
            <Ionicons name="settings-outline" size={24} color={tc.navIcon} />
          </Pressable>
        ),
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: headerBg,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        sceneContainerStyle: { backgroundColor: headerBg },
        tabBarActiveTintColor: isDark ? "#ffffff" : "#1a1a2e",
        tabBarInactiveTintColor: isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.35)",
        tabBarIcon: ({ color, focused }) => {
          const size = focused ? 26 : 24;
          if (route.name === "home") return <Ionicons name="chatbubble" size={size} color={color} />;
          if (route.name === "transits") return <Ionicons name="planet" size={size} color={color} />;
          return <Ionicons name="people" size={size} color={color} />;
        },
        title: route.name === "home" ? t("main.home") : route.name === "transits" ? t("main.transits") : t("main.people"),
      })}
    >
      <Tabs.Screen
        name="home"
        options={{
          /** Full-bleed home (wordmark + setup row) — history/settings live in-screen */
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="transits"
        options={{
          /** Same in-page chrome as home — `personal-transits` implements the header row. */
          headerShown: false,
        }}
      />
      <Tabs.Screen name="personal-transits" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="people"
        options={{
          headerShown: false,
        }}
      />
      <Tabs.Screen name="people/add" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="edit-person" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          href: null,
          /** In-page chrome in `history.tsx` — matches Home / Settings / People. */
          headerShown: false,
        }}
      />
      <Tabs.Screen name="history/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="feature/[id]" options={{ href: null }} />
      <Tabs.Screen name="ask-me-anything" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="edit-profile" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
