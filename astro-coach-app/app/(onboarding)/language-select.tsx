import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { I18nManager, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { changeLanguage, ONBOARDING_LANG_SELECTED_KEY, type AppLanguage } from "@/lib/i18n";
import { writePersistedValue } from "@/lib/storage";
import { useTheme } from "@/providers/ThemeProvider";

export default function LanguageSelectScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { theme } = useTheme();
  const [selected, setSelected] = useState<AppLanguage>((i18n.language === "en" ? "en" : "fa") as AppLanguage);

  const isRtl = useMemo(() => selected === "fa", [selected]);

  const handleSelect = async (lng: AppLanguage) => {
    setSelected(lng);
    await changeLanguage(lng);
  };

  const handleContinue = async () => {
    await writePersistedValue(ONBOARDING_LANG_SELECTED_KEY, "1");
    if (I18nManager.isRTL !== isRtl) {
      I18nManager.allowRTL(isRtl);
      I18nManager.forceRTL(isRtl);
    }
    router.replace("/(onboarding)/get-set-up");
  };

  return (
    <View className="flex-1 justify-between px-6 py-12" style={{ backgroundColor: theme.colors.background }}>
      <View className="pt-16">
        <AkhtarWordmark size="hero" />
        <Text
          className="mt-10 text-center text-2xl font-semibold"
          style={{ color: theme.colors.onBackground, writingDirection: isRtl ? "rtl" : "ltr" }}
        >
          {t("language.title")}
        </Text>
        <Text
          className="mt-3 text-center text-base"
          style={{ color: theme.colors.onSurfaceVariant, writingDirection: isRtl ? "rtl" : "ltr" }}
        >
          {t("language.subtitle")}
        </Text>
      </View>

      <View className="gap-3">
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => void handleSelect("fa")}
            className="min-h-[52px] flex-1 items-center justify-center rounded-2xl border px-4 py-4"
            style={{
              borderColor: selected === "fa" ? theme.colors.primary : theme.colors.outline,
              backgroundColor: selected === "fa" ? theme.colors.primaryContainer : "transparent",
            }}
          >
            <Text className="text-center text-lg font-semibold" style={{ color: theme.colors.onBackground }}>
              {t("language.farsi")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void handleSelect("en")}
            className="min-h-[52px] flex-1 items-center justify-center rounded-2xl border px-4 py-4"
            style={{
              borderColor: selected === "en" ? theme.colors.primary : theme.colors.outline,
              backgroundColor: selected === "en" ? theme.colors.primaryContainer : "transparent",
            }}
          >
            <Text className="text-center text-lg font-semibold" style={{ color: theme.colors.onBackground }}>
              {t("language.english")}
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => void handleContinue()}
          className="mt-4 min-h-[52px] justify-center rounded-full px-4 py-4"
          style={{ backgroundColor: theme.colors.onBackground }}
        >
          <Text className="text-center text-2xl font-semibold" style={{ color: theme.colors.background }}>
            {t("language.cta")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
