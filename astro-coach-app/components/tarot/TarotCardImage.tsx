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

const SIZES = {
  small: { width: 60, height: 90, symbol: 16, name: 8, arcana: 7 },
  medium: { width: 100, height: 150, symbol: 32, name: 11, arcana: 9 },
  large: { width: 140, height: 210, symbol: 46, name: 14, arcana: 11 },
} as const;

/**
 * Standard Roman numerals for 1–21; major arcana index 0 renders as "0".
 */
function toRoman(n: number): string {
  if (n === 0) return "0";
  const vals: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remainder = n;
  let result = "";
  while (remainder > 0) {
    for (const [value, numeral] of vals) {
      if (remainder >= value) {
        result += numeral;
        remainder -= value;
        break;
      }
    }
  }
  return result || String(n);
}

const getMajorIndexFromId = (id: string): number | null => {
  const m = id.match(/^major-(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
};

const topGlyphFromCardId = (cardId: string): string => {
  if (cardId.startsWith("major")) {
    const idx = getMajorIndexFromId(cardId);
    return idx !== null ? toRoman(idx) : "—";
  }
  if (cardId.includes("cups")) return "♥";
  if (cardId.includes("wands")) return "♦";
  if (cardId.includes("swords")) return "♠";
  if (cardId.includes("pentacles")) return "✧";
  return "—";
};

const centerGlyphFromCardId = (cardId: string): string => {
  if (cardId.startsWith("major")) return "✦";
  if (cardId.includes("cups")) return "♥";
  if (cardId.includes("wands")) return "♦";
  if (cardId.includes("swords")) return "♠";
  if (cardId.includes("pentacles")) return "✧";
  return "✦";
};

type Props = {
  cardId: string;
  isReversed: boolean;
  showFront: boolean;
  size?: Size;
  lang: "en" | "fa";
};

/**
 * Placeholder tarot visuals (no bundled images). Y-axis flip when `showFront` becomes true.
 */
export function TarotCardImage({
  cardId,
  isReversed,
  showFront,
  size = "medium",
  lang,
}: Props) {
  const dim = SIZES[size];
  const flip = useSharedValue(0);

  useEffect(() => {
    flip.value = withTiming(showFront ? 1 : 0, { duration: 600 });
  }, [showFront, flip]);

  const display = getCardDisplay(cardId);
  const cardName =
    display != null ? (lang === "fa" ? display.name.fa : display.name.en) : cardId;

  const topLine = topGlyphFromCardId(cardId);
  const centerGlyph = centerGlyphFromCardId(cardId);

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

  const faceDims = {
    position: "absolute" as const,
    left: 0,
    top: 0,
    width: dim.width,
    height: dim.height,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    overflow: "hidden" as const,
  };

  const backFace = {
    ...faceDims,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const frontFace = {
    ...faceDims,
    padding: 6,
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  };

  return (
    <View style={{ width: dim.width, height: dim.height, position: "relative" }}>
      <Animated.View style={[backFace, backStyle]}>
        <Text style={{ color: "#f59e0b", fontSize: dim.symbol, textAlign: "center" }}>✦</Text>
        <Text
          style={{
            marginTop: 4,
            color: "rgba(255,255,255,0.5)",
            fontSize: dim.arcana,
            textAlign: "center",
          }}
        >
          Akhtar
        </Text>
      </Animated.View>
      <Animated.View style={[frontFace, frontStyle]}>
        <Text
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: dim.arcana,
            textAlign: "center",
          }}
        >
          {topLine}
        </Text>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", width: "100%" }}>
          <Text style={{ color: "#f59e0b", fontSize: dim.symbol, textAlign: "center" }}>
            {centerGlyph}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              marginTop: 4,
              color: "white",
              fontSize: dim.name,
              textAlign: "center",
            }}
          >
            {cardName}
          </Text>
        </View>
        {isReversed ? (
          <Text style={{ color: "#f87171", fontSize: dim.arcana, textAlign: "center" }}>⟳ Reversed</Text>
        ) : null}
      </Animated.View>
    </View>
  );
}
