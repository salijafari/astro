import { Image } from "expo-image";
import { Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { cardIdToImageUrl, cardIdToThumbUrl } from "@/data/tarot-deck-client";

/** Layout footprint for the flip animation container. */
type LayoutSize = "small" | "medium" | "large";

const SIZES = {
  small: { width: 60, height: 90, symbol: 16, name: 8, arcana: 7 },
  medium: { width: 100, height: 150, symbol: 32, name: 11, arcana: 9 },
  large: { width: 140, height: 210, symbol: 46, name: 14, arcana: 11 },
} as const;

type Props = {
  cardId: string;
  isReversed: boolean;
  showFront: boolean;
  /** Pixel layout for the card frame (fan vs single-card). */
  size?: LayoutSize;
  /** GCS asset resolution: thumbnails for dense fans, full for large single views. */
  resolution?: "thumb" | "full";
  lang: "en" | "fa";
};

/**
 * Rider–Waite card art from GCS; Y-axis flip when `showFront` becomes true.
 */
export function TarotCardImage({
  cardId,
  isReversed,
  showFront,
  size = "medium",
  resolution = "full",
  lang: _lang,
}: Props) {
  const dim = SIZES[size];
  const flip = useSharedValue(0);

  useEffect(() => {
    flip.value = withTiming(showFront ? 1 : 0, { duration: 600 });
  }, [showFront, flip]);

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
        {/* Real card image from GCS */}
        <Image
          source={{
            uri: resolution === "thumb" ? cardIdToThumbUrl(cardId) : cardIdToImageUrl(cardId),
          }}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 8,
          }}
          contentFit="cover"
          transition={300}
          placeholder={{ blurhash: "LGFFaXYk^6#M@-5c,1J5@[or[Q6." }}
        />
        {isReversed ? (
          <View
            style={{
              position: "absolute",
              bottom: 6,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#f87171",
                fontSize: dim.arcana,
                textAlign: "center",
                backgroundColor: "rgba(0,0,0,0.6)",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              ⟳ Reversed
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}
