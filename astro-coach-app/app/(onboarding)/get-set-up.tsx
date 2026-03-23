import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { useTheme } from "@/providers/ThemeProvider";

const FEATURE_KEYS = [
  "features.romanticCompatibility",
  "features.tarotInterpreter",
  "features.personalGrowth",
  "features.conflictAdvice",
] as const;

export default function GetSetUpScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const rtl = i18n.language === "fa";

  return (
    <View className="flex-1 px-6 py-12" style={{ backgroundColor: theme.colors.background }}>
      <View className="mt-8">
        <AkhtarWordmark size="hero" />
      </View>
      <Text
        className="mt-12 text-center text-3xl font-semibold"
        style={{ color: theme.colors.onBackground, writingDirection: rtl ? "rtl" : "ltr" }}
      >
        {t("setup.title")}
      </Text>
      <Text
        className="mt-4 text-center text-base"
        style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr" }}
      >
        {t("setup.subtitle")}
      </Text>

      <View className="mt-10 gap-3">
        {FEATURE_KEYS.map((key, idx) => (
          <View
            key={key}
            className="flex-row items-center overflow-hidden rounded-3xl border"
            style={{ borderColor: theme.colors.outline }}
          >
            <View
              className="h-20 w-20"
              style={{
                backgroundColor:
                  idx % 2 === 0 ? theme.colors.cardAccent2 : idx % 3 === 0 ? theme.colors.cardAccent4 : theme.colors.cardAccent3,
              }}
            />
            <Text
              className="px-4 text-xl font-medium"
              style={{ color: theme.colors.onBackground, writingDirection: rtl ? "rtl" : "ltr" }}
            >
              {t(key)}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex-1 justify-end pb-4">
        <Pressable
          onPress={() => router.push("/(onboarding)/chat-onboarding")}
          className="min-h-[52px] justify-center rounded-full px-6 py-4"
          style={{ backgroundColor: theme.colors.onBackground }}
        >
          <Text className="text-center text-2xl font-semibold" style={{ color: theme.colors.background }}>
            {t("setup.cta")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
