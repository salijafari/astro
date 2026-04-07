import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

const BG = "#0f172a";
const CARD = "#1e293b";
const BORDER = "#334155";
const ACCENT = "#7c3aed";
const MUTED = "#94a3b8";
const WHITE = "#ffffff";

const PRIMARY = "publishvibe@gmail.com";

type AdminRow = {
  id: string;
  email: string;
  addedBy: string | null;
  createdAt: string;
};

/**
 * Manage AdminUser allowlist.
 */
export default function AdminAdminsScreen() {
  const { getToken } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("/api/admin/admins", { method: "GET", getToken });
      if (!res.ok) {
        setError(`Failed to load (${res.status})`);
        return;
      }
      const data = (await res.json()) as { admins: AdminRow[] };
      setAdmins(data.admins);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const addAdmin = async () => {
    setFormError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setFormError("Enter a valid email");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("/api/admin/admins", {
        method: "POST",
        getToken,
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        const text = await res.text();
        setFormError(text || `Failed (${res.status})`);
        return;
      }
      setEmail("");
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const removeAdmin = async (row: AdminRow) => {
    if (row.email.toLowerCase() === PRIMARY) return;
    if (typeof window !== "undefined" && !window.confirm(`Remove admin ${row.email}?`)) return;
    setRemovingId(row.id);
    try {
      const res = await apiRequest(`/api/admin/admins/${row.id}`, { method: "DELETE", getToken });
      if (res.ok) await load();
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text style={{ color: WHITE, fontSize: 20, fontWeight: "700", marginBottom: 8 }}>Admins</Text>
      <Text style={{ color: MUTED, fontSize: 14, marginBottom: 20 }}>Dashboard admin allowlist (plus legacy User.isAdmin)</Text>

      <View
        style={{
          borderWidth: 1,
          borderColor: BORDER,
          borderRadius: 12,
          padding: 16,
          backgroundColor: CARD,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>Add admin email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="admin@example.com"
          placeholderTextColor={MUTED}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{
            borderWidth: 1,
            borderColor: BORDER,
            borderRadius: 8,
            padding: 10,
            color: WHITE,
            marginBottom: 10,
          }}
        />
        {formError ? <Text style={{ color: "#f87171", marginBottom: 8, fontSize: 13 }}>{formError}</Text> : null}
        <Pressable
          onPress={() => void addAdmin()}
          disabled={submitting}
          style={{
            backgroundColor: ACCENT,
            paddingVertical: 12,
            borderRadius: 8,
            alignItems: "center",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? <ActivityIndicator color={WHITE} /> : <Text style={{ color: WHITE, fontWeight: "600" }}>Add</Text>}
        </Pressable>
      </View>

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
      ) : (
        admins.map((row) => {
          const isPrimary = row.email.toLowerCase() === PRIMARY;
          return (
            <View
              key={row.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 14,
                marginBottom: 10,
                backgroundColor: CARD,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: BORDER,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: WHITE, fontWeight: "600" }}>{row.email}</Text>
                <Text style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
                  Added by {row.addedBy ?? "—"} · {new Date(row.createdAt).toLocaleString()}
                </Text>
                {isPrimary ? (
                  <Text style={{ color: MUTED, fontSize: 11, marginTop: 4, fontStyle: "italic" }}>Primary admin</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => void removeAdmin(row)}
                disabled={isPrimary || removingId === row.id}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: isPrimary ? "#334155" : "#7f1d1d",
                  opacity: isPrimary ? 0.5 : 1,
                }}
              >
                {removingId === row.id ? (
                  <ActivityIndicator color={WHITE} size="small" />
                ) : (
                  <Text style={{ color: isPrimary ? MUTED : WHITE, fontSize: 12, fontWeight: "600" }}>Remove</Text>
                )}
              </Pressable>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
