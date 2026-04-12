import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getTarotHistory } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useThemeColors } from "@/lib/themeColors";
import type { TarotHistoryItem } from "@/types/tarot";

export default function TarotHistory() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const { getToken } = useAuth();
  const isRTL = i18n.language.startsWith("fa");

  const [readings, setReadings] = useState<TarotHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      try {
        const data = await getTarotHistory(getToken, pageNum, 10);
        setReadings((prev) => (replace ? data.readings : [...prev, ...data.readings]));
        setTotalPages(data.totalPages);
        setPage(pageNum);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [getToken],
  );

  useEffect(() => {
    void fetchPage(1, true);
  }, [fetchPage]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void fetchPage(1, true);
  };

  const handleLoadMore = () => {
    if (isLoadingMore || page >= totalPages) return;
    setIsLoadingMore(true);
    void fetchPage(page + 1, false);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language.startsWith("fa") ? "fa-IR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const depthCardCount: Record<string, number> = {
    single: 1,
    three: 3,
    five: 5,
    "celtic-cross": 10,
  };

  const renderItem = ({ item }: { item: TarotHistoryItem }) => (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: "/(main)/tarot/reading",
          params: { readingId: item.id, fromHistory: "true" },
        })
      }
      style={{
        backgroundColor: colors.surfacePrimary,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <Text style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 15 }}>
          {t(`tarot.readingDepth.${item.currentDepth}`)}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          {depthCardCount[item.currentDepth] ?? "?"} cards
        </Text>
      </View>
      {item.question ? (
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 4 }} numberOfLines={1}>
          &ldquo;{item.question.length > 60 ? `${item.question.slice(0, 57)}...` : item.question}&rdquo;
        </Text>
      ) : null}
      <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{formatDate(item.createdAt)}</Text>
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
      <Text style={{ fontSize: 48, opacity: 0.2, marginBottom: 16 }}>✦</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
        {t("tarot.noHistory")}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 24, textAlign: "center", paddingHorizontal: 24 }}>
        {t("tarot.noHistorySubtitle")}
      </Text>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ backgroundColor: "#7c3aed", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, minHeight: 44, justifyContent: "center" }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>{t("tarot.drawCard")}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.sheetBackground }} edges={["top", "left", "right"]}>
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          padding: 20,
          paddingBottom: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>←</Text>
        </TouchableOpacity>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 20,
            fontWeight: "700",
            marginLeft: isRTL ? 0 : 12,
            marginRight: isRTL ? 12 : 0,
          }}
        >
          {t("tarot.pastReadings")}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#7c3aed" />
      ) : (
        <FlatList
          data={readings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingTop: 0, flexGrow: 1 }}
          ListEmptyComponent={EmptyState}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#7c3aed" />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isLoadingMore ? <ActivityIndicator color="#7c3aed" style={{ marginVertical: 16 }} /> : null
          }
        />
      )}
    </SafeAreaView>
  );
}
