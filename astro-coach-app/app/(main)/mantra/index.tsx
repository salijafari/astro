import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackgroundSheet } from "@/components/mantra/BackgroundSheet";
import { CosmicBackground } from "@/components/CosmicBackground";
import { JournalSheet } from "@/components/mantra/JournalSheet";
import { PracticeModeSheet } from "@/components/mantra/PracticeModeSheet";
import { ThemeSheet } from "@/components/mantra/ThemeSheet";
import { useMantra } from "@/hooks/useMantra";
import { useMantraBackground } from "@/hooks/useMantraBackground";
import type { MantraPracticeMode, MantraTheme } from "@/types/mantra";

// Planet symbols for transit chip
const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "☀",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
  Chiron: "⚷",
  خورشید: "☀",
  ماه: "☽",
  عطارد: "☿",
  زهره: "♀",
  مریخ: "♂",
  مشتری: "♃",
  زحل: "♄",
  اورانوس: "♅",
  نپتون: "♆",
  پلوتون: "♇",
  کیرون: "⚷",
};

export default function MantraIndexScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { width: W, height: H } = useWindowDimensions();
  const isRtl = i18n.language.startsWith("fa");
  const {
    mantra,
    isLoading,
    isRefreshing,
    error,
    selectedTheme,
    isToneExploratory,
    handleRefresh,
    handleThemeSelect,
    handleThemeClear,
    handleToneToggle,
    handlePin,
    currentMantraText,
    currentTieBack,
    currentPlanetLabel,
    currentQualityLabel,
  } = useMantra();
  const { backgroundSource, selectBackground, selectedId } = useMantraBackground();
  const [themeOpen, setThemeOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [bgSheetOpen, setBgSheetOpen] = useState(false);

  // Shimmer animation for loading state
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    if (!isLoading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLoading, shimmerAnim]);

  const onSwipeRefresh = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void handleRefresh();
  };

  const swipeGesture = Gesture.Pan().onEnd((e) => {
    if (e.velocityY < -500) {
      runOnJS(onSwipeRefresh)();
    }
  });

  const planetSymbol = currentPlanetLabel ? (PLANET_SYMBOLS[currentPlanetLabel] ?? "✦") : "✦";

  const BackgroundWrapper = backgroundSource
    ? ({ children }: { children: ReactNode }) => (
        <ImageBackground source={backgroundSource} style={{ flex: 1 }} resizeMode="cover">
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.35)" }]} />
          {children}
        </ImageBackground>
      )
    : ({ children }: { children: ReactNode }) => (
        <View style={{ flex: 1 }}>
          <CosmicBackground mantraMode />
          {children}
        </View>
      );

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={{ flex: 1 }}>
        <BackgroundWrapper>
          <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right", "bottom"]}>
            {/* ── TOP BAR ── */}
            <View
              style={{
                flexDirection: isRtl ? "row-reverse" : "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingTop: 8,
              }}
            >
              {/* Back button */}
              <Pressable
                onPress={() => router.back()}
                hitSlop={12}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "rgba(0,0,0,0.35)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                accessibilityRole="button"
                accessibilityLabel={t("mantra.backA11y")}
              >
                <Ionicons name={isRtl ? "chevron-forward" : "chevron-back"} size={20} color="#fff" />
              </Pressable>

              {/* Transit context chip */}
              {currentPlanetLabel && currentQualityLabel ? (
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={{
                    borderRadius: 20,
                    overflow: "hidden",
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    maxWidth: W * 0.55,
                  }}
                >
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.9)",
                      fontSize: 12,
                      fontWeight: "600",
                      textAlign: "center",
                    }}
                  >
                    {planetSymbol} {currentPlanetLabel} · {currentQualityLabel}
                  </Text>
                </BlurView>
              ) : (
                <View style={{ width: 36 }} />
              )}

              {/* Background picker button */}
              <Pressable
                onPress={() => setBgSheetOpen(true)}
                hitSlop={12}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "rgba(0,0,0,0.35)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                accessibilityRole="button"
              >
                <Ionicons name="image-outline" size={20} color="#fff" />
              </Pressable>
            </View>

            {/* ── MANTRA ZONE (upper-center) ── */}
            <View
              style={{
                flex: 1,
                paddingHorizontal: 32,
                paddingTop: H * 0.08,
                alignItems: "center",
              }}
            >
              {isLoading && !currentMantraText ? (
                <View style={{ width: "100%", alignItems: "center", gap: 12 }}>
                  {[W * 0.7, W * 0.85, W * 0.6].map((w, i) => (
                    <Animated.View
                      key={i}
                      style={{
                        width: w,
                        height: i === 0 ? 32 : 28,
                        borderRadius: 8,
                        backgroundColor: "rgba(255,255,255,0.15)",
                        opacity: shimmerAnim,
                      }}
                    />
                  ))}
                </View>
              ) : error ? (
                <Pressable onPress={() => void handleRefresh()}>
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.7)",
                      textAlign: "center",
                      fontSize: 15,
                    }}
                  >
                    {t("mantra.errorRetry")}
                  </Text>
                </Pressable>
              ) : (
                <>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={4}
                    style={{
                      color: "#FFFFFF",
                      fontSize: 30,
                      fontWeight: "700",
                      textAlign: isRtl ? "right" : "center",
                      writingDirection: isRtl ? "rtl" : "ltr",
                      lineHeight: 42,
                      letterSpacing: -0.3,
                      marginBottom: 16,
                      width: "100%",
                    }}
                  >
                    {currentMantraText}
                  </Text>

                  {currentTieBack ? (
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.65)",
                        fontSize: 15,
                        fontWeight: "400",
                        textAlign: isRtl ? "right" : "center",
                        writingDirection: isRtl ? "rtl" : "ltr",
                        lineHeight: 22,
                        width: "100%",
                      }}
                      numberOfLines={3}
                    >
                      {currentTieBack}
                    </Text>
                  ) : null}
                </>
              )}
            </View>

            {/* ── ACTION ROW (4 ghost icon buttons) ── */}
            <View
              style={{
                flexDirection: isRtl ? "row-reverse" : "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 36,
                paddingVertical: 20,
              }}
            >
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  void handleRefresh();
                }}
                hitSlop={12}
                disabled={isRefreshing}
              >
                <Ionicons name="refresh-outline" size={26} color="rgba(255,255,255,0.55)" />
              </Pressable>

              <Pressable onPress={() => void handleToneToggle()} hitSlop={12}>
                <Ionicons
                  name={isToneExploratory ? "help-circle-outline" : "chatbubble-ellipses-outline"}
                  size={26}
                  color="rgba(255,255,255,0.55)"
                />
              </Pressable>

              <Pressable onPress={() => setThemeOpen(true)} hitSlop={12}>
                <Ionicons
                  name="color-palette-outline"
                  size={26}
                  color={selectedTheme ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)"}
                />
              </Pressable>

              <Pressable onPress={() => setJournalOpen(true)} hitSlop={12}>
                <Ionicons name="bookmark-outline" size={26} color="rgba(255,255,255,0.55)" />
              </Pressable>
            </View>

            {/* ── BOTTOM BAR ── */}
            <View
              style={{
                flexDirection: isRtl ? "row-reverse" : "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 24,
                paddingBottom: 16,
              }}
            >
              {currentPlanetLabel ? (
                <BlurView
                  intensity={25}
                  tint="dark"
                  style={{
                    borderRadius: 20,
                    overflow: "hidden",
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.8)",
                      fontSize: 13,
                      fontWeight: "500",
                    }}
                  >
                    {planetSymbol} {currentPlanetLabel} · {currentQualityLabel}
                  </Text>
                </BlurView>
              ) : (
                <View />
              )}

              <Pressable
                onPress={() => setPracticeOpen(true)}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  backgroundColor: "#7C3AED",
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#7C3AED",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.5,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <Ionicons name="play" size={24} color="#fff" style={{ marginLeft: 3 }} />
              </Pressable>
            </View>
          </SafeAreaView>
        </BackgroundWrapper>

        <ThemeSheet
          open={themeOpen}
          onClose={() => setThemeOpen(false)}
          selectedTheme={selectedTheme}
          onThemeSelect={(th: MantraTheme) => {
            void handleThemeSelect(th);
            setThemeOpen(false);
          }}
          onThemeClear={() => {
            void handleThemeClear();
            setThemeOpen(false);
          }}
          onPin={() => {
            handlePin();
            setThemeOpen(false);
          }}
          isPinned={mantra?.isPinned}
        />
        <PracticeModeSheet
          open={practiceOpen}
          onClose={() => setPracticeOpen(false)}
          onSelectMode={(m: MantraPracticeMode) => {
            setPracticeOpen(false);
            router.push({ pathname: "/(main)/mantra/practice", params: { modeId: m.id } });
          }}
        />
        <JournalSheet open={journalOpen} onClose={() => setJournalOpen(false)} />
        <BackgroundSheet
          open={bgSheetOpen}
          onClose={() => setBgSheetOpen(false)}
          selectedId={selectedId}
          onSelectBackground={selectBackground}
        />
      </View>
    </GestureDetector>
  );
}
