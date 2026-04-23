import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/themeColors";

export type MainTabChromeHeaderProps = {
  /**
   * Left control: open history vs pop (e.g. Settings should not show history while you are
   * already in a leaf flow).
   */
  leadingAction?: "history" | "back" | "none";
};

const ICON_HIT_SLOP = { top: 4, right: 4, bottom: 4, left: 4 } as const;

/**
 * Transparent tab header control for `feature/[id]` — back only (`router.back()`), RTL-aware icon.
 */
export const FeatureTabHeaderBackButton = () => {
  const router = useRouter();
  const tc = useThemeColors();
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === "fa" || i18n.language.startsWith("fa");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
      hitSlop={ICON_HIT_SLOP}
      onPress={() => router.back()}
      className="ms-2 h-10 w-10 items-center justify-center rounded-[20px]"
    >
      <Ionicons name={rtl ? "arrow-forward" : "arrow-back"} size={24} color={tc.navIcon} />
    </Pressable>
  );
};

/**
 * In-page top row: history or back (left) and settings (right),
 * transparent over `CosmicBackground`, with safe-area top padding.
 */
export const MainTabChromeHeader = ({ leadingAction = "history" }: MainTabChromeHeaderProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tc = useThemeColors();
  return (
    <View
      className="mb-2 flex-row items-center justify-between"
      style={{ paddingTop: Math.max(insets.top, 8) }}
    >
      {leadingAction !== "none" ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={ICON_HIT_SLOP}
          onPress={() => (leadingAction === "back" ? router.back() : router.push("/(main)/history"))}
          className="h-10 w-10 items-center justify-center rounded-[20px]"
        >
          {leadingAction === "back" ? (
            <Ionicons name="arrow-back" size={24} color={tc.navIcon} />
          ) : (
            <MaterialCommunityIcons name="history" size={24} color={tc.navIcon} />
          )}
        </Pressable>
      ) : (
        <View className="h-10 w-10" />
      )}
      <Pressable
        accessibilityRole="button"
        hitSlop={ICON_HIT_SLOP}
        onPress={() => router.push("/(main)/settings")}
        className="h-10 w-10 items-center justify-center rounded-[20px]"
      >
        <Ionicons name="settings-outline" size={24} color={tc.navIcon} />
      </Pressable>
    </View>
  );
};

/**
 * Personal Transits: back, centered title, settings only on the right (history lives on Home).
 */
export const TransitsChromeHeader = ({ title }: { title: string }) => {
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  return (
    <View
      className="mb-2 flex-row items-center px-4"
      style={{ paddingTop: Math.max(insets.top, 8) }}
    >
      <View className="min-w-0 flex-1" />
      <Text
        className="min-w-0 flex-[2] px-2 text-center text-lg font-semibold"
        numberOfLines={1}
        style={{ color: tc.textPrimary }}
      >
        {title}
      </Text>
      <View className="min-w-0 flex-1" />
    </View>
  );
};
