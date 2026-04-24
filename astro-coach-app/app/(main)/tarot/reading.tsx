import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  interpolate,
  runOnJS,
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
import { TarotFanDisplay } from "@/components/tarot/TarotFanDisplay";
import { TarotCardImage } from "@/components/tarot/TarotCardImage";
import { getCardDisplay } from "@/data/tarot-deck-client";
import { deepenTarotReading, getTarotReadingById } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isPersian } from "@/lib/i18n";
import { useStreamingChat } from "@/lib/useStreamingChat";
import { useThemeColors } from "@/lib/themeColors";
import { useTheme } from "@/providers/ThemeProvider";
import type { DrawnCardResult, TarotHistoryItem, TarotReadingResult } from "@/types/tarot";
import { tarotReadingCache } from "@/lib/tarotReadingCache";
import { useBottomNavInset } from "@/hooks/useBottomNavInset";

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
  const bottomNavInset = useBottomNavInset();

  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const { theme } = useTheme();
  const router = useRouter();
  const { getToken } = useAuth();
  const isRTL = isPersian(i18n.language);

  const [phase, setPhase] = useState<ReadingPhase>(() => (isFromHistory ? "complete" : "shuffling"));
  const [reading, setReading] = useState<TarotReadingResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [newCardKeys, setNewCardKeys] = useState<Set<string>>(new Set());
  const [previousInterpretations, setPreviousInterpretations] = useState<Record<string, string>>({});
  const [isDeepeningLoading, setIsDeepeningLoading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [collapsedDepths, setCollapsedDepths] = useState<Set<string>>(new Set());

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [poppedCard, setPoppedCard] = useState<DrawnCardResult | null>(null);
  const popOverlayAnim = useSharedValue(0);

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
    getExtraBody: () => ({
      readingId: reading?.id ?? "",
      language: isPersian(i18n.language) ? "fa" : "en",
    }),
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
          // Pre-collapse all depths except the deepest for history view
          const depthsToCollapse = new Set(
            DEPTH_ORDER.filter(
              (dd) => tr.interpretations[dd] && dd !== tr.currentDepth
            )
          );
          setCollapsedDepths(depthsToCollapse);
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

  const handlePoppedCardChange = (card: DrawnCardResult | null) => {
    if (card) {
      setPoppedCard(card);
      popOverlayAnim.value = withTiming(1, { duration: 250 });
    } else {
      popOverlayAnim.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setPoppedCard)(null);
      });
    }
  };

  const getLangKey = () => (isPersian(i18n.language) ? "fa" : "en");

  const getPoppedCardName = (card: DrawnCardResult): string => {
    const display = getCardDisplay(card.cardId);
    if (!display) return card.cardId;
    const name = display.name;
    const lang = getLangKey();
    if (typeof name === "string") return name;
    return name[lang] ?? name.en ?? card.cardId;
  };

  const FA_POS_LABELS: Record<string, string> = {
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

  const getPoppedCardLabel = (card: DrawnCardResult): string => {
    if (reading?.currentDepth === "single") return t("tarot.present");
    const raw = card.positionLabel ?? "";
    if (isPersian(i18n.language) && FA_POS_LABELS[raw]) {
      return FA_POS_LABELS[raw]!;
    }
    return raw;
  };

  const popOverlayStyle = useAnimatedStyle(() => ({
    opacity: popOverlayAnim.value,
    transform: [
      { scale: interpolate(popOverlayAnim.value, [0, 1], [0.85, 1]) },
    ],
  }));

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
      // Collapse the depth we just completed so user focuses on new cards
      setCollapsedDepths((prev) => new Set([...prev, reading.currentDepth]));
      // Scroll to top so new cards are visible immediately
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 150);
      setPhase("ready_to_reveal");
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      if (m.includes("premium")) setPaywallOpen(true);
    } finally {
      setIsDeepeningLoading(false);
    }
  };

  const renderCards = () => {
    const cards = reading?.revealedCards ?? [];
    if (cards.length === 0) return null;

    return (
      <View style={{ marginVertical: 24 }}>
        <TarotFanDisplay
          cards={cards}
          flippedCards={flippedCards}
          onCardFlip={handleCardFlip}
          isRTL={isRTL}
          language={i18n.language}
          depthLabel={reading?.currentDepth}
          onPoppedCardChange={handlePoppedCardChange}
        />
      </View>
    );
  };

  const assistantText =
    messages.filter((m) => m.role === "assistant").pop()?.content ??
    (reading?.interpretations?.[reading.currentDepth] ?? "");

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.sheetBackground }} edges={["top", "left", "right"]}>
        <View
          style={{
            flexDirection: "row",
            direction: "ltr",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            className="h-10 w-10 items-center justify-center rounded-[20px]"
            hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.onBackground} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <Text style={{ color: colors.textPrimary, textAlign: "center" }}>{loadError}</Text>
        </View>
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
      {/* Fixed header — outside ScrollView so it never scrolls */}
      <View
        style={{
          flexDirection: "row",
          direction: "ltr",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-[20px]"
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.onBackground} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 17,
            fontWeight: "600",
            color: colors.textPrimary,
          }}
        >
          {t("tarot.title")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 20 + bottomNavInset }}
      >
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
            {DEPTH_ORDER.filter((d) => reading.interpretations[d]).map((d) => {
              // Simple rule: presence in collapsedDepths means collapsed.
              // On load, all depths except the deepest start collapsed —
              // see the useEffect below that initialises this.
              const isCollapsed = collapsedDepths.has(d);
              return (
                <View key={d} style={{ marginBottom: 8 }}>
                  <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 8 }} />
                  <Pressable
                    onPress={() =>
                      setCollapsedDepths((prev) => {
                        const next = new Set(prev);
                        if (next.has(d)) {
                          next.delete(d);
                        } else {
                          next.add(d);
                        }
                        return next;
                      })
                    }
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 8,
                      minHeight: 36,
                    }}
                  >
                    <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: "500" }}>
                      {t(`tarot.readingDepth.${d}`)}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                      {isCollapsed ? t("tarot.showPreviousReading") : t("tarot.hidePreviousReading")}
                    </Text>
                  </Pressable>
                  {!isCollapsed ? (
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 15,
                        lineHeight: 24,
                        textAlign: isRTL ? "right" : "left",
                        marginTop: 2,
                        marginBottom: 12,
                      }}
                    >
                      {reading.interpretations[d]}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <>
            {Object.entries(previousInterpretations).map(([depth, text]) => {
              const isCollapsed = collapsedDepths.has(depth);
              return (
                <View key={depth} style={{ marginTop: 12 }}>
                  <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 8 }} />
                  <Pressable
                    onPress={() =>
                      setCollapsedDepths((prev) => {
                        const next = new Set(prev);
                        if (next.has(depth)) {
                          next.delete(depth);
                        } else {
                          next.add(depth);
                        }
                        return next;
                      })
                    }
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 8,
                      minHeight: 36,
                    }}
                  >
                    <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: "500" }}>
                      {t(`tarot.readingDepth.${depth}`)}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                      {isCollapsed ? t("tarot.showPreviousReading") : t("tarot.hidePreviousReading")}
                    </Text>
                  </Pressable>
                  {!isCollapsed ? (
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 15,
                        lineHeight: 24,
                        textAlign: isRTL ? "right" : "left",
                        opacity: 0.6,
                        marginTop: 2,
                        marginBottom: 8,
                      }}
                    >
                      {text}
                    </Text>
                  ) : null}
                </View>
              );
            })}

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

      {/* Screen-level pop-out card overlay — renders above ScrollView */}
      {poppedCard ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              // Center on screen
              top: windowHeight * 0.5 - 180,
              left: windowWidth * 0.5 - 90,
              width: 180,
              alignItems: "center",
              zIndex: 100,
            },
            popOverlayStyle,
          ]}
        >
          <View
            style={{
              backgroundColor: "rgba(10, 10, 30, 0.92)",
              borderRadius: 16,
              padding: 16,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(255, 191, 0, 0.3)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 16,
              elevation: 20,
            }}
          >
            <Text
              style={{
                color: "rgba(255, 191, 0, 0.9)",
                fontSize: 11,
                fontWeight: "600",
                letterSpacing: 0.5,
                textAlign: "center",
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              {getPoppedCardLabel(poppedCard)}
            </Text>
            <TarotCardImage
              cardId={poppedCard.cardId}
              isReversed={poppedCard.isReversed}
              showFront={true}
              size="large"
              lang={getLangKey()}
            />
            <Text
              style={{
                color: "#ffffff",
                fontSize: 14,
                fontWeight: "700",
                marginTop: 10,
                textAlign: "center",
              }}
            >
              {getPoppedCardName(poppedCard)}
            </Text>
          </View>
        </Animated.View>
      ) : null}

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
