import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Button } from "@/components/ui/Button";

type Props = {
  title: string;
  narrative: string;
  mood: string;
  onShare?: () => void;
};

/**
 * Home hero card for cached daily insight (free forever).
 */
export const DailyInsightCard: React.FC<Props> = ({ title, narrative, mood, onShare }) => {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const preview = narrative.split("\n").slice(0, 3).join("\n");

  return (
    <Animated.View entering={FadeInDown.duration(500)} className="bg-indigo-950 border border-indigo-800 rounded-3xl p-5 mb-4">
      <Animated.View entering={FadeIn}>
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-indigo-300 text-xs uppercase tracking-wide">{mood}</Text>
          {onShare ? (
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  void Haptics.selectionAsync().catch(() => {});
                }
                onShare();
              }}
            >
              <Text className="text-indigo-200 text-sm">Share</Text>
            </Pressable>
          ) : null}
        </View>
        <Text className="text-white text-xl font-bold mb-2">{title}</Text>
        <Text className="text-slate-200 leading-6">{expanded ? narrative : `${preview}${narrative.length > preview.length ? "…" : ""}`}</Text>
        {narrative.length > preview.length ? (
          <Pressable onPress={() => setExpanded(!expanded)} className="mt-2">
            <Text className="text-indigo-300">{expanded ? "Show less" : "Read more"}</Text>
          </Pressable>
        ) : null}
        <View className="mt-4">
          <Button
            title="Ask me more about today"
            variant="secondary"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/(main)/ask-me-anything");
            }}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
};
