import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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

const NAV_ITEMS = [
  { label: "Content Manager", icon: "library-outline", route: "/(admin)/content" },
  { label: "Prompt Templates", icon: "code-slash-outline", route: "/(admin)/prompts" },
  { label: "Safety Responses", icon: "shield-checkmark-outline", route: "/(admin)/safety" },
  { label: "Usage Stats", icon: "bar-chart-outline", route: "/(admin)/stats" },
] as const;

/**
 * Admin dashboard — shows overview metrics and navigation tiles.
 */
const AdminDashboard: React.FC = () => {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [counts, setCounts] = useState<ContentCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [overviewRes, countsRes] = await Promise.all([
          apiRequest("/api/admin/stats/overview", { method: "GET", getToken }),
          apiRequest("/api/admin/stats/content-counts", { method: "GET", getToken }),
        ]);
        if (overviewRes.ok) setOverview(await overviewRes.json());
        if (countsRes.ok) setCounts(await countsRes.json());
      } catch {
        Alert.alert("Error", "Failed to load admin stats.");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [getToken]);

  const c = theme.colors;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {/* Header */}
        <Text className="mt-6 mb-2 text-2xl font-semibold" style={{ color: c.onBackground }}>
          Admin Panel
        </Text>
        <Text className="mb-6 text-sm" style={{ color: c.onSurfaceVariant }}>
          Internal tools — not visible to users.
        </Text>

        {/* Stats Row */}
        {loading ? (
          <ActivityIndicator color={c.primary} />
        ) : overview ? (
          <View className="mb-6 flex-row flex-wrap gap-3">
            {[
              { label: "Total Users", value: overview.totalUsers },
              { label: "Premium", value: overview.premiumUsers },
              { label: "Sessions", value: overview.totalSessions },
              { label: "Messages", value: overview.totalMessages },
              { label: "Avg Msgs/Session", value: overview.avgMessagesPerSession },
              { label: "Memories Saved", value: overview.totalSummaries },
            ].map((stat) => (
              <View
                key={stat.label}
                className="rounded-xl p-4"
                style={{
                  backgroundColor: c.surface,
                  minWidth: "44%",
                  flex: 1,
                }}
              >
                <Text className="text-2xl font-bold" style={{ color: c.onBackground }}>
                  {stat.value.toLocaleString()}
                </Text>
                <Text className="text-xs mt-1" style={{ color: c.onSurfaceVariant }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Content Counts */}
        {counts && (
          <View
            className="mb-6 rounded-xl p-4"
            style={{ backgroundColor: c.surface }}
          >
            <Text className="mb-3 font-semibold" style={{ color: c.onBackground }}>
              Content Database
            </Text>
            {Object.entries(counts).map(([key, val]) => (
              <View key={key} className="flex-row justify-between py-1">
                <Text className="capitalize text-sm" style={{ color: c.onSurfaceVariant }}>
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </Text>
                <Text className="text-sm font-medium" style={{ color: c.onBackground }}>
                  {val}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Navigation Tiles */}
        <Text className="mb-3 font-semibold text-sm" style={{ color: c.onSurfaceVariant }}>
          MANAGEMENT
        </Text>
        {NAV_ITEMS.map((item) => (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route as never)}
            className="mb-3 flex-row items-center rounded-xl p-4"
            style={{ backgroundColor: c.surface }}
            android_ripple={{ color: c.surfaceVariant }}
          >
            <Ionicons name={item.icon as never} size={22} color={c.primary} />
            <Text className="ml-3 flex-1 font-medium" style={{ color: c.onBackground }}>
              {item.label}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={c.onSurfaceVariant} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AdminDashboard;
