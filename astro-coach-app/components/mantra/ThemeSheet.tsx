import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type FC } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSubscription } from "@/lib/useSubscription";
import type { MantraTheme } from "@/types/mantra";
import { MANTRA_THEMES } from "@/types/mantra";
import { BottomSheetModal } from "./BottomSheetModal";

const THEME_GRADIENT: Record<MantraTheme, [string, string]> = {
  calm: ["#1A4A4A", "#0D2E2E"],
  confidence: ["#4A3A00", "#2E2200"],
  "self-worth": ["#4A1A2A", "#2E0D18"],
  love: ["#4A1A3A", "#2E0D24"],
  healing: ["#1A3A2A", "#0D2418"],
  focus: ["#1A1A4A", "#0D0D2E"],
  growth: ["#1A3A1A", "#0D240D"],
  release: ["#2A1A4A", "#180D2E"],
  hope: ["#3A2A00", "#241A00"],
  faith: ["#001A3A", "#000D24"],
};

const THEME_EMOJI: Record<MantraTheme, string> = {
  calm: "🌊",
  confidence: "☀️",
  "self-worth": "✨",
  love: "💜",
  healing: "🌿",
  focus: "🎯",
  growth: "🌱",
  release: "🕊️",
  hope: "🌅",
  faith: "🙏",
};

export type ThemeSheetProps = {
  open: boolean;
  onClose: () => void;
  selectedTheme: MantraTheme | null;
  onThemeSelect: (t: MantraTheme) => void;
  onThemeClear: () => void;
  onPin: () => void;
  isPinned?: boolean;
};

export const ThemeSheet: FC<ThemeSheetProps> = ({
  open,
  onClose,
  selectedTheme,
  onThemeSelect,
  onThemeClear,
  onPin,
  isPinned,
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith("fa");
  const { hasAccess } = useSubscription();

  return (
    <BottomSheetModal open={open} onClose={onClose} snapHeight="70%">
      <ScrollView
        className="px-4 pb-8"
        style={{ maxHeight: "100%" }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          className="mb-1 text-[22px] font-bold text-white"
          style={{ textAlign: isRtl ? "right" : "left", writingDirection: isRtl ? "rtl" : "ltr" }}
        >
          {t("mantra.themeSheetTitle")}
        </Text>
        <Text
          className="mb-4 text-sm text-white/60"
          style={{ textAlign: isRtl ? "right" : "left", writingDirection: isRtl ? "rtl" : "ltr" }}
        >
          {t("mantra.themeSheetSubtitle")}
        </Text>

        <Pressable
          onPress={() => {
            onThemeClear();
          }}
          className="mb-3 overflow-hidden rounded-xl border-2 p-3"
          style={{
            borderColor: selectedTheme === null ? "#fff" : "rgba(255,255,255,0.15)",
            backgroundColor: "rgba(255,255,255,0.08)",
          }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-white">{t("mantra.noTheme")}</Text>
            {selectedTheme === null ? (
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
            ) : null}
          </View>
        </Pressable>

        <View className="mb-4 flex-row flex-wrap justify-between gap-y-3">
          {MANTRA_THEMES.map((th) => {
            const sel = selectedTheme === th;
            const g = THEME_GRADIENT[th];
            return (
              <Pressable
                key={th}
                onPress={() => onThemeSelect(th)}
                className="mb-1 overflow-hidden rounded-xl border-2"
                style={{
                  width: "48%",
                  height: 100,
                  borderColor: sel ? "#fff" : "transparent",
                }}
              >
                <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 10 }}>
                  <View className="flex-row items-start justify-between">
                    <Text className="text-xl">{THEME_EMOJI[th]}</Text>
                    {sel ? <Ionicons name="checkmark-circle" size={20} color="#fff" /> : null}
                  </View>
                  <Text className="mt-1 text-[15px] font-bold text-white">{t(`mantra.themeLabels.${th}`)}</Text>
                  <Text className="text-xs text-white/70" style={{ writingDirection: isRtl ? "rtl" : "ltr" }}>
                    {t(`mantra.themeLabelsFa.${th}`)}
                  </Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => {
            if (isPinned) return;
            onPin();
          }}
          className="flex-row items-center justify-center rounded-xl py-4"
          style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
        >
          <Ionicons name="pin" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text className="text-base font-medium text-white">{t("mantra.pinSevenDays")}</Text>
          {!hasAccess ? (
            <View className="ml-2 rounded bg-amber-500/30 px-2 py-0.5">
              <Text className="text-xs text-amber-100">Premium</Text>
            </View>
          ) : null}
        </Pressable>
      </ScrollView>
    </BottomSheetModal>
  );
};
