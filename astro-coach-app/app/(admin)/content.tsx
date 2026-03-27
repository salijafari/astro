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

type ContentType =
  | "signs"
  | "planets"
  | "houses"
  | "tarot"
  | "coffee-symbols"
  | "challenges"
  | "conflicts";

const CONTENT_TYPES: { label: string; key: ContentType; idField: string }[] = [
  { label: "Zodiac Signs", key: "signs", idField: "sign" },
  { label: "Planets", key: "planets", idField: "name" },
  { label: "Houses", key: "houses", idField: "number" },
  { label: "Tarot Cards", key: "tarot", idField: "cardId" },
  { label: "Coffee Symbols", key: "coffee-symbols", idField: "symbol" },
  { label: "Life Challenges", key: "challenges", idField: "challengeId" },
  { label: "Conflict Types", key: "conflicts", idField: "conflictTypeId" },
];

/**
 * Content Manager screen — lists all entries for a selected content type
 * and allows inline editing of JSON fields via a text editor.
 *
 * Editing is intentionally raw JSON — this is an admin-only internal tool.
 */
const ContentManager: React.FC = () => {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const [selectedType, setSelectedType] = useState<ContentType>("signs");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [saving, setSaving] = useState(false);

  const c = theme.colors;
  const typeConfig = CONTENT_TYPES.find((t) => t.key === selectedType)!;

  const loadRows = useCallback(async () => {
    setLoading(true);
    setEditingId(null);
    try {
      const res = await apiRequest(`/api/admin/content/${selectedType}`, {
        method: "GET",
        getToken,
      });
      if (res.ok) setRows(await res.json());
      else Alert.alert("Error", `Failed to load ${selectedType}.`);
    } catch {
      Alert.alert("Error", "Network error loading content.");
    } finally {
      setLoading(false);
    }
  }, [selectedType, getToken]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const startEdit = (row: Record<string, unknown>) => {
    const id = String(row[typeConfig.idField]);
    setEditingId(id);
    setEditBuffer(JSON.stringify(row, null, 2));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const parsed = JSON.parse(editBuffer) as Record<string, unknown>;
      const idValue = editingId;
      const res = await apiRequest(
        `/api/admin/content/${selectedType}/${encodeURIComponent(idValue)}`,
        {
          method: "PUT",
          body: JSON.stringify(parsed),
          getToken,
        }
      );
      if (res.ok) {
        Alert.alert("Saved", `${selectedType} entry updated.`);
        setEditingId(null);
        await loadRows();
      } else {
        const err = await res.json() as { error?: string };
        Alert.alert("Save failed", err.error ?? "Unknown error.");
      }
    } catch {
      Alert.alert("Error", "Invalid JSON — could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.background }} edges={["bottom"]}>
      {/* Type selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
        className="max-h-14"
      >
        {CONTENT_TYPES.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setSelectedType(t.key)}
            className="rounded-full px-4 py-2"
            style={{
              backgroundColor: selectedType === t.key ? c.primary : c.surface,
            }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: selectedType === t.key ? c.onPrimary : c.onSurface }}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.primary} />
        </View>
      ) : editingId ? (
        // Edit mode
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="flex-row items-center justify-between px-4 py-3">
            <Pressable onPress={() => setEditingId(null)}>
              <Ionicons name="close" size={24} color={c.onBackground} />
            </Pressable>
            <Text className="font-semibold" style={{ color: c.onBackground }}>
              Editing: {editingId}
            </Text>
            <Pressable onPress={saveEdit} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={c.primary} size="small" />
              ) : (
                <Ionicons name="checkmark" size={24} color={c.primary} />
              )}
            </Pressable>
          </View>
          <ScrollView className="flex-1 px-4">
            <TextInput
              value={editBuffer}
              onChangeText={setEditBuffer}
              multiline
              className="rounded-xl p-4 font-mono text-xs"
              style={{
                backgroundColor: c.surface,
                color: c.onBackground,
                minHeight: 400,
                textAlignVertical: "top",
              }}
              autoCorrect={false}
              spellCheck={false}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        // List mode
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item[typeConfig.idField])}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const id = String(item[typeConfig.idField]);
            const preview =
              (item["label"] as string) ??
              (item["name"] as string) ??
              (item["sign"] as string) ??
              (item["symbol"] as string) ??
              id;
            return (
              <Pressable
                onPress={() => startEdit(item)}
                className="mb-2 flex-row items-center rounded-xl px-4 py-3"
                style={{ backgroundColor: c.surface }}
              >
                <View className="flex-1">
                  <Text className="font-medium text-sm" style={{ color: c.onBackground }}>
                    {preview}
                  </Text>
                  <Text className="text-xs mt-0.5" style={{ color: c.onSurfaceVariant }}>
                    ID: {id}
                  </Text>
                </View>
                <Ionicons name="pencil-outline" size={18} color={c.onSurfaceVariant} />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text className="text-center mt-10" style={{ color: c.onSurfaceVariant }}>
              No entries found.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default ContentManager;
