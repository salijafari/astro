import { useState, useCallback, useEffect } from "react";
import {
  View, Text, Pressable, ScrollView, TextInput,
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/providers/ThemeProvider";
import { apiRequest } from "@/lib/api";

interface PromptTemplate {
  id: string;
  featureId: string;
  templateKey: string;
  systemPrompt: string;
  notes?: string | null;
  isActive: boolean;
  updatedAt: string;
}

/**
 * Prompt Templates screen — list, create, edit, activate/deactivate, and delete
 * AI prompt templates stored in the database.
 *
 * Active templates override the static prompt builder functions in the backend.
 */
const PromptsScreen: React.FC = () => {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const c = theme.colors;

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newFeatureId, setNewFeatureId] = useState("");
  const [newTemplateKey, setNewTemplateKey] = useState("");
  const [newSystemPrompt, setNewSystemPrompt] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/api/admin/prompts", { method: "GET", getToken });
      if (res.ok) setTemplates(await res.json());
      else Alert.alert("Error", "Failed to load prompt templates.");
    } catch {
      Alert.alert("Error", "Network error.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await apiRequest(`/api/admin/prompts/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          systemPrompt: editing.systemPrompt,
          notes: editing.notes,
          isActive: editing.isActive,
        }),
        getToken,
      });
      if (res.ok) {
        Alert.alert("Saved");
        setEditing(null);
        await loadTemplates();
      } else {
        const err = await res.json() as { error?: string };
        Alert.alert("Save failed", err.error ?? "Unknown error.");
      }
    } finally {
      setSaving(false);
    }
  };

  const createTemplate = async () => {
    if (!newFeatureId.trim() || !newTemplateKey.trim() || !newSystemPrompt.trim()) {
      Alert.alert("Missing fields", "Feature ID, template key, and system prompt are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("/api/admin/prompts", {
        method: "POST",
        body: JSON.stringify({
          featureId: newFeatureId.trim(),
          templateKey: newTemplateKey.trim(),
          systemPrompt: newSystemPrompt.trim(),
          notes: newNotes.trim() || undefined,
        }),
        getToken,
      });
      if (res.ok) {
        Alert.alert("Created");
        setCreating(false);
        setNewFeatureId(""); setNewTemplateKey(""); setNewSystemPrompt(""); setNewNotes("");
        await loadTemplates();
      } else {
        const err = await res.json() as { error?: string };
        Alert.alert("Create failed", err.error ?? "Unknown error.");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = (id: string) => {
    Alert.alert("Delete template?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await apiRequest(`/api/admin/prompts/${id}`, { method: "DELETE", getToken });
          if (res.ok) await loadTemplates();
          else Alert.alert("Error", "Could not delete.");
        },
      },
    ]);
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
            <Text className="font-semibold text-sm" style={{ color: c.onBackground }}>
              {editing.featureId} / {editing.templateKey}
            </Text>
            <Pressable onPress={saveEdit} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={c.primary} /> : (
                <Ionicons name="checkmark" size={24} color={c.primary} />
              )}
            </Pressable>
          </View>
          <ScrollView className="flex-1 px-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: c.onBackground }}>Active (overrides static prompt)</Text>
              <Switch
                value={editing.isActive}
                onValueChange={(v) => setEditing({ ...editing, isActive: v })}
                trackColor={{ true: c.primary }}
              />
            </View>
            <Text className="mb-1 text-xs font-medium" style={{ color: c.onSurfaceVariant }}>
              NOTES (internal only)
            </Text>
            <TextInput
              value={editing.notes ?? ""}
              onChangeText={(v) => setEditing({ ...editing, notes: v })}
              placeholder="Optional internal notes…"
              placeholderTextColor={c.onSurfaceVariant}
              className="rounded-xl mb-4 px-3 py-2 text-sm"
              style={{ backgroundColor: c.surface, color: c.onBackground }}
            />
            <Text className="mb-1 text-xs font-medium" style={{ color: c.onSurfaceVariant }}>
              SYSTEM PROMPT
            </Text>
            <TextInput
              value={editing.systemPrompt}
              onChangeText={(v) => setEditing({ ...editing, systemPrompt: v })}
              multiline
              className="rounded-xl p-3 text-xs font-mono"
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
      </SafeAreaView>
    );
  }

  if (creating) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: c.background }} edges={["bottom"]}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <Pressable onPress={() => setCreating(false)}>
              <Ionicons name="close" size={24} color={c.onBackground} />
            </Pressable>
            <Text className="font-semibold" style={{ color: c.onBackground }}>New Template</Text>
            <Pressable onPress={createTemplate} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={c.primary} /> : (
                <Ionicons name="checkmark" size={24} color={c.primary} />
              )}
            </Pressable>
          </View>
          <ScrollView className="flex-1 px-4">
            {[
              { label: "Feature ID", value: newFeatureId, setter: setNewFeatureId, placeholder: "e.g. daily_horoscope" },
              { label: "Template Key", value: newTemplateKey, setter: setNewTemplateKey, placeholder: "e.g. system_v2" },
              { label: "Notes (internal)", value: newNotes, setter: setNewNotes, placeholder: "Optional notes" },
            ].map((field) => (
              <View key={field.label} className="mb-4">
                <Text className="mb-1 text-xs font-medium" style={{ color: c.onSurfaceVariant }}>
                  {field.label.toUpperCase()}
                </Text>
                <TextInput
                  value={field.value}
                  onChangeText={field.setter}
                  placeholder={field.placeholder}
                  placeholderTextColor={c.onSurfaceVariant}
                  className="rounded-xl px-3 py-2 text-sm"
                  style={{ backgroundColor: c.surface, color: c.onBackground }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))}
            <Text className="mb-1 text-xs font-medium" style={{ color: c.onSurfaceVariant }}>
              SYSTEM PROMPT
            </Text>
            <TextInput
              value={newSystemPrompt}
              onChangeText={setNewSystemPrompt}
              multiline
              placeholder="Enter the full system prompt…"
              placeholderTextColor={c.onSurfaceVariant}
              className="rounded-xl p-3 text-xs"
              style={{
                backgroundColor: c.surface,
                color: c.onBackground,
                minHeight: 300,
                textAlignVertical: "top",
              }}
              autoCorrect={false}
              spellCheck={false}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.background }} edges={["bottom"]}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-xs" style={{ color: c.onSurfaceVariant }}>
          {templates.length} templates
        </Text>
        <Pressable
          onPress={() => setCreating(true)}
          className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
          style={{ backgroundColor: c.primary }}
        >
          <Ionicons name="add" size={16} color={c.onPrimary} />
          <Text className="text-sm font-medium" style={{ color: c.onPrimary }}>New</Text>
        </Pressable>
      </View>
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setEditing(item)}
            className="mb-2 rounded-xl px-4 py-3"
            style={{ backgroundColor: c.surface }}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="font-semibold text-sm" style={{ color: c.onBackground }}>
                  {item.featureId}
                </Text>
                <Text className="text-xs mt-0.5" style={{ color: c.onSurfaceVariant }}>
                  {item.templateKey}
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: item.isActive ? c.primaryContainer : c.surfaceVariant }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: item.isActive ? c.onPrimaryContainer : c.onSurfaceVariant }}
                  >
                    {item.isActive ? "ACTIVE" : "INACTIVE"}
                  </Text>
                </View>
                <Pressable onPress={() => deleteTemplate(item.id)} hitSlop={12}>
                  <Ionicons name="trash-outline" size={16} color={c.error} />
                </Pressable>
              </View>
            </View>
            {item.notes ? (
              <Text className="text-xs mt-1" style={{ color: c.onSurfaceVariant }} numberOfLines={1}>
                {item.notes}
              </Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text className="text-center mt-10" style={{ color: c.onSurfaceVariant }}>
            No templates yet. Active DB templates override static prompt builders.
          </Text>
        }
      />
    </SafeAreaView>
  );
};

export default PromptsScreen;
