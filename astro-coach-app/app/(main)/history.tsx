import { Text, View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { useTranslation } from "react-i18next";

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const ITEMS = [
    { title: t("history.item1Title"), subtitle: t("history.item1Subtitle") },
    { title: t("history.item2Title"), subtitle: t("history.item2Subtitle") },
    { title: t("history.item3Title"), subtitle: t("history.item3Subtitle") },
    { title: t("history.item4Title"), subtitle: t("history.item4Subtitle") },
  ] as const;
  const rtl = i18n.language === "fa";
  return (
    <View className="flex-1 px-4 pb-8" style={{ backgroundColor: theme.colors.background }}>
      <Text className="mb-4 text-4xl font-semibold" style={{ color: theme.colors.onBackground }}>
        {t("main.history")}
      </Text>
      {ITEMS.map((item, idx) => (
        <View key={`${item.title}-${idx}`} className="mb-3 rounded-2xl border px-4 py-3" style={{ borderColor: theme.colors.outline }}>
          <Text className="text-2xl font-semibold" style={{ color: theme.colors.onBackground, writingDirection: rtl ? "rtl" : "ltr" }}>
            {item.title}
          </Text>
          <Text className="text-base" style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr" }}>
            {item.subtitle}
          </Text>
        </View>
      ))}
    </View>
  );
}
