import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { TarotCardImage } from "@/components/tarot/TarotCardImage";
import { getTarotReading } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useThemeColors } from "@/lib/themeColors";
import type { DrawnCardResult } from "@/types/tarot";

export default function TarotDrawScreen() {
  const { readingId } = useLocalSearchParams<{ readingId: string }>();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { getToken } = useAuth();
  const tc = useThemeColors();
  const lang = i18n.language.startsWith("fa") ? "fa" : "en";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cards, setCards] = useState<DrawnCardResult[]>([]);
  const [phase, setPhase] = useState<"shuffle" | "play">("shuffle");
  const [revealed, setRevealed] = useState<boolean[]>([]);

  const load = useCallback(async () => {
    if (!readingId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await getTarotReading(getToken, readingId);
      const drawn = res.reading.drawnCards as DrawnCardResult[];
      setCards(drawn);
      setRevealed(drawn.map(() => false));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "err");
    } finally {
      setLoading(false);
    }
  }, [getToken, readingId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (phase !== "shuffle" || cards.length === 0) return;
    const timer = setTimeout(() => setPhase("play"), 2500);
    return () => clearTimeout(timer);
  }, [phase, cards.length]);

  const nextIndex = useMemo(() => revealed.findIndex((r) => !r), [revealed]);
  const allRevealed = revealed.length > 0 && revealed.every(Boolean);

  const onReveal = (index: number) => {
    if (phase !== "play") return;
    if (index !== nextIndex) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRevealed((prev) => {
      const n = [...prev];
      n[index] = true;
      return n;
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator color={tc.textPrimary} />
      </SafeAreaView>
    );
  }

  if (err || !readingId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-950 px-4">
        <Text className="text-center text-slate-300">{err ?? t("tarot.errorDrawing")}</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text style={{ color: tc.textSecondary }}>{t("common.back")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top", "left", "right"]}>
      <View className="flex-1 px-4 pb-8 pt-4">
        <Text className="mb-6 text-center text-base text-slate-300">
          {phase === "shuffle"
            ? t("tarot.shuffling")
            : allRevealed
              ? t("tarot.allRevealed")
              : nextIndex === -1
                ? t("tarot.tapToReveal")
                : t(nextIndex === 0 ? "tarot.tapToReveal" : "tarot.tapNextCard")}
        </Text>

        {phase === "shuffle" ? (
          <View className="flex-row items-center justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                className="h-[120px] w-[72px] rounded-xl border border-amber-600/40 bg-indigo-950"
                style={{ transform: [{ rotate: `${(i - 1) * 6}deg` }] }}
              />
            ))}
          </View>
        ) : (
          <View className="flex-row flex-wrap items-start justify-center gap-4">
            {cards.map((c, index) => (
              <Pressable
                key={`${c.cardId}_${index}`}
                accessibilityRole="button"
                onPress={() => onReveal(index)}
                className="items-center"
              >
                <TarotCardImage
                  cardId={c.cardId}
                  isReversed={c.isReversed}
                  showFront={revealed[index] ?? false}
                  lang={lang}
                  size="medium"
                />
                {revealed[index] ? (
                  <Text className="mt-2 max-w-[120px] text-center text-xs text-slate-400">
                    {c.position}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        {allRevealed ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: "/(main)/tarot/reading", params: { readingId } })
            }
            className="mt-8 min-h-[48px] items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3"
          >
            <Text className="text-base font-medium text-white">{t("tarot.getReading")}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
