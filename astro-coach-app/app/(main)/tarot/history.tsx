import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { getTarotHistory } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useThemeColors } from "@/lib/themeColors";
import type { TarotReadingResult } from "@/types/tarot";

export default function TarotHistoryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { getToken } = useAuth();
  const tc = useThemeColors();
  const lang = i18n.language.startsWith("fa") ? "fa" : "en";

  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TarotReadingResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (p: number, append: boolean) => {
      const res = await getTarotHistory(getToken, p, 10);
      setTotal(res.total);
      setItems((prev) => (append ? [...prev, ...(res.readings ?? [])] : res.readings ?? []));
    },
    [getToken],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    try {
      await load(1, false);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await load(1, false);
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top", "left", "right"]}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable onPress={() => router.back()} className="min-h-[44px] justify-center">
          <Text style={{ color: tc.textSecondary }}>{t("common.back")}</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-slate-100">{t("tarot.history")}</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <ActivityIndicator className="mt-8" color={tc.textPrimary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          onEndReached={() => {
            if (items.length >= total) return;
            const next = page + 1;
            setPage(next);
            void load(next, true);
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <Text className="mt-8 text-center text-slate-400">{t("tarot.noHistory")}</Text>
          }
          renderItem={({ item }) => {
            const spreadLabel =
              {
                "daily-card": t("tarot.dailyCard"),
                "past-present-direction": t("tarot.pastPresentDirection"),
                "love-reading": t("tarot.loveReading"),
                "decision-reading": t("tarot.decisionReading"),
              }[item.spreadId] ?? item.spreadId;
            const date = new Date(item.createdAt).toLocaleDateString(lang === "fa" ? "fa-IR" : "en-US");
            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(main)/tarot/reading",
                    params: { readingId: item.id, fromHistory: "1" },
                  })
                }
                className="mb-3 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3"
              >
                <Text className="text-base font-medium text-slate-100">{spreadLabel}</Text>
                {item.question ? (
                  <Text className="mt-1 text-sm text-slate-400" numberOfLines={2}>
                    {item.question}
                  </Text>
                ) : null}
                <Text className="mt-2 text-xs text-slate-500">{date}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
