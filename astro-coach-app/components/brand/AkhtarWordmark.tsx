import { I18nManager, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { typography } from "@/constants/theme";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  /** Larger hero wordmark on intro screens */
  size?: "hero" | "header";
};

/**
 * Stylized “Akhtar” wordmark with celestial sparkles — matches reference layout; font is Vazirmatn until a custom asset replaces it.
 */
export function AkhtarWordmark({ size = "hero" }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const rtl = I18nManager.isRTL;
  const c = theme.colors;
  const nameSize = size === "hero" ? "text-5xl" : "text-3xl";
  const sparkleOpacity = 0.85;

  return (
    <View className="items-center justify-center py-2">
      <View
        className="flex-row items-center justify-center gap-2"
        style={{ flexDirection: rtl ? "row-reverse" : "row" }}
      >
        <Text className="text-lg" style={{ color: c.onBackground, opacity: sparkleOpacity }}>
          ✦
        </Text>
        <Text
          className={`${nameSize} font-bold`}
          style={{
            fontFamily: typography.family.bold,
            color: c.onBackground,
            letterSpacing: size === "hero" ? 1.5 : 0.5,
            writingDirection: rtl ? "rtl" : "ltr",
          }}
        >
          {t("brand.name")}
        </Text>
        <Text className="text-lg" style={{ color: c.onBackground, opacity: sparkleOpacity }}>
          ✦
        </Text>
      </View>
      {size === "hero" ? (
        <View
          className="mt-2 flex-row items-center justify-center gap-4"
          style={{ flexDirection: rtl ? "row-reverse" : "row" }}
        >
          <Text style={{ color: c.onBackground, opacity: 0.35 }}>·</Text>
          <Text className="text-xs" style={{ color: c.onBackground, opacity: 0.55 }}>
            ✦
          </Text>
          <Text style={{ color: c.onBackground, opacity: 0.35 }}>·</Text>
        </View>
      ) : null}
    </View>
  );
}
