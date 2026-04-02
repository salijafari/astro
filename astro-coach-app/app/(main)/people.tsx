import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CosmicBackground } from "@/components/CosmicBackground";
import { MainTabChromeHeader } from "@/components/MainInPageChrome";
import { useThemeColors } from "@/lib/themeColors";
import { useTheme } from "@/providers/ThemeProvider";

export default function PeopleScreen() {
  const { t, i18n } = useTranslation();
  const tc = useThemeColors();
  const { theme } = useTheme();
  const router = useRouter();
  const rtl = i18n.language === "fa";

  return (
    <View className="flex-1" style={{ backgroundColor: "transparent" }}>
      <CosmicBackground subtleDrift />
      <View className="flex-1 px-4 pb-8">
        <MainTabChromeHeader />
        <Text className="mt-2 text-3xl font-semibold" style={{ color: tc.textPrimary, writingDirection: rtl ? "rtl" : "ltr" }}>
          {t("people.title")}
        </Text>
        <Text className="mt-3 text-lg" style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}>
          {t("people.subtitle")}
        </Text>

        <Pressable
          onPress={() => router.push("/(onboarding)/chat")}
          className="mt-8 flex-row items-center rounded-2xl border"
          style={{ borderColor: tc.border }}
        >
          <View className="h-20 w-20 items-center justify-center border-r" style={{ borderColor: tc.border }}>
            <Text className="text-5xl" style={{ color: tc.textPrimary }}>+</Text>
          </View>
          <Text className="px-4 text-3xl font-medium" style={{ color: tc.textPrimary }}>
            {t("people.addSomeone")}
          </Text>
        </Pressable>

        <View className="mt-4 flex-row items-center rounded-2xl border" style={{ borderColor: tc.border }}>
          <View className="h-20 w-20 items-center justify-center" style={{ backgroundColor: theme.colors.cardAccent2 }}>
            <Text className="text-3xl">🪞</Text>
          </View>
          <View className="px-4">
            <Text className="text-3xl font-semibold" style={{ color: tc.textPrimary }}>{t("people.you")}</Text>
            <Text className="text-xl" style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}>
              {t("people.youSigns")}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
