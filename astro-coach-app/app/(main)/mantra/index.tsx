import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  ImageBackground,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackgroundSheet } from "@/components/mantra/BackgroundSheet";
import { MindfulReveal } from "@/components/mantra/MindfulReveal";
import { CosmicBackground } from "@/components/CosmicBackground";
import { PracticeModeSheet } from "@/components/mantra/PracticeModeSheet";
import { SavedMantrasSheet } from "@/components/mantra/SavedMantrasSheet";
import { ThemeSheet } from "@/components/mantra/ThemeSheet";
import { useMantra } from "@/hooks/useMantra";
import { useMantraBackground } from "@/hooks/useMantraBackground";
import { useMantraVisited } from "@/hooks/useMantraVisited";
import type { MantraSave } from "@/lib/api";
import { readPersistedValue } from "@/lib/storage";
import { useMantraStore } from "@/stores/mantraStore";
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
  "خورشید": "☀",
  "ماه": "☽",
  "عطارد": "☿",
  "زهره": "♀",
  "مریخ": "♂",
  "مشتری": "♃",
  "زحل": "♄",
  "اورانوس": "♅",
  "نپتون": "♆",
  "پلوتون": "♇",
  "کیرون": "⚷",
};


const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 400;

/** Must match `MANTRA_VISITED_STORAGE_KEY` in `useMantraVisited`. */
const MANTRA_VISITED_DATE_KEY = "akhtar.mantraVisitedDate";

