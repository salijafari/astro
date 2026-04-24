import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, Text, View } from "react-native";
import { isPersian } from "@/lib/i18n";
import Reanimated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, G } from "react-native-svg";

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const AnimatedText = Reanimated.createAnimatedComponent(Text);

const CIRCLE_SIZE = 160;
const GLOW_WRAPPER = 300;
const RING_SIZE = 190;
const RING_CENTER = 95;
const RADIUS = 92;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type MindfulRevealProps = {
  visible: boolean;
  onRevealComplete: () => void;
};

const triggerHapticImpact = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== "web") {
    void Haptics.impactAsync(style);
  } else if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(50);
  }
};

const triggerHapticSuccess = () => {
  if (Platform.OS !== "web") {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } else if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([30, 40, 30]);
  }
};

function formatOverlayDateUpper(): string {
  return new Date()
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();
}

function greetingForLocale(isFa: boolean): string {
  const hour = new Date().getHours();
  if (isFa) {
    if (hour < 12) return "صبح بخیر";
    if (hour < 17) return "روز بخیر";
    if (hour < 21) return "عصر بخیر";
    return "شب بخیر";
  }
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

/**
 * Full-screen press-and-hold breathing interaction before showing the daily mantra.
 */
export const MindfulReveal: React.FC<MindfulRevealProps> = ({
  visible,
  onRevealComplete,
}) => {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isFa = isPersian(i18n.language);

  const dateLine = useMemo(() => formatOverlayDateUpper(), []);
  const greeting = useMemo(() => greetingForLocale(isFa), [isFa]);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const haptic1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const haptic25Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progressAnim = useSharedValue(0);
  const pulsePhase = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const keepLabelOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const circleScale = useSharedValue(1);
  const overlayOpacity = useSharedValue(1);
  const isCompletingRef = useRef(false);

  const onRevealCompleteRef = useRef(onRevealComplete);
  onRevealCompleteRef.current = onRevealComplete;

  const clearHoldTimers = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (haptic1Ref.current) {
      clearTimeout(haptic1Ref.current);
      haptic1Ref.current = null;
    }
    if (haptic25Ref.current) {
      clearTimeout(haptic25Ref.current);
      haptic25Ref.current = null;
    }
    if (keepLabelTimerRef.current) {
      clearTimeout(keepLabelTimerRef.current);
      keepLabelTimerRef.current = null;
    }
  }, []);

  const resetAfterRelease = useCallback(() => {
    clearHoldTimers();
    cancelAnimation(pulsePhase);
    cancelAnimation(progressAnim);
    cancelAnimation(glowOpacity);
    pulsePhase.value = 0;
    progressAnim.value = withTiming(0, { duration: 300 });
    ringOpacity.value = withTiming(0, { duration: 200 });
    keepLabelOpacity.value = withTiming(0, { duration: 150 });
    glowOpacity.value = withTiming(0, { duration: 300 });
    circleScale.value = withTiming(1, { duration: 200 });
    triggerHapticImpact(Haptics.ImpactFeedbackStyle.Light);
  }, [clearHoldTimers, circleScale, glowOpacity, keepLabelOpacity, progressAnim, pulsePhase, ringOpacity]);

  const runCompletionSequence = useCallback(() => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    clearHoldTimers();
    cancelAnimation(pulsePhase);
    cancelAnimation(progressAnim);
    cancelAnimation(glowOpacity);
    triggerHapticSuccess();

    circleScale.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
    glowOpacity.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.quad) });
    overlayOpacity.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) });

    if (completionRef.current) clearTimeout(completionRef.current);
    completionRef.current = setTimeout(() => {
      completionRef.current = null;
      onRevealCompleteRef.current();
      isCompletingRef.current = false;
    }, 600);
  }, [clearHoldTimers, circleScale, glowOpacity, overlayOpacity, progressAnim, pulsePhase]);

  useEffect(() => {
    return () => {
      clearHoldTimers();
      if (completionRef.current) clearTimeout(completionRef.current);
    };
  }, [clearHoldTimers]);

  useEffect(() => {
    if (!visible) {
      isCompletingRef.current = false;
      clearHoldTimers();
      cancelAnimation(pulsePhase);
      cancelAnimation(progressAnim);
      cancelAnimation(glowOpacity);
      progressAnim.value = 0;
      pulsePhase.value = 0;
      ringOpacity.value = 0;
      keepLabelOpacity.value = 0;
      glowOpacity.value = 0;
      circleScale.value = 1;
      overlayOpacity.value = 1;
    }
  }, [visible, clearHoldTimers, glowOpacity, progressAnim, pulsePhase, ringOpacity, keepLabelOpacity, circleScale, overlayOpacity]);

  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progressAnim.value),
    opacity: ringOpacity.value,
  }));

  const circleAnimatedStyle = useAnimatedStyle(() => {
    const breathScale = circleScale.value * (1 + pulsePhase.value * 0.08);
    return {
      transform: [{ scale: breathScale }],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: 1 + glowOpacity.value * 0.3 }],
  }));

  const keepLabelStyle = useAnimatedStyle(() => ({
    opacity: keepLabelOpacity.value,
  }));

  const rootOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const handlePressIn = () => {
    if (!visible || isCompletingRef.current) return;

    triggerHapticImpact(Haptics.ImpactFeedbackStyle.Medium);

    progressAnim.value = 0;
    progressAnim.value = withTiming(1, { duration: 5000, easing: Easing.linear });
    ringOpacity.value = withTiming(1, { duration: 200 });

    glowOpacity.value = 0;
    glowOpacity.value = withTiming(1, { duration: 4000, easing: Easing.out(Easing.quad) });

    pulsePhase.value = 0;
    pulsePhase.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    keepLabelOpacity.value = 0;
    if (keepLabelTimerRef.current) clearTimeout(keepLabelTimerRef.current);
    keepLabelTimerRef.current = setTimeout(() => {
      keepLabelTimerRef.current = null;
      keepLabelOpacity.value = withTiming(0.9, { duration: 300 });
    }, 300);

    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      runCompletionSequence();
    }, 5000);

    haptic1Ref.current = setTimeout(() => {
      haptic1Ref.current = null;
      triggerHapticImpact(Haptics.ImpactFeedbackStyle.Light);
    }, 1000);

    haptic25Ref.current = setTimeout(() => {
      haptic25Ref.current = null;
      triggerHapticImpact(Haptics.ImpactFeedbackStyle.Medium);
    }, 2500);
  };

  const handlePressOut = () => {
    if (!visible || isCompletingRef.current) return;
    if (holdTimerRef.current) {
      resetAfterRelease();
    }
  };

  if (!visible) {
    return null;
  }

  const ringOffset = (GLOW_WRAPPER - RING_SIZE) / 2;
  const circleOffset = (GLOW_WRAPPER - CIRCLE_SIZE) / 2;

  const instructionLine1 = isFa ? "نگه دار تا پیام امروزت رو ببینی" : "Press and hold";
  const keepLine = isFa ? "نفس عمیق بکش..." : "Take a deep breath...";

  return (
    <Reanimated.View
      pointerEvents="auto"
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          elevation: 9999,
          backgroundColor: "rgba(0, 0, 0, 0.45)",
        },
        rootOverlayStyle,
      ]}
    >
      <View style={{ flex: 1, width: "100%" }} pointerEvents="auto">
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            position: "absolute",
            top: 56,
            left: 20,
            zIndex: 10000,
            padding: 4,
          }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color="rgba(255,255,255,0.7)" />
        </Pressable>

        <View style={{ paddingTop: 80, paddingHorizontal: 24, alignItems: "center" }}>
          <Text
            style={{
              color: "#fff",
              fontSize: 13,
              opacity: 0.6,
              letterSpacing: 2,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {dateLine}
          </Text>
          <Text
            style={{
              color: "#fff",
              fontSize: 32,
              fontWeight: "300",
              textAlign: "center",
            }}
          >
            {greeting}
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: "flex-end", alignItems: "center", minHeight: 0 }}>
          <AnimatedText
            style={[
              {
                marginBottom: 24,
                fontSize: 15,
                color: "#fff",
                textAlign: "center",
                paddingHorizontal: 24,
              },
              keepLabelStyle,
            ]}
          >
            {keepLine}
          </AnimatedText>

          <View
            style={{
              width: GLOW_WRAPPER,
              height: GLOW_WRAPPER,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 32,
            }}
          >
            <Reanimated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  width: GLOW_WRAPPER,
                  height: GLOW_WRAPPER,
                  borderRadius: GLOW_WRAPPER / 2,
                  backgroundColor: "rgba(255, 220, 150, 0.35)",
                },
                glowStyle,
              ]}
            />

            <Svg
              width={RING_SIZE}
              height={RING_SIZE}
              style={{ position: "absolute", top: ringOffset, left: ringOffset }}
            >
              <G transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}>
                <AnimatedCircle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={RADIUS}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeLinecap="round"
                  animatedProps={ringAnimatedProps}
                />
              </G>
            </Svg>

            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={{
                position: "absolute",
                top: circleOffset,
                left: circleOffset,
                width: CIRCLE_SIZE,
                height: CIRCLE_SIZE,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Reanimated.View
                style={[
                  {
                    width: CIRCLE_SIZE,
                    height: CIRCLE_SIZE,
                    borderRadius: CIRCLE_SIZE / 2,
                    backgroundColor: "rgba(255, 255, 255, 0.06)",
                    borderWidth: 1.5,
                    borderColor: "rgba(255, 255, 255, 0.35)",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  },
                  circleAnimatedStyle,
                ]}
              >
                <Ionicons name="finger-print-outline" size={60} color="#FFFFFF" style={{ opacity: 0.45 }} />
              </Reanimated.View>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingBottom: 60, paddingHorizontal: 24, alignItems: "center" }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "700",
              color: "#fff",
              textAlign: "center",
            }}
          >
            {instructionLine1}
          </Text>
        </View>
      </View>
    </Reanimated.View>
  );
};
