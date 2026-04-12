import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { PaywallScreen } from "@/components/coaching/PaywallScreen";
import { StreamingCursor } from "@/components/StreamingCursor";
import { FlippableCard } from "@/components/tarot/FlippableCard";
import { deepenTarotReading, getTarotReadingById } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStreamingChat } from "@/lib/useStreamingChat";
import { useThemeColors } from "@/lib/themeColors";
import type { DrawnCardResult, TarotHistoryItem, TarotReadingResult } from "@/types/tarot";
import { tarotReadingCache } from "@/lib/tarotReadingCache";

const API_BASE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

const DEPTH_INDICES: Record<string, number[]> = {
  single: [1],
  three: [0, 1, 2],
  five: [0, 1, 2, 3, 4],
  "celtic-cross": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
};

function revealedCardsForDepth(allCards: DrawnCardResult[], depth: string): DrawnCardResult[] {
  const want = new Set(DEPTH_INDICES[depth] ?? [1]);
  return allCards.filter((c) => want.has(c.positionIndex)).sort((a, b) => a.positionIndex - b.positionIndex);
}

function historyToResult(r: TarotHistoryItem): TarotReadingResult {
  const depth = r.currentDepth as TarotReadingResult["currentDepth"];
  return {
    id: r.id,
    question: r.question,
    currentDepth: depth,
    revealedCards: revealedCardsForDepth(r.allCards, r.currentDepth),
    interpretations: r.interpretations ?? {},
    language: r.language,
    createdAt: r.createdAt,
  };
}

const cardKey = (c: DrawnCardResult) => `${c.positionIndex}-${c.cardId}`;

type ReadingPhase =
  | "shuffling"
  | "ready_to_reveal"
  | "revealing"
  | "interpreting"
  | "complete"
  | "deepening";

const DEPTH_ORDER = ["single", "three", "five", "celtic-cross"] as const;

