import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

const BG = "#0f172a";
const CARD = "#1e293b";
const BORDER = "#334155";
const ACCENT = "#7c3aed";
const MUTED = "#94a3b8";
const WHITE = "#ffffff";

type DashboardStats = {
  totalUsers: number;
  premiumUsers: number;
  trialUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
};

const ACCENTS = ["#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"];

/**
 * Admin overview — GET /api/admin/stats (six user-centric counts).
 */
export default function AdminOverviewScreen() {
  const { getToken } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("/api/admin/stats", { method: "GET", getToken });
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        return;
      }
      setStats((await res.json()) as DashboardStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const items: { label: string; key: keyof DashboardStats }[] = [
    { label: "Total Users", key: "totalUsers" },
    { label: "Premium Users", key: "premiumUsers" },
    { label: "Trial Users", key: "trialUsers" },
    { label: "New Today", key: "newUsersToday" },
    { label: "New This Week", key: "newUsersThisWeek" },
    { label: "New This Month", key: "newUsersThisMonth" },
  ];

  const cardBasis = isDesktop ? "31%" : "47%";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, flexGrow: 1 }}
    >
      <Text style={{ color: WHITE, fontSize: 22, fontWeight: "700", marginBottom: 8 }}>Overview</Text>
      <Text style={{ color: MUTED, fontSize: 14, marginBottom: 20 }}>User metrics (non-deleted accounts)</Text>

      {loading ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={{
                width: cardBasis,
                minWidth: 140,
                flexGrow: 1,
                height: 100,
                borderRadius: 12,
                backgroundColor: "#334155",
                opacity: 0.5,
              }}
            />
          ))}
        </View>
      ) : error ? (
        <View style={{ padding: 16, alignItems: "flex-start" }}>
          <Text style={{ color: "#f87171", marginBottom: 12 }}>{error}</Text>
          <Pressable
            onPress={() => void load()}
            style={{ backgroundColor: ACCENT, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
          >
            <Text style={{ color: WHITE, fontWeight: "600" }}>Retry</Text>
          </Pressable>
        </View>
      ) : stats ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {items.map((item, i) => (
            <View
              key={item.key}
              style={{
                width: cardBasis,
                minWidth: 140,
                flexGrow: 1,
                backgroundColor: CARD,
                borderRadius: 12,
                padding: 16,
                borderLeftWidth: 4,
                borderLeftColor: ACCENTS[i % ACCENTS.length] ?? ACCENT,
                borderWidth: 1,
                borderColor: BORDER,
              }}
            >
              <Text style={{ color: WHITE, fontSize: 32, fontWeight: "700" }}>
                {stats[item.key].toLocaleString()}
              </Text>
              <Text style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
