import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Modal, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackgroundSheet } from "@/components/mantra/BackgroundSheet";
import { BottomSheetModal } from "@/components/mantra/BottomSheetModal";
import { MantraModeSheet } from "@/components/mantra/MantraModeSheet";
import { MindfulReveal } from "@/components/mantra/MindfulReveal";
import { PracticeModeSheet } from "@/components/mantra/PracticeModeSheet";
import { CosmicBackground } from "@/components/CosmicBackground";
import NativeDateTimePicker from "@/components/NativeDateTimePicker";
import { useFloatingIslandExtraPadding } from "@/hooks/useMainTabShellInsets";
import { useMantra } from "@/hooks/useMantra";
import { useMantraBackground } from "@/hooks/useMantraBackground";
import { useMantraVisited } from "@/hooks/useMantraVisited";
import { putMantraReminderTime } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isPersian } from "@/lib/i18n";
import { trackEvent } from "@/lib/mixpanel";
import { MANTRA_UX_KEYS, migrateLegacyMantraVisitedDate, readMantraUx, writeMantraUx } from "@/lib/mantraUxStorage";
import { invalidateProfileCache } from "@/lib/userProfile";
import { useThemeColors } from "@/lib/themeColors";
import { useMantraStore } from "@/stores/mantraStore";
import type { MantraPracticeMode, MantraRegister } from "@/types/mantra";

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "☀",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
  Chiron: "⚷",
  خورشید: "☀",
  ماه: "☽",
  عطارد: "☿",
  زهره: "♀",
  مریخ: "♂",
  مشتری: "♃",
  زحل: "♄",
  اورانوس: "♅",
  نپتون: "♆",
  پلوتون: "♇",
  کیرون: "⚷",
};

