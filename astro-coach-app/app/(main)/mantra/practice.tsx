import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { CosmicBackground } from "@/components/CosmicBackground";
import { PostPracticeSheet } from "@/components/mantra/PostPracticeSheet";
import { useMantraBackground } from "@/hooks/useMantraBackground";
import { trackEvent } from "@/lib/mixpanel";
import { useMantraStore } from "@/stores/mantraStore";
import { PRACTICE_MODES, type MantraPracticeMode, type MantraRegister } from "@/types/mantra";

function lineForRegister(
  m: NonNullable<ReturnType<typeof useMantraStore.getState>["mantra"]>,
  lang: "en" | "fa",
  register: MantraRegister,
): string {
  if (lang === "fa") return register === "direct" ? m.mantraFaDirect : m.mantraFaExploratory;
  return register === "direct" ? m.mantraEnDirect : m.mantraEnExploratory;
}

function tieForLang(m: NonNullable<ReturnType<typeof useMantraStore.getState>["mantra"]>, lang: "en" | "fa") {
  return lang === "fa" ? m.tieBackFa : m.tieBackEn;
}

export default function MantraPracticeScreen() {
  useKeepAwake();
  const { modeId, register: regParam, lang: langParam } = useLocalSearchParams<{
    modeId: string;
    register?: string;
    lang?: string;
  }>();
  const register: MantraRegister = regParam === "exploratory" ? "exploratory" : "direct";
  const lang: "en" | "fa" = langParam === "fa" ? "fa" : "en";

  const mode = useMemo(
    () => (PRACTICE_MODES.find((m) => m.id === modeId) ?? PRACTICE_MODES[0]) as MantraPracticeMode,
    [modeId],
  );
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith("fa");
  const mantra = useMantraStore((s) => s.mantra);
  const { selectedId } = useMantraBackground();

  const startedAtRef = useRef<number>(Date.now());

  const mantraLine = mantra ? lineForRegister(mantra, lang, register) : "";
  const tieLine = mantra ? tieForLang(mantra, lang) : "";

  const [count, setCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(
    mode.kind === "timer" ? mode.durationSeconds : 0,
  );
  const [showBreathHint, setShowBreathHint] = useState(true);
  const breathOpacity = useSharedValue(1);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [doneSummary, setDoneSummary] = useState("");
  const [completionReps, setCompletionReps] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    trackEvent("mantra_practice_started", { mode: mode.id });
  }, [mode.id]);

  const triggerCompletion = useCallback(
    async (finalCount?: number) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const elapsed =
        mode.kind === "timer"
          ? Math.max(3, mode.durationSeconds)
          : Math.max(3, Math.floor((Date.now() - startedAtRef.current) / 1000));
      setElapsedSec(elapsed);
      const reps = mode.kind === "timer" || mode.kind === "silent" ? 0 : finalCount ?? 0;
      setCompletionReps(reps);
      trackEvent("mantra_practice_completed", { mode: mode.id, repetitions: reps, durationSec: elapsed });
      const label = isRtl ? mode.labelFa : mode.labelEn;
      if (mode.kind === "timer") {
        const mm = Math.floor(mode.durationSeconds / 60);
        setDoneSummary(`${mm} min · ${label}`);
      } else if (mode.kind === "silent") {
        setDoneSummary(label);
      } else {
        setDoneSummary(`${reps} × ${label}`);
      }
      setCompleteOpen(true);
    },
    [isRtl, mode],
  );

  const timerDoneRef = useRef(false);
  useEffect(() => {
    timerDoneRef.current = false;
    startedAtRef.current = Date.now();
    setCount(0);
    setShowBreathHint(true);
    breathOpacity.value = 1;
    if (mode.kind === "timer") {
      setSecondsLeft(mode.durationSeconds);
    } else {
      setSecondsLeft(0);
    }
  }, [mode.id, mode.kind, mode, breathOpacity]);

  useEffect(() => {
    if (mode.kind !== "timer") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) return 0;
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [mode.kind, mode.id]);

  useEffect(() => {
    if (mode.kind !== "timer") return;
    if (secondsLeft !== 0 || timerDoneRef.current) return;
    timerDoneRef.current = true;
    void triggerCompletion(0);
  }, [secondsLeft, mode.kind, triggerCompletion]);

  const onMainTap = () => {
    if (mode.kind === "timer" || mode.kind === "silent") return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (mode.kind === "breath") {
      setShowBreathHint(false);
      breathOpacity.value = withTiming(0, { duration: 300 });
    }
    const target = mode.kind === "breath" ? mode.breaths : mode.kind === "count" ? mode.count : 1;
    setCount((c) => {
      const n = c + 1;
      if (n >= target) void triggerCompletion(n);
      return n;
    });
  };

  const breathStyle = useAnimatedStyle(() => ({ opacity: breathOpacity.value }));

  const mmss = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress =
    mode.kind === "timer"
      ? 1 - secondsLeft / mode.durationSeconds
      : mode.kind === "breath" || mode.kind === "count"
        ? count /
          (mode.kind === "breath" ? mode.breaths : mode.kind === "count" ? mode.count : 1)
        : 0;

  const size = 120;
  const stroke = 2;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - Math.min(1, progress));

  const useStillness = selectedId === "cosmic-default";

  return (
    <View className="flex-1">
      <CosmicBackground practiceStillness={useStillness} />
      <Pressable
        onPress={mode.kind === "timer" || mode.kind === "silent" ? undefined : onMainTap}
        className="flex-1"
        style={{ paddingTop: 48 }}
      >
        <Pressable
          onPress={() => router.back()}
          className="absolute left-4 top-12 z-10 h-10 w-10 items-center justify-center rounded-[20px]"
          hitSlop={12}
          accessibilityRole="button"
        >
          <Ionicons name={isRtl ? "arrow-forward" : "arrow-back"} size={24} color="rgba(255,255,255,0.7)" />
        </Pressable>

        <View className="flex-1 items-center justify-center px-8">
          {mantraLine ? (
            <Text
              className="text-center font-bold text-white"
              style={{
                fontSize: 28,
                lineHeight: 39,
                writingDirection: isRtl ? "rtl" : "ltr",
                textAlign: isRtl ? "right" : "center",
                letterSpacing: -0.3,
              }}
              numberOfLines={3}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {mantraLine}
            </Text>
          ) : null}
          {tieLine ? (
            <Text
              className="mt-3 text-center text-sm text-white/60"
              style={{ writingDirection: isRtl ? "rtl" : "ltr" }}
              numberOfLines={2}
            >
              {tieLine}
            </Text>
          ) : null}

          {mode.kind === "silent" ? (
            <Text className="mt-8 text-center text-base text-white/80" style={{ writingDirection: isRtl ? "rtl" : "ltr" }}>
              {t("mantra.silentHint")}
            </Text>
          ) : null}

          {mode.kind === "breath" && (
            <Animated.Text style={[breathStyle, { marginTop: 24, color: "rgba(255,255,255,0.85)" }]}>
              {t("mantra.breathHint")}
            </Animated.Text>
          )}

          {mode.kind !== "timer" &&
            mode.kind !== "silent" &&
            (mode.kind === "count" || mode.kind === "breath") && (
              <View className="mt-10 items-center">
                {mode.kind === "count" && mode.count === 3 ? (
                  <View className="flex-row gap-2">
                    {Array.from({
                      length: mode.count,
                    }).map((_, i) => (
                      <View
                        key={i}
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: i < count ? "#fff" : "rgba(255,255,255,0.25)",
                        }}
                      />
                    ))}
                  </View>
                ) : (
                  <View className="items-center">
                    <Svg width={size} height={size}>
                      <Circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth={stroke}
                        fill="none"
                      />
                      <Circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        stroke="#fff"
                        strokeWidth={stroke}
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        rotation="-90"
                        origin={`${cx}, ${cy}`}
                      />
                    </Svg>
                    <Text
                      className="absolute text-2xl font-bold text-white"
                      style={{ marginTop: size / 2 - 16 }}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </View>
            )}

          {mode.kind === "timer" && (
            <View className="mt-10 items-center">
              <Svg width={size} height={size}>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={stroke}
                  fill="none"
                />
                <Circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  stroke="#fff"
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  rotation="-90"
                  origin={`${cx}, ${cy}`}
                />
              </Svg>
              <Text className="absolute text-2xl font-bold text-white" style={{ marginTop: size / 2 - 16 }}>
                {mmss(secondsLeft)}
              </Text>
            </View>
          )}

          {mode.kind === "silent" ? (
            <Pressable
              onPress={() => void triggerCompletion(0)}
              className="mt-12 min-h-[44px] items-center justify-center rounded-full bg-white/15 px-8 py-3"
            >
              <Text className="font-semibold text-white">{t("mantra.silentFinish")}</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable onPress={() => router.replace("/(main)/mantra")} className="items-center pb-10">
          <Text style={{ color: "rgba(255,255,255,0.5)" }}>{t("mantra.doneLink")}</Text>
        </Pressable>
      </Pressable>

      {mantra ? (
        <PostPracticeSheet
          open={completeOpen}
          onClose={() => setCompleteOpen(false)}
          onDoneNavigate={() => router.replace("/(main)/mantra")}
          summaryLine={doneSummary}
          modeId={mode.id}
          repetitions={completionReps}
          durationSec={elapsedSec}
          register={register}
          language={lang}
          mantraText={mantraLine}
          mantra={mantra}
        />
      ) : null}
    </View>
  );
}
