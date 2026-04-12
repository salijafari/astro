import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TarotCardImage } from "@/components/tarot/TarotCardImage";
import { getCardDisplay } from "@/data/tarot-deck-client";
import { useThemeColors } from "@/lib/themeColors";

const SIZES = {
  small: { width: 60, height: 90 },
  medium: { width: 100, height: 150 },
  large: { width: 140, height: 210 },
} as const;

type Props = {
  cardId: string;
  isReversed: boolean;
  isFlipped: boolean;
  onFlip: () => void;
  size: keyof typeof SIZES;
  positionLabel?: string;
  disabled?: boolean;
};

export const FlippableCard: React.FC<Props> = ({
  cardId,
  isReversed,
  isFlipped,
  onFlip,
  size,
  positionLabel,
  disabled,
}) => {
  const { i18n } = useTranslation();
  const colors = useThemeColors();
  const lang = i18n.language.startsWith("fa") ? "fa" : "en";
  const card = getCardDisplay(cardId);
  const cardName = card ? card.name[lang] : cardId;

  // Animation values
  const rotation = useSharedValue(isFlipped ? 180 : 0);
  const scale = useSharedValue(1);
  const nameOpacity = useSharedValue(0);
  const labelOpacity = useSharedValue(isFlipped ? 1 : 0);
  const [hasAnimated, setHasAnimated] = useState(false);

  // If card arrives already flipped (history mode or re-render),
  // snap to final state with no animation
  useEffect(() => {
    if (isFlipped && !hasAnimated) {
      rotation.value = 180;
      labelOpacity.value = 1;
      nameOpacity.value = 0;
      scale.value = 1;
      setHasAnimated(true);
    }
  }, [isFlipped, hasAnimated]);

  const handlePress = async () => {
    if (isFlipped || disabled || hasAnimated) return;
    setHasAnimated(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // 1. Card name fades in + card scales up (simultaneously)
    nameOpacity.value = withTiming(1, { duration: 200 });
    scale.value = withTiming(1.25, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });

    // 2. After 180ms: flip begins
    rotation.value = withDelay(
      180,
      withTiming(180, {
        duration: 600,
        easing: Easing.inOut(Easing.ease),
      }),
    );

    // 3. After 780ms (180 + 600): scale back down, name fades out,
    //    position label fades in, call onFlip
    scale.value = withDelay(
      780,
      withTiming(1.0, {
        duration: 300,
        easing: Easing.in(Easing.ease),
      }),
    );
    nameOpacity.value = withDelay(
      780,
      withTiming(0, { duration: 200 }),
    );
    labelOpacity.value = withDelay(
      850,
      withTiming(1, { duration: 250 }),
    );

    // Call onFlip when scale-down begins
    setTimeout(() => {
      onFlip();
    }, 780);
  };

  // Back face: visible when rotation < 90
  const backStyle = useAnimatedStyle(() => ({
    position: "absolute",
    opacity: interpolate(rotation.value, [0, 85, 90, 180], [1, 1, 0, 0]),
    transform: [{ rotateY: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  // Front face: visible when rotation > 90
  const frontStyle = useAnimatedStyle(() => ({
    position: "absolute",
    opacity: interpolate(rotation.value, [0, 89, 90, 180], [0, 0, 1, 1]),
    // Counter-rotate text so it reads correctly after Y flip
    transform: [
      { rotateY: `${rotation.value - 180}deg` },
      { scale: scale.value },
    ],
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  const dim = SIZES[size];

  return (
    <View style={{ alignItems: "center" }}>
      {/* Card name — appears above card during reveal, disappears after */}
      <Animated.View
        style={[
          nameStyle,
          {
            height: 28,
            justifyContent: "center",
            marginBottom: 6,
          },
        ]}
      >
        <Text
          style={{
            color: "rgba(255, 191, 0, 0.9)",
            fontSize: size === "small" ? 11 : 14,
            fontWeight: "600",
            textAlign: "center",
            letterSpacing: 0.5,
          }}
        >
          {cardName}
        </Text>
      </Animated.View>

      {/* Card container */}
      <TouchableOpacity
        onPress={() => void handlePress()}
        disabled={disabled || isFlipped}
        activeOpacity={isFlipped ? 1 : 0.85}
        accessibilityRole="button"
        style={{
          width: dim.width,
          height: dim.height,
        }}
      >
        {/* Back face */}
        <Animated.View style={backStyle}>
          <TarotCardImage
            cardId={cardId}
            isReversed={isReversed}
            showFront={false}
            size={size}
            lang={lang}
          />
        </Animated.View>

        {/* Front face */}
        <Animated.View style={frontStyle}>
          <TarotCardImage
            cardId={cardId}
            isReversed={isReversed}
            showFront={true}
            size={size}
            lang={lang}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Position label — fades in after reveal, stays permanently */}
      {positionLabel ? (
        <Animated.View style={[labelStyle, { marginTop: 6 }]}>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              textAlign: "center",
              maxWidth: dim.width + 24,
            }}
          >
            {positionLabel}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
};
