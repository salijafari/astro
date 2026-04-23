import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "@/lib/themeColors";
import { drawTarotCard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { tarotReadingCache } from "@/lib/tarotReadingCache";
import { useBottomNavInset } from "@/hooks/useBottomNavInset";

export default function TarotIndex() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const { getToken } = useAuth();
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRTL = i18n.language.startsWith("fa");
  const bottomNavInset = useBottomNavInset();

  const exampleQuestions = t("tarot.exampleQuestions", { returnObjects: true }) as string[];

  const handleDraw = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith("fa") ? "fa" : "en";
      const { reading } = await drawTarotCard(getToken, question.trim() || undefined, lang);
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
      {/* Fixed header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
          style={{
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 20,
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 17,
            fontWeight: "600",
            color: colors.textPrimary,
          }}
        >
          ✦ {t("tarot.title")} ✦
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24,
          paddingBottom: 24 + bottomNavInset,
          maxWidth: 480,
          alignSelf: "center",
          width: "100%",
        }}
      >
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
