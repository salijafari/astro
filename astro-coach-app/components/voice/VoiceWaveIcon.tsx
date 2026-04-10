/**
 * Sound-wave bars (conversation / voice control — not a dictation mic).
 * Uses Reanimated on all platforms (including web).
 */
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export type VoiceWaveIconProps = {
  active: boolean;
  busy?: boolean;
  color: string;
  size?: number;
};

const BASE_HEIGHTS = [8, 14, 20, 14, 8];
const DELAYS_MS = [0, 80, 160, 80, 0];

function WaveBar({
  baseHeight,
  delayMs,
  active,
  busy,
  color,
  maxHeight,
}: {
  baseHeight: number;
  delayMs: number;
  active: boolean;
  busy: boolean;
  color: string;
  maxHeight: number;
}) {
  const h = useSharedValue(baseHeight);

  useEffect(() => {
    cancelAnimation(h);
    if (active) {
      const t = setTimeout(() => {
        h.value = withRepeat(
          withSequence(
            withTiming(maxHeight, { duration: 280, easing: Easing.inOut(Easing.sin) }),
            withTiming(baseHeight * 0.4, { duration: 280, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        );
      }, delayMs);
      return () => clearTimeout(t);
    }
    if (busy) {
      h.value = withRepeat(
        withSequence(
          withTiming(baseHeight * 0.6, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(baseHeight, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
      return () => cancelAnimation(h);
    }
    h.value = withTiming(baseHeight, { duration: 200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared value `h` excluded
  }, [active, busy, baseHeight, delayMs, maxHeight]);

  const animStyle = useAnimatedStyle(() => ({
    height: h.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 3,
          borderRadius: 2,
          backgroundColor: color,
          opacity: active ? 1 : busy ? 0.6 : 0.45,
        },
        animStyle,
      ]}
    />
  );
}

export const VoiceWaveIcon = ({ active, busy = false, color, size = 24 }: VoiceWaveIconProps) => {
  const maxHeight = size * 0.95;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2, height: size }}>
      {BASE_HEIGHTS.map((h, i) => (
        <WaveBar
          key={i}
          baseHeight={(h / 20) * size}
          delayMs={DELAYS_MS[i] ?? 0}
          active={active}
          busy={busy}
          color={color}
          maxHeight={maxHeight}
        />
      ))}
    </View>
  );
};
