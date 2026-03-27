import { useState, useCallback, useEffect } from "react";
import {
  View, Text, Pressable, ScrollView, TextInput,
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/providers/ThemeProvider";
import { apiRequest } from "@/lib/api";

interface SafetyResponseItem {
  id: string;
  flagType: string;
  response: string;
  escalationNote?: string | null;
  updatedAt: string;
}

/**
 * Safety Responses screen — edit the app's crisis/safety response messages.
 *
 * These are what the AI returns when it detects a safety flag (crisis, abuse, etc.)
 * and are critical to user welfare. Changes take effect within 5 minutes (TTL).
 */
const SafetyScreen: React.FC = () => {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const c = theme.colors;

  const [items, setItems] = useState<SafetyResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SafetyResponseItem | null>(null);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/api/admin/safety-responses", { method: "GET", getToken });
      if (res.ok) setItems(await res.json());
      else Alert.alert("Error", "Failed to load safety responses.");
    } catch {
      Alert.alert("Error", "Network error.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await apiRequest(
        `/api/admin/safety-responses/${encodeURIComponent(editing.flagType)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            response: editing.response,
            escalationNote: editing.escalationNote ?? undefined,
          }),
          getToken,
        }
      );
      if (res.ok) {
        Alert.alert("Saved", "Safety response updated. Live within ~5 minutes.");
        setEditing(null);
        await loadItems();
      } else {
        const err = await res.json() as { error?: string };
        Alert.alert("Save failed", err.error ?? "Unknown error.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </SafeAreaView>
    );
  }

  if (editing) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: c.background }} edges={["bottom"]}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <Pressable onPress={() => setEditing(null)}>
              <Ionicons name="close" size={24} color={c.onBackground} />
            </Pressable>
            <Text className="font-semibold" style={{ color: c.onBackground }}>
              {editing.flagType}
            </Text>
            <Pressable onPress={saveEdit} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={c.primary} /> : (
                <Ionicons name="checkmark" size={24} color={c.primary} />
              )}
            </Pressable>
          </View>
          <ScrollView className="flex-1 px-4">
            {/* Warning banner */}
            <View
              className="mb-4 rounded-xl p-3 flex-row gap-2"
              style={{ backgroundColor: c.errorContainer }}
            >
              <Ionicons name="warning" size={16} color={c.error} />
              <Text className="flex-1 text-xs" style={{ color: c.onErrorContainer }}>
                Safety responses are shown to users in distress. Keep them warm, direct, and human.
                Always include a hotline or professional resource.
              </Text>
            </View>
            <Text className="mb-1 text-xs font-medium" style={{ color: c.onSurfaceVariant }}>
              RESPONSE TEXT
            </Text>
            <TextInput
              value={editing.response}
              onChangeText={(v) => setEditing({ ...editing, response: v })}
              multiline
              className="rounded-xl p-3 text-sm mb-4"
              style={{
                backgroundColor: c.surface,
                color: c.onBackground,
                minHeight: 200,
                textAlignVertical: "top",
              }}
            />
            <Text className="mb-1 text-xs font-medium" style={{ color: c.onSurfaceVariant }}>
              ESCALATION NOTE (internal — not shown to users)
            </Text>
            <TextInput
              value={editing.escalationNote ?? ""}
              onChangeText={(v) => setEditing({ ...editing, escalationNote: v })}
              multiline
              placeholder="Internal notes on escalation procedure…"
              placeholderTextColor={c.onSurfaceVariant}
              className="rounded-xl p-3 text-sm"
              style={{
                backgroundColor: c.surface,
                color: c.onBackground,
                minHeight: 100,
                textAlignVertical: "top",
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.background }} edges={["bottom"]}>
      <View className="px-4 py-3">
        <View
          className="rounded-xl p-3 flex-row gap-2"
          style={{ backgroundColor: c.errorContainer }}
        >
          <Ionicons name="shield-checkmark" size={16} color={c.error} />
          <Text className="flex-1 text-xs" style={{ color: c.onErrorContainer }}>
            These responses are shown when the AI detects crisis, abuse, medical, legal, or
            financial situations. Handle with care.
          </Text>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setEditing(item)}
            className="mb-2 rounded-xl px-4 py-3"
            style={{ backgroundColor: c.surface }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-sm" style={{ color: c.onBackground }}>
                {item.flagType}
              </Text>
              <Ionicons name="pencil-outline" size={16} color={c.onSurfaceVariant} />
            </View>
            <Text className="text-xs mt-1" style={{ color: c.onSurfaceVariant }} numberOfLines={2}>
              {item.response}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text className="text-center mt-10" style={{ color: c.onSurfaceVariant }}>
            No safety responses found. Run the seed script.
          </Text>
        }
      />
    </SafeAreaView>
  );
};

export default SafetyScreen;
