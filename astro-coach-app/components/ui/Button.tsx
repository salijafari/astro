import * as Haptics from "expo-haptics";
import { Platform, Pressable, Text } from "react-native";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  disabled?: boolean;
};

/**
 * Primary touch target ≥44pt (Section 9 global rules).
 */
export const Button: React.FC<Props> = ({
  title,
  onPress,
  variant = "primary",
  className = "",
  disabled = false,
}) => {
  const bg =
    variant === "primary"
      ? "bg-indigo-600 active:bg-indigo-700"
      : variant === "secondary"
        ? "bg-slate-200 dark:bg-slate-700"
        : "bg-transparent";
  const text =
    variant === "primary" ? "text-white" : "text-slate-900 dark:text-slate-100";
  return (
    <Pressable
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={() => {
        if (disabled) return;
        if (Platform.OS !== "web") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPress();
      }}
      className={`min-h-[48px] px-5 py-3 rounded-2xl items-center justify-center ${bg} ${disabled ? "opacity-50" : ""} ${className}`}
    >
      <Text className={`text-base font-semibold ${text}`}>{title}</Text>
    </Pressable>
  );
};