function hhmmFromDate(d: Date): string {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export default function MantraIndexScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { width: W } = useWindowDimensions();
  const shellBottomPad = useFloatingIslandExtraPadding();
  const isRtl = isPersian(i18n.language);
  const { getToken } = useAuth();
  const tc = useThemeColors();
  const {
    mantra,
    isLoading,
    error,
    register,
    fetchMantra,
    setRegisterPreference,
    currentMantraText,
    currentTieBack,
    currentPlanetLabel,
    currentQualityLabel,
  } = useMantra();
  const { backgroundSource, selectBackground, selectedId } = useMantraBackground();
  const { markMantraVisited } = useMantraVisited();

  /** `null` until AsyncStorage is read on this mount (prevents mantra flash). */
  const [revealEverCompleted, setRevealEverCompleted] = useState<boolean | null>(null);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [bgSheetOpen, setBgSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [registerSheetOpen, setRegisterSheetOpen] = useState(false);
  const [reminderOptInOpen, setReminderOptInOpen] = useState(false);
  const [reminderTime, setReminderTime] = useState<string | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [webTime, setWebTime] = useState("08:00");

  const mantraOpacity = useSharedValue(0);
  const chromeOpacity = useSharedValue(0);

  useEffect(() => {
    void (async () => {
      await migrateLegacyMantraVisitedDate();
      const val = await readMantraUx(MANTRA_UX_KEYS.revealEverCompleted);
      setRevealEverCompleted(val === "true");
    })();
  }, []);

  const showReveal = useMemo(
    () =>
      revealEverCompleted === false &&
      !isLoading &&
      !!currentMantraText?.trim(),
    [revealEverCompleted, isLoading, currentMantraText],
  );

  /** Top/bottom chrome (not the screen back button) hidden until reveal is done in storage. */
  const chromeBlocked = revealEverCompleted !== true;

  useEffect(() => {
    if (revealEverCompleted === true) {
      mantraOpacity.value = withTiming(1, { duration: 800 });
      chromeOpacity.value = withTiming(1, { duration: 800 });
    } else {
      mantraOpacity.value = 0;
      chromeOpacity.value = 0;
    }
  }, [revealEverCompleted, mantraOpacity, chromeOpacity]);

  const mantraContentOpacityStyle = useAnimatedStyle(() => ({
    opacity: mantraOpacity.value,
  }));

  const chromeOpacityStyle = useAnimatedStyle(() => ({
    opacity: chromeOpacity.value,
  }));

  const shimmerAnim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    if (!isLoading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLoading, shimmerAnim]);

  const planetSymbol =
    mantra?.transitHint.planetSymbol?.trim() ||
    (currentPlanetLabel ? (PLANET_SYMBOLS[currentPlanetLabel] ?? "\u2726") : "\u2726");

  const saveReminder = useCallback(
    async (hhmm: string | null) => {
      try {
        await putMantraReminderTime(getToken, hhmm);
        setReminderTime(hhmm);
        await invalidateProfileCache();
        trackEvent("mantra_reminder_set", { enabled: hhmm != null });
      } catch {
        /* noop */
      }
    },
    [getToken],
  );

  return (
    <View style={{ flex: 1 }}>
      {backgroundSource ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <Image
            source={backgroundSource}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
          />
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.38)",
            }}
          />
        </View>
      ) : (
        <CosmicBackground mantraMode />
      )}

      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right", "bottom"]}>
        <Reanimated.View
          pointerEvents={chromeBlocked ? "none" : "auto"}
          style={[
            {
              flexDirection: "row",
              direction: "ltr",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingTop: 8,
            },
            chromeOpacityStyle,
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            pointerEvents="auto"
            className="h-10 w-10 items-center justify-center rounded-[20px]"
            accessibilityRole="button"
            accessibilityLabel={t("mantra.backA11y")}
          >
            <Ionicons name="arrow-back" size={24} color={tc.navIcon} />
          </Pressable>

          <Reanimated.View
            pointerEvents={chromeBlocked ? "none" : "auto"}
            style={[
              {
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 0,
              },
              chromeOpacityStyle,
            ]}
          >
            {currentPlanetLabel && currentQualityLabel ? (
              <BlurView
                intensity={30}
                tint="dark"
                style={{
                  borderRadius: 20,
                  overflow: "hidden",
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  maxWidth: W * 0.55,
                }}
              >
                <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600", textAlign: "center" }}>
                  {planetSymbol} {currentPlanetLabel} · {currentQualityLabel}
                </Text>
              </BlurView>
            ) : (
              <View style={{ width: 36 }} />
            )}
          </Reanimated.View>

          <Pressable
            onPress={() => router.push("/(main)/settings")}
            hitSlop={12}
            pointerEvents="auto"
            className="h-10 w-10 items-center justify-center rounded-[20px]"
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={24} color={tc.navIcon} />
          </Pressable>
        </Reanimated.View>

        <View
          style={{
            flex: 1,
            paddingHorizontal: 32,
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: 16 + shellBottomPad,
          }}
        >
          {isLoading && !currentMantraText ? (
            <View style={{ width: "100%", alignItems: "center", gap: 12 }}>
              {[W * 0.7, W * 0.85, W * 0.6].map((w, i) => (
                <Animated.View
                  key={i}
                  style={{
                    width: w,
                    height: i === 0 ? 32 : 28,
                    borderRadius: 8,
                    backgroundColor: "rgba(255,255,255,0.15)",
                    opacity: shimmerAnim,
                  }}
                />
              ))}
            </View>
          ) : error ? (
            <Pressable onPress={() => void fetchMantra()}>
              <Text style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", fontSize: 15 }}>
                {t("mantra.errorRetry")}
              </Text>
            </Pressable>
          ) : (
            <Reanimated.View style={[{ width: "100%", alignItems: "center" }, mantraContentOpacityStyle]}>
              <Text
                key={currentMantraText?.slice(0, 20) ?? "loading"}
                adjustsFontSizeToFit
                numberOfLines={4}
                style={{
                  color: "#FFFFFF",
                  fontSize: 30,
                  fontWeight: "700",
                  textAlign: "center",
                  writingDirection: isRtl ? "rtl" : "ltr",
                  lineHeight: 42,
                  letterSpacing: -0.3,
                  marginBottom: 16,
                  width: "100%",
                }}
              >
                {currentMantraText}
              </Text>

              {currentTieBack ? (
                <Text
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontSize: 15,
                    fontWeight: "400",
                    textAlign: "center",
                    writingDirection: isRtl ? "rtl" : "ltr",
                    lineHeight: 22,
                    width: "100%",
                  }}
                  numberOfLines={3}
                >
                  {currentTieBack}
                </Text>
              ) : null}
            </Reanimated.View>
          )}
        </View>

        <Reanimated.View
          pointerEvents={chromeBlocked ? "none" : "auto"}
          style={[
            {
              flexDirection: "row",
              direction: "ltr",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 24,
              paddingBottom: 16 + shellBottomPad,
            },
            chromeOpacityStyle,
          ]}
        >
          <Pressable
            onPress={() => setBgSheetOpen(true)}
            hitSlop={12}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "rgba(0,0,0,0.35)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="image-outline" size={22} color="#fff" />
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setPracticeOpen(true);
            }}
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: "#7C3AED",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#7C3AED",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Ionicons name="play" size={24} color="#fff" style={{ marginLeft: 3 }} />
          </Pressable>

          <View style={{ width: 44 }} />
        </Reanimated.View>
      </SafeAreaView>

      <PracticeModeSheet
        open={practiceOpen}
        onClose={() => setPracticeOpen(false)}
        onSelectMode={(m: MantraPracticeMode) => {
          setPracticeOpen(false);
          const reg = useMantraStore.getState().register;
          const lang = isPersian(i18n.language) ? "fa" : "en";
          router.push({
            pathname: "/(main)/mantra/practice",
            params: { modeId: m.id, register: reg, lang },
          });
        }}
      />

      <BackgroundSheet
        open={bgSheetOpen}
        onClose={() => setBgSheetOpen(false)}
        selectedId={selectedId}
        onSelectBackground={selectBackground}
      />

      <BottomSheetModal open={settingsOpen} onClose={() => setSettingsOpen(false)} snapHeight="52%">
        <View className="px-4 pb-8">
          <Text
            className="mb-3 text-lg font-semibold text-white"
            style={{ textAlign: isRtl ? "right" : "left", writingDirection: isRtl ? "rtl" : "ltr" }}
          >
            {t("mantra.settingsTitle")}
          </Text>

          <Pressable
            onPress={() => {
              setRegisterSheetOpen(true);
            }}
            className="mb-3 min-h-[44px] flex-row items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3"
          >
            <Text className="text-white">{t("mantra.registerRow")}</Text>
            <Text className="text-white/70">
              {register === "direct" ? t("mantra.registerDirect") : t("mantra.registerExploratory")}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setReminderOptInOpen(true)}
            className="mb-3 min-h-[44px] items-center justify-center rounded-xl border border-violet-500/40 bg-violet-600/25 px-4 py-3"
          >
            <Text className="font-semibold text-white">{t("mantra.reminderOptInCta")}</Text>
            {reminderTime ? (
              <Text className="mt-1 text-xs text-white/60">{reminderTime}</Text>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => void saveReminder(null)}
            className="mb-2 min-h-[44px] items-center justify-center rounded-xl border border-white/10 py-2"
          >
            <Text className="text-sm text-white/60">{t("mantra.reminderClear")}</Text>
          </Pressable>
        </View>
      </BottomSheetModal>

      <MantraModeSheet
        open={registerSheetOpen}
        onClose={() => setRegisterSheetOpen(false)}
        value={register}
        onChange={(v: MantraRegister) => {
          void setRegisterPreference(v);
          setRegisterSheetOpen(false);
        }}
      />

      <Modal visible={reminderOptInOpen} transparent animationType="fade" onRequestClose={() => setReminderOptInOpen(false)}>
        <Pressable
          className="flex-1 justify-end bg-black/60"
          onPress={() => setReminderOptInOpen(false)}
        >
          <Pressable
            className="rounded-t-2xl bg-slate-900 px-4 pb-10 pt-4"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="mb-3 text-lg font-semibold text-white">{t("mantra.reminderModalTitle")}</Text>
            {Platform.OS === "web" ? (
              <TextInput
                value={webTime}
                onChangeText={setWebTime}
                placeholder="08:00"
                placeholderTextColor="#64748b"
                className="mb-4 rounded-xl border border-white/20 px-3 py-3 text-white"
              />
            ) : showTimePicker ? (
              <NativeDateTimePicker
                value={new Date(`2000-01-01T${reminderTime ?? webTime}:00`)}
                mode="time"
                display="spinner"
                onChange={(_: unknown, date?: Date) => {
                  setShowTimePicker(false);
                  if (date) {
                    const hhmm = hhmmFromDate(date);
                    void saveReminder(hhmm);
                    setReminderOptInOpen(false);
                  }
                }}
              />
            ) : (
              <Pressable
                onPress={() => setShowTimePicker(true)}
                className="mb-4 items-center rounded-xl bg-violet-600 py-3"
              >
                <Text className="font-semibold text-white">{t("mantra.reminderPickTime")}</Text>
              </Pressable>
            )}
            {Platform.OS === "web" ? (
              <Pressable
                onPress={() => {
                  const raw = webTime.trim();
                  if (raw && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(raw)) return;
                  void saveReminder(raw || null);
                  setReminderOptInOpen(false);
                }}
                className="items-center rounded-xl bg-violet-600 py-3"
              >
                <Text className="font-semibold text-white">{t("common.save")}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <MindfulReveal
        visible={showReveal}
        onRevealComplete={() => {
          void writeMantraUx(MANTRA_UX_KEYS.revealEverCompleted, "true");
          setRevealEverCompleted(true);
          void readMantraUx(MANTRA_UX_KEYS.firstViewedAt).then((fv) => {
            if (!fv) void writeMantraUx(MANTRA_UX_KEYS.firstViewedAt, new Date().toISOString());
          });
          setTimeout(() => {
            markMantraVisited();
          }, 850);
        }}
      />
    </View>
  );
}
