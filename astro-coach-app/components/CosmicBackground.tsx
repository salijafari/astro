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

const DARK = {
  base: AURORA_BASE_DARK,
  aurora1: ["#0d3b2e", AURORA_BASE_DARK] as const,
  aurora2: ["#0f2a4a", AURORA_BASE_DARK] as const,
  aurora3: ["#2d1047", AURORA_BASE_DARK] as const,
  aurora4: ["#083d2a", AURORA_BASE_DARK] as const,
  bottomFade: "rgba(6,8,15,0.65)",
} as const;

const LIGHT = {
  base: AURORA_BASE_LIGHT,
  aurora1: ["#9de8cc", AURORA_BASE_LIGHT] as const,
  aurora2: ["#a8c8f8", AURORA_BASE_LIGHT] as const,
  aurora3: ["#d4b8f8", AURORA_BASE_LIGHT] as const,
  aurora4: ["#8ee8d8", AURORA_BASE_LIGHT] as const,
  bottomFade: "rgba(232,237,245,0.55)",
} as const;

interface AuroraLayerProps {
  colors: readonly [string, string];
  delay: number;
  duration: number;
  minOpacity: number;
  maxOpacity: number;
  startX: number;
  endX: number;
  /** Subtle positional drift (px); omit on all to disable. Dashboard-only enhancement. */
  driftAmpX?: number;
  driftAmpY?: number;
  driftDurX?: number;
  driftDurY?: number;
  driftStartDelay?: number;
}

const AuroraLayer: FC<AuroraLayerProps> = ({
  colors,
  delay,
  duration,
  minOpacity,
  maxOpacity,
  startX,
  endX,
  driftAmpX,
  driftAmpY,
  driftDurX,
  driftDurY,
  driftStartDelay = 0,
}) => {
  const opacity = useSharedValue(minOpacity);
  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);

  const driftEnabled =
    driftAmpX != null &&
    driftAmpY != null &&
    driftDurX != null &&
    driftDurY != null &&
    driftDurX > 0 &&
    driftDurY > 0;

  useEffect(() => {
    opacity.value = minOpacity;
    const timer = setTimeout(() => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(maxOpacity, {
            duration: duration * 0.4,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(minOpacity, {
            duration: duration * 0.6,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      );
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimation(opacity);
      opacity.value = minOpacity;
    };
  }, [colors, delay, duration, maxOpacity, minOpacity]);

  useEffect(() => {
    if (!driftEnabled) {
      cancelAnimation(driftX);
      cancelAnimation(driftY);
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
        withTiming(ax, {
          duration: ddx,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      );
      driftY.value = withRepeat(
        withTiming(ay, {
          duration: ddy,
          easing: Easing.inOut(Easing.sin),
        }),
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
        colors={[colors[0], colors[1]]}
        start={{ x: startX, y: 0 }}
        end={{ x: endX, y: 0.65 }}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  );
};

export type CosmicBackgroundProps = {
  colorSchemeOverride?: ColorSchemeName | null;
  /** Very slow sub-pixel-style drift on aurora layers (home / dashboard only). */
  subtleDrift?: boolean;
};

/** Aurora canvas follows in-app appearance unless `colorSchemeOverride` is set. */
export const CosmicBackground: FC<CosmicBackgroundProps> = ({
  colorSchemeOverride,
  subtleDrift = false,
}) => {
  const { isDark: prefIsDark } = useTheme();
  const isDark =
    colorSchemeOverride === "dark" ? true : colorSchemeOverride === "light" ? false : prefIsDark;
  const palette = isDark ? DARK : LIGHT;

  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: palette.base },
        subtleDrift ? { overflow: "hidden" } : null,
      ]}
      pointerEvents="none"
    >
      <AuroraLayer
        colors={palette.aurora1}
        delay={0}
        duration={14000}
        minOpacity={isDark ? 0.4 : 0.52}
        maxOpacity={isDark ? 0.75 : 0.9}
        startX={0}
        endX={0.5}
        {...(subtleDrift
          ? {
              driftAmpX: 10,
              driftAmpY: 8,
              driftDurX: 18000,
              driftDurY: 22000,
              driftStartDelay: 0,
            }
          : {})}
      />
      <AuroraLayer
        colors={palette.aurora2}
        delay={3000}
        duration={18000}
        minOpacity={isDark ? 0.28 : 0.38}
        maxOpacity={isDark ? 0.62 : 0.8}
        startX={0.5}
        endX={1}
        {...(subtleDrift
          ? {
              driftAmpX: 8,
              driftAmpY: 10,
              driftDurX: 21000,
              driftDurY: 16000,
              driftStartDelay: 1500,
            }
          : {})}
      />
      <AuroraLayer
        colors={palette.aurora3}
        delay={7000}
        duration={22000}
        minOpacity={isDark ? 0.18 : 0.28}
        maxOpacity={isDark ? 0.52 : 0.72}
        startX={0.2}
        endX={0.8}
        {...(subtleDrift
          ? {
              driftAmpX: 12,
              driftAmpY: 7,
              driftDurX: 19000,
              driftDurY: 24000,
              driftStartDelay: 2800,
            }
          : {})}
      />
      <AuroraLayer
        colors={palette.aurora4}
        delay={11000}
        duration={16000}
        minOpacity={isDark ? 0.15 : 0.22}
        maxOpacity={isDark ? 0.45 : 0.65}
        startX={0.6}
        endX={0.1}
        {...(subtleDrift
          ? {
              driftAmpX: 7,
              driftAmpY: 12,
              driftDurX: 20000,
              driftDurY: 18000,
              driftStartDelay: 4000,
            }
          : {})}
      />

      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient
          colors={["transparent", palette.bottomFade]}
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
    colorSchemeOverride === "dark" ? true : colorSchemeOverride === "light" ? false : prefIsDark;
  const rootFill = auroraCanvasBackground(isDark);
  return (
    <SafeAreaView className={className} edges={edges} style={[{ flex: 1, backgroundColor: rootFill }, style]}>
      <CosmicBackground colorSchemeOverride={colorSchemeOverride} />
      {children}
    </SafeAreaView>
  );
};
