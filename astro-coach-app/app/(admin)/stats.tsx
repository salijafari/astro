import { useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/providers/ThemeProvider";
import { apiRequest } from "@/lib/api";

interface OverviewStats {
  totalUsers: number;
  totalSessions: number;
  totalMessages: number;
  premiumUsers: number;
  freeUsers: number;
  avgMessagesPerSession: number;
  totalSummaries: number;
}

interface ContentCounts {
  signs: number;
  planets: number;
  houses: number;
  transits: number;
  tarot: number;
  coffeeSymbols: number;
  challenges: number;
  conflicts: number;
  prompts: number;
  safetyResponses: number;
}

interface RecentActivity {
  since: string;
  newUsers: number;
  newSessions: number;
  newMessages: number;
}

const CONTENT_MINIMUMS: Record<string, number> = {
  signs: 12, planets: 10, houses: 12, transits: 50,
  tarot: 78, coffeeSymbols: 40, challenges: 10, conflicts: 5,
  safetyResponses: 4,
};

/**
 * Usage Stats screen — displays usage metrics, content counts, and last 7 days activity.
 */
const StatsScreen: React.FC = () => {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const c = theme.colors;

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [counts, setCounts] = useState<ContentCounts | null>(null);
  const [recent, setRecent] = useState<RecentActivity | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, ct, rc] = await Promise.all([
        apiRequest("/api/admin/stats/overview", { method: "GET", getToken }),
        apiRequest("/api/admin/stats/content-counts", { method: "GET", getToken }),
        apiRequest("/api/admin/stats/recent-activity", { method: "GET", getToken }),
      ]);
      if (ov.ok) setOverview(await ov.json());
      if (ct.ok) setCounts(await ct.json());
      if (rc.ok) setRecent(await rc.json());
    } catch {
      Alert.alert("Error", "Failed to load stats.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const StatCard: React.FC<{ label: string; value: string | number; sub?: string }> = ({
    label, value, sub,
  }) => (
    <View
      className="rounded-xl p-4 mb-3"
      style={{ backgroundColor: c.surface }}
    >
      <Text className="text-3xl font-bold" style={{ color: c.onBackground }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </Text>
      <Text className="mt-1 font-medium text-sm" style={{ color: c.onBackground }}>
        {label}
      </Text>
      {sub ? (
        <Text className="text-xs mt-0.5" style={{ color: c.onSurfaceVariant }}>{sub}</Text>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.background }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <View className="flex-row items-center justify-between mt-4 mb-4">
          <Text className="font-semibold" style={{ color: c.onBackground }}>Usage Stats</Text>
          <Pressable onPress={loadAll}>
            <Ionicons name="refresh-outline" size={20} color={c.primary} />
          </Pressable>
        </View>

        {/* Last 7 Days */}
        {recent && (
          <>
            <Text className="mb-2 text-xs font-medium" style={{ color: c.onSurfaceVariant }}>
              LAST 7 DAYS
            </Text>
            <View className="mb-4 flex-row gap-3">
              {[
                { label: "New Users", value: recent.newUsers },
                { label: "New Sessions", value: recent.newSessions },
                { label: "New Messages", value: recent.newMessages },
              ].map((s) => (
                <View key={s.label} className="flex-1 rounded-xl p-3" style={{ backgroundColor: c.surface }}>
                  <Text className="text-xl font-bold" style={{ color: c.primary }}>
                    {s.value.toLocaleString()}
                  </Text>
                  <Text className="text-xs mt-0.5" style={{ color: c.onSurfaceVariant }}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Overview */}
        {overview && (
          <>
            <Text className="mb-2 text-xs font-medium" style={{ color: c.onSurfaceVariant }}>
              ALL TIME
            </Text>
            <StatCard label="Total Users" value={overview.totalUsers}
              sub={`${overview.premiumUsers} premium / ${overview.freeUsers} free`} />
            <StatCard label="Chat Sessions" value={overview.totalSessions} />
            <StatCard label="Messages Sent" value={overview.totalMessages}
              sub={`~${overview.avgMessagesPerSession} per session`} />
            <StatCard label="Session Memories Saved" value={overview.totalSummaries}
              sub="Summarised sessions used for memory" />
          </>
        )}

        {/* Content DB health */}
        {counts && (
          <>
            <Text className="mt-4 mb-2 text-xs font-medium" style={{ color: c.onSurfaceVariant }}>
              CONTENT DATABASE HEALTH
            </Text>
            <View className="rounded-xl p-4" style={{ backgroundColor: c.surface }}>
              {Object.entries(counts).map(([key, val]) => {
                const min = CONTENT_MINIMUMS[key];
                const healthy = min === undefined || val >= min;
                return (
                  <View key={key} className="flex-row justify-between py-1.5">
                    <View className="flex-row items-center gap-2">
                      <Ionicons
                        name={healthy ? "checkmark-circle" : "warning"}
                        size={14}
                        color={healthy ? c.primary : c.error}
                      />
                      <Text className="text-sm capitalize" style={{ color: c.onBackground }}>
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </Text>
                    </View>
                    <Text className="text-sm font-semibold" style={{ color: healthy ? c.onBackground : c.error }}>
                      {val}{min ? `/${min}+` : ""}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default StatsScreen;