export default function TarotReadingScreen() {
  const params = useLocalSearchParams<{ readingId?: string | string[]; fromHistory?: string }>();
  const readingId = typeof params.readingId === "string" ? params.readingId : params.readingId?.[0] ?? "";
  const fromHistory = params.fromHistory;
  const isFromHistory = fromHistory === "true" || fromHistory === "1";

  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const { getToken } = useAuth();
  const isRTL = i18n.language.startsWith("fa");

  const [phase, setPhase] = useState<ReadingPhase>(() => (isFromHistory ? "complete" : "shuffling"));
  const [reading, setReading] = useState<TarotReadingResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [newCardKeys, setNewCardKeys] = useState<Set<string>>(new Set());
  const [previousInterpretations, setPreviousInterpretations] = useState<Record<string, string>>({});
  const [isDeepeningLoading, setIsDeepeningLoading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const interpretSentKey = useRef<string>("");

  const streamUrl = `${API_BASE}/api/tarot/interpret`;
  const syncPath = "/api/tarot/interpret-sync";

  const {
    messages,
    isStreaming,
    sendMessage,
    clearMessages,
  } = useStreamingChat({
    streamUrl,
    nonStreamingPath: syncPath,
    getToken,
    getExtraBody: () => ({ readingId: reading?.id ?? "" }),
    emptyErrorText: t("tarot.errorDrawing"),
  });

  useEffect(() => {
    if (!readingId) return;
    let cancelled = false;

    if (isFromHistory) {
      void (async () => {
        try {
          const { reading: r } = await getTarotReadingById(getToken, readingId);
          if (cancelled) return;
          const tr = historyToResult(r);
          setReading(tr);
          setFlippedCards(new Set(r.allCards.map((c) => cardKey(c))));
          const prev: Record<string, string> = {};
          for (const d of DEPTH_ORDER) {
            const txt = tr.interpretations[d];
            if (txt && d !== tr.currentDepth) prev[d] = txt;
          }
          setPreviousInterpretations(prev);
        } catch {
          if (!cancelled) setLoadError(t("tarot.errorDrawing"));
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (tarotReadingCache.pending && tarotReadingCache.pending.id === readingId) {
      const pr = tarotReadingCache.pending;
      tarotReadingCache.pending = null;
      setReading(pr);
      return;
    }

    void (async () => {
      try {
        const { reading: r } = await getTarotReadingById(getToken, readingId);
        if (cancelled) return;
        setReading(historyToResult(r));
      } catch {
        if (!cancelled) setLoadError(t("tarot.errorDrawing"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [readingId, isFromHistory, getToken, t]);

  useEffect(() => {
    if (phase !== "shuffling") return;
    const timer = setTimeout(() => setPhase("ready_to_reveal"), 2500);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "ready_to_reveal" || !reading) return;
    const revealed = reading.revealedCards ?? [];
    const nk = new Set(revealed.map((c) => cardKey(c)).filter((k) => !flippedCards.has(k)));
    setNewCardKeys(nk);
    if (nk.size === 0) setPhase("interpreting");
  }, [phase, reading?.currentDepth, reading?.revealedCards, flippedCards]);

  useEffect(() => {
    if (phase !== "interpreting" || !reading?.id || isFromHistory) return;
    const key = `${reading.id}:${reading.currentDepth}`;
    if (interpretSentKey.current === key) return;
    interpretSentKey.current = key;
    void sendMessage(t("tarot.interpretPrompt"));
  }, [phase, reading?.id, reading?.currentDepth, isFromHistory, sendMessage, t]);

  useEffect(() => {
    const last = messages.filter((m) => m.role === "assistant").pop();
    if (last?.role === "assistant" && !isStreaming && phase === "interpreting") {
      setPhase("complete");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    }
  }, [messages, isStreaming, phase]);

  const handleCardFlip = (key: string) => {
    const next = new Set(flippedCards);
    next.add(key);
    setFlippedCards(next);
    const allNewFlipped = [...newCardKeys].every((id) => next.has(id));
    if (allNewFlipped && newCardKeys.size > 0 && phase === "ready_to_reveal") {
      setPhase("interpreting");
    }
  };

  const handleDeepen = async () => {
    if (!reading) return;
    setIsDeepeningLoading(true);
    try {
      const currentInterp =
        messages.find((m) => m.role === "assistant")?.content ??
        reading.interpretations[reading.currentDepth] ??
        "";
      setPreviousInterpretations((prev) => ({
        ...prev,
        [reading.currentDepth]: currentInterp,
      }));
      clearMessages();
      interpretSentKey.current = "";

      const result = await deepenTarotReading(getToken, reading.id);
      const { currentDepth, newCards, allRevealedCards } = result.reading;
      setReading((prev) =>
        prev
          ? {
              ...prev,
              currentDepth: currentDepth as TarotReadingResult["currentDepth"],
              revealedCards: allRevealedCards,
              newCards,
              allRevealedCards,
            }
          : prev,
      );
      setNewCardKeys(new Set(newCards.map((c) => cardKey(c))));
      setPhase("ready_to_reveal");
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      if (m.includes("premium")) setPaywallOpen(true);
    } finally {
      setIsDeepeningLoading(false);
    }
  };

  const renderCards = () => {
    if (!reading) return null;
    const cards = reading.revealedCards ?? [];
    const depth = reading.currentDepth;

    if (depth === "single") {
      const card = cards[0];
      if (!card) return null;
      return (
        <View style={{ alignItems: "center", marginVertical: 24 }}>
          <FlippableCard
            cardId={card.cardId}
            isReversed={card.isReversed}
            isFlipped={flippedCards.has(cardKey(card))}
            onFlip={() => handleCardFlip(cardKey(card))}
            size="large"
            positionLabel={t("tarot.present")}
          />
        </View>
      );
    }

    if (depth === "three") {
      return (
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            justifyContent: "center",
            gap: 12,
            marginVertical: 24,
            flexWrap: "wrap",
          }}
        >
          {cards.map((card) => (
            <FlippableCard
              key={cardKey(card)}
              cardId={card.cardId}
              isReversed={card.isReversed}
              isFlipped={flippedCards.has(cardKey(card))}
              onFlip={() => handleCardFlip(cardKey(card))}
              size="medium"
              positionLabel={card.positionLabel}
            />
          ))}
        </View>
      );
    }

    if (depth === "five") {
      const row = cards.slice(0, 3);
      const challenge = cards[3];
      const advice = cards[4];
      return (
        <View style={{ alignItems: "center", marginVertical: 24, gap: 8 }}>
          {challenge ? (
            <FlippableCard
              key={cardKey(challenge)}
              cardId={challenge.cardId}
              isReversed={challenge.isReversed}
              isFlipped={flippedCards.has(cardKey(challenge))}
              onFlip={() => handleCardFlip(cardKey(challenge))}
              size="medium"
              positionLabel={t("tarot.challenge")}
            />
          ) : null}
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {row.map((card) => (
              <FlippableCard
                key={cardKey(card)}
                cardId={card.cardId}
                isReversed={card.isReversed}
                isFlipped={flippedCards.has(cardKey(card))}
                onFlip={() => handleCardFlip(cardKey(card))}
                size="medium"
                positionLabel={card.positionLabel}
              />
            ))}
          </View>
          {advice ? (
            <FlippableCard
              key={cardKey(advice)}
              cardId={advice.cardId}
              isReversed={advice.isReversed}
              isFlipped={flippedCards.has(cardKey(advice))}
              onFlip={() => handleCardFlip(cardKey(advice))}
              size="medium"
              positionLabel={t("tarot.advice")}
            />
          ) : null}
        </View>
      );
    }

    if (depth === "celtic-cross") {
      const row1 = cards.slice(0, 5);
      const row2 = cards.slice(5, 10);
      return (
        <View style={{ marginVertical: 24, gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8, padding: 4 }}>
              {row1.map((card) => (
                <FlippableCard
                  key={cardKey(card)}
                  cardId={card.cardId}
                  isReversed={card.isReversed}
                  isFlipped={flippedCards.has(cardKey(card))}
                  onFlip={() => handleCardFlip(cardKey(card))}
                  size="small"
                  positionLabel={card.positionLabel}
                />
              ))}
            </View>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8, padding: 4 }}>
              {row2.map((card) => (
                <FlippableCard
                  key={cardKey(card)}
                  cardId={card.cardId}
                  isReversed={card.isReversed}
                  isFlipped={flippedCards.has(cardKey(card))}
                  onFlip={() => handleCardFlip(cardKey(card))}
                  size="small"
                  positionLabel={card.positionLabel}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      );
    }
    return null;
  };

  const assistantText =
    messages.filter((m) => m.role === "assistant").pop()?.content ??
    (reading?.interpretations?.[reading.currentDepth] ?? "");

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.sheetBackground, justifyContent: "center", padding: 24 }}>
        <Text style={{ color: colors.textPrimary, textAlign: "center" }}>{loadError}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, alignItems: "center" }}>
          <Text style={{ color: colors.textSecondary }}>{t("common.back")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!reading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.sheetBackground, justifyContent: "center" }}>
        <ActivityIndicator color="#7c3aed" />
      </SafeAreaView>
    );
  }

  if (phase === "shuffling") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.sheetBackground, alignItems: "center", justifyContent: "center" }}>
        <ShuffleCard index={0} colors={colors} />
        <ShuffleCard index={1} colors={colors} />
        <ShuffleCard index={2} colors={colors} />
        <Text style={{ color: colors.textSecondary, marginTop: 32, fontSize: 16 }}>{t("tarot.shuffling")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.sheetBackground }} edges={["top", "left", "right"]}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 8, minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>← {t("common.back")}</Text>
        </TouchableOpacity>

        {reading.question ? (
          <Text
            style={{
              color: colors.textSecondary,
              textAlign: isRTL ? "right" : "left",
              fontSize: 14,
              marginBottom: 8,
              fontStyle: "italic",
            }}
          >
            &ldquo;{reading.question}&rdquo;
          </Text>
        ) : null}

        {renderCards()}

        {phase === "ready_to_reveal" ? (
          <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: 14, marginTop: 8 }}>
            {t("tarot.tapToReveal")}
          </Text>
        ) : null}

        {isFromHistory ? (
          <View style={{ marginTop: 20 }}>
            {DEPTH_ORDER.filter((d) => reading.interpretations[d]).map((d) => (
              <View key={d} style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 6 }}>
                  {t(`tarot.readingDepth.${d}`)}
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 15,
                    lineHeight: 24,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {reading.interpretations[d]}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            {Object.entries(previousInterpretations).map(([depth, text]) => (
              <View key={depth} style={{ marginTop: 20, opacity: 0.5 }}>
                <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 12 }} />
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 4 }}>
                  {t(`tarot.readingDepth.${depth}`)}
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 15,
                    lineHeight: 24,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {text}
                </Text>
              </View>
            ))}

            {(phase === "interpreting" || phase === "complete") && !isFromHistory ? (
              <View style={{ marginTop: 20 }}>
                <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 12 }} />
                <Text style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 24, textAlign: isRTL ? "right" : "left" }}>
                  {assistantText}
                  {isStreaming ? <StreamingCursor /> : null}
                </Text>
              </View>
            ) : null}
          </>
        )}

        {phase === "complete" && reading && !isFromHistory ? (
          <View style={{ flexDirection: "row", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
            <TouchableOpacity
              onPress={() => router.replace("/(main)/tarot")}
              style={{
                flex: 1,
                minWidth: 120,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                minHeight: 48,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center" }}>
                {reading.currentDepth === "celtic-cross" ? t("tarot.newReading") : t("tarot.thatsAllINeeded")}
              </Text>
            </TouchableOpacity>

            {reading.currentDepth !== "celtic-cross" ? (
              <TouchableOpacity
                onPress={() => void handleDeepen()}
                disabled={isDeepeningLoading}
                style={{
                  flex: 1,
                  minWidth: 120,
                  backgroundColor: "#7c3aed",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: isDeepeningLoading ? 0.7 : 1,
                  minHeight: 48,
                  justifyContent: "center",
                }}
              >
                {isDeepeningLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                    {reading.currentDepth === "single"
                      ? t("tarot.showMeMore")
                      : reading.currentDepth === "three"
                        ? t("tarot.goDeeper")
                        : t("tarot.goEvenDeeper")}{" "}
                    →
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => router.push("/(main)/tarot/history")}
                style={{
                  flex: 1,
                  minWidth: 120,
                  backgroundColor: "#7c3aed",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  minHeight: 48,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                  {t("tarot.viewPastReadings")} →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </ScrollView>

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </SafeAreaView>
  );
}

function ShuffleCard({
  index,
  colors,
}: {
  index: number;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const offset = useSharedValue(0);
  useEffect(() => {
    offset.value = withRepeat(
      withSequence(
        withTiming(index % 2 === 0 ? -8 : 8, { duration: 800 + index * 200 }),
        withTiming(index % 2 === 0 ? 8 : -8, { duration: 800 + index * 200 }),
      ),
      -1,
      true,
    );
  }, [index, offset]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }, { rotate: `${index * 8 - 8}deg` }],
  }));
  return (
    <Animated.View
      style={[
        style,
        {
          position: "absolute",
          width: 80,
          height: 120,
          backgroundColor: "#1a0a2e",
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "rgba(255,191,0,0.3)",
          alignItems: "center",
          justifyContent: "center",
          top: "30%",
          left: "50%",
          marginLeft: -40 + (index - 1) * 12,
        },
      ]}
    >
      <Text style={{ color: "rgba(255,191,0,0.5)", fontSize: 24 }}>✦</Text>
    </Animated.View>
  );
}
