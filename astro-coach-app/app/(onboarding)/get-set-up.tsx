import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { useTheme } from "@/providers/ThemeProvider";

const FEATURES = [
  { key: "features.askAnything", icon: "🎱", accent: "cardAccent2" },
  { key: "features.dailyHoroscope", icon: "🔮", accent: "cardAccent3" },
  { key: "features.romanticCompatibility", icon: "🌹", accent: "cardAccent2" },
  { key: "features.conflictAdvice", icon: "🤺", accent: "cardAccent4" },
  { key: "features.lifeChallenges", icon: "🧗", accent: "cardAccent2" },
  { key: "features.personalGrowth", icon: "🪁", accent: "cardAccent3" },
  { key: "features.astrologicalEvents", icon: "🌟", accent: "cardAccent1" },
  { key: "features.tarotInterpreter", icon: "🌞", accent: "cardAccent2" },
  { key: "features.coffeeReading", icon: "☕", accent: "cardAccent3" },
  { key: "features.futureSeer", icon: "⏳", accent: "cardAccent3" },
] as const;

export default function GetSetUpScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const rtl = i18n.language === "fa";

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 40, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View className="mt-8 items-center">
          <AkhtarWordmark size="hero" />
        </View>

        <View className="mt-10 mb-3">
          <Pressable
            onPress={() => router.push("/(onboarding)/chat-onboarding")}
            className="min-h-[80px] flex-row items-center overflow-hidden rounded-3xl border"
            style={{ borderColor: theme.colors.outline }}
          >
            <LinearGradient
              colors={[`${theme.colors.cardAccent1}ee`, `${theme.colors.secondary}cc`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ width: 88, minHeight: 80, alignItems: "center", justifyContent: "center" }}
            >
              <Text className="text-3xl">👋</Text>
            </LinearGradient>
            <Text
              className="flex-1 px-4 text-xl font-semibold"
              style={{ color: theme.colors.onBackground, writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}
            >
              {t("setup.title")}
            </Text>
            <Text className="px-3 text-2xl" style={{ color: theme.colors.onSurfaceVariant }}>
              {rtl ? "‹" : "›"}
            </Text>
          </Pressable>
        </View>

        {FEATURES.map((feature) => (
          <View
            key={feature.key}
            className="mb-3 min-h-[80px] flex-row items-center overflow-hidden rounded-3xl border"
            style={{ borderColor: theme.colors.outlineVariant, opacity: 0.38 }}
            accessibilityState={{ disabled: true }}
          >
            <View
              className="items-center justify-center"
              style={{
                width: 88,
                minHeight: 80,
                backgroundColor: theme.colors.surfaceVariant,
              }}
            >
              <Text className="text-2xl opacity-80">{feature.icon}</Text>
            </View>
            <Text
              className="flex-1 px-4 text-xl font-medium"
              style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}
            >
              {t(feature.key)}
            </Text>
            <Text className="px-3 text-2xl opacity-40" style={{ color: theme.colors.onSurfaceVariant }}>
              {rtl ? "‹" : "›"}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
