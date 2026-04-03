import * as Haptics from "expo-haptics";
import { Platform, Pressable, Text, View } from "react-native";
import { useLanguage } from "@/lib/languageManager";

export type LanguageSelectorProps = {
  /** `pills` = two side-by-side controls; `inline` = compact single toggle. */
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
            فارسی
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
            English
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic();
        void setLanguage(isFA ? "en" : "fa");
      }}
      className="rounded-full border border-white/20 px-2.5 py-1"
    >
      <Text className="text-xs font-medium" style={{ color: inactiveText }}>
        {isFA ? "EN" : "فا"}
      </Text>
    </Pressable>
  );
};
