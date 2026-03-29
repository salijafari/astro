import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { isOnboardingCompletedLocally } from "@/lib/onboardingState";
import { useTheme } from "@/providers/ThemeProvider";
import { typography } from "@/constants/theme";

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

/** Icon column and row height; emoji ~20% below full text-5xl (~48px). */
const ROW_MIN_H = 88;
const ICON_COLUMN_W = 96;
const FEATURE_ICON_FONT_SIZE = Math.round(48 * 0.8);
const featureIconTextStyle = {
  fontSize: FEATURE_ICON_FONT_SIZE,
  lineHeight: Math.round(FEATURE_ICON_FONT_SIZE * 1.2),
} as const;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rtl = i18n.language === "fa";
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  useEffect(() => {
    void (async () => {
      const completed = await isOnboardingCompletedLocally();
      setOnboardingCompleted(completed);
    })();
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="mb-2 flex-row items-center justify-between"
          style={{ paddingTop: Math.max(insets.top, 8) }}
        >
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.push("/(main)/history")}
            className="rounded-full p-2"
          >
            <MaterialCommunityIcons name="history" size={24} color={theme.colors.onBackground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.push("/(main)/settings")}
            className="rounded-full p-2"
          >
            <Ionicons name="settings-outline" size={24} color={theme.colors.onBackground} />
          </Pressable>
        </View>

        <View className="items-center pb-8 pt-4">
          <AkhtarWordmark size="home" />
        </View>

        {!onboardingCompleted ? (
          <>
            <Pressable
              onPress={() => router.push("/(onboarding)/get-set-up")}
              className="mb-3 min-h-[88px] flex-row items-center overflow-hidden rounded-3xl border"
              style={{ borderColor: theme.colors.outline }}
            >
              <LinearGradient
                colors={[`${theme.colors.cardAccent1}ee`, `${theme.colors.secondary}cc`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ width: ICON_COLUMN_W, minHeight: ROW_MIN_H, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={featureIconTextStyle}>👋</Text>
              </LinearGradient>
              <Text
                className="flex-1 px-4 text-xl font-semibold"
                style={{ color: theme.colors.onBackground, textAlign: rtl ? "right" : "left", writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {t("setup.title")}
              </Text>
              <Text className="px-3 text-2xl" style={{ color: theme.colors.onSurfaceVariant }}>
                {rtl ? "‹" : "›"}
              </Text>
            </Pressable>

            {FEATURES.map((feature) => (
              <View
                key={feature.id}
                className="mb-3 min-h-[88px] flex-row items-center overflow-hidden rounded-3xl border"
                style={{
                  borderColor: theme.colors.outlineVariant,
                  opacity: 0.38,
                }}
                accessibilityState={{ disabled: true }}
              >
                <View
                  className="items-center justify-center"
                  style={{
                    width: ICON_COLUMN_W,
                    minHeight: ROW_MIN_H,
                    backgroundColor: theme.colors.surfaceVariant,
                  }}
                >
                  <Text style={[featureIconTextStyle, { opacity: 0.8 }]}>{feature.icon}</Text>
                </View>
                <Text
                  className="flex-1 px-4 text-xl font-medium"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    textAlign: rtl ? "right" : "left",
                    writingDirection: rtl ? "rtl" : "ltr",
                  }}
                >
                  {t(feature.key)}
                </Text>
                <Text className="px-3 text-2xl opacity-40" style={{ color: theme.colors.onSurfaceVariant }}>
                  {rtl ? "‹" : "›"}
                </Text>
              </View>
            ))}
          </>
        ) : (
          <>
            {FEATURES.map((feature) => (
              <Pressable
                key={feature.id}
                onPress={() =>
                  feature.id === "ask-anything"
                    ? router.push("/(main)/ask-me-anything")
                    : router.push({ pathname: "/feature/[id]", params: { id: feature.id } })
                }
                className="mb-3 min-h-[88px] flex-row items-center overflow-hidden rounded-3xl border"
                style={{ borderColor: theme.colors.outline }}
              >
                <View
                  className="items-center justify-center"
                  style={{
                    width: ICON_COLUMN_W,
                    minHeight: ROW_MIN_H,
                    backgroundColor: theme.colors[feature.accent],
                  }}
                >
                  <Text style={featureIconTextStyle}>{feature.icon}</Text>
                </View>
                <Text
                  className="flex-1 px-4 text-xl font-medium"
                  style={{ color: theme.colors.onBackground, textAlign: rtl ? "right" : "left", writingDirection: rtl ? "rtl" : "ltr" }}
                >
                  {t(feature.key)}
                </Text>
                <Text className="px-3 text-2xl" style={{ color: theme.colors.onSurfaceVariant }}>
                  {rtl ? "‹" : "›"}
                </Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
