import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
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
  isFlipped: boolean; // controlled entirely by parent — single source of truth
  onFlip: () => void; // parent calls this; we fire it after animation begins
  onTap?: () => void;
  size: keyof typeof SIZES;
  positionLabel?: string;
  disabled?: boolean;
};

export const FlippableCard: React.FC<Props> = ({
  cardId,
  isReversed,
  isFlipped,
  onFlip,
  onTap,
  size,
  positionLabel,
  disabled,
}) => {
  const { i18n } = useTranslation();
  const colors = useThemeColors();
  const lang = i18n.language.startsWith("fa") ? "fa" : "en";
  const dim = SIZES[size];

  // Card lookup for name display during reveal
  const card = getCardDisplay(cardId);
  const cardName = card ? card.name[lang] : "";

  // Animation values — reset when cardId changes (new card at new depth)
  const rotation = useSharedValue(isFlipped ? 180 : 0);
  const scale = useSharedValue(1);
  const nameOpacity = useSharedValue(0);
  const labelOpacity = useSharedValue(isFlipped ? 1 : 0);

  // Track previous cardId to detect when a new card replaces this slot
  const prevCardId = useRef(cardId);

  useEffect(() => {
    if (prevCardId.current !== cardId) {
      // New card in this slot (depth expanded) — snap to unflipped state
      prevCardId.current = cardId;
      rotation.value = 0;
      scale.value = 1;
      nameOpacity.value = 0;
      labelOpacity.value = 0;
      return;
    }
    if (isFlipped) {
      // Already-flipped card (history mode or returning to screen) — snap, no animation
      rotation.value = 180;
      labelOpacity.value = 1;
      nameOpacity.value = 0;
      scale.value = 1;
    }
  }, [isFlipped, cardId]);

  const handlePress = async () => {
    if (disabled) return;
    if (isFlipped) {
      onTap?.();
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Notify parent immediately so state updates (phase transition logic runs)
    onFlip();

    // --- Visual sequence ---
    // 1. Card name fades in above + card scales up (0ms)
    nameOpacity.value = withTiming(1, { duration: 180 });
    scale.value = withTiming(1.22, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });

    // 2. Flip rotation starts at 180ms
    rotation.value = withDelay(
      180,
      withTiming(180, {
        duration: 580,
        easing: Easing.inOut(Easing.ease),
      }),
    );

    // 3. At 760ms: scale back to normal, name fades out, label fades in
    scale.value = withDelay(
      760,
      withTiming(1, { duration: 280, easing: Easing.in(Easing.ease) }),
    );
    nameOpacity.value = withDelay(760, withTiming(0, { duration: 200 }));
    labelOpacity.value = withDelay(
      820,
      withTiming(1, { duration: 250 }),
    );
  };

  // Back face: fully visible at 0°, invisible after 90°
  const backStyle = useAnimatedStyle(() => ({
    position: "absolute",
    opacity: interpolate(rotation.value, [0, 85, 90, 180], [1, 1, 0, 0]),
    transform: [
      { perspective: 800 },
      { rotateY: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  // Front face: invisible before 90°, fully visible at 180°
  const frontStyle = useAnimatedStyle(() => ({
    position: "absolute",
    opacity: interpolate(rotation.value, [0, 89, 90, 180], [0, 0, 1, 1]),
    transform: [
      { perspective: 800 },
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

  return (
    <View style={{ alignItems: "center" }}>
      {/* Card name — appears above during reveal, fades out after */}
      <Animated.View
        style={[
          nameStyle,
          {
            height: size === "small" ? 18 : 24,
            justifyContent: "center",
            marginBottom: 4,
            minWidth: dim.width,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={{
            color: "rgba(255, 191, 0, 0.95)",
            fontSize: size === "small" ? 10 : size === "medium" ? 12 : 15,
            fontWeight: "600",
            textAlign: "center",
            letterSpacing: 0.4,
          }}
        >
          {cardName}
        </Text>
      </Animated.View>

      {/* Card */}
      <TouchableOpacity
        onPress={() => void handlePress()}
        disabled={disabled}
        activeOpacity={isFlipped ? 0.7 : 0.85}
        accessibilityRole="button"
        style={{ width: dim.width, height: dim.height }}
      >
        <Animated.View style={[backStyle, { width: dim.width, height: dim.height }]}>
          <TarotCardImage
            cardId={cardId}
            isReversed={isReversed}
            showFront={false}
            size={size}
            lang={lang}
          />
        </Animated.View>

        <Animated.View style={[frontStyle, { width: dim.width, height: dim.height }]}>
          <TarotCardImage
            cardId={cardId}
            isReversed={isReversed}
            showFront={true}
            size={size}
            lang={lang}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Position label — fades in after reveal, stays */}
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
