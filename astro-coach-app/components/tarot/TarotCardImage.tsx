import { Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { getCardDisplay } from "@/data/tarot-deck-client";

type Size = "small" | "medium" | "large";

const SIZE_PX: Record<Size, { w: number; h: number }> = {
  small: { w: 60, h: 90 },
  medium: { w: 100, h: 150 },
  large: { w: 140, h: 210 },
};

type Props = {
  cardId: string;
  isReversed: boolean;
  showFront: boolean;
  size?: Size;
  lang: "en" | "fa";
};

/**
 * Placeholder tarot visuals (no remote images until assets exist). Y-axis flip when `showFront` becomes true.
 */
export function TarotCardImage({
  cardId,
  isReversed,
  showFront,
  size = "medium",
  lang,
}: Props) {
  const { w, h } = SIZE_PX[size];
  const flip = useSharedValue(0);

  useEffect(() => {
    flip.value = withTiming(showFront ? 1 : 0, { duration: 600 });
  }, [showFront, flip]);

  const card = getCardDisplay(cardId);
  const label = card ? (lang === "fa" ? card.name.fa : card.name.en) : cardId;

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    opacity: flip.value < 0.5 ? 1 : 0,
    zIndex: flip.value < 0.5 ? 2 : 0,
  }));

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    opacity: flip.value >= 0.5 ? 1 : 0,
    zIndex: flip.value >= 0.5 ? 2 : 0,
  }));

  return (
    <View style={{ width: w, height: h }}>
      <Animated.View
        className="absolute overflow-hidden rounded-xl border border-amber-600/50 bg-indigo-950"
        style={[{ width: w, height: h }, backStyle]}
      >
        <View className="flex-1 items-center justify-center px-1">
          <Text className="text-center text-lg text-amber-200/90">✦</Text>
          <Text className="mt-1 text-center text-[10px] text-slate-400">Akhtar</Text>
        </View>
      </Animated.View>
      <Animated.View
        className="absolute overflow-hidden rounded-xl border border-slate-600 bg-slate-900"
        style={[{ width: w, height: h }, frontStyle]}
      >
        <View className="flex-1 items-center justify-center px-1">
          <Text
            className="text-center text-xs font-medium leading-tight text-slate-100"
            style={{ transform: [{ rotate: isReversed ? "180deg" : "0deg" }] }}
          >
            {label}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
