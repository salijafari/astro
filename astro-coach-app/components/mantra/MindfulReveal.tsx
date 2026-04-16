import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, Text, View } from "react-native";
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
const RING_SIZE = 180;
const RADIUS = 87;
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

/**
 * Full-screen press-and-hold breathing interaction before showing the daily mantra.
 */
export const MindfulReveal: React.FC<MindfulRevealProps> = ({
  visible,
  onRevealComplete,
}) => {
  console.log("[MindfulReveal DEBUG] rendered with visible:", visible);

  const { t } = useTranslation();

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const haptic1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const haptic25Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progressAnim = useSharedValue(0);
  const pulsePhase = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const keepLabelOpacity = useSharedValue(0);
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
    pulsePhase.value = 0;
    progressAnim.value = withTiming(0, { duration: 300 });
    ringOpacity.value = withTiming(0, { duration: 200 });
    keepLabelOpacity.value = withTiming(0, { duration: 150 });
    circleScale.value = withTiming(1, { duration: 200 });
    triggerHapticImpact(Haptics.ImpactFeedbackStyle.Light);
  }, [clearHoldTimers, circleScale, keepLabelOpacity, progressAnim, pulsePhase, ringOpacity]);

  const runCompletionSequence = useCallback(() => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    clearHoldTimers();
    cancelAnimation(pulsePhase);
    cancelAnimation(progressAnim);
    triggerHapticSuccess();

    circleScale.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
    overlayOpacity.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) });

    if (completionRef.current) clearTimeout(completionRef.current);
    completionRef.current = setTimeout(() => {
      completionRef.current = null;
      onRevealCompleteRef.current();
      isCompletingRef.current = false;
    }, 600);
  }, [clearHoldTimers, circleScale, overlayOpacity, progressAnim, pulsePhase]);

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
      progressAnim.value = 0;
      pulsePhase.value = 0;
      ringOpacity.value = 0;
      keepLabelOpacity.value = 0;
      circleScale.value = 1;
      overlayOpacity.value = 1;
    }
  }, [visible, clearHoldTimers, progressAnim, pulsePhase, ringOpacity, keepLabelOpacity, circleScale, overlayOpacity]);

  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progressAnim.value),
    opacity: ringOpacity.value,
  }));

  const circleAnimatedStyle = useAnimatedStyle(() => {
    const bgAlpha = 0.08 + pulsePhase.value * 0.1;
    const breathScale = circleScale.value * (1 + pulsePhase.value * 0.08);
    return {
      transform: [{ scale: breathScale }],
      backgroundColor: `rgba(255, 255, 255, ${bgAlpha})`,
    };
  });

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
      keepLabelOpacity.value = withTiming(0.8, { duration: 300 });
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
          zIndex: 100,
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          alignItems: "center",
          justifyContent: "center",
        },
        rootOverlayStyle,
      ]}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 16,
          opacity: 0.7,
          marginBottom: 40,
          textAlign: "center",
          paddingHorizontal: 24,
        }}
      >
        {t("mantra.mindfulBreathHint")}
      </Text>

      <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" }}>
        <Svg
          width={RING_SIZE}
          height={RING_SIZE}
          style={{ position: "absolute" }}
        >
          <G transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}>
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke="#FFFFFF"
              strokeWidth={3}
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
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          <Reanimated.View
            style={[
              {
                width: CIRCLE_SIZE,
                height: CIRCLE_SIZE,
                borderRadius: CIRCLE_SIZE / 2,
                borderWidth: 2,
                borderColor: "rgba(255, 255, 255, 0.3)",
                alignItems: "center",
                justifyContent: "center",
              },
              circleAnimatedStyle,
            ]}
          >
            <Ionicons name="finger-print-outline" size={64} color="#FFFFFF" style={{ opacity: 0.5 }} />
          </Reanimated.View>
        </Pressable>
      </View>

      <AnimatedText
        style={[
          {
            marginTop: 24,
            color: "#fff",
            fontSize: 14,
            textAlign: "center",
          },
          keepLabelStyle,
        ]}
      >
        {t("mantra.mindfulKeepHolding")}
      </AnimatedText>
    </Reanimated.View>
  );
};
