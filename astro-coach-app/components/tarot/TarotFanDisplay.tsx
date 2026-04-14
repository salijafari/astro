import { useEffect, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import { FlippableCard } from "@/components/tarot/FlippableCard";
import type { DrawnCardResult } from "@/types/tarot";

// Card dimensions in the fan — larger than before for better readability
const CARD_W = 90;
const CARD_H = 135;
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
  "Your Inner World": "دنیای درونی",
  "Final Outcome": "نتیجه نهایی",
};

export type TarotFanDisplayProps = {
  cards: DrawnCardResult[];
  flippedCards: Set<string>;
  onCardFlip: (key: string) => void;
  isRTL: boolean;
  language: string;
  depthLabel?: string;
  /** Called when a card is popped or un-popped. Parent renders the overlay. */
  onPoppedCardChange: (card: DrawnCardResult | null) => void;
};

export const TarotFanDisplay = ({
  cards,
  flippedCards,
  onCardFlip,
  isRTL,
  language,
  depthLabel,
  onPoppedCardChange,
}: TarotFanDisplayProps) => {
  const { width: windowWidth } = useWindowDimensions();
  const { t } = useTranslation();
  const isSingle = cards.length === 1;
  const [poppedKey, setPoppedKey] = useState<string | null>(null);
  const autoReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute overlap so all cards fit within screen width
  const availableWidth = windowWidth - 48;
  const totalNaturalWidth = cards.length * CARD_W;
  const overlap =
    cards.length > 1
      ? Math.max(0, (totalNaturalWidth - availableWidth) / (cards.length - 1))
      : 0;
  const effectiveCardWidth = CARD_W - overlap;

  const getPosLabel = (card: DrawnCardResult): string => {
    if (depthLabel === "single") return t("tarot.present");
    const raw = card.positionLabel ?? "";
    if (language.startsWith("fa") && FA_POSITION_LABELS[raw]) {
      return FA_POSITION_LABELS[raw]!;
    }
    return raw;
  };

  const clearTimer = () => {
    if (autoReturnTimer.current) {
      clearTimeout(autoReturnTimer.current);
      autoReturnTimer.current = null;
    }
  };

  const popCard = (key: string) => {
    clearTimer();
    if (poppedKey === key) {
      // Same card tapped — return it
      setPoppedKey(null);
      onPoppedCardChange(null);
      return;
    }
    // New card tapped — switch immediately
    const card = cards.find((c) => cardKey(c) === key) ?? null;
    setPoppedKey(key);
    onPoppedCardChange(card);
    // Auto-return after 2.5 seconds
    autoReturnTimer.current = setTimeout(() => {
      setPoppedKey(null);
      onPoppedCardChange(null);
      autoReturnTimer.current = null;
    }, AUTO_RETURN_MS);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimer();
  }, []);

  // When cards change (depth change), clear any popped state
  useEffect(() => {
    clearTimer();
    setPoppedKey(null);
    onPoppedCardChange(null);
  }, [depthLabel]);

  const rowDir = isRTL ? "row-reverse" : "row";

  // SINGLE CARD: centered, large, no fan logic
  if (isSingle) {
    const card = cards[0]!;
    const key = cardKey(card);
    const isFlipped = flippedCards.has(key);
    const isPopped = poppedKey === key;
    return (
      <View style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 24,
        opacity: isPopped ? 0.3 : 1,
      }}>
        <FlippableCard
          cardId={card.cardId}
          isReversed={card.isReversed}
          isFlipped={isFlipped}
          onFlip={() => onCardFlip(key)}
          onTap={isFlipped ? () => popCard(key) : undefined}
          size="large"
          positionLabel={getPosLabel(card)}
        />
      </View>
    );
  }

  // MULTI CARD: fan layout, no rotation, overlap to fit screen
  return (
    <View style={{ width: windowWidth - 48, alignSelf: "center", paddingVertical: 16 }}>
      {/* Card fan row */}
      <View
        style={{
          flexDirection: rowDir,
          alignItems: "flex-start",
          // Height = card height + space for position label inside FlippableCard
          height: CARD_H + 60,
        }}
      >
        {cards.map((card, i) => {
          const key = cardKey(card);
          const isFlipped = flippedCards.has(key);
          const isPopped = poppedKey === key;
          const isLast = i === cards.length - 1;
          return (
            <View
              key={key}
              style={{
                // Last card takes full CARD_W so it's not clipped
                width: isLast ? CARD_W : effectiveCardWidth,
                alignItems: "center",
                opacity: isPopped ? 0.3 : 1,
              }}
            >
              <FlippableCard
                cardId={card.cardId}
                isReversed={card.isReversed}
                isFlipped={isFlipped}
                onFlip={() => onCardFlip(key)}
                onTap={isFlipped ? () => popCard(key) : undefined}
                size="medium"
                positionLabel={getPosLabel(card)}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
};
