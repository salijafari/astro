import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { useTheme } from "@/providers/ThemeProvider";

function HeaderBrand() {
  return (
    <View className="pb-1">
      <AkhtarWordmark size="header" />
    </View>
  );
}

export default function MainLayout() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: theme.colors.background,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outlineVariant,
        },
        headerTitle: () => <HeaderBrand />,
        headerLeft: () => (
          <Pressable onPress={() => router.push("/(main)/history")} className="px-4">
            <MaterialCommunityIcons name="history" size={24} color={theme.colors.onBackground} />
          </Pressable>
        ),
        headerRight: () => (
          <Pressable onPress={() => router.push("/(main)/settings")} className="px-4">
            <Ionicons name="settings-outline" size={24} color={theme.colors.onBackground} />
          </Pressable>
        ),
        tabBarShowLabel: false,
        tabBarStyle: { backgroundColor: theme.colors.background, borderTopColor: theme.colors.outlineVariant },
        tabBarActiveTintColor: theme.colors.onBackground,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarIcon: ({ color, focused }) => {
          const size = focused ? 26 : 24;
          if (route.name === "home") return <Ionicons name="chatbubble" size={size} color={color} />;
          if (route.name === "transits") return <Ionicons name="planet" size={size} color={color} />;
          return <Ionicons name="people" size={size} color={color} />;
        },
        title: route.name === "home" ? t("main.home") : route.name === "transits" ? t("main.transits") : t("main.people"),
      })}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="transits" />
      <Tabs.Screen name="people" />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="feature/[id]" options={{ href: null }} />
    </Tabs>
  );
}
