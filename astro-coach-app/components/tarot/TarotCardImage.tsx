import { Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { getCardById, getCardDisplay } from "@/data/tarot-deck-client";

type Size = "small" | "medium" | "large";

const SIZE_PX: Record<Size, { w: number; h: number }> = {
  small: { w: 60, h: 90 },
  medium: { w: 100, h: 150 },
  large: { w: 140, h: 210 },
};

/** Font sizes scale with card size (NativeWind arbitrary text-[Npx]). */
const FONT: Record<
  Size,
  { symbol: string; name: string; arcana: string; reversed: string }
> = {
  small: {
    symbol: "text-[16px]",
    name: "text-[8px]",
    arcana: "text-[7px]",
    reversed: "text-[6px]",
  },
  medium: {
    symbol: "text-[28px]",
    name: "text-[11px]",
    arcana: "text-[9px]",
    reversed: "text-[8px]",
  },
  large: {
    symbol: "text-[40px]",
    name: "text-[14px]",
    arcana: "text-[11px]",
    reversed: "text-[9px]",
  },
};

/** Indices 0–21 for major-00 … major-21 */
const ROMAN_MAJOR: string[] = [
  "0",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
  "XXI",
];

/**
 * Roman numeral (or "0") for major arcana index 0–21.
 */
const toRoman = (n: number): string => {
  if (n >= 0 && n <= 21) {
    return ROMAN_MAJOR[n] ?? String(n);
  }
  return String(n);
};

const getMajorIndexFromId = (id: string): number | null => {
  const m = id.match(/^major-(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
};

type SuitKey = "cups" | "wands" | "swords" | "pentacles";

const SUIT_TOP: Record<SuitKey, string> = {
  cups: "♥",
  wands: "♦",
  swords: "♠",
  pentacles: "✦",
};

const inferSuitFromId = (id: string): SuitKey | undefined => {
  if (id.includes("cups")) return "cups";
  if (id.includes("wands")) return "wands";
  if (id.includes("swords")) return "swords";
  if (id.includes("pentacles")) return "pentacles";
  return undefined;
};

const centerSymbolForCard = (
  arcana: "major" | "minor",
  suit: SuitKey | undefined,
): string => {
  if (arcana === "major") return "✦";
  switch (suit) {
    case "cups":
      return "♥";
    case "wands":
      return "♦";
    case "swords":
      return "♠";
    case "pentacles":
      return "✦";
    default:
      return "✦";
  }
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
  const { w, h } = SIZE_PX[size];
  const flip = useSharedValue(0);

  useEffect(() => {
    flip.value = withTiming(showFront ? 1 : 0, { duration: 600 });
  }, [showFront, flip]);

  const display = getCardDisplay(cardId);
  const full = getCardById(cardId);
  const label = display
    ? lang === "fa"
      ? display.name.fa
      : display.name.en
    : full
      ? lang === "fa"
        ? full.name.fa
        : full.name.en
      : cardId;

  const arcana = full?.arcana ?? (cardId.startsWith("major") ? "major" : "minor");
  const suit = full?.suit ?? inferSuitFromId(cardId);

  const majorIdx = getMajorIndexFromId(cardId);
  const topLine =
    arcana === "major" && majorIdx !== null
      ? toRoman(majorIdx)
      : suit
        ? SUIT_TOP[suit]
        : "—";

  const centerGlyph = centerSymbolForCard(arcana, suit);

  const f = FONT[size];

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
        className="absolute overflow-hidden rounded-xl border border-amber-500/30"
        style={[{ width: w, height: h }, frontStyle]}
      >
        <LinearGradient
          colors={["#0f172a", "#1e1b4b"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ flex: 1, borderRadius: 12 }}
        >
          <View className="flex-1 px-1 pt-0.5 pb-1">
            <Text className={`text-center ${f.arcana} text-slate-400`}>{topLine}</Text>
            <View className="min-h-0 flex-1 items-center justify-center">
              <Text className={`${f.symbol} text-amber-500/80`}>{centerGlyph}</Text>
            </View>
            <Text
              numberOfLines={2}
              className={`text-center font-medium leading-tight text-white ${f.name}`}
            >
              {label}
            </Text>
            {isReversed ? (
              <Text className={`mt-0.5 text-center ${f.reversed} text-[#f87171]`}>⟳ Reversed</Text>
            ) : null}
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}
