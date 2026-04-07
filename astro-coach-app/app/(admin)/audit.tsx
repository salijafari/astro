import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

const BG = "#0f172a";
const CARD = "#1e293b";
const BORDER = "#334155";
const ACCENT = "#7c3aed";
const MUTED = "#94a3b8";
const WHITE = "#ffffff";

type AuditEntry = {
  id: string;
  adminEmail: string;
  action: string;
  targetId: string | null;
  targetEmail: string | null;
  metadata: unknown;
  createdAt: string;
};

function formatMetadata(meta: unknown): string {
  if (meta === null || meta === undefined) return "—";
  if (typeof meta === "object" && !Array.isArray(meta)) {
    return Object.entries(meta as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join(" · ");
  }
  return String(meta);
}

function actionBadge(action: string): { bg: string; label: string } {
  if (action.includes("grant") || action === "add_admin") return { bg: "#14532d", label: action };
  if (action.includes("revoke") || action.includes("delete") || action.includes("remove")) {
    return { bg: "#7f1d1d", label: action };
  }
  if (action.includes("send")) return { bg: "#1e3a8a", label: action };
  return { bg: "#334155", label: action };
}

/**
 * Recent admin audit log (client filter by actor email).
 */
export default function AdminAuditScreen() {
  const { getToken } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEmail, setFilterEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("/api/admin/audit-log", { method: "GET", getToken });
      if (!res.ok) {
        setError(`Failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { entries: AuditEntry[] };
      setEntries(data.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = filterEmail.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.adminEmail.toLowerCase().includes(q));
  }, [entries, filterEmail]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text style={{ color: WHITE, fontSize: 20, fontWeight: "700", marginBottom: 8 }}>Audit log</Text>
      <Text style={{ color: MUTED, fontSize: 14, marginBottom: 16 }}>Last 100 actions</Text>

      <TextInput
        value={filterEmail}
        onChangeText={setFilterEmail}
        placeholder="Filter by admin email"
        placeholderTextColor={MUTED}
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: BORDER,
          borderRadius: 8,
          padding: 10,
          color: WHITE,
          backgroundColor: CARD,
          marginBottom: 16,
        }}
      />

      {loading ? (
        <ActivityIndicator color={ACCENT} />
      ) : error ? (
        <View>
          <Text style={{ color: "#f87171", marginBottom: 12 }}>{error}</Text>
          <Pressable
            onPress={() => void load()}
            style={{ backgroundColor: ACCENT, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: "flex-start" }}
          >
            <Text style={{ color: WHITE, fontWeight: "600" }}>Retry</Text>
          </Pressable>
        </View>
      ) : isDesktop ? (
        <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 10, overflow: "hidden" }}>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#0a0f1e",
              paddingVertical: 10,
              paddingHorizontal: 8,
              borderBottomWidth: 1,
              borderBottomColor: BORDER,
            }}
          >
            <Text style={{ flex: 1.2, color: MUTED, fontSize: 11, fontWeight: "700" }}>DATE</Text>
            <Text style={{ flex: 1, color: MUTED, fontSize: 11, fontWeight: "700" }}>ADMIN</Text>
            <Text style={{ flex: 0.9, color: MUTED, fontSize: 11, fontWeight: "700" }}>ACTION</Text>
            <Text style={{ flex: 1, color: MUTED, fontSize: 11, fontWeight: "700" }}>TARGET</Text>
            <Text style={{ flex: 1.4, color: MUTED, fontSize: 11, fontWeight: "700" }}>DETAILS</Text>
          </View>
          {filtered.map((row) => {
            const b = actionBadge(row.action);
            return (
              <View
                key={row.id}
                style={{
                  flexDirection: "row",
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: BORDER,
                  backgroundColor: CARD,
                  alignItems: "flex-start",
                }}
              >
                <Text style={{ flex: 1.2, color: WHITE, fontSize: 12 }}>
                  {new Date(row.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={{ flex: 1, color: MUTED, fontSize: 12 }} numberOfLines={2}>
                  {row.adminEmail}
                </Text>
                <View style={{ flex: 0.9 }}>
                  <View style={{ alignSelf: "flex-start", backgroundColor: b.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: WHITE, fontSize: 10 }} numberOfLines={1}>
                      {b.label}
                    </Text>
                  </View>
                </View>
                <Text style={{ flex: 1, color: MUTED, fontSize: 11 }} numberOfLines={3}>
                  {row.targetEmail ?? row.targetId ?? "—"}
                </Text>
                <Text style={{ flex: 1.4, color: MUTED, fontSize: 11 }} numberOfLines={4}>
                  {formatMetadata(row.metadata)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        filtered.map((row) => {
          const b = actionBadge(row.action);
          return (
            <View
              key={row.id}
              style={{
                padding: 14,
                marginBottom: 10,
                backgroundColor: CARD,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: BORDER,
              }}
            >
              <Text style={{ color: WHITE, fontSize: 13, marginBottom: 6 }}>
                {new Date(row.createdAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
              <Text style={{ color: MUTED, fontSize: 12 }}>Admin: {row.adminEmail}</Text>
              <View style={{ alignSelf: "flex-start", marginVertical: 6, backgroundColor: b.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ color: WHITE, fontSize: 12 }}>{b.label}</Text>
              </View>
              <Text style={{ color: MUTED, fontSize: 12 }}>Target: {row.targetEmail ?? row.targetId ?? "—"}</Text>
              <Text style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>{formatMetadata(row.metadata)}</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
