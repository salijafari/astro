import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/providers/ThemeProvider";

const FEATURE_KEY_BY_ID: Record<string, string> = {
  "ask-anything": "features.askAnything",
  "daily-horoscope": "features.dailyHoroscope",
  "romantic-compatibility": "features.romanticCompatibility",
  "conflict-advice": "features.conflictAdvice",
  "life-challenges": "features.lifeChallenges",
  "personal-growth": "features.personalGrowth",
  "astrological-events": "features.astrologicalEvents",
  "tarot-interpreter": "features.tarotInterpreter",
  "coffee-reading": "features.coffeeReading",
  "future-seer": "features.futureSeer",
};

export default function FeaturePlaceholderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const key = FEATURE_KEY_BY_ID[id ?? ""] ?? "main.home";
  const rtl = i18n.language === "fa";

  return (
    <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: theme.colors.background }}>
      <Text className="text-center text-3xl font-semibold" style={{ color: theme.colors.onBackground, writingDirection: rtl ? "rtl" : "ltr" }}>
        {t(key)}
      </Text>
      <Text className="mt-4 text-center text-xl" style={{ color: theme.colors.onSurfaceVariant }}>
        {t("common.comingSoon")}
      </Text>
    </View>
  );
}
