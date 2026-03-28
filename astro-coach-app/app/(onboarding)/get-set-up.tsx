import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { useTheme } from "@/providers/ThemeProvider";

export default function GetSetUpScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const rtl = i18n.language === "fa";

  return (
    <View
      className="flex-1 justify-between px-6 py-12"
      style={{ backgroundColor: theme.colors.background }}
    >
      <View className="flex-1 items-center justify-center">
        <AkhtarWordmark size="hero" />
        <Text
          className="mt-8 text-center text-2xl font-semibold"
          style={{
            color: theme.colors.onBackground,
            writingDirection: rtl ? "rtl" : "ltr",
          }}
        >
          {t("onboarding.getSetUpTitle")}
        </Text>
        <Text
          className="mt-3 text-center text-lg"
          style={{
            color: theme.colors.onSurfaceVariant,
            writingDirection: rtl ? "rtl" : "ltr",
          }}
        >
          {t("onboarding.getSetUpSubtitle")}
        </Text>
      </View>

      <Pressable
        onPress={() => router.replace("/(onboarding)/chat")}
        className="min-h-[52px] justify-center rounded-full px-4 py-4"
        style={{ backgroundColor: theme.colors.onBackground }}
      >
        <Text
          className="text-center text-2xl font-semibold"
          style={{ color: theme.colors.background }}
        >
          {t("onboarding.getSetUpCta")}
        </Text>
      </Pressable>
    </View>
  );
}
