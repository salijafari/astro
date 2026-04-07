import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

const BG = "#0f172a";
const SIDEBAR = "#0a0f1e";
const CARD = "#1e293b";
const BORDER = "#334155";
const ACCENT = "#7c3aed";
const MUTED = "#94a3b8";
const WHITE = "#ffffff";

type FilterTab = "all" | "free" | "trial" | "premium";

type UserRow = {
  id: string;
  name: string;
  email: string;
  subscriptionStatus: string;
  premiumExpiresAt: string | null;
  premiumUnlimited: boolean;
  trialStartedAt: string | null;
  onboardingComplete: boolean;
  language: string;
  createdAt: string;
  isAdmin: boolean;
  birthProfile: { id: string } | null;
  _count: { peopleProfiles: number };
};

type UserDetailResponse = {
  user: UserRow & {
    birthProfile: Record<string, unknown> | null;
    updatedAt?: string;
    stripeCustomerId?: string | null;
  };
  counts: { peopleProfiles: number; chatSessions: number };
};

function initials(name: string, email: string): string {
  const n = name.trim();
  if (n.length >= 2) return (n[0]! + n[1]!).toUpperCase();
  if (n.length === 1) return n[0]!.toUpperCase();
  const e = email.trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  return "?";
}

function badgeKind(row: Pick<UserRow, "subscriptionStatus" | "trialStartedAt" | "premiumExpiresAt" | "premiumUnlimited">): {
  label: string;
  bg: string;
  fg: string;
} {
  if (row.subscriptionStatus === "free" && row.trialStartedAt) {
    return { label: "Trial", bg: "#ca8a04", fg: "#fff" };
  }
  if (row.premiumUnlimited || row.subscriptionStatus === "vip") {
    return { label: row.subscriptionStatus === "vip" ? "VIP" : "Premium", bg: "#16a34a", fg: "#fff" };
  }
  if (
    row.premiumExpiresAt &&
    new Date(row.premiumExpiresAt) <= new Date() &&
    !row.premiumUnlimited &&
    (row.subscriptionStatus === "premium" || row.subscriptionStatus === "vip")
  ) {
    return { label: "Expired", bg: "#dc2626", fg: "#fff" };
  }
  if (row.subscriptionStatus === "premium" || row.subscriptionStatus === "vip") {
    return { label: "Premium", bg: "#16a34a", fg: "#fff" };
  }
  return { label: "Free", bg: "#475569", fg: "#fff" };
}

