import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/themeColors";

export type MainTabChromeHeaderProps = {
  /**
   * Left control: open history vs pop (e.g. Settings should not show history while you are
   * already in a leaf flow).
   */
  leadingAction?: "history" | "back";
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
      <Pressable
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => (leadingAction === "back" ? router.back() : router.push("/(main)/history"))}
        className="rounded-full p-2"
      >
        {leadingAction === "back" ? (
          <Ionicons name="arrow-back" size={24} color={tc.navIcon} />
        ) : (
          <MaterialCommunityIcons name="history" size={24} color={tc.navIcon} />
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => router.push("/(main)/settings")}
        className="rounded-full p-2"
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
  const router = useRouter();
  const tc = useThemeColors();
  return (
    <View
      className="mb-2 flex-row items-center px-4"
      style={{ paddingTop: Math.max(insets.top, 8) }}
    >
      <View className="min-w-0 flex-1 flex-row items-center justify-start">
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          className="rounded-full p-2"
        >
          <Ionicons name="arrow-back" size={24} color={tc.navIcon} />
        </Pressable>
      </View>
      <Text
        className="min-w-0 flex-[2] px-1 text-center text-lg font-semibold"
        numberOfLines={1}
        style={{ color: tc.textPrimary }}
      >
        {title}
      </Text>
      <View className="min-w-0 flex-1 flex-row items-center justify-end">
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.push("/(main)/settings")}
          className="rounded-full p-2"
        >
          <Ionicons name="settings-outline" size={24} color={tc.navIcon} />
        </Pressable>
      </View>
    </View>
  );
};
