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
  /** When false, trailing settings is hidden and a same-width spacer keeps layout balanced. */
  showSettings?: boolean;
};

export type TransitsChromeHeaderProps = {
  title: string;
  showBack?: boolean;
  showSettings?: boolean;
};

const ICON_HIT_SLOP = { top: 4, right: 4, bottom: 4, left: 4 } as const;

/**
 * Transparent tab header control for `feature/[id]` — back only (`router.back()`), always arrow-back (top-left).
 */
export const FeatureTabHeaderBackButton = () => {
  const router = useRouter();
  const tc = useThemeColors();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
      hitSlop={ICON_HIT_SLOP}
      onPress={() => router.back()}
      className="ms-2 h-10 w-10 items-center justify-center rounded-[20px]"
    >
      <Ionicons name="arrow-back" size={24} color={tc.navIcon} />
    </Pressable>
  );
};

/**
 * In-page top row: history or back (left) and settings (right),
 * transparent over `CosmicBackground`, with safe-area top padding.
 */
export const MainTabChromeHeader = ({
  leadingAction = "history",
  showSettings = true,
}: MainTabChromeHeaderProps) => {
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
      {showSettings ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={ICON_HIT_SLOP}
          onPress={() => router.push("/(main)/settings")}
          className="h-10 w-10 items-center justify-center rounded-[20px]"
        >
          <Ionicons name="settings-outline" size={24} color={tc.navIcon} />
        </Pressable>
      ) : (
        <View className="h-10 w-10" />
      )}
    </View>
  );
};

/**
 * Personal Transits: optional back, centered title, optional settings (history lives on Home).
 */
export const TransitsChromeHeader = ({
  title,
  showBack = true,
  showSettings = true,
}: TransitsChromeHeaderProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tc = useThemeColors();
  return (
    <View
      className="mb-2 flex-row items-center px-4"
      style={{ paddingTop: Math.max(insets.top, 8) }}
    >
      <View className="min-w-0 flex-1 flex-row items-center justify-start">
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={ICON_HIT_SLOP}
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-[20px]"
          >
            <Ionicons name="arrow-back" size={24} color={tc.navIcon} />
          </Pressable>
        ) : (
          <View className="h-10 w-10" />
        )}
      </View>
      <Text
        className="min-w-0 flex-[2] px-2 text-center text-lg font-semibold"
        numberOfLines={1}
        style={{ color: tc.textPrimary }}
      >
        {title}
      </Text>
      <View className="min-w-0 flex-1 flex-row items-center justify-end">
        {showSettings ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={ICON_HIT_SLOP}
            onPress={() => router.push("/(main)/settings")}
            className="h-10 w-10 items-center justify-center rounded-[20px]"
          >
            <Ionicons name="settings-outline" size={24} color={tc.navIcon} />
          </Pressable>
        ) : (
          <View className="h-10 w-10" />
        )}
      </View>
    </View>
  );
};