async function adminConfirm(message: string): Promise<boolean> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => {
    Alert.alert("Confirm", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "OK", onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Admin user list, filters, pagination, and detail/actions drawer.
 */
export default function AdminUsersScreen() {
  const { getToken } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [detail, setDetail] = useState<UserDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; message: string } | null>(null);
  const [expiryInput, setExpiryInput] = useState("");

  const limit = 20;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        filter,
      });
      if (debouncedSearch) q.set("search", debouncedSearch);
      const res = await apiRequest(`/api/admin/users?${q.toString()}`, { method: "GET", getToken });
      if (!res.ok) {
        setListError(`Failed to load users (${res.status})`);
        return;
      }
      const data = (await res.json()) as { users: UserRow[]; total: number };
      setUsers(data.users);
      setTotal(data.total);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [getToken, page, filter, debouncedSearch]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      try {
        const res = await apiRequest(`/api/admin/users/${id}`, { method: "GET", getToken });
        if (res.ok) {
          setDetail((await res.json()) as UserDetailResponse);
        }
      } finally {
        setDetailLoading(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    if (selected) void loadDetail(selected.id);
  }, [selected, loadDetail]);

  const maxPage = Math.max(1, Math.ceil(total / limit));

  const runAction = async (key: string, fn: () => Promise<boolean>) => {
    setActionBusy(key);
    try {
      const ok = await fn();
      if (ok) {
        setToast({ type: "ok", message: "Saved successfully" });
        void loadList();
        if (selected) void loadDetail(selected.id);
      }
    } catch (e) {
      setToast({
        type: "err",
        message: e instanceof Error ? e.message : "Action failed",
      });
    } finally {
      setActionBusy(null);
    }
  };

  const grantLifetime = async () => {
    if (!selected) return;
    if (!(await adminConfirm("Grant lifetime premium to this user?"))) return;
    await runAction("grant", async () => {
      const res = await apiRequest(`/api/admin/users/${selected.id}/grant-premium`, {
        method: "POST",
        getToken,
      });
      if (!res.ok) {
        setToast({ type: "err", message: (await res.text()) || `Failed (${res.status})` });
        return false;
      }
      return true;
    });
  };

  const grantUntil = async () => {
    if (!selected || !expiryInput.trim()) {
      setToast({ type: "err", message: "Enter a date (YYYY-MM-DD)" });
      return;
    }
    const iso = new Date(`${expiryInput.trim()}T23:59:59.000Z`).toISOString();
    if (Number.isNaN(Date.parse(iso))) {
      setToast({ type: "err", message: "Invalid date" });
      return;
    }
    if (!(await adminConfirm(`Set premium until ${expiryInput.trim()}?`))) return;
    await runAction("until", async () => {
      const res = await apiRequest(`/api/admin/users/${selected.id}/subscription`, {
        method: "PUT",
        getToken,
        body: JSON.stringify({
          status: "premium",
          expiresAt: iso,
          unlimited: false,
        }),
      });
      if (!res.ok) {
        setToast({ type: "err", message: (await res.text()) || `Failed (${res.status})` });
        return false;
      }
      return true;
    });
  };

  const revokePremium = async () => {
    if (!selected) return;
    if (!(await adminConfirm("Revoke premium for this user?"))) return;
    await runAction("revoke", async () => {
      const res = await apiRequest(`/api/admin/users/${selected.id}/revoke-premium`, {
        method: "POST",
        getToken,
      });
      if (!res.ok) {
        setToast({ type: "err", message: (await res.text()) || `Failed (${res.status})` });
        return false;
      }
      return true;
    });
  };

  const disableAccount = async () => {
    if (!selected) return;
    if (
      !(await adminConfirm(
        "Disable this account? This cannot be undone (soft delete).",
      ))
    )
      return;
    await runAction("delete", async () => {
      const res = await apiRequest(`/api/admin/users/${selected.id}`, { method: "DELETE", getToken });
      if (!res.ok) {
        setToast({ type: "err", message: (await res.text()) || `Failed (${res.status})` });
        return false;
      }
      setSelected(null);
      setDetail(null);
      return true;
    });
  };

  const filterTabs = useMemo(
    () =>
      (["all", "free", "trial", "premium"] as const).map((f) => ({
        key: f,
        label: f.charAt(0).toUpperCase() + f.slice(1),
      })),
    [],
  );

  const detailUser = detail?.user ?? selected;

  const panelContent = detailLoading ? (
    <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
  ) : detailUser ? (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: ACCENT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: WHITE, fontSize: 24, fontWeight: "700" }}>
            {initials(detailUser.name, detailUser.email)}
          </Text>
        </View>
        <Text style={{ color: WHITE, fontSize: 18, fontWeight: "700", marginTop: 8 }}>{detailUser.name}</Text>
        <Text style={{ color: MUTED, fontSize: 13 }}>{detailUser.email}</Text>
        {(() => {
          const b = badgeKind(detailUser);
          return (
            <View style={{ marginTop: 8, backgroundColor: b.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ color: b.fg, fontWeight: "600", fontSize: 12 }}>{b.label}</Text>
            </View>
          );
        })()}
      </View>

      <Text style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>Joined</Text>
      <Text style={{ color: WHITE, marginBottom: 12 }}>
        {new Date(detailUser.createdAt).toLocaleString()}
      </Text>
      <Text style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>Language</Text>
      <Text style={{ color: WHITE, marginBottom: 12 }}>{detailUser.language}</Text>
      <Text style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>Onboarding</Text>
      <Text style={{ color: WHITE, marginBottom: 12 }}>
        {detailUser.onboardingComplete ? "Complete" : "Incomplete"}
      </Text>
      <Text style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>People profiles</Text>
      <Text style={{ color: WHITE, marginBottom: 12 }}>
        {detail?.counts.peopleProfiles ?? detailUser._count?.peopleProfiles ?? 0}
      </Text>
      {detailUser.trialStartedAt ? (
        <>
          <Text style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>Trial started</Text>
          <Text style={{ color: WHITE, marginBottom: 12 }}>
            {new Date(detailUser.trialStartedAt).toLocaleString()}
          </Text>
        </>
      ) : null}
      {detailUser.premiumExpiresAt ? (
        <>
          <Text style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>Premium expires</Text>
          <Text style={{ color: WHITE, marginBottom: 16 }}>
            {new Date(detailUser.premiumExpiresAt).toLocaleString()}
          </Text>
        </>
      ) : null}

      <Text style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>Premium until (YYYY-MM-DD)</Text>
      <TextInput
        value={expiryInput}
        onChangeText={setExpiryInput}
        placeholder="2026-12-31"
        placeholderTextColor={MUTED}
        style={{
          borderWidth: 1,
          borderColor: BORDER,
          borderRadius: 8,
          padding: 10,
          color: WHITE,
          marginBottom: 12,
        }}
      />

      <Pressable
        onPress={() => void grantLifetime()}
        disabled={!!actionBusy}
        style={{
          backgroundColor: ACCENT,
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          marginBottom: 8,
          opacity: actionBusy ? 0.6 : 1,
        }}
      >
        {actionBusy === "grant" ? (
          <ActivityIndicator color={WHITE} />
        ) : (
          <Text style={{ color: WHITE, fontWeight: "600" }}>Grant Lifetime Premium</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => void grantUntil()}
        disabled={!!actionBusy}
        style={{
          backgroundColor: "#2563eb",
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          marginBottom: 8,
          opacity: actionBusy ? 0.6 : 1,
        }}
      >
        {actionBusy === "until" ? (
          <ActivityIndicator color={WHITE} />
        ) : (
          <Text style={{ color: WHITE, fontWeight: "600" }}>Grant Premium Until Date</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => void revokePremium()}
        disabled={!!actionBusy}
        style={{
          backgroundColor: "#ea580c",
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          marginBottom: 8,
          opacity: actionBusy ? 0.6 : 1,
        }}
      >
        {actionBusy === "revoke" ? (
          <ActivityIndicator color={WHITE} />
        ) : (
          <Text style={{ color: WHITE, fontWeight: "600" }}>Revoke Premium</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => void disableAccount()}
        disabled={!!actionBusy}
        style={{
          backgroundColor: "#b91c1c",
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          opacity: actionBusy ? 0.6 : 1,
        }}
      >
        {actionBusy === "delete" ? (
          <ActivityIndicator color={WHITE} />
        ) : (
          <Text style={{ color: WHITE, fontWeight: "600" }}>Disable Account</Text>
        )}
      </Pressable>
    </ScrollView>
  ) : null;

  const closePanel = () => {
    setSelected(null);
    setDetail(null);
    setExpiryInput("");
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <Text style={{ color: WHITE, fontSize: 20, fontWeight: "700", marginBottom: 12 }}>Users</Text>
        <TextInput
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            setPage(1);
          }}
          placeholder="Search by name or email"
          placeholderTextColor={MUTED}
          style={{
            borderWidth: 1,
            borderColor: BORDER,
            borderRadius: 8,
            padding: 12,
            color: WHITE,
            backgroundColor: CARD,
          }}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {filterTabs.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => {
                setFilter(t.key);
                setPage(1);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: filter === t.key ? "#4c1d95" : CARD,
                borderWidth: 1,
                borderColor: filter === t.key ? ACCENT : BORDER,
              }}
            >
              <Text style={{ color: filter === t.key ? WHITE : MUTED, fontWeight: "600", fontSize: 13 }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {listError ? (
        <View style={{ padding: 20 }}>
          <Text style={{ color: "#f87171", marginBottom: 12 }}>{listError}</Text>
          <Pressable
            onPress={() => void loadList()}
            style={{ backgroundColor: ACCENT, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: "flex-start" }}
          >
            <Text style={{ color: WHITE, fontWeight: "600" }}>Retry</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
          renderItem={({ item }) => {
            const b = badgeKind(item);
            return (
              <Pressable
                onPress={() => setSelected(item)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 12,
                  marginBottom: 8,
                  backgroundColor: CARD,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: BORDER,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: ACCENT,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Text style={{ color: WHITE, fontWeight: "700" }}>{initials(item.name, item.email)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: WHITE, fontWeight: "700" }} numberOfLines={1}>
                    {item.name || "—"}
                  </Text>
                  <Text style={{ color: MUTED, fontSize: 12 }} numberOfLines={1}>
                    {item.email}
                  </Text>
                  <View style={{ flexDirection: "row", marginTop: 6, alignItems: "center", gap: 8 }}>
                    <View style={{ backgroundColor: b.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ color: b.fg, fontSize: 11, fontWeight: "600" }}>{b.label}</Text>
                    </View>
                  </View>
                </View>
                <Text style={{ color: MUTED, fontSize: 11 }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 16,
          borderTopWidth: 1,
          borderTopColor: BORDER,
          backgroundColor: BG,
        }}
      >
        <Pressable
          onPress={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          style={{ opacity: page <= 1 ? 0.4 : 1 }}
        >
          <Text style={{ color: ACCENT, fontWeight: "600" }}>Previous</Text>
        </Pressable>
        <Text style={{ color: MUTED, fontSize: 13 }}>
          Page {page} / {maxPage}
        </Text>
        <Pressable
          onPress={() => setPage((p) => Math.min(maxPage, p + 1))}
          disabled={page >= maxPage || loading}
          style={{ opacity: page >= maxPage ? 0.4 : 1 }}
        >
          <Text style={{ color: ACCENT, fontWeight: "600" }}>Next</Text>
        </Pressable>
      </View>

      {toast ? (
        <View
          style={{
            position: "absolute",
            bottom: 72,
            left: 16,
            right: 16,
            padding: 12,
            borderRadius: 8,
            backgroundColor: toast.type === "ok" ? "#14532d" : "#7f1d1d",
          }}
        >
          <Text style={{ color: WHITE, textAlign: "center" }}>{toast.message}</Text>
        </View>
      ) : null}

      {isDesktop && selected ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: 380,
            backgroundColor: SIDEBAR,
            borderLeftWidth: 1,
            borderLeftColor: BORDER,
            padding: 16,
            zIndex: 10,
          }}
        >
          <Pressable onPress={closePanel} style={{ alignSelf: "flex-end", padding: 8, marginBottom: 8 }}>
            <Ionicons name="close" size={24} color={MUTED} />
          </Pressable>
          {panelContent}
        </View>
      ) : null}

      {!isDesktop ? (
        <Modal visible={!!selected} animationType="slide" onRequestClose={closePanel}>
          <View style={{ flex: 1, backgroundColor: SIDEBAR, paddingTop: 48, paddingHorizontal: 16 }}>
            <Pressable onPress={closePanel} style={{ alignSelf: "flex-end", padding: 8, marginBottom: 8 }}>
              <Ionicons name="close" size={28} color={MUTED} />
            </Pressable>
            {panelContent}
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
