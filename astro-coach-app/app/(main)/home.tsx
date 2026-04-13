import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  Animated,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useTranslation } from "react-i18next";
import { CosmicBackground } from "@/components/CosmicBackground";
import { MainTabChromeHeader } from "@/components/MainInPageChrome";
import { PaywallGate } from "@/components/PaywallGate";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { useAuth } from "@/lib/auth";
import { useFeatureAccess } from "@/lib/useFeatureAccess";
import { fetchUserProfile } from "@/lib/userProfile";
import { useThemeColors } from "@/lib/themeColors";
import { useTheme } from "@/providers/ThemeProvider";

type FeatureAccent = "cardAccent1" | "cardAccent2" | "cardAccent3" | "cardAccent4" | "cardAccent5" | "cardAccent6";

export type HomeFeatureRow = {
  id: string;
  key: string;
  accent: FeatureAccent;
  /** When true, row is omitted from the home dashboard (screens still exist). */
  hidden?: boolean;
  /** Shows a small "Coming soon" label; does not change navigation. */
  comingSoon?: boolean;
};

const PINNED_FEATURE_ID = "ask-anything";

/** Full catalog; `hidden: true` keeps routes/screens but hides the card. Launch list = 5 visible. */
const ALL_FEATURES: HomeFeatureRow[] = [
  { id: "ask-anything", key: "features.askAnything", accent: "cardAccent2" },
  { id: "coffee-reading", key: "features.coffeeReading", accent: "cardAccent3" },
  { id: "dream-interpreter", key: "features.dreamInterpreter", accent: "cardAccent4" },
  {
    id: "romantic-compatibility",
    key: "features.romanticCompatibility",
    accent: "cardAccent2",
  },
  {
    id: "astrological-events",
    key: "features.astrologicalEvents",
    accent: "cardAccent1",
  },
  { id: "daily-horoscope", key: "features.dailyHoroscope", accent: "cardAccent3", hidden: true },
  { id: "conflict-advice", key: "features.conflictAdvice", accent: "cardAccent4", hidden: true },
  { id: "life-challenges", key: "features.lifeChallenges", accent: "cardAccent2", hidden: true },
  { id: "personal-growth", key: "features.personalGrowth", accent: "cardAccent3", hidden: true },
  { id: "tarot-interpreter", key: "features.tarotInterpreter", accent: "cardAccent2" },
  { id: "future-seer", key: "features.futureSeer", accent: "cardAccent3", hidden: true },
];

/**
 * Fisher–Yates shuffle (in-place copy). Randomness only used here, not during render.
 */
function shuffleInPlace<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function buildDashboardOrder(): HomeFeatureRow[] {
  const visible = ALL_FEATURES.filter((f) => !f.hidden);
  const pinned = visible.find((f) => f.id === PINNED_FEATURE_ID);
  const pool = visible.filter((f) => f.id !== PINNED_FEATURE_ID);
  const shuffled = shuffleInPlace(pool);
  return pinned ? [pinned, ...shuffled] : shuffled;
}

/** Icon column and row height; icon glyph size matches prior emoji text size (~20% below full text-5xl). */
const ROW_MIN_H = 88;
const ICON_COLUMN_W = 96;
const FEATURE_ICON_FONT_SIZE = Math.round(48 * 0.8);

/** Emoji in the setup CTA gradient column only (feature cards use Ionicons). */
const setupCtaEmojiStyle = {
  fontSize: FEATURE_ICON_FONT_SIZE,
  lineHeight: FEATURE_ICON_FONT_SIZE,
  textAlign: "center" as const,
};

/**
 * Unified Ionicons for dashboard feature tiles — same stroke family, one visual system.
 * Size uses FEATURE_ICON_FONT_SIZE so bounding box matches the old emoji implementation.
 */
const DASHBOARD_FEATURE_IONICON: Record<string, ComponentProps<typeof Ionicons>["name"]> = {
  "ask-anything": "planet-outline",
  "coffee-reading": "cafe-outline",
  "dream-interpreter": "moon-outline",
  "romantic-compatibility": "heart-outline",
  "astrological-events": "sparkles",
  "daily-horoscope": "star-outline",
  "conflict-advice": "shield-outline",
  "life-challenges": "trending-up-outline",
  "personal-growth": "leaf-outline",
  "tarot-interpreter": "layers-outline",
  "future-seer": "hourglass-outline",
};

