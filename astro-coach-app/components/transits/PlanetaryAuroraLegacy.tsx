/**
 * Thin animated aurora ribbon tinted by the dominant transit color (Reanimated + expo-linear-gradient).
 */
import { LinearGradient } from "expo-linear-gradient";
import type { FC } from "react";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { planetaryAuroraStops } from "@/lib/auroraPalette";

type PlanetaryAuroraRibbonProps = {
  accentHex: string;
  isDark: boolean;
  /** Visible band height (default 52pt, ≥ touch area comfort). */
  barHeight?: number;
};

const DRIFT = 22;

/** @deprecated Prefer `components/aurora/PlanetaryAurora` (full-screen DS aurora). */
export const PlanetaryAuroraLegacy: FC<PlanetaryAuroraRibbonProps> = ({
  accentHex,
  isDark,
  barHeight = 52,
}) => {
  const tx = useSharedValue(0);

  useEffect(() => {
    tx.value = 0;
    tx.value = withRepeat(
      withSequence(
        withTiming(DRIFT, { duration: 8_000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-DRIFT, { duration: 8_000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [accentHex, tx]);

  const drift = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  const stops = planetaryAuroraStops(accentHex, isDark);

  return (
    <View
      className="mx-4 mt-2 overflow-hidden rounded-xl"
      style={{ height: barHeight }}
      accessibilityRole="none"
    >
      <Animated.View
        style={[
          { width: "200%", height: "100%", marginLeft: "-50%" },
          drift,
        ]}
      >
        <LinearGradient
          colors={[...stops]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, width: "100%" }}
        />
      </Animated.View>
      <View
        pointerEvents="none"
        className="absolute inset-0 rounded-xl bg-black"
        style={{ opacity: isDark ? 0.06 : 0.03 }}
      />
    </View>
  );
};
