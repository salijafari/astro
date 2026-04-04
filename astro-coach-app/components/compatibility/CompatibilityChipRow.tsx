import { Pressable, ScrollView, Text } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  prompts: string[];
  onPress: (prompt: string) => void;
  rtl: boolean;
};

/**
 * Horizontal follow-up chips matching Ask Me Anything / ChatMessageBubble styling.
 */
export const CompatibilityChipRow: React.FC<Props> = ({ prompts, onPress, rtl }) => {
  const { theme } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-3 mt-1"
      contentContainerStyle={{
        gap: 8,
        flexDirection: rtl ? "row-reverse" : "row",
      }}
    >
      {prompts.map((prompt) => (
        <Pressable
          key={prompt}
          onPress={() => onPress(prompt)}
          className="min-h-[36px] justify-center rounded-full border px-3 py-2"
          style={{ borderColor: theme.colors.outline }}
          accessibilityRole="button"
        >
          <Text
            className="text-sm"
            style={{
              color: theme.colors.onSurfaceVariant,
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {prompt}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
};