type DashboardIconTone = {
  base: string;
  highlight: string;
  shadow: string;
};

const DASHBOARD_ICON_TONES: Record<string, DashboardIconTone> = {
  "ask-anything": { base: "#d2b6ff", highlight: "#f4d8ff", shadow: "#7b3cff" },
  "astrological-events": { base: "#d8ecff", highlight: "#fff4cc", shadow: "#3f7bff" },
  "dream-interpreter": { base: "#ffe4ad", highlight: "#fff5dc", shadow: "#d78722" },
  "coffee-reading": { base: "#c8f8ff", highlight: "#f2fdff", shadow: "#1aa7cc" },
  "romantic-compatibility": { base: "#ffbfd9", highlight: "#ffe1f0", shadow: "#c02f8b" },
};

function DashboardInteractiveCard({
  children,
  className,
  style,
  onPress,
  onHoverChange,
}: {
  children: ReactNode;
  className: string;
  style?: ViewStyle;
  onPress: () => void;
  onHoverChange?: (hovered: boolean) => void;
}) {
  const hoverAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(0)).current;
  const isWeb = Platform.OS === "web";

  const runHover = useCallback(
    (toValue: number) => {
      if (!isWeb) return;
      Animated.timing(hoverAnim, {
        toValue,
        duration: 180,
        useNativeDriver: true,
      }).start();
    },
    [hoverAnim, isWeb],
  );

  const runPress = useCallback(
    (toValue: number, duration: number) => {
      Animated.timing(pressAnim, {
        toValue,
        duration,
        useNativeDriver: true,
      }).start();
    },
    [pressAnim],
  );

  const translateY = Animated.add(
    hoverAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }),
    pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }),
  );
  const scale = Animated.multiply(
    hoverAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.013] }),
    pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }),
  );
  const shadowOpacity = Animated.add(
    hoverAnim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.18] }),
    pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -0.07] }),
  );
  const shadowRadius = Animated.add(
    hoverAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 11] }),
    pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }),
  );

  return (
    <Animated.View
      style={{
        transform: [{ translateY }, { scale }],
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity,
        shadowRadius,
        elevation: 2,
      }}
    >
      <Pressable
        onPress={onPress}
        onHoverIn={() => {
          runHover(1);
          onHoverChange?.(true);
        }}
        onHoverOut={() => {
          runHover(0);
          onHoverChange?.(false);
        }}
        onPressIn={() => runPress(1, 90)}
        onPressOut={() => runPress(0, 120)}
        className={className}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function DashboardFeatureIcon({
  featureId,
  color,
  opacity = 1,
  isHovered = false,
}: {
  featureId: string;
  color: string;
  opacity?: number;
  isHovered?: boolean;
}) {
  const name = DASHBOARD_FEATURE_IONICON[featureId] ?? "ellipse-outline";
  const tone = DASHBOARD_ICON_TONES[featureId];
  const hoverProgress = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (Platform.OS !== "web") return;
    Animated.timing(hoverProgress, {
      toValue: isHovered ? 1 : 0,
      duration: 170,
      useNativeDriver: true,
    }).start();
  }, [hoverProgress, isHovered]);

  const translateY = hoverProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });
  const scale = hoverProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035],
  });
  const glowOpacity = hoverProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.45],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        width: FEATURE_ICON_FONT_SIZE,
        height: FEATURE_ICON_FONT_SIZE,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ translateY }, { scale }],
      }}
    >
      {tone ? (
        <>
          <Animated.View
            style={{
              position: "absolute",
              width: FEATURE_ICON_FONT_SIZE + 4,
              height: FEATURE_ICON_FONT_SIZE + 4,
              borderRadius: FEATURE_ICON_FONT_SIZE,
              backgroundColor: tone.shadow,
              opacity: glowOpacity,
            }}
          />
          <Ionicons
            name={name}
            size={FEATURE_ICON_FONT_SIZE}
            color={tone.base}
            style={{ position: "absolute", opacity: opacity }}
          />
          <Ionicons
            name={name}
            size={FEATURE_ICON_FONT_SIZE}
            color={tone.highlight}
            style={{ position: "absolute", opacity: 0.5 * opacity, transform: [{ translateY: -0.6 }] }}
          />
          <Ionicons name={name} size={FEATURE_ICON_FONT_SIZE} color={color} style={{ opacity: 0.18 * opacity }} />
        </>
      ) : (
        <Ionicons name={name} size={FEATURE_ICON_FONT_SIZE} color={color} style={{ opacity }} />
      )}
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const tc = useThemeColors();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const rtl = i18n.language === "fa";
  const { getToken, user } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { requireAccess, paywallVisible, pendingFeature, closePaywall } = useFeatureAccess();
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [dashboardFeatures, setDashboardFeatures] = useState<HomeFeatureRow[]>(buildDashboardOrder);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  // Calculate logo fade: logo fades as content scrolls over it
  // Logo container is top 50% of screen, centered = logo center at ~25%
  // List starts just below logo bottom = ~50% of screen height minus header
  // On mobile: show 3 full cards + peek of 4th (ROW_MIN_H = 88pt per card)
  // Header approx height = inset + 48pt, use 110pt as safe estimate
  const HEADER_H = 110;
  const LOGO_ZONE_H = windowHeight * 0.5; // logo container height
  // paddingTop for ScrollView = space before first card
  // = logo zone height - header height + small breathing gap
  const mobilePaddingTop = Math.max(LOGO_ZONE_H - HEADER_H + 16, 200);
  // Web: just enough gap below logo, don't push too far
  const webPaddingTop = windowHeight * 0.26;

  const openFeature = useCallback(
    (feature: HomeFeatureRow) => {
      if (feature.comingSoon) return;
      const label = t(feature.key);
      if (feature.id === "ask-anything") {
        requireAccess(() => router.push("/(main)/ask-me-anything"), label);
        return;
      }
      if (feature.id === "astrological-events") {
        requireAccess(() => router.push("/(main)/personal-transits"), label);
        return;
      }
      if (feature.id === "tarot-interpreter") {
        router.push("/(main)/tarot");
        return;
      }
      requireAccess(() => router.push({ pathname: "/feature/[id]", params: { id: feature.id } }), label);
    },
    [requireAccess, router, t],
  );

  useFocusEffect(
    useCallback(() => {
      setDashboardFeatures(buildDashboardOrder());
      let cancelled = false;
      void (async () => {
        const token = await getTokenRef.current();
        if (!token || cancelled) return;
        const profile = await fetchUserProfile(token, true);
        if (!cancelled) setIsProfileComplete(profile.isProfileComplete);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <View className="flex-1" style={{ backgroundColor: "transparent" }}>
      <CosmicBackground subtleDrift />
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "50%",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 0,
          opacity: scrollY.interpolate({
            inputRange: [0, ROW_MIN_H],
            outputRange: [1, 0],
            extrapolate: "clamp",
          }),
        }}
      >
        <AkhtarWordmark size="dashboard" />
      </Animated.View>
      <View style={{ zIndex: 2, elevation: 4 }}>
        <MainTabChromeHeader />
      </View>
      <Animated.ScrollView
        style={{ flex: 1, zIndex: 1 }}
        contentContainerStyle={{
          paddingTop: Platform.OS === "web" ? webPaddingTop : mobilePaddingTop,
          paddingBottom: 32,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
      >
        {user && !isProfileComplete ? (
          <>
            <DashboardInteractiveCard
              onPress={() => router.push("/(profile-setup)/setup")}
              className="mb-2 min-h-[88px] flex-row items-center overflow-hidden rounded-xl border"
              style={{
                borderColor: tc.border,
                backgroundColor: isDark ? "rgba(30,28,60,0.90)" : "rgba(240,238,255,0.90)",
              }}
            >
              <LinearGradient
                colors={[`${theme.colors.cardAccent1}ee`, `${theme.colors.secondary}cc`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ width: ICON_COLUMN_W, minHeight: ROW_MIN_H, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={setupCtaEmojiStyle}>👋</Text>
              </LinearGradient>
              <Text
                className="flex-1 px-4 text-xl font-semibold"
                style={{ color: tc.textPrimary, textAlign: rtl ? "right" : "left", writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {t("setup.title")}
              </Text>
              <Text className="px-3 text-2xl" style={{ color: tc.textSecondary }}>
                {rtl ? "‹" : "›"}
              </Text>
            </DashboardInteractiveCard>

            {dashboardFeatures.map((feature) => (
              <View
                key={feature.id}
                className="mb-2 min-h-[88px] flex-row items-center overflow-hidden rounded-xl border"
                style={{
                  borderColor: tc.borderSubtle,
                  backgroundColor: isDark ? "rgba(30,28,60,0.90)" : "rgba(240,238,255,0.90)",
                  opacity: 0.55,
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
                  <DashboardFeatureIcon
                    featureId={feature.id}
                    color={tc.textSecondary}
                    opacity={0.8}
                    isHovered={false}
                  />
                </View>
                <View className="flex-1 justify-center px-4">
                  <Text
                    className="text-xl font-medium"
                    style={{
                      color: tc.textSecondary,
                      textAlign: rtl ? "right" : "left",
                      writingDirection: rtl ? "rtl" : "ltr",
                    }}
                  >
                    {t(feature.key)}
                  </Text>
                  {feature.comingSoon ? (
                    <Text
                      className="mt-1 text-xs"
                      style={{
                        color: tc.textSecondary,
                        textAlign: rtl ? "right" : "left",
                        writingDirection: rtl ? "rtl" : "ltr",
                        opacity: 0.85,
                      }}
                    >
                      {t("common.comingSoon")}
                    </Text>
                  ) : null}
                </View>
                <Text className="px-3 text-2xl opacity-40" style={{ color: tc.textSecondary }}>
                  {rtl ? "‹" : "›"}
                </Text>
              </View>
            ))}
          </>
        ) : (
          <>
            {dashboardFeatures.map((feature) => (
              <DashboardInteractiveCard
                key={feature.id}
                onPress={() => openFeature(feature)}
                onHoverChange={(hovered) => setHoveredFeatureId(hovered ? feature.id : null)}
                className="mb-2 min-h-[88px] flex-row items-center overflow-hidden rounded-xl border"
                style={{
                  borderColor: tc.border,
                  backgroundColor: isDark ? "rgba(30,28,60,0.90)" : "rgba(240,238,255,0.90)",
                }}
              >
                <View
                  className="items-center justify-center"
                  style={{
                    width: ICON_COLUMN_W,
                    minHeight: ROW_MIN_H,
                    backgroundColor: theme.colors[feature.accent],
                  }}
                >
                  <DashboardFeatureIcon
                    featureId={feature.id}
                    color="rgba(255,255,255,0.96)"
                    isHovered={hoveredFeatureId === feature.id}
                  />
                </View>
                <View className="flex-1 justify-center px-4">
                  <Text
                    className="text-xl font-medium"
                    style={{ color: tc.textPrimary, textAlign: rtl ? "right" : "left", writingDirection: rtl ? "rtl" : "ltr" }}
                  >
                    {t(feature.key)}
                  </Text>
                  {feature.comingSoon ? (
                    <Text
                      className="mt-1 text-xs"
                      style={{
                        color: tc.textSecondary,
                        textAlign: rtl ? "right" : "left",
                        writingDirection: rtl ? "rtl" : "ltr",
                      }}
                    >
                      {t("common.comingSoon")}
                    </Text>
                  ) : null}
                </View>
                <Text className="px-3 text-2xl" style={{ color: tc.textSecondary }}>
                  {rtl ? "‹" : "›"}
                </Text>
              </DashboardInteractiveCard>
            ))}
          </>
        )}
      </Animated.ScrollView>
      <PaywallGate visible={paywallVisible} onClose={closePaywall} featureName={pendingFeature} />
    </View>
  );
}
