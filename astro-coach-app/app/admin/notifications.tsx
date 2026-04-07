import { useCallback, useEffect, useRef, useState } from "react";
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

type TargetKey = "all" | "free" | "trial" | "premium" | "user";

const TARGET_OPTIONS: { key: TargetKey; label: string }[] = [
  { key: "all", label: "All Users" },
  { key: "free", label: "Free Users" },
  { key: "trial", label: "Trial Users" },
  { key: "premium", label: "Premium Users" },
  { key: "user", label: "Specific User" },
];

type UserRow = {
  id: string;
  name: string;
  email: string;
};

/**
 * Send FCM broadcast segments via admin API.
 */
export default function AdminNotificationsScreen() {
  const { getToken } = useAuth();
  const [target, setTarget] = useState<TargetKey>("all");
  const [userSearch, setUserSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(userSearch.trim()), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userSearch]);

  const searchUsers = useCallback(async () => {
    if (!debouncedSearch) {
      setSearchResults([]);
      return;
    }
    try {
      const q = new URLSearchParams({ search: debouncedSearch, limit: "15", page: "1", filter: "all" });
      const res = await apiRequest(`/api/admin/users?${q}`, { method: "GET", getToken });
      if (res.ok) {
        const data = (await res.json()) as { users: UserRow[] };
        setSearchResults(data.users);
      }
    } catch {
      setSearchResults([]);
    }
  }, [debouncedSearch, getToken]);

  useEffect(() => {
    if (target !== "user") {
      setSearchResults([]);
      return;
    }
    void searchUsers();
  }, [target, searchUsers]);

  const send = async () => {
    setError(null);
    setSuccess(null);
    if (!title.trim() || !body.trim()) {
      setError("Title and message are required");
      return;
    }
    if (target === "user" && !selectedUser) {
      setError("Pick a user from search results");
      return;
    }
    setSending(true);
    try {
      const res = await apiRequest("/api/admin/notifications/send", {
        method: "POST",
        getToken,
        body: JSON.stringify({
          target,
          userId: target === "user" ? selectedUser?.id : undefined,
          title: title.slice(0, 50),
          body: body.slice(0, 200),
        }),
      });
      const data = (await res.json()) as { error?: string; sent?: number; recipientUsers?: number };
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setSuccess(
        `Sent ${data.sent ?? 0} notifications (${data.recipientUsers ?? 0} users with tokens).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text style={{ color: WHITE, fontSize: 20, fontWeight: "700", marginBottom: 8 }}>Notifications</Text>
      <Text style={{ color: MUTED, fontSize: 14, marginBottom: 20 }}>Push via FCM (registered devices only)</Text>

      <Text style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>Target</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {TARGET_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => {
              setTarget(opt.key);
              if (opt.key !== "user") setSelectedUser(null);
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: target === opt.key ? "#4c1d95" : CARD,
              borderWidth: 1,
              borderColor: target === opt.key ? ACCENT : BORDER,
            }}
          >
            <Text style={{ color: target === opt.key ? WHITE : MUTED, fontSize: 13 }}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      {target === "user" ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>Search user by email</Text>
          <TextInput
            value={userSearch}
            onChangeText={(t) => {
              setUserSearch(t);
              setSelectedUser(null);
            }}
            placeholder="email@…"
            placeholderTextColor={MUTED}
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: BORDER,
              borderRadius: 8,
              padding: 10,
              color: WHITE,
              backgroundColor: CARD,
              marginBottom: 8,
            }}
          />
          {selectedUser ? (
            <Text style={{ color: "#86efac", fontSize: 13 }}>
              Selected: {selectedUser.name} ({selectedUser.email})
            </Text>
          ) : null}
          {searchResults.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => setSelectedUser(u)}
              style={{
                padding: 10,
                backgroundColor: CARD,
                borderRadius: 8,
                marginTop: 6,
                borderWidth: 1,
                borderColor: selectedUser?.id === u.id ? ACCENT : BORDER,
              }}
            >
              <Text style={{ color: WHITE, fontWeight: "600" }}>{u.name || "—"}</Text>
              <Text style={{ color: MUTED, fontSize: 12 }}>{u.email}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>Title ({title.length}/50)</Text>
      <TextInput
        value={title}
        onChangeText={(t) => setTitle(t.slice(0, 50))}
        placeholder="Short title"
        placeholderTextColor={MUTED}
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

      <Text style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>Message ({body.length}/200)</Text>
      <TextInput
        value={body}
        onChangeText={(t) => setBody(t.slice(0, 200))}
        placeholder="Notification body"
        placeholderTextColor={MUTED}
        multiline
        numberOfLines={4}
        style={{
          borderWidth: 1,
          borderColor: BORDER,
          borderRadius: 8,
          padding: 10,
          color: WHITE,
          backgroundColor: CARD,
          minHeight: 100,
          textAlignVertical: "top",
          marginBottom: 16,
        }}
      />

      {error ? <Text style={{ color: "#f87171", marginBottom: 12 }}>{error}</Text> : null}
      {success ? <Text style={{ color: "#86efac", marginBottom: 12 }}>{success}</Text> : null}

      <Pressable
        onPress={() => void send()}
        disabled={sending}
        style={{
          backgroundColor: ACCENT,
          paddingVertical: 14,
          borderRadius: 8,
          alignItems: "center",
          opacity: sending ? 0.6 : 1,
        }}
      >
        {sending ? <ActivityIndicator color={WHITE} /> : <Text style={{ color: WHITE, fontWeight: "700" }}>Send</Text>}
      </Pressable>
    </ScrollView>
  );
}
