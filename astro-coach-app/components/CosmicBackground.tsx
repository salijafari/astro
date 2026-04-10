import { LinearGradient } from "expo-linear-gradient";
import { useEffect, type FC, type ReactNode } from "react";
import type { ColorSchemeName, StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeSafeAreaViewProps } from "react-native-safe-area-context";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AURORA_BASE_DARK, AURORA_BASE_LIGHT, auroraCanvasBackground } from "@/lib/auroraPalette";
import { useTheme } from "@/providers/ThemeProvider";

export {
  AURORA_BASE_DARK,
  AURORA_BASE_LIGHT,
  auroraCanvasBackground,
  auroraRootBackground,
} from "@/lib/auroraPalette";

/** @deprecated Use `AURORA_BASE_DARK` or `auroraCanvasBackground`. */
export const AURORA_BASE = AURORA_BASE_DARK;

// 4 aurora colors to cycle through — one at a time
const DARK_COLORS = [
  "#0d3b2e", // deep emerald
  "#0f2a4a", // deep cobalt
  "#2d1047", // deep violet
  "#083d2a", // deep teal
] as const;

const LIGHT_COLORS = [
  "#9de8cc",
  "#a8c8f8",
  "#d4b8f8",
  "#8ee8d8",
] as const;

const DARK_BASE = AURORA_BASE_DARK;
const LIGHT_BASE = AURORA_BASE_LIGHT;

// How long each color stays at peak visibility
const HOLD_DURATION = 3000;
// How long to crossfade between colors
const FADE_DURATION = 4000;
// One full cycle = 4 colors × (fade in + hold + fade out)
const CYCLE = (FADE_DURATION + HOLD_DURATION + FADE_DURATION) * 4;

interface CrossfadeLayerProps {
  color: string;
  base: string;
  /** Offset in ms so this layer's peak is staggered from others */
  offset: number;
  startX: number;
  endX: number;
  /** Drift props */
  driftAmpX?: number;
  driftAmpY?: number;
  driftDurX?: number;
  driftDurY?: number;
  driftStartDelay?: number;
}

const CrossfadeLayer: FC<CrossfadeLayerProps> = ({
  color,
  base,
  offset,
  startX,
  endX,
  driftAmpX,
  driftAmpY,
  driftDurX,
  driftDurY,
  driftStartDelay = 0,
}) => {
  const opacity = useSharedValue(0);
  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);

  const driftEnabled =
    driftAmpX != null && driftAmpY != null && driftDurX != null && driftDurY != null;

  useEffect(() => {
    opacity.value = 0;
    // Each layer: fade in → hold → fade out → stay dark for the other 3 colors → repeat
    const hiddenDuration = CYCLE - FADE_DURATION - HOLD_DURATION - FADE_DURATION;
    opacity.value = withDelay(
      offset,
      withRepeat(
        withSequence(
          withTiming(0.75, { duration: FADE_DURATION, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.75, { duration: HOLD_DURATION }),
          withTiming(0, { duration: FADE_DURATION, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: hiddenDuration }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(opacity);
      opacity.value = 0;
    };
  }, [color, offset]);

  useEffect(() => {
    if (!driftEnabled) {
      driftX.value = 0;
      driftY.value = 0;
      return;
    }
    const ax = driftAmpX!;
    const ay = driftAmpY!;
    const ddx = driftDurX!;
    const ddy = driftDurY!;
    driftX.value = -ax;
    driftY.value = -ay;
    const t = setTimeout(() => {
      driftX.value = withRepeat(
        withTiming(ax, { duration: ddx, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
      driftY.value = withRepeat(
        withTiming(ay, { duration: ddy, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }, driftStartDelay);
    return () => {
      clearTimeout(t);
      cancelAnimation(driftX);
      cancelAnimation(driftY);
      driftX.value = 0;
      driftY.value = 0;
    };
  }, [driftEnabled, driftAmpX, driftAmpY, driftDurX, driftDurY, driftStartDelay]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: driftX.value }, { translateY: driftY.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, animStyle]} pointerEvents="none">
      <LinearGradient
        colors={[color, base]}
        start={{ x: startX, y: 0 }}
        end={{ x: endX, y: 0.65 }}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  );
};

export type CosmicBackgroundProps = {
  colorSchemeOverride?: ColorSchemeName | null;
  subtleDrift?: boolean;
};

export const CosmicBackground: FC<CosmicBackgroundProps> = ({
  colorSchemeOverride,
  subtleDrift = false,
}) => {
  const { isDark: prefIsDark } = useTheme();
  const isDark =
    colorSchemeOverride === "dark" ? true
    : colorSchemeOverride === "light" ? false
    : prefIsDark;

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  const base = isDark ? DARK_BASE : LIGHT_BASE;
  const bottomFade = isDark ? "rgba(6,8,15,0.65)" : "rgba(232,237,245,0.55)";

  // Each color is offset by one slot in the cycle
  const slotDuration = FADE_DURATION + HOLD_DURATION + FADE_DURATION;

  const driftProps = (index: number) =>
    subtleDrift
      ? {
          driftAmpX: [10, 8, 12, 7][index],
          driftAmpY: [8, 10, 7, 12][index],
          driftDurX: [18000, 21000, 19000, 20000][index],
          driftDurY: [22000, 16000, 24000, 18000][index],
          driftStartDelay: [0, 1500, 2800, 4000][index],
        }
      : {};

  const positions = [
    { startX: 0.1, endX: 0.6 },
    { startX: 0.5, endX: 1.0 },
    { startX: 0.2, endX: 0.8 },
    { startX: 0.6, endX: 0.1 },
  ];

  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: base },
        subtleDrift ? { overflow: "hidden" } : null,
      ]}
      pointerEvents="none"
    >
      {colors.map((color, i) => (
        <CrossfadeLayer
          key={color}
          color={color}
          base={base}
          offset={i * slotDuration}
          startX={positions[i]!.startX}
          endX={positions[i]!.endX}
          {...driftProps(i)}
        />
      ))}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient
          colors={["transparent", bottomFade]}
          start={{ x: 0.5, y: 0.25 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
    </View>
  );
};

export type AuroraSafeAreaProps = {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  edges?: NativeSafeAreaViewProps["edges"];
  colorSchemeOverride?: ColorSchemeName | null;
};

export const AuroraSafeArea: FC<AuroraSafeAreaProps> = ({
  children,
  className,
  style,
  edges,
  colorSchemeOverride,
}) => {
  const { isDark: prefIsDark } = useTheme();
  const isDark =
    colorSchemeOverride === "dark" ? true
    : colorSchemeOverride === "light" ? false
    : prefIsDark;
  const rootFill = auroraCanvasBackground(isDark);
  return (
    <SafeAreaView
      className={className}
      edges={edges}
      style={[{ flex: 1, backgroundColor: rootFill }, style]}
    >
      <CosmicBackground colorSchemeOverride={colorSchemeOverride} />
      {children}
    </SafeAreaView>
  );
};
