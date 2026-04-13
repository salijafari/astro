import { useEffect, useRef, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { FlippableCard } from "@/components/tarot/FlippableCard";
import { TarotCardImage } from "@/components/tarot/TarotCardImage";
import { getCardDisplay } from "@/data/tarot-deck-client";
import { useThemeColors } from "@/lib/themeColors";
import type { DrawnCardResult } from "@/types/tarot";

const CARD_W = 70;
const CARD_H = 105;
const CARD_W_LARGE = 140;
const CARD_H_LARGE = 210;
const MAX_ROTATION = 10;
const POP_DURATION = 250;
const AUTO_RETURN_MS = 2500;

const cardKey = (c: DrawnCardResult) => `${c.positionIndex}-${c.cardId}`;

const FA_POSITION_LABELS: Record<string, string> = {
  Past: "گذشته",
  Present: "حال",
  Future: "آینده",
  Challenge: "چالش",
  Advice: "راهنمایی",
  "Celtic Cross": "صلیب سلتی",
  Crossing: "تقاطع",
  Foundation: "پایه",
  "Recent Past": "گذشته نزدیک",
  "Near Future": "آینده نزدیک",
  Self: "خود",
  External: "محیط",
  Hopes: "امیدها",
  Outcome: "نتیجه",
};

export type TarotFanDisplayProps = {
  cards: DrawnCardResult[];
  flippedCards: Set<string>;
  onCardFlip: (key: string) => void;
  isRTL: boolean;
  language: string;
  depthLabel?: string;
};

export const TarotFanDisplay = ({
  cards,
  flippedCards,
  onCardFlip,
  isRTL,
  language,
  depthLabel,
}: TarotFanDisplayProps) => {
  const { width: windowWidth } = useWindowDimensions();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const langKey = language.startsWith("fa") ? "fa" : "en";

  const allFlipped = cards.every((c) => flippedCards.has(cardKey(c)));

  const [poppedKey, setPoppedKey] = useState<string | null>(null);
  const popAnim = useSharedValue(0);
  const autoReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalWidth = cards.length * CARD_W;
  const availableWidth = windowWidth - 32;
  const overlap =
    cards.length > 1 ? Math.max(0, (totalWidth - availableWidth) / (cards.length - 1)) : 0;
  const effectiveCardWidth = CARD_W - overlap;

  const getPosLabel = (card: DrawnCardResult): string => {
    if (depthLabel === "single") return t("tarot.present");
    const raw = card.positionLabel ?? "";
    if (language.startsWith("fa") && FA_POSITION_LABELS[raw]) {
      return FA_POSITION_LABELS[raw]!;
    }
    return raw;
  };

  const getCardName = (card: DrawnCardResult): string => {
    const display = getCardDisplay(card.cardId);
    if (!display) return card.cardId;
    const name = display.name;
    if (typeof name === "string") return name;
    return name[langKey] ?? name.en ?? card.cardId;
  };

  const popCard = (key: string) => {
    if (autoReturnTimer.current) {
      clearTimeout(autoReturnTimer.current);
      autoReturnTimer.current = null;
    }

    if (poppedKey === key) {
      popAnim.value = withTiming(0, { duration: POP_DURATION });
      setPoppedKey(null);
      return;
    }

    popAnim.value = withTiming(0, { duration: 150 }, (finished) => {
      if (!finished) return;
      runOnJS(setPoppedKey)(key);
      popAnim.value = withTiming(1, { duration: POP_DURATION });
    });

    autoReturnTimer.current = setTimeout(() => {
      popAnim.value = withTiming(0, { duration: POP_DURATION });
      setPoppedKey(null);
      autoReturnTimer.current = null;
    }, AUTO_RETURN_MS + POP_DURATION);
  };

  useEffect(() => {
    return () => {
      if (autoReturnTimer.current) clearTimeout(autoReturnTimer.current);
    };
  }, []);

  const poppedCard = poppedKey ? cards.find((c) => cardKey(c) === poppedKey) : null;

  const poppedStyle = useAnimatedStyle(() => ({
    opacity: popAnim.value,
    transform: [
      { translateY: interpolate(popAnim.value, [0, 1], [40, -20]) },
      { scale: interpolate(popAnim.value, [0, 1], [0.8, 1]) },
    ],
  }));

  const rowDir = isRTL ? "row-reverse" : "row";

  return (
    <View style={{ width: windowWidth - 32, alignSelf: "center" }}>
      {poppedCard ? (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: -(CARD_H_LARGE + 60),
              left: 0,
              right: 0,
              alignItems: "center",
              zIndex: 10,
            },
            poppedStyle,
          ]}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
            {getPosLabel(poppedCard)}
          </Text>
          <TarotCardImage
            cardId={poppedCard.cardId}
            isReversed={poppedCard.isReversed}
            showFront={true}
            size="large"
            lang={langKey}
          />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 14,
              fontWeight: "600",
              marginTop: 8,
              textAlign: "center",
            }}
          >
            {getCardName(poppedCard)}
          </Text>
        </Animated.View>
      ) : null}

      <View
        style={{
          flexDirection: rowDir,
          alignItems: "flex-end",
          height: CARD_H + 40,
          marginTop: poppedCard ? CARD_H_LARGE + 80 : 16,
        }}
      >
        {cards.map((card, i) => {
          const key = cardKey(card);
          const isFlipped = flippedCards.has(key);
          const isPopped = poppedKey === key;
          const rotation =
            cards.length > 1 ? -MAX_ROTATION + (i / (cards.length - 1)) * MAX_ROTATION * 2 : 0;
          const verticalOffset = Math.abs(rotation) * 1.5;
          return (
            <View
              key={key}
              style={{
                width: effectiveCardWidth,
                height: CARD_H + verticalOffset,
                alignItems: "center",
                justifyContent: "flex-end",
                ...(i === cards.length - 1 ? { width: CARD_W } : {}),
              }}
            >
              <Animated.View
                style={{
                  transform: [{ rotate: allFlipped ? `${rotation}deg` : "0deg" }],
                  opacity: isPopped ? 0.3 : 1,
                  zIndex: i,
                }}
              >
                <FlippableCard
                  cardId={card.cardId}
                  isReversed={card.isReversed}
                  isFlipped={isFlipped}
                  onFlip={() => onCardFlip(key)}
                  onTap={isFlipped ? () => popCard(key) : undefined}
                  size="small"
                  positionLabel={getPosLabel(card)}
                />
              </Animated.View>
            </View>
          );
        })}
      </View>

      {allFlipped ? (
        <View
          style={{
            flexDirection: rowDir,
            marginTop: 8,
          }}
        >
          {cards.map((card, i) => (
            <View
              key={cardKey(card)}
              style={{
                width: i === cards.length - 1 ? CARD_W : effectiveCardWidth,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 9,
                  textAlign: "center",
                }}
                numberOfLines={1}
              >
                {getPosLabel(card)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};
