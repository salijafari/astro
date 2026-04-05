import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { useThemeColors } from "@/lib/themeColors";

export type PeopleScreenRowCardProps = {
  rtl: boolean;
  onPress?: () => void;
  leading: ReactNode;
  title: string;
  subtitle: string;
  /** When true, subtitle uses LTR so glyphs/sign names read correctly in Persian RTL. */
  subtitleForceLtr?: boolean;
  tertiary?: string;
  /** When true, tertiary uses LTR (same as subtitleForceLtr). */
  tertiaryForceLtr?: boolean;
  marginBottom?: number;
  style?: ViewStyle;
};

/**
 * Shared layout for “You” and saved-person rows: 80×80 lead, title/subtitle, optional chevron.
 * RTL: row-reverse so avatar sits on the right and chevron on the left.
 */
export const PeopleScreenRowCard = ({
  rtl,
  onPress,
  leading,
  title,
  subtitle,
  subtitleForceLtr = false,
  tertiary,
  tertiaryForceLtr = false,
  marginBottom = 8,
  style,
}: PeopleScreenRowCardProps) => {
  const tc = useThemeColors();
  const { theme } = useTheme();
  const rowDir = rtl ? "row-reverse" : "row";
  const subtitleDir = subtitleForceLtr ? "ltr" : rtl ? "rtl" : "ltr";
  const subtitleAlign = subtitleForceLtr ? "left" : rtl ? "right" : "left";
  const tertiaryDir = tertiaryForceLtr ? "ltr" : rtl ? "rtl" : "ltr";
  const tertiaryAlign = tertiaryForceLtr ? "left" : rtl ? "right" : "left";

  const content = (
    <>
      <View className="h-20 w-20 items-center justify-center" style={{ backgroundColor: theme.colors.cardAccent2 }}>
        {leading}
      </View>
      <View className="min-w-0 flex-1 justify-center px-4 py-2">
        <Text
          className="text-3xl font-semibold"
          style={{
            color: tc.textPrimary,
            textAlign: rtl ? "right" : "left",
            writingDirection: rtl ? "rtl" : "ltr",
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text
          className="text-xl"
          style={{
            color: tc.textSecondary,
            textAlign: subtitleAlign,
            writingDirection: subtitleDir,
          }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
        {tertiary ? (
          <Text
            className="mt-1 text-xs"
            style={{
              color: tc.textSecondary,
              textAlign: tertiaryAlign,
              writingDirection: tertiaryDir,
            }}
            numberOfLines={2}
          >
            {tertiary}
          </Text>
        ) : null}
      </View>
      {onPress ? (
        <View className="justify-center px-4">
          <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} size={22} color={tc.iconSecondary} />
        </View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="min-h-[80px] items-center rounded-xl border"
        style={[
          {
            borderColor: tc.border,
            marginBottom,
            flexDirection: rowDir,
          },
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      className="min-h-[80px] items-center rounded-xl border"
      style={[
        {
          borderColor: tc.border,
          marginBottom,
          flexDirection: rowDir,
        },
        style,
      ]}
    >
      {content}
    </View>
  );
};
