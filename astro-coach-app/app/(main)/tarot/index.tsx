import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { PaywallScreen } from "@/components/coaching/PaywallScreen";
import { drawTarotCards, getTarotSpreads } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/lib/useSubscription";
import { useThemeColors } from "@/lib/themeColors";
import type { TarotSpreadData } from "@/types/tarot";

const PREMIUM_SPREADS = new Set(["past-present-direction", "love-reading", "decision-reading"]);

export default function TarotHomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const tc = useThemeColors();
  const { getToken } = useAuth();
  const { hasAccess, loading: subLoading } = useSubscription();
  const lang = i18n.language.startsWith("fa") ? "fa" : "en";
  const [spreads, setSpreads] = useState<TarotSpreadData[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await getTarotSpreads(getToken);
      setSpreads(res.spreads ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "err");
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const onChoose = async (spread: TarotSpreadData) => {
    if (subLoading) return;
    if (PREMIUM_SPREADS.has(spread.id) && !hasAccess) {
      setPaywallOpen(true);
      return;
    }
    if (spread.id === "daily-card") {
      setBusyId(spread.id);
      try {
        const res = await drawTarotCards(getToken, "daily-card");
        router.push({
          pathname: "/(main)/tarot/draw",
          params: { readingId: res.reading.id },
        });
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        if (m.includes("daily_limit")) setLoadError(t("tarot.dailyLimitReached"));
        else setLoadError(t("tarot.errorDrawing"));
      } finally {
        setBusyId(null);
      }
      return;
    }
    router.push({ pathname: "/(main)/tarot/question", params: { spreadId: spread.id } });
  };

  return (
    <SafeAreaView className="flex-1 bg-transparent" edges={["top", "left", "right"]}>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-6 items-center pt-2">
          <Text className="text-center text-2xl font-semibold text-slate-100">{t("tarot.title")}</Text>
          <Text className="mt-1 text-center text-sm text-slate-400">{t("tarot.subtitle")}</Text>
        </View>

        {loadError ? (
          <Text className="mb-4 text-center text-sm text-rose-300">{loadError}</Text>
        ) : null}

        {spreads.length === 0 && !loadError ? (
          <ActivityIndicator color={tc.textPrimary} />
        ) : null}

        {spreads.map((spread) => {
          const title = lang === "fa" ? spread.name.fa : spread.name.en;
          const desc = lang === "fa" ? spread.description.fa : spread.description.en;
          const isDaily = spread.id === "daily-card";
          const busy = busyId === spread.id;
          return (
            <Pressable
              key={spread.id}
              accessibilityRole="button"
              onPress={() => void onChoose(spread)}
              disabled={!!busyId}
              className="mb-3 min-h-[88px] rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 active:opacity-90"
            >
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="layers-outline" size={22} color={tc.textPrimary} />
                    <Text className="flex-1 text-lg font-medium text-slate-100">{title}</Text>
                  </View>
                  <Text className="mt-1 text-sm leading-5 text-slate-400">{desc}</Text>
                </View>
                <View className="rounded-full bg-slate-800 px-2 py-1">
                  <Text className="text-xs text-amber-200">
                    {isDaily ? t("tarot.freeDaily") : t("tarot.premium")}
                  </Text>
                </View>
              </View>
              {busy ? <ActivityIndicator className="mt-2" color={tc.textPrimary} /> : null}
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(main)/tarot/history")}
          className="mt-4 min-h-[48px] flex-row items-center justify-center rounded-2xl border border-white/15 bg-slate-900/40 px-4 py-3"
        >
          <Text className="text-base text-slate-200">{t("tarot.history")}</Text>
          <Ionicons name="chevron-forward" size={18} color={tc.textSecondary} style={{ marginLeft: 6 }} />
        </Pressable>
      </ScrollView>

      {paywallOpen ? (
        <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} />
      ) : null}
    </SafeAreaView>
  );
}
