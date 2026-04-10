import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { StreamingCursor } from "@/components/StreamingCursor";
import { TarotCardImage } from "@/components/tarot/TarotCardImage";
import { getTarotReading } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStreamingChat } from "@/lib/useStreamingChat";
import { useThemeColors } from "@/lib/themeColors";
import type { DrawnCardResult } from "@/types/tarot";

const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export default function TarotReadingScreen() {
  const { readingId, fromHistory } = useLocalSearchParams<{
    readingId: string;
    fromHistory?: string;
  }>();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { getToken } = useAuth();
  const tc = useThemeColors();
  const lang = i18n.language.startsWith("fa") ? "fa" : "en";
  const rtl = lang === "fa";

  const [loading, setLoading] = useState(true);
  const [drawn, setDrawn] = useState<DrawnCardResult[]>([]);
  const [prefillInterpretation, setPrefillInterpretation] = useState<string | null>(null);
  const sentRef = useRef(false);

  const load = useCallback(async () => {
    if (!readingId) return;
    setLoading(true);
    try {
      const res = await getTarotReading(getToken, readingId);
      setDrawn(res.reading.drawnCards as DrawnCardResult[]);
      if (res.reading.interpretation?.trim()) {
        setPrefillInterpretation(res.reading.interpretation);
      }
    } finally {
      setLoading(false);
    }
  }, [getToken, readingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const {
    messages,
    setMessages,
    isStreaming,
    sendMessage,
  } = useStreamingChat({
    streamUrl: `${apiBase}/api/tarot/interpret`,
    getToken,
    getExtraBody: () => ({ readingId: readingId ?? "" }),
    nonStreamingPath: "/api/tarot/interpret-sync",
    emptyErrorText: t("tarot.errorDrawing"),
  });

  useEffect(() => {
    if (!readingId || loading) return;
    if (prefillInterpretation) {
      setMessages([
        {
          id: "a_cached",
          role: "assistant",
          content: prefillInterpretation,
          isStreaming: false,
        },
      ]);
      return;
    }
    if (sentRef.current) return;
    sentRef.current = true;
    void sendMessage(t("tarot.interpretPrompt"));
    // sendMessage identity changes each render; single fire via sentRef only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [readingId, loading, prefillInterpretation, setMessages, t]);

  const assistantText = messages.filter((m) => m.role === "assistant").pop()?.content ?? "";
  const showCursor =
    Platform.OS === "web" && isStreaming && messages.some((m) => m.role === "assistant" && m.isStreaming);

  if (loading || !readingId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator color={tc.textPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top", "left", "right"]}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable onPress={() => router.back()} accessibilityRole="button" className="min-h-[44px] justify-center">
          <Text style={{ color: tc.textSecondary }}>{t("common.back")}</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-slate-100">{t("tarot.readingTitle")}</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView horizontal className="max-h-[200px] border-b border-white/5 px-2 py-3" showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-3 px-2">
          {drawn.map((c, i) => (
            <View key={`${c.cardId}_${i}`} className="items-center">
              <TarotCardImage
                cardId={c.cardId}
                isReversed={c.isReversed}
                showFront={true}
                lang={lang}
                size="small"
              />
              <Text className="mt-1 max-w-[72px] text-center text-[10px] text-slate-500">{c.position}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="min-h-[200px]">
          {assistantText ? (
            <Text
              className="text-base leading-7 text-slate-100"
              style={{ writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}
            >
              {assistantText}
            </Text>
          ) : (
            <ActivityIndicator color={tc.textPrimary} />
          )}
          {showCursor ? (
            <View className="mt-1 flex-row">
              <StreamingCursor cursorColor={`${tc.textPrimary}b3`} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View className="border-t border-white/10 px-4 py-3">
        <Pressable
          onPress={() =>
            fromHistory === "1"
              ? router.replace("/(main)/tarot/history")
              : router.replace("/(main)/tarot")
          }
          className="min-h-[48px] items-center justify-center rounded-2xl bg-slate-800"
        >
          <Text className="text-base text-slate-100">
            {fromHistory === "1" ? t("common.back") : t("tarot.newReading")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
