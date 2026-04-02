import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { CosmicBackground } from "@/components/CosmicBackground";
import { MainTabChromeHeader } from "@/components/MainInPageChrome";
import { useAuth } from "@/lib/auth";
import { apiGetJson } from "@/lib/api";
import { getFeatureConfig } from "@/lib/featureConfig";
import { useTheme } from "@/providers/ThemeProvider";

type ConvRow = {
  id: string;
  title: string;
  category: string;
  messageCount: number;
  lastMessage: { role: string; preview: string; createdAt: string } | null;
  createdAt: string;
  updatedAt: string;
};

type HistoryResponse = {
  conversations: ConvRow[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
};

/**
 * Formats a UTC timestamp as a human-readable "time ago" string.
 */
function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  === 1) return "Yesterday";
  if (days  < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * History screen — shows all past conversations from PostgreSQL, grouped by feature.
 * Uses GET /api/history with pagination and pull-to-refresh.
 */
export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { getToken } = useAuth();
  const router = useRouter();
  const rtl = i18n.language === "fa";

  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (p = 1, append = false) => {
    try {
      const data = await apiGetJson<HistoryResponse>(
        `/api/history?page=${p}&limit=20`,
        getToken,
      );
      setConversations((prev) => (append ? [...prev, ...data.conversations] : data.conversations));
      setHasMore(data.pagination.hasMore);
      setPage(p);
    } catch (err) {
      console.warn("[history] load error:", err);
    }
  }, [getToken]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load(1);
      setLoading(false);
    })();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(1);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await load(page + 1, true);
    setLoadingMore(false);
  };

  const renderItem = ({ item }: { item: ConvRow }) => {
    const config = getFeatureConfig(item.category);
    return (
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(main)/history/[id]" as any,
            params: { id: item.id },
          })
        }
        className="mx-4 mb-3 rounded-2xl border px-4 py-4"
        style={{ borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }}
      >
        {/* Feature badge + time */}
        <View className="mb-2 flex-row items-center justify-between">
          <View
            className="flex-row items-center gap-1 rounded-full px-2 py-1"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <Ionicons name={config.icon as any} size={12} color={config.color} />
            <Text className="text-xs font-medium" style={{ color: config.color }}>
              {t(config.labelKey)}
            </Text>
          </View>
          <Text className="text-xs" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatTimeAgo(item.updatedAt)}
          </Text>
        </View>

        {/* Conversation title */}
        <Text
          className="mb-1 text-sm font-semibold"
          numberOfLines={1}
          style={{
            color: theme.colors.onBackground,
            writingDirection: rtl ? "rtl" : "ltr",
            textAlign: rtl ? "right" : "left",
          }}
        >
          {item.title}
        </Text>

        {/* Last message preview */}
        {item.lastMessage ? (
          <Text
            className="text-xs"
            numberOfLines={2}
            style={{
              color: theme.colors.onSurfaceVariant,
              writingDirection: rtl ? "rtl" : "ltr",
              textAlign: rtl ? "right" : "left",
            }}
          >
            {item.lastMessage.role === "assistant" ? "✦ " : ""}
            {item.lastMessage.preview}
          </Text>
        ) : null}

        {/* Message count */}
        <Text className="mt-2 text-xs" style={{ color: `${theme.colors.onSurfaceVariant}80` }}>
          {t("history.messages", { count: item.messageCount })}
        </Text>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View className="flex-1" style={{ backgroundColor: "transparent" }}>
        <CosmicBackground subtleDrift />
        <View className="flex-1 px-4">
          <MainTabChromeHeader leadingAction="back" />
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: "transparent" }}>
      <CosmicBackground subtleDrift />
      <View className="flex-1">
        <View className="px-4">
          <MainTabChromeHeader leadingAction="back" />
          <View className="pb-3 pt-2">
            <Text
              className="text-xl font-bold"
              style={{ color: theme.colors.onBackground, textAlign: rtl ? "right" : "left" }}
            >
              {t("history.title")}
            </Text>
            <Text
              className="mt-1 text-sm"
              style={{ color: theme.colors.onSurfaceVariant, textAlign: rtl ? "right" : "left" }}
            >
              {t("history.subtitle")}
            </Text>
          </View>
        </View>

        {conversations.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.onSurfaceVariant} style={{ opacity: 0.4 }} />
            <Text
              className="mt-4 text-center text-base"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("history.empty")}
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            className="flex-1"
            contentContainerStyle={{ paddingVertical: 16 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void handleRefresh()}
                tintColor={theme.colors.primary}
              />
            }
            onEndReached={() => void handleLoadMore()}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator color={theme.colors.primary} style={{ padding: 16 }} />
              ) : null
            }
          />
        )}
      </View>
    </View>
  );
}
