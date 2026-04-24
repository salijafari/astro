import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
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
import { DashboardSvgIcon } from "@/components/dashboard/DashboardSvgIcon";
import { CosmicBackground } from "@/components/CosmicBackground";
import { MainTabChromeHeader } from "@/components/MainInPageChrome";
import { PaywallGate } from "@/components/PaywallGate";
import { SmartAppBanner } from "@/components/SmartAppBanner";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { useBottomNavInset } from "@/hooks/useBottomNavInset";
import { useMantraVisited } from "@/hooks/useMantraVisited";
import { useAuth } from "@/lib/auth";
import { trackEvent } from "@/lib/mixpanel";
import { useFeatureAccess } from "@/lib/useFeatureAccess";
import { isPersian } from "@/lib/i18n";
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
  { id: "tarot-interpreter", key: "features.tarotInterpreter", accent: "cardAccent2" },
  { id: "mantra", key: "features.mantra", accent: "cardAccent4", hidden: true },
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
  { id: "future-seer", key: "features.futureSeer", accent: "cardAccent3", hidden: true },
];

function buildDashboardOrder(): HomeFeatureRow[] {
  const visible = ALL_FEATURES.filter((f) => !f.hidden);
  const pinned = visible.find((f) => f.id === PINNED_FEATURE_ID);
  const rest = visible.filter((f) => f.id !== PINNED_FEATURE_ID);
  const ordered = pinned ? [pinned, ...rest] : rest;
  return ordered.filter((f) => f.id !== "astrological-events");
}

/** Icon column and row height; icon glyph size matches prior emoji text size (~20% below full text-5xl). */
const ROW_MIN_H = 88;
const ICON_COLUMN_W = 96;
const FEATURE_ICON_FONT_SIZE = Math.round(48 * 0.8);
// SVG icons fill ~78% of the icon column for pixel-perfect
// match with the design (96px column × 0.78 = ~75px)
const SVG_ICON_SIZE_DEFAULT = Math.round(ICON_COLUMN_W * 0.78);
const SVG_ICON_SIZE_LARGE = Math.round(SVG_ICON_SIZE_DEFAULT * 1.15);

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
  mantra: "moon-outline",
};

type DashboardIconTone = {
  base: string;
  highlight: string;
  shadow: string;
};

const DASHBOARD_ICON_TONES: Record<string, DashboardIconTone> = {
  "ask-anything": { base: "#FFF0A0", highlight: "#FFFDE0", shadow: "#B8932C" },
  "astrological-events": { base: "#C8D8FF", highlight: "#E8F0FF", shadow: "#2F4273" },
  "dream-interpreter": { base: "#D8D0FF", highlight: "#F0EEFF", shadow: "#5C4A9A" },
  "coffee-reading": { base: "#FFD8A0", highlight: "#FFF0D8", shadow: "#6B3A1F" },
  "romantic-compatibility": { base: "#FFD0C8", highlight: "#FFE8E0", shadow: "#7A3A3A" },
  "tarot-interpreter": { base: "#D0B0E8", highlight: "#EDE0FF", shadow: "#3B1F50" },
  mantra: { base: "#E8D5FF", highlight: "#F5EEFF", shadow: "#2D1A45" },
};

const FEATURE_GRADIENTS: Record<string, [string, string]> = {
  "ask-anything": ["#D4AF37", "#B8932C"],
  "tarot-interpreter": ["#5C3B6F", "#7B4C91"],
  "astrological-events": ["#4E6AA8", "#2F4273"],
  "romantic-compatibility": ["#9D6B6B", "#C58A7A"],
  "coffee-reading": ["#8E5B3A", "#B97842"],
  "dream-interpreter": ["#7D74B2", "#A79AD9"],
  mantra: ["#4FA89D", "#2B6E6A"],
};

// Fallback for features not in the map (hidden features etc.)
const DEFAULT_GRADIENT: [string, string] = ["#4E3A7A", "#2F2550"];

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

  const hasSvg = [
    "ask-anything",
    "tarot-interpreter",
    "astrological-events",
    "romantic-compatibility",
    "coffee-reading",
    "dream-interpreter",
    "mantra",
  ].includes(featureId);

  if (hasSvg) {
    const svgSize =
      featureId === "astrological-events"
        ? SVG_ICON_SIZE_DEFAULT
        : SVG_ICON_SIZE_LARGE;
    return (
      <Animated.View
        pointerEvents="none"
        style={{
          width: svgSize,
          height: svgSize,
          alignItems: "center",
          justifyContent: "center",
          opacity,
          transform: [{ translateY }, { scale }],
        }}
      >
        <DashboardSvgIcon featureId={featureId} size={svgSize} />
      </Animated.View>
    );
  }

  const name = DASHBOARD_FEATURE_IONICON[featureId] ?? "ellipse-outline";
  const tone = DASHBOARD_ICON_TONES[featureId];

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
              opacity: hoverProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.45],
              }),
            }}
          />
          <Ionicons
            name={name}
            size={FEATURE_ICON_FONT_SIZE}
            color={tone.base}
            style={{ position: "absolute", opacity }}
          />
          <Ionicons
            name={name}
            size={FEATURE_ICON_FONT_SIZE}
            color={tone.highlight}
            style={{
              position: "absolute",
              opacity: 0.5 * opacity,
              transform: [{ translateY: -0.6 }],
            }}
          />
          <Ionicons name={name} size={FEATURE_ICON_FONT_SIZE} color={color} style={{ opacity: 0.18 * opacity }} />
        </>
      ) : (
        <Ionicons name={name} size={FEATURE_ICON_FONT_SIZE} color={color} style={{ opacity }} />
      )}
    </Animated.View>
  );
}

