import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FeatureTabHeaderBackButton } from "@/components/MainInPageChrome";
import { AkhtarTabBar } from "@/components/navigation/AkhtarTabBar";
import { useAuth } from "@/lib/auth";
import { auroraCanvasBackground } from "@/lib/auroraPalette";
import { useThemeColors } from "@/lib/themeColors";
import { useTheme } from "@/providers/ThemeProvider";

export default function MainLayout() {
  const { isDark } = useTheme();
  const headerBg = auroraCanvasBackground(isDark);
  const tc = useThemeColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/(auth)/welcome");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return null;
  }

  return (
    <Tabs
      tabBar={(props) => <AkhtarTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: headerBg,
          borderBottomWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitle: () => null,
        sceneContainerStyle: { backgroundColor: "transparent" },
        tabBarHideOnKeyboard: true,
        /** Transparent chrome — real height from AkhtarTabBar; no default colors.card ribbon. */
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopWidth: 0,
          borderTopColor: "transparent",
          elevation: 0,
          shadowOpacity: 0,
          shadowColor: "transparent",
        },
        tabBarBackground: () => null,
        title:
          route.name === "home"
            ? t("main.home")
            : route.name === "transits"
              ? t("main.transits")
              : route.name === "chart"
                ? t("main.chart")
                : t("main.people"),
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
      <Tabs.Screen name="chart" options={{ headerShown: false }} />
      <Tabs.Screen
        name="personal-transits"
        options={{ href: null, headerShown: false, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="people"
        options={{
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="people/add"
        options={{ href: null, headerShown: false, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="edit-person"
        options={{ href: null, headerShown: false, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          href: null,
          /** In-page chrome in `history.tsx` — matches Home / Settings / People. */
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="history/[id]"
        options={{ href: null, headerShown: false, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="feature/[id]"
        options={{
          href: null,
          headerTransparent: true,
          headerStatusBarHeight: insets.top,
          headerStyle: {
            backgroundColor: "transparent",
            borderBottomWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerShadowVisible: false,
          headerTitle: () => null,
          headerTintColor: tc.navIcon,
          headerLeft: () => <FeatureTabHeaderBackButton />,
          headerRight: () => null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="ask-me-anything"
        options={{ href: null, headerShown: false, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="edit-profile"
        options={{ href: null, headerShown: false, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="tarot"
        options={{ href: null, headerShown: false, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="mantra"
        options={{ href: null, headerShown: false, tabBarStyle: { display: "none" } }}
      />
    </Tabs>
  );
}
