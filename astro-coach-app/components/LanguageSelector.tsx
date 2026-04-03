import * as Haptics from "expo-haptics";
import { Platform, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/lib/languageManager";

export type LanguageSelectorProps = {
  /** `pills` = FA + EN; `inline` = one control for the language you are switching to (EN when UI is FA, FA when UI is EN). */
  variant?: "pills" | "inline";
  activeColor?: string;
  inactiveColor?: string;
};

/**
 * Reusable FA/EN switch; updates i18n and persisted storage immediately via `useLanguage`.
 */
export const LanguageSelector = ({
  variant = "pills",
  activeColor,
  inactiveColor,
}: LanguageSelectorProps) => {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const isFA = language === "fa";

  const haptic = () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const activeText = activeColor ?? "#ffffff";
  const inactiveText = inactiveColor ?? "rgba(255,255,255,0.6)";

  if (variant === "pills") {
    return (
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptic();
            void setLanguage("fa");
          }}
          className="rounded-full border px-4 py-2"
          style={{
            backgroundColor: isFA ? "rgba(99,102,241,0.9)" : "rgba(255,255,255,0.12)",
            borderColor: isFA ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.15)",
          }}
        >
          <Text
            className="text-sm font-medium"
            style={{ color: isFA ? activeText : inactiveText }}
          >
            {t("language.farsi")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptic();
            void setLanguage("en");
          }}
          className="rounded-full border px-4 py-2"
          style={{
            backgroundColor: !isFA ? "rgba(99,102,241,0.9)" : "rgba(255,255,255,0.12)",
            borderColor: !isFA ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.15)",
          }}
        >
          <Text
            className="text-sm font-medium"
            style={{ color: !isFA ? activeText : inactiveText }}
          >
            {t("language.english")}
          </Text>
        </Pressable>
      </View>
    );
  }

  const switchTo = isFA ? "en" : "fa";
  const switchLabel = isFA ? t("language.english") : t("language.farsi");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={switchLabel}
      onPress={() => {
        haptic();
        void setLanguage(switchTo);
      }}
      className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/20 px-4 py-2"
    >
      <Text className="text-sm font-medium" style={{ color: inactiveText }}>
        {isFA ? t("language.shortEnglish") : t("language.shortFarsi")}
      </Text>
    </Pressable>
  );
};
