import * as Haptics from "expo-haptics";
import { Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { TarotCardImage } from "@/components/tarot/TarotCardImage";
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

/**
 * Tappable tarot card: reveals face with flip animation (uses `TarotCardImage` + GCS art).
 */
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

  const handlePress = async () => {
    if (isFlipped || disabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFlip();
  };

  return (
    <View style={{ alignItems: "center" }}>
      <TouchableOpacity
        onPress={() => void handlePress()}
        disabled={disabled || isFlipped}
        activeOpacity={0.9}
        accessibilityRole="button"
        style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}
      >
        <TarotCardImage cardId={cardId} isReversed={isReversed} showFront={isFlipped} size={size} lang={lang} />
      </TouchableOpacity>
      {positionLabel && isFlipped ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 11,
            marginTop: 6,
            textAlign: "center",
            maxWidth: SIZES[size].width + 24,
          }}
        >
          {positionLabel}
        </Text>
      ) : null}
    </View>
  );
};
