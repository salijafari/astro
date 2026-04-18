/**
 * Full-screen planetary aurora background (design system §6).
 * Uses react-native-reanimated only — no core Animated API.
 */
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  DURATION,
  PLANET_PALETTE,
  type PlanetName,
} from "@/constants";

/** Numeric lifecycle motion — DS tokens AURORA_MOTION use multipliers, not durations; values per redesign spec. */
const LIFECYCLE_ANIM_MS = {
  approaching: 13_000,
  applying: 9_400,
  peak: 8_000,
  separating: 11_400,
  fading: 20_000,
} as const;

const LIFECYCLE_AMPLITUDE = {
  approaching: 30,
  applying: 26,
  peak: 28,
  separating: 22,
  fading: 16,
} as const;

export type PlanetaryAuroraLifecycle =
  | "approaching"
  | "applying"
  | "peak"
  | "separating"
  | "fading";

export interface PlanetaryAuroraProps {
  planet: PlanetName;
  lifecycle: PlanetaryAuroraLifecycle;
  aspectKind: "hard" | "soft";
  isStill: boolean;
  opacity?: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

function rgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function cycleDurationMs(lifecycle: PlanetaryAuroraLifecycle, aspectKind: "hard" | "soft"): number {
  let d = LIFECYCLE_ANIM_MS[lifecycle];
  if (aspectKind === "hard") d *= 0.87;
  else d *= 1.1;
  return Math.round(d);
}

export const PlanetaryAurora: React.FC<PlanetaryAuroraProps> = ({
  planet,
  lifecycle,
  aspectKind,
  isStill,
  opacity = 1,
}) => {
  const { width: W, height: H } = Dimensions.get("window");
  const palette = PLANET_PALETTE[planet] ?? PLANET_PALETTE.Moon;

  const txMid = useSharedValue(0);
  const tyGlow = useSharedValue(0);
  const rotGlow = useSharedValue(0);
  const pulse = useSharedValue(1);

  const dur = cycleDurationMs(lifecycle, aspectKind);
  const ampMid = LIFECYCLE_AMPLITUDE[lifecycle];
  const ampGlow = Math.round(ampMid * 0.65);

  const easeStill = Easing.bezier(0.25, 0.1, 0.25, 1);

  useEffect(() => {
    if (isStill) {
      cancelAnimation(txMid);
      cancelAnimation(tyGlow);
      cancelAnimation(rotGlow);
      cancelAnimation(pulse);
      txMid.value = withTiming(0, { duration: DURATION.auroraStill, easing: easeStill });
      tyGlow.value = withTiming(0, { duration: DURATION.auroraStill, easing: easeStill });
      rotGlow.value = withTiming(0, { duration: DURATION.auroraStill, easing: easeStill });
      pulse.value = withTiming(1, { duration: DURATION.auroraStill, easing: easeStill });
      return;
    }

    cancelAnimation(pulse);
    if (lifecycle !== "peak") {
      pulse.value = 1;
    }

    const half = dur / 2;
    txMid.value = withRepeat(
      withSequence(
        withTiming(ampMid, { duration: half, easing: Easing.inOut(Easing.sin) }),
        withTiming(-ampMid, { duration: half, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    tyGlow.value = withRepeat(
      withSequence(
        withTiming(-ampGlow, { duration: half * 1.1, easing: Easing.inOut(Easing.sin) }),
        withTiming(ampGlow, { duration: half * 1.1, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    rotGlow.value = withRepeat(
      withSequence(
        withTiming(3, { duration: dur * 0.8, easing: Easing.inOut(Easing.sin) }),
        withTiming(-3, { duration: dur * 0.8, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    if (lifecycle === "peak") {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.85, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = 1;
    }
  }, [planet, lifecycle, aspectKind, isStill, dur, ampMid, ampGlow, txMid, tyGlow, rotGlow, pulse]);

  const midStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: txMid.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.4 * pulse.value,
    transform: [{ translateY: tyGlow.value }, { rotate: `${rotGlow.value}deg` }],
  }));

  const midGradientColors = [
    rgba(palette.mid, 0),
    rgba(palette.mid, 0.45),
    rgba(palette.mid, 0),
  ] as const;

  const glowGradientColors = [
    rgba(palette.glow, 0),
    rgba(palette.glow, 0.55),
    rgba(palette.glow, 0),
  ] as const;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.root, { opacity }]}
    >
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.deep }]} />

      <Animated.View
        style={[
          {
            position: "absolute",
            width: W * 1.5,
            height: H * 0.55,
            left: -W * 0.25,
            top: H * 0.22,
          },
          midStyle,
        ]}
      >
        <LinearGradient
          colors={[...midGradientColors]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <Animated.View
        style={[
          {
            position: "absolute",
            width: W * 0.85,
            height: H * 0.38,
            left: W * 0.08,
            bottom: H * 0.08,
          },
          glowStyle,
        ]}
      >
        <LinearGradient
          colors={[...glowGradientColors]}
          locations={[0.15, 0.5, 0.85]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    zIndex: 0,
  },
});
