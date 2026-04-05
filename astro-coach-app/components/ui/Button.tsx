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
 * M3 common button: ~40px visual row inside min 48px touch height; pill radius 20; label 14 medium.
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
        ? "bg-slate-200 dark:bg-slate-700 border border-slate-400 dark:border-slate-500"
        : "bg-transparent";
  const text =
    variant === "primary" ? "text-white" : "text-slate-900 dark:text-slate-100";
  const padX = variant === "ghost" ? "px-3" : "px-6";
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
      className={`min-h-[48px] items-center justify-center rounded-[20px] py-2 ${padX} ${bg} ${disabled ? "opacity-50" : ""} ${className}`}
    >
      <Text className={`text-sm font-medium ${text}`} style={{ letterSpacing: 0.1 }}>
        {title}
      </Text>
    </Pressable>
  );
};
