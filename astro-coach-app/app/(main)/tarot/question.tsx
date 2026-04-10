import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { drawTarotCards } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useThemeColors } from "@/lib/themeColors";

export default function TarotQuestionScreen() {
  const { spreadId } = useLocalSearchParams<{ spreadId: string }>();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { getToken } = useAuth();
  const tc = useThemeColors();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const examples = t("tarot.exampleQuestions", { returnObjects: true }) as string[];

  const runDraw = async (question?: string) => {
    if (!spreadId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await drawTarotCards(getToken, spreadId, question?.trim() || undefined);
      router.replace({
        pathname: "/(main)/tarot/draw",
        params: { readingId: res.reading.id },
      });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (m.includes("premium")) setErr(t("errors.connectionError"));
      else setErr(t("tarot.errorDrawing"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-transparent" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 px-4"
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="mb-4 min-h-[44px] justify-center self-start"
        >
          <Text style={{ color: tc.textSecondary }}>{t("common.back")}</Text>
        </Pressable>
        <Text className="mb-3 text-xl font-semibold text-slate-100">{t("tarot.questionPrompt")}</Text>
        <TextInput
          value={q}
          onChangeText={(x) => setQ(x.slice(0, 200))}
          placeholder={t("tarot.questionPlaceholder")}
          placeholderTextColor="#64748b"
          multiline
          className="min-h-[120px] rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-base text-slate-100"
          style={{ textAlign: i18n.dir() === "rtl" ? "right" : "left" }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 mt-4">
          <View className="flex-row flex-wrap gap-2">
            {examples.map((ex) => (
              <Pressable
                key={ex}
                onPress={() => setQ(ex)}
                className="mb-2 rounded-full border border-white/10 bg-slate-800/80 px-3 py-2"
              >
                <Text className="text-sm text-slate-200">{ex}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        {err ? <Text className="mb-2 text-sm text-rose-300">{err}</Text> : null}
        <Pressable
          onPress={() => void runDraw(q)}
          disabled={loading}
          className="mb-3 min-h-[48px] items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3"
        >
          <Text className="text-base font-medium text-white">{loading ? "…" : t("tarot.drawCardsCta")}</Text>
        </Pressable>
        <Pressable onPress={() => void runDraw()} className="min-h-[44px] items-center justify-center">
          <Text style={{ color: tc.textSecondary }}>{t("tarot.skipQuestion")}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
