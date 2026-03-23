import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/providers/ThemeProvider";

const FEATURES = [
  { id: "ask-anything", key: "features.askAnything", icon: "🎱", accent: "cardAccent2" },
  { id: "daily-horoscope", key: "features.dailyHoroscope", icon: "🔮", accent: "cardAccent3" },
  { id: "romantic-compatibility", key: "features.romanticCompatibility", icon: "🌹", accent: "cardAccent2" },
  { id: "conflict-advice", key: "features.conflictAdvice", icon: "🤺", accent: "cardAccent4" },
  { id: "life-challenges", key: "features.lifeChallenges", icon: "🧗", accent: "cardAccent2" },
  { id: "personal-growth", key: "features.personalGrowth", icon: "🪁", accent: "cardAccent3" },
  { id: "astrological-events", key: "features.astrologicalEvents", icon: "🌟", accent: "cardAccent1" },
  { id: "tarot-interpreter", key: "features.tarotInterpreter", icon: "🌞", accent: "cardAccent2" },
  { id: "coffee-reading", key: "features.coffeeReading", icon: "☕", accent: "cardAccent3" },
  { id: "future-seer", key: "features.futureSeer", icon: "⏳", accent: "cardAccent3" },
] as const;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const rtl = i18n.language === "fa";

  return (
    <View className="flex-1 px-4 pb-8" style={{ backgroundColor: theme.colors.background }}>
      <View className="pt-4">
        {FEATURES.map((feature) => (
          <Pressable
            key={feature.id}
            onPress={() => router.push({ pathname: "/feature/[id]", params: { id: feature.id } })}
            className="mb-3 min-h-[88px] flex-row items-center overflow-hidden rounded-3xl border"
            style={{ borderColor: theme.colors.outline }}
          >
            <View className="h-[88px] w-[88px] items-center justify-center" style={{ backgroundColor: theme.colors[feature.accent] }}>
              <Text className="text-2xl">{feature.icon}</Text>
            </View>
            <Text
              className="flex-1 px-4 text-2xl font-medium"
              style={{ color: theme.colors.onBackground, textAlign: rtl ? "right" : "left", writingDirection: rtl ? "rtl" : "ltr" }}
            >
              {t(feature.key)}
            </Text>
            <Text className="px-4 text-3xl" style={{ color: theme.colors.onSurfaceVariant }}>
              {rtl ? "‹" : "›"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