/** Dedicated mantra row in third dashboard slot (catalog `mantra` remains hidden from the generic list). */
function MantraHomeDashboardRow() {
  const { t, i18n } = useTranslation();
  const tc = useThemeColors();
  const { isDark } = useTheme();
  const router = useRouter();
  const rtl = isPersian(i18n.language);
  const { hasUnreadMantra } = useMantraVisited();
  const [hovered, setHovered] = useState(false);
  const viewedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (viewedRef.current) return;
      viewedRef.current = true;
      trackEvent("mantra_card_viewed");
    }, []),
  );

  return (
    <DashboardInteractiveCard
      onPress={() => {
        trackEvent("mantra_card_tapped");
        router.push("/(main)/mantra");
      }}
      onHoverChange={setHovered}
      className="mb-2 min-h-[88px] flex-row items-center overflow-hidden rounded-xl border"
      style={{
        borderColor: tc.border,
        backgroundColor: isDark ? "rgba(30,28,60,0.90)" : "rgba(240,238,255,0.90)",
      }}
    >
      <View className="min-h-[88px] w-full flex-1 flex-row items-center" style={{ position: "relative" }}>
        <LinearGradient
          colors={FEATURE_GRADIENTS.mantra ?? DEFAULT_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            width: ICON_COLUMN_W,
            minHeight: ROW_MIN_H,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <DashboardFeatureIcon featureId="mantra" color="rgba(255,255,255,0.96)" isHovered={hovered} />
        </LinearGradient>
        <View className="flex-1 justify-center px-4">
          <Text
            className="text-xl font-medium"
            style={{
              color: tc.textPrimary,
              textAlign: rtl ? "right" : "left",
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {t("features.mantra")}
          </Text>
        </View>
        <Text className="px-3 text-2xl" style={{ color: tc.textSecondary }}>
          {rtl ? "‹" : "›"}
        </Text>
        {hasUnreadMantra ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 8,
              right: 10,
              width: 12,
              height: 12,
              borderRadius: 999,
              backgroundColor: "#FF3B30",
            }}
          />
        ) : null}
      </View>
    </DashboardInteractiveCard>
  );
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const tc = useThemeColors();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const rtl = isPersian(i18n.language);
  const { getToken, user } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { requireAccess, paywallVisible, pendingFeature, closePaywall } = useFeatureAccess();
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [dashboardFeatures, setDashboardFeatures] = useState<HomeFeatureRow[]>(buildDashboardOrder);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  const [smartBannerInset, setSmartBannerInset] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const bottomNavInset = useBottomNavInset();

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
      if (feature.id === "mantra") {
        router.push("/(main)/mantra");
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
      <SmartAppBanner onHeightChange={setSmartBannerInset} />
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
          paddingTop:
            (Platform.OS === "web" ? webPaddingTop : mobilePaddingTop) + smartBannerInset,
          paddingBottom: bottomNavInset,
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
                colors={["#D4AF37ee", "#B8932Ccc"]}
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
            {dashboardFeatures.map((feature, index) => (
              <Fragment key={feature.id}>
                <DashboardInteractiveCard
                  onPress={() => openFeature(feature)}
                  onHoverChange={(hovered) => setHoveredFeatureId(hovered ? feature.id : null)}
                  className="mb-2 min-h-[88px] flex-row items-center overflow-hidden rounded-xl border"
                  style={{
                    borderColor: tc.border,
                    backgroundColor: isDark ? "rgba(30,28,60,0.90)" : "rgba(240,238,255,0.90)",
                  }}
                >
                  <View className="min-h-[88px] w-full flex-1 flex-row items-center" style={{ position: "relative" }}>
                    <LinearGradient
                      colors={FEATURE_GRADIENTS[feature.id] ?? DEFAULT_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{
                        width: ICON_COLUMN_W,
                        minHeight: ROW_MIN_H,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <DashboardFeatureIcon
                        featureId={feature.id}
                        color="rgba(255,255,255,0.96)"
                        isHovered={hoveredFeatureId === feature.id}
                      />
                    </LinearGradient>
                    <View className="flex-1 justify-center px-4">
                      <Text
                        className="text-xl font-medium"
                        style={{
                          color: tc.textPrimary,
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
                          }}
                        >
                          {t("common.comingSoon")}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="px-3 text-2xl" style={{ color: tc.textSecondary }}>
                      {rtl ? "‹" : "›"}
                    </Text>
                  </View>
                </DashboardInteractiveCard>
                {index === 1 ? <MantraHomeDashboardRow /> : null}
              </Fragment>
            ))}
          </>
        )}
      </Animated.ScrollView>
      <PaywallGate visible={paywallVisible} onClose={closePaywall} featureName={pendingFeature} />
    </View>
  );
}
