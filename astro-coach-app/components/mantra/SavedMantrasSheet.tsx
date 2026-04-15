import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { BottomSheetModal } from "./BottomSheetModal";
import { useAuth } from "@/lib/auth";
import {
  getSavedMantras,
  deleteSavedMantra,
  type MantraSave,
} from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelectSave: (save: MantraSave) => void;
  currentMantraText: string | null;
  onSaveCurrent: () => Promise<void>;
  isSaving: boolean;
};

function getTitle(save: MantraSave, lang: string): string {
  const text = lang === "fa" ? save.mantraFa : save.mantraEn;
  const words = text.trim().split(/\s+/).slice(0, 3).join(" ");
  return words + "...";
}

export function SavedMantrasSheet({
  open,
  onClose,
  onSelectSave,
  currentMantraText,
  onSaveCurrent,
  isSaving,
}: Props) {
  const { i18n } = useTranslation();
  const { getToken } = useAuth();
  const lang = i18n.language.startsWith("fa") ? "fa" : "en";
  const isRtl = lang === "fa";
  const [saves, setSaves] = useState<MantraSave[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSaves = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getSavedMantras(getToken);
      setSaves(result.saves);
    } catch {
      // non-fatal
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (open) void loadSaves();
  }, [open, loadSaves]);

  const handleDelete = async (saveId: string) => {
    try {
      await deleteSavedMantra(getToken, saveId);
      setSaves((prev) => prev.filter((s) => s.id !== saveId));
    } catch {
      // non-fatal
    }
  };

  return (
    <BottomSheetModal open={open} onClose={onClose} snapHeight="70%">
      <View style={{ flex: 1, paddingTop: 8 }}>
        {/* Header row */}
        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: "700",
              writingDirection: isRtl ? "rtl" : "ltr",
            }}
          >
            {isRtl ? "مانتراهای ذخیره‌شده" : "Saved Mantras"}
          </Text>
          {/* Save current button */}
          <Pressable
            onPress={() => void onSaveCurrent()}
            disabled={isSaving || !currentMantraText}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "rgba(124,58,237,0.7)",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              opacity: isSaving || !currentMantraText ? 0.5 : 1,
            }}
          >
            <Ionicons name="bookmark" size={14} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
              {isSaving
                ? isRtl
                  ? "در حال ذخیره..."
                  : "Saving..."
                : isRtl
                  ? "ذخیره این مانترا"
                  : "Save this"}
            </Text>
          </Pressable>
        </View>

        {/* List */}
        {isLoading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 32 }} />
        ) : saves.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 40, opacity: 0.5 }}>
            <Ionicons name="bookmark-outline" size={36} color="#fff" />
            <Text
              style={{
                color: "#fff",
                fontSize: 14,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              {isRtl ? "هنوز مانترایی ذخیره نکرده‌ای" : "No saved mantras yet"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={saves}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 32,
              gap: 10,
            }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelectSave(item);
                  onClose();
                }}
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: isRtl ? "row-reverse" : "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: "600",
                      writingDirection: isRtl ? "rtl" : "ltr",
                      textAlign: isRtl ? "right" : "left",
                      marginBottom: 4,
                    }}
                  >
                    {getTitle(item, lang)}
                  </Text>
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 12,
                      writingDirection: isRtl ? "rtl" : "ltr",
                      textAlign: isRtl ? "right" : "left",
                    }}
                  >
                    {item.planetLabel} · {item.qualityLabel}
                  </Text>
                </View>
                {/* Delete button */}
                <Pressable onPress={() => void handleDelete(item.id)} hitSlop={8} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.35)" />
                </Pressable>
              </Pressable>
            )}
          />
        )}
      </View>
    </BottomSheetModal>
  );
}
