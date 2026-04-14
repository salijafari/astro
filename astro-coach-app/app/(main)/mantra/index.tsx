import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { CosmicBackground } from "@/components/CosmicBackground";
import { JournalSheet } from "@/components/mantra/JournalSheet";
import { PracticeModeSheet } from "@/components/mantra/PracticeModeSheet";
import { ThemeSheet } from "@/components/mantra/ThemeSheet";
import { useMantra } from "@/hooks/useMantra";
import type { MantraPracticeMode, MantraTheme } from "@/types/mantra";

export default function MantraIndexScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith("fa");
  const {
    mantra,
    isLoading,
    isRefreshing,
    error,
    selectedTheme,
    isToneExploratory,
    handleRefresh,
    handleThemeSelect,
    handleThemeClear,
    handleToneToggle,
    handlePin,
    handleUnpin,
    currentMantraText,
    currentTieBack,
    currentPlanetLabel,
    currentQualityLabel,
  } = useMantra();

  const [themeOpen, setThemeOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);

  const onRefresh = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void handleRefresh();
  }, [handleRefresh]);

  const pan = Gesture.Pan().onEnd((e) => {
    if (e.translationY > 56 && Math.abs(e.velocityY) > 120) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void handleRefresh();
    }
  });

  return (
    <View className="flex-1">
      <CosmicBackground mantraMode />
      <SafeAreaView className="flex-1" edges={["top", "left", "right"]}>
        <GestureDetector gesture={pan}>
          <ScrollView
            className="flex-1 px-5"
            contentContainerStyle={{ paddingBottom: 32 }}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#fff" />
            }
          >
            <View className="mb-4 flex-row items-center justify-between pt-2">
              <Pressable
                onPress={() => router.back()}
                hitSlop={12}
                className="h-11 w-11 items-center justify-center rounded-full"
                accessibilityRole="button"
                accessibilityLabel={t("mantra.backA11y")}
              >
                <Ionicons
                  name={isRtl ? "chevron-forward" : "chevron-back"}
                  size={26}
                  color="rgba(255,255,255,0.85)"
                />
              </Pressable>
              <Text className="text-lg font-semibold text-white">{t("mantra.screenTitle")}</Text>
              <Pressable
                onPress={() => void handleRefresh()}
                hitSlop={12}
                disabled={isRefreshing}
                className="h-11 w-11 items-center justify-center rounded-full"
                accessibilityRole="button"
              >
                <Ionicons name="refresh" size={22} color="rgba(255,255,255,0.85)" />
              </Pressable>
            </View>

            {isLoading && !mantra ? (
              <View className="items-center py-16">
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}

            {error ? (
              <Text
                className="mb-4 text-center text-red-300"
                style={{ writingDirection: isRtl ? "rtl" : "ltr" }}
              >
                {t(error)}
              </Text>
            ) : null}

            {currentMantraText ? (
              <View className="mb-6 rounded-2xl border border-white/15 bg-white/5 p-5">
                <Text
                  className="text-center text-2xl font-bold leading-8 text-white"
                  style={{
                    writingDirection: isRtl ? "rtl" : "ltr",
                    textAlign: isRtl ? "right" : "center",
                  }}
                >
                  {currentMantraText}
                </Text>
                {currentTieBack ? (
                  <Text
                    className="mt-3 text-center text-sm text-white/65"
                    style={{ writingDirection: isRtl ? "rtl" : "ltr" }}
                  >
                    {currentTieBack}
                  </Text>
                ) : null}
                {currentPlanetLabel && currentQualityLabel ? (
                  <Text className="mt-4 text-center text-xs uppercase tracking-widest text-white/40">
                    {currentPlanetLabel} · {currentQualityLabel}
                  </Text>
                ) : null}
                {mantra?.dominantTransit ? (
                  <Text
                    className="mt-2 text-center text-xs text-white/35"
                    style={{ writingDirection: isRtl ? "rtl" : "ltr" }}
                  >
                    {mantra.dominantTransit}
                  </Text>
                ) : null}
              </View>
            ) : !isLoading ? (
              <Text className="text-center text-white/50">{t("mantra.emptyState")}</Text>
            ) : null}

            {mantra?.canRefresh ? (
              <Text className="mb-4 text-center text-xs text-white/45">
                {t("mantra.refreshHint", { remaining: mantra.canRefresh.remaining })}
              </Text>
            ) : null}

            <View className="mb-4 flex-row flex-wrap gap-2">
              <Pressable
                onPress={() => setThemeOpen(true)}
                className="min-h-[48px] flex-1 min-w-[44%] items-center justify-center rounded-xl bg-white/10 px-3 py-3"
              >
                <Text className="text-center text-sm font-semibold text-white">{t("mantra.theme")}</Text>
              </Pressable>
              <Pressable
                onPress={() => setPracticeOpen(true)}
                className="min-h-[48px] flex-1 min-w-[44%] items-center justify-center rounded-xl bg-white/10 px-3 py-3"
              >
                <Text className="text-center text-sm font-semibold text-white">{t("mantra.practice")}</Text>
              </Pressable>
              <Pressable
                onPress={() => setJournalOpen(true)}
                className="min-h-[48px] flex-1 min-w-[44%] items-center justify-center rounded-xl bg-white/10 px-3 py-3"
              >
                <Text className="text-center text-sm font-semibold text-white">{t("mantra.journal")}</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleToneToggle()}
                className="min-h-[48px] flex-1 min-w-[44%] items-center justify-center rounded-xl bg-violet-600/40 px-3 py-3"
              >
                <Text className="text-center text-sm font-semibold text-white">
                  {isToneExploratory ? t("mantra.toneExploratory") : t("mantra.toneDeclarative")}
                </Text>
              </Pressable>
            </View>

            {mantra?.isPinned ? (
              <Pressable
                onPress={() => void handleUnpin()}
                className="mb-6 items-center rounded-xl border border-white/20 py-3"
              >
                <Text className="text-sm text-white/80">{t("mantra.unpin")}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </GestureDetector>
      </SafeAreaView>

      <ThemeSheet
        open={themeOpen}
        onClose={() => setThemeOpen(false)}
        selectedTheme={selectedTheme}
        onThemeSelect={(th: MantraTheme) => {
          void handleThemeSelect(th);
          setThemeOpen(false);
        }}
        onThemeClear={() => {
          void handleThemeClear();
          setThemeOpen(false);
        }}
        onPin={() => {
          handlePin();
          setThemeOpen(false);
        }}
        isPinned={mantra?.isPinned}
      />
      <PracticeModeSheet
        open={practiceOpen}
        onClose={() => setPracticeOpen(false)}
        onSelectMode={(m: MantraPracticeMode) => {
          setPracticeOpen(false);
          router.push({ pathname: "/(main)/mantra/practice", params: { modeId: m.id } });
        }}
      />
      <JournalSheet open={journalOpen} onClose={() => setJournalOpen(false)} />
    </View>
  );
}
