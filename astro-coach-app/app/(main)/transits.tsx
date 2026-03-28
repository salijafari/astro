import { useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/providers/ThemeProvider";

export default function TransitsScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const name = "Ali";
  const rtl = i18n.language === "fa";
  const PLACEHOLDER_TRANSITS = [
    { id: "1", planet: "♄", type: t("transits.t1Type"), range: t("transits.t1Range"), text: t("transits.t1Text") },
    { id: "2", planet: "♀", type: t("transits.t2Type"), range: t("transits.t2Range"), text: t("transits.t2Text") },
    { id: "3", planet: "♆", type: t("transits.t3Type"), range: t("transits.t3Range"), text: t("transits.t3Text") },
  ] as const;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => PLACEHOLDER_TRANSITS.find((item) => item.id === selectedId) ?? null, [selectedId]);

  return (
    <View className="flex-1 px-4 pb-8" style={{ backgroundColor: theme.colors.background }}>
      <Text className="mt-2 text-4xl font-semibold" style={{ color: theme.colors.onBackground, writingDirection: rtl ? "rtl" : "ltr" }}>
        {t("transits.title", { name })}
      </Text>
      <Text className="mt-8 text-xl" style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr" }}>
        {t("transits.outlook")}
      </Text>
      <Text className="mt-2 text-5xl font-semibold leading-[58px]" style={{ color: theme.colors.onBackground, writingDirection: rtl ? "rtl" : "ltr" }}>
        {t("transits.outlookText")}
      </Text>
      <View className="mt-10 flex-row items-center justify-between">
        <Text className="text-3xl font-semibold" style={{ color: theme.colors.onBackground }}>
          {t("transits.upcoming")}
        </Text>
        <View className="rounded-full border px-4 py-2" style={{ borderColor: theme.colors.outline }}>
          <Text style={{ color: theme.colors.onBackground }}>{t("transits.today")}</Text>
        </View>
      </View>
      <Text className="mb-4 mt-1" style={{ color: theme.colors.onSurfaceVariant }}>
        {t("transits.hint")}
      </Text>

      {PLACEHOLDER_TRANSITS.map((item) => (
        <Pressable key={item.id} onPress={() => setSelectedId(item.id)} className="mb-3 flex-row items-center">
          <View className="h-14 w-2 rounded-full" style={{ backgroundColor: theme.colors.cardAccent3 }} />
          <View className="ml-3 flex-1">
            <Text className="text-2xl font-semibold" style={{ color: theme.colors.onBackground }}>{item.type}</Text>
            <Text className="text-base" style={{ color: theme.colors.onSurfaceVariant }}>{item.text}</Text>
            <Text className="text-base" style={{ color: theme.colors.onSurfaceVariant }}>{item.range}</Text>
          </View>
          <Text className="ml-2 text-4xl" style={{ color: theme.colors.onBackground }}>{item.planet}</Text>
        </Pressable>
      ))}

      <Modal transparent visible={Boolean(selected)} animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl border px-5 py-6" style={{ borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }}>
            <Text className="text-3xl font-semibold" style={{ color: theme.colors.onSurface }}>{selected?.type}</Text>
            <Text className="mt-2 text-base" style={{ color: theme.colors.onSurfaceVariant }}>{selected?.range}</Text>
            <Text className="mt-4 text-lg" style={{ color: theme.colors.onSurfaceVariant }}>{selected?.text}</Text>
            <Pressable onPress={() => setSelectedId(null)} className="mt-6 rounded-full px-4 py-3" style={{ backgroundColor: theme.colors.onSurface }}>
              <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.surface }}>{t("common.continue")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
