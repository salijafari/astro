import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "@/lib/themeColors";
import { drawTarotCard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { tarotReadingCache } from "@/lib/tarotReadingCache";

export default function TarotIndex() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const { getToken } = useAuth();
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRTL = i18n.language.startsWith("fa");

  const exampleQuestions = t("tarot.exampleQuestions", { returnObjects: true }) as string[];

  const handleDraw = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { reading } = await drawTarotCard(getToken, question.trim() || undefined);
      tarotReadingCache.pending = reading;
      router.push({
        pathname: "/(main)/tarot/reading",
        params: { readingId: reading.id },
      });
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      if (m.includes("daily_limit") || m.includes("daily_limit_reached")) {
        setError(t("tarot.dailyLimitReached"));
      } else {
        setError(t("tarot.errorDrawing"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.sheetBackground }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, maxWidth: 480, alignSelf: "center", width: "100%" }}>
        <Text
          style={{
            fontSize: 26,
            fontWeight: "700",
            color: colors.textPrimary,
            textAlign: "center",
            marginTop: 32,
            marginBottom: 32,
            letterSpacing: 1,
          }}
        >
          ✦ {t("tarot.title")} ✦
        </Text>

        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder={t("tarot.questionPlaceholder")}
          placeholderTextColor={colors.textTertiary}
          maxLength={200}
          style={{
            backgroundColor: colors.surfacePrimary,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 16,
            color: colors.textPrimary,
            fontSize: 16,
            textAlign: isRTL ? "right" : "left",
            minHeight: 80,
          }}
          multiline
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12, marginBottom: 24, flexShrink: 0 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
        >
          {exampleQuestions.map((q, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setQuestion(q)}
              style={{
                backgroundColor: colors.surfacePrimary,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 8,
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {error ? (
          <Text style={{ color: "#f87171", textAlign: "center", marginBottom: 16, fontSize: 14 }}>{error}</Text>
        ) : null}

        <TouchableOpacity
          onPress={() => void handleDraw()}
          disabled={isLoading}
          style={{
            backgroundColor: "#7c3aed",
            borderRadius: 14,
            paddingVertical: 18,
            alignItems: "center",
            opacity: isLoading ? 0.7 : 1,
            minHeight: 48,
            justifyContent: "center",
          }}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>{t("tarot.drawCard")} →</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(main)/tarot/history")}
          style={{ marginTop: 24, alignItems: "center", minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{t("tarot.pastReadings")} →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