function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MantraIndexScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { width: W, height: SCREEN_H } = useWindowDimensions();
  const isRtl = i18n.language.startsWith("fa");
  const {
    mantra,
    isLoading,
    isRefreshing,
    error,
    selectedTheme,
    handleRefresh,
    goToNext,
    goToPrevious,
    handleThemeSelect,
    handleThemeClear,
    handlePin,
    currentMantraText,
    currentTieBack,
    currentPlanetLabel,
    currentQualityLabel,
  } = useMantra();
  const mantraHistoryLen = useMantraStore((s) => s.mantraHistory.length);
  const { backgroundSource, selectBackground, selectedId } = useMantraBackground();
  const { hasUnreadMantra, markMantraVisited } = useMantraVisited();
  const [revealComplete, setRevealComplete] = useState(false);
  /** Avoids a one-frame overlay flash before `useMantraVisited` hydrates from storage. */
  const [visitHydrated, setVisitHydrated] = useState(false);
  const [storedVisitedToday, setStoredVisitedToday] = useState<boolean | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [savesOpen, setSavesOpen] = useState(false);
  const [bgSheetOpen, setBgSheetOpen] = useState(false);

  const dragY = useSharedValue(0);
  const isTransitioning = useSharedValue(false);
  const historyLenSV = useSharedValue(0);
  const mantraOpacity = useSharedValue(0);
  const showRevealSV = useSharedValue(false);

  useEffect(() => {
    historyLenSV.value = mantraHistoryLen;
  }, [mantraHistoryLen, historyLenSV]);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await readPersistedValue(MANTRA_VISITED_DATE_KEY);
        setStoredVisitedToday(stored === todayYmdUtc());
      } catch {
        setStoredVisitedToday(false);
      } finally {
        setVisitHydrated(true);
      }
    })();
  }, []);

  const showReveal = useMemo(
    () =>
      visitHydrated &&
      storedVisitedToday === false &&
      hasUnreadMantra &&
      !revealComplete &&
      !isLoading &&
      !!currentMantraText?.trim(),
    [
      visitHydrated,
      storedVisitedToday,
      hasUnreadMantra,
      revealComplete,
      isLoading,
      currentMantraText,
    ],
  );

  useEffect(() => {
    showRevealSV.value = showReveal;
  }, [showReveal, showRevealSV]);

  useEffect(() => {
    if (!hasUnreadMantra) {
      setRevealComplete(true);
      showRevealSV.value = false;
      if (visitHydrated) {
        mantraOpacity.value = 1;
      }
    }
  }, [hasUnreadMantra, visitHydrated, mantraOpacity, showRevealSV]);

  useEffect(() => {
    if (!visitHydrated || storedVisitedToday === null) return;
    if (storedVisitedToday) {
      setRevealComplete(true);
      mantraOpacity.value = 1;
      showRevealSV.value = false;
    }
  }, [visitHydrated, storedVisitedToday, mantraOpacity, showRevealSV]);

  useEffect(() => {
    if (showReveal) {
      mantraOpacity.value = 0;
    }
  }, [showReveal, mantraOpacity]);

  const mantraAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  const mantraContentOpacityStyle = useAnimatedStyle(() => ({
    opacity: mantraOpacity.value,
  }));

  const runGoNextAfterSlideRef = useRef<() => Promise<void>>(async () => {});
  runGoNextAfterSlideRef.current = async () => {
    await goToNext();
    dragY.value = SCREEN_H * 0.4;
    dragY.value = withTiming(0, { duration: 280 }, () => {
      isTransitioning.value = false;
    });
  };
  const runGoNextAfterSlide = useCallback(() => void runGoNextAfterSlideRef.current(), []);

  const runGoPreviousAfterSlideRef = useRef<() => void>(() => {});
  runGoPreviousAfterSlideRef.current = () => {
    goToPrevious();
    dragY.value = -SCREEN_H * 0.4;
    dragY.value = withTiming(0, { duration: 280 }, () => {
      isTransitioning.value = false;
    });
  };
  const runGoPreviousAfterSlide = useCallback(() => runGoPreviousAfterSlideRef.current(), []);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          if (showRevealSV.value) return;
          if (isTransitioning.value) return;
          if (e.translationY > 0 && historyLenSV.value === 0) {
            dragY.value = e.translationY * 0.12;
            return;
          }
          dragY.value = e.translationY;
        })
        .onEnd((e) => {
          if (showRevealSV.value) return;
          if (isTransitioning.value) return;
          const shouldGoNext =
            e.translationY < -SWIPE_THRESHOLD || e.velocityY < -VELOCITY_THRESHOLD;
          const shouldGoPrev =
            historyLenSV.value > 0 &&
            (e.translationY > SWIPE_THRESHOLD || e.velocityY > VELOCITY_THRESHOLD);
          if (shouldGoNext) {
            isTransitioning.value = true;
            dragY.value = withTiming(-SCREEN_H, { duration: 250 }, (finished) => {
              if (!finished) {
                isTransitioning.value = false;
                dragY.value = withTiming(0, { duration: 150 });
                return;
              }
              runOnJS(runGoNextAfterSlide)();
            });
          } else if (shouldGoPrev) {
            isTransitioning.value = true;
            dragY.value = withTiming(SCREEN_H, { duration: 250 }, (finished) => {
              if (!finished) {
                isTransitioning.value = false;
                dragY.value = withTiming(0, { duration: 150 });
                return;
              }
              runOnJS(runGoPreviousAfterSlide)();
            });
          } else {
            dragY.value = withTiming(0, { duration: 200 });
          }
        }),
    // Empty deps — callbacks are stable refs, shared values
    // are stable Reanimated objects, constants are module-level
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleSelectSave = (save: MantraSave) => {
    const st = useMantraStore.getState();
    if (!st.mantra) return;
    st.pushHistory(st.mantra);
    const asCurrent = {
      ...st.mantra,
      mantraEn: save.mantraEn,
      mantraFa: save.mantraFa,
      tieBackEn: save.tieBackEn,
      tieBackFa: save.tieBackFa,
      planetLabelEn: save.planetLabel,
      planetLabelFa: save.planetLabel,
      qualityLabelEn: save.qualityLabel,
      qualityLabelFa: save.qualityLabel,
    };
    st.setMantra(asCurrent);
  };

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

  const planetSymbol = currentPlanetLabel ? (PLANET_SYMBOLS[currentPlanetLabel] ?? "\u2726") : "\u2726";

  return (
    <View style={{ flex: 1 }}>
      {/* Background layer */}
      {backgroundSource ? (
        <ImageBackground
          source={backgroundSource}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          resizeMode="cover"
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.38)",
            }}
          />
        </ImageBackground>
      ) : (
        <CosmicBackground mantraMode />
      )}

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

        {/* ── GESTURE + mantra + action row ── */}
        <GestureDetector gesture={swipeGesture}>
          <Reanimated.View
            style={[
              {
                flex: 1,
                paddingHorizontal: 32,
                alignItems: "center",
                justifyContent: "center",
                paddingBottom: 16,
              },
              mantraAnimStyle,
            ]}
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
              <Reanimated.View style={[{ width: "100%", alignItems: "center" }, mantraContentOpacityStyle]}>
                <Text
                  key={currentMantraText?.slice(0, 20) ?? "loading"}
                  adjustsFontSizeToFit
                  numberOfLines={4}
                  style={{
                    color: "#FFFFFF",
                    fontSize: 30,
                    fontWeight: "700",
                    textAlign: "center",
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
                      textAlign: "center",
                      writingDirection: isRtl ? "rtl" : "ltr",
                      lineHeight: 22,
                      width: "100%",
                    }}
                    numberOfLines={3}
                  >
                    {currentTieBack}
                  </Text>
                ) : null}

                <View
                  style={{
                    flexDirection: isRtl ? "row-reverse" : "row",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 36,
                    marginTop: 24,
                  }}
                >
                  <Pressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      void goToNext();
                    }}
                    hitSlop={12}
                    disabled={isRefreshing}
                  >
                    <Ionicons name="refresh-outline" size={26} color="rgba(255,255,255,0.55)" />
                  </Pressable>

                  <Pressable onPress={() => setThemeOpen(true)} hitSlop={12}>
                    <Ionicons
                      name="color-palette-outline"
                      size={26}
                      color={selectedTheme ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)"}
                    />
                  </Pressable>

                  <Pressable onPress={() => setSavesOpen(true)} hitSlop={12}>
                    <Ionicons name="bookmark-outline" size={26} color="rgba(255,255,255,0.55)" />
                  </Pressable>
                </View>
              </Reanimated.View>
            )}
          </Reanimated.View>
        </GestureDetector>

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
      <SavedMantrasSheet
        open={savesOpen}
        onClose={() => setSavesOpen(false)}
        onSelectSave={handleSelectSave}
        currentMantraData={mantra}
      />
      <BackgroundSheet
        open={bgSheetOpen}
        onClose={() => setBgSheetOpen(false)}
        selectedId={selectedId}
        onSelectBackground={selectBackground}
      />

      <MindfulReveal
        visible={showReveal}
        onRevealComplete={() => {
          setRevealComplete(true);
          mantraOpacity.value = withTiming(1, { duration: 800 });
          showRevealSV.value = false;
          setTimeout(() => {
            markMantraVisited();
          }, 850);
        }}
      />
    </View>
  );
}
