import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type FC } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { AuroraSafeArea } from "@/components/CosmicBackground";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { useThemeColors } from "@/lib/themeColors";

type Timeframe = "today" | "week" | "month";

type TransitCard = {
  id: string;
  transitingBody: string;
  natalTargetBody: string;
  aspectType: string;
  startAt: string;
  endAt: string;
  peakAt: string;
  isActiveNow: boolean;
  title: string;
  shortSummary: string;
  colorHex: string;
  colorKey: string;
  themeTags: string[];
  significanceScore: number;
};

type OverviewData = {
  timeframe: string;
  /** True while overview AI (outlook + card copy) is still running server-side. */
  isGenerating?: boolean;
  dailyOutlook?: {
    title: string;
    text: string;
    moodLabel: string;
  };
  bigThree?: {
    sun: string;
    moon: string;
    rising: string | null;
  };
  precisionNote?: string | null;
  transits?: TransitCard[];
  status?: string;
  message?: string;
};

type Tc = ReturnType<typeof useThemeColors>;

const SkeletonCard: FC<{ tc: Tc }> = ({ tc }) => (
  <View
    className="mx-4 mb-3 min-h-[88px] flex-row items-stretch overflow-hidden rounded-2xl border"
    style={{ borderColor: tc.border, backgroundColor: tc.surfacePrimary }}
  >
    <View className="w-16 items-center justify-center px-2 py-3">
      <View className="mb-2 h-3 w-8 rounded" style={{ backgroundColor: tc.skeletonMuted }} />
      <View className="mb-2 min-h-[20px] w-1 flex-1 rounded" style={{ backgroundColor: tc.skeletonMuted }} />
      <View className="h-3 w-8 rounded" style={{ backgroundColor: tc.skeletonMuted }} />
    </View>
    <View className="flex-1 justify-center gap-2 py-3 pr-2">
      <View className="h-4 w-[72%] max-w-[220px] rounded" style={{ backgroundColor: tc.skeletonMuted }} />
      <View className="h-3 w-full rounded" style={{ backgroundColor: tc.skeletonMuted }} />
      <View className="h-3 w-2/3 rounded" style={{ backgroundColor: tc.skeletonMuted }} />
    </View>
    <View className="w-8" />
  </View>
);

const SkeletonOutlook: FC<{ tc: Tc }> = ({ tc }) => (
  <View
    className="mx-4 mt-4 gap-3 rounded-2xl border p-4"
    style={{ borderColor: tc.border, backgroundColor: tc.surfacePrimary }}
  >
    <View className="h-6 w-1/2 rounded" style={{ backgroundColor: tc.skeletonMuted }} />
    <View className="h-3 w-full rounded" style={{ backgroundColor: tc.skeletonMuted }} />
    <View className="h-3 w-5/6 rounded" style={{ backgroundColor: tc.skeletonMuted }} />
    <View className="h-3 w-4/6 rounded" style={{ backgroundColor: tc.skeletonMuted }} />
  </View>
);

type DetailPayload = TransitCard & {
  subtitle?: string;
  whyThisIsHappening?: string;
  whyItMattersForYou?: string;
  leanInto?: string[];
  beMindfulOf?: string[];
  longInterpretation?: {
    subtitle?: string;
    whyThisIsHappening?: string;
    whyItMattersForYou?: string;
    leanInto?: string[];
    beMindfulOf?: string[];
  };
};

const PersonalTransitsScreen: FC = () => {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const tc = useThemeColors();

  const [timeframe, setTimeframe] = useState<Timeframe>("today");
  const [byTf, setByTf] = useState<Record<Timeframe, OverviewData | null>>({
    today: null,
    week: null,
    month: null,
  });
  const [tfLoading, setTfLoading] = useState<Record<Timeframe, boolean>>({
    today: false,
    week: false,
    month: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedTransit, setSelectedTransit] = useState<TransitCard | null>(null);
  const [detailData, setDetailData] = useState<DetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const byTfRef = useRef(byTf);
  byTfRef.current = byTf;

  const currentData = byTf[timeframe];

  const loadTransits = useCallback(
    async (tf: Timeframe, force = false) => {
      if (!force && byTfRef.current[tf]) {
        setTfLoading((p) => ({ ...p, [tf]: false }));
        return;
      }

      setTfLoading((p) => ({ ...p, [tf]: true }));
      setError(null);
      try {
        const res = await apiRequest(`/api/transits/overview?timeframe=${tf}`, {
          method: "GET",
          getToken,
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Error ${res.status}`);
        }

        const json = (await res.json()) as OverviewData;
        setByTf((prev) => ({ ...prev, [tf]: json }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[personal-transits] load error:", msg);
        setError(msg);
      } finally {
        setTfLoading((p) => ({ ...p, [tf]: false }));
      }
    },
    [getToken],
  );

  useFocusEffect(
    useCallback(() => {
      void loadTransits(timeframe);
    }, [timeframe, loadTransits]),
  );

  useEffect(() => {
    if (!currentData?.isGenerating) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      if (n > 12) {
        clearInterval(id);
        return;
      }
      void loadTransits(timeframe, true);
    }, 2500);
    return () => clearInterval(id);
  }, [currentData?.isGenerating, timeframe, loadTransits]);

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    if (byTfRef.current[tf]) {
      setError(null);
      setTfLoading((p) => ({ ...p, [tf]: false }));
    } else {
      void loadTransits(tf);
    }
  };

  const noDataAnywhere = !byTf.today && !byTf.week && !byTf.month;
  const tabLoading = tfLoading[timeframe];

  const handleTransitTap = async (transit: TransitCard) => {
    setSelectedTransit(transit);
    setDetailData(null);
    setDetailLoading(true);
    setShowDetail(true);
    try {
      const res = await apiRequest(`/api/transits/detail/${encodeURIComponent(transit.id)}`, {
        method: "GET",
        getToken,
      });
      if (res.ok) {
        const raw = (await res.json()) as DetailPayload;
        const li = raw.longInterpretation;
        const merged: DetailPayload = li
          ? {
              ...raw,
              subtitle: raw.subtitle ?? li.subtitle,
              whyThisIsHappening: raw.whyThisIsHappening ?? li.whyThisIsHappening,
              whyItMattersForYou: raw.whyItMattersForYou ?? li.whyItMattersForYou,
              leanInto: raw.leanInto ?? li.leanInto,
              beMindfulOf: raw.beMindfulOf ?? li.beMindfulOf,
            }
          : raw;
        setDetailData(merged);
      }
    } catch (e: unknown) {
      console.warn("[personal-transits] detail error:", e);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const locale = i18n.language === "fa" ? "fa-IR" : "en-US";
    return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
  };

  const header = (
    <View className="flex-row items-center px-4 py-3">
      <Pressable onPress={() => router.back()} className="-ml-2 p-2" hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color={tc.navIcon} />
      </Pressable>
      <Text className="mr-8 flex-1 text-center text-lg font-semibold" style={{ color: tc.textPrimary }}>
        {t("transits.screenTitle")}
      </Text>
    </View>
  );

  if (tabLoading && !currentData && !error && noDataAnywhere) {
    return (
      <AuroraSafeArea className="flex-1" edges={["top", "left", "right"]}>
        {header}
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <SkeletonOutlook tc={tc} />
          <View className="mx-4 mt-3 flex-row flex-wrap gap-2">
            {[1, 2, 3].map((i) => (
              <View key={i} className="h-7 w-24 rounded-full" style={{ backgroundColor: tc.skeletonMuted }} />
            ))}
          </View>
          <View className="mx-4 mt-4 flex-row gap-2">
            {(["today", "week", "month"] as const).map((tf) => (
              <Pressable
                key={tf}
                onPress={() => handleTimeframeChange(tf)}
                className={`rounded-full px-4 py-2 ${timeframe === tf ? "bg-indigo-500" : "border"}`}
                style={
                  timeframe === tf ? undefined : { borderColor: tc.border, backgroundColor: tc.surfacePrimary }
                }
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: timeframe === tf ? "#ffffff" : tc.textSecondary }}
                >
                  {tf === "today" ? t("transits.today") : tf === "week" ? t("transits.thisWeek") : t("transits.thisMonth")}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="mx-4 mb-3 mt-6 text-xs font-semibold uppercase tracking-wider" style={{ color: tc.textSecondary }}>
            {t("transits.upcomingTitle")}
          </Text>
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} tc={tc} />
          ))}
        </ScrollView>
      </AuroraSafeArea>
    );
  }

  if (error && !currentData && !tabLoading && noDataAnywhere) {
    return (
      <AuroraSafeArea className="flex-1" edges={["top", "left", "right"]}>
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="warning-outline" size={48} color={tc.iconSecondary} />
          <Text className="mt-4 text-center" style={{ color: tc.textSecondary }}>
            {t("transits.errorTitle")}
          </Text>
          <Pressable
            onPress={() => {
              setByTf({ today: null, week: null, month: null });
              setError(null);
              void loadTransits(timeframe, true);
            }}
            className="mt-6 rounded-xl bg-indigo-500 px-6 py-3"
          >
            <Text className="font-semibold text-white">{t("transits.retry")}</Text>
          </Pressable>
        </View>
      </AuroraSafeArea>
    );
  }

  if (currentData?.status === "incomplete_profile") {
    return (
      <AuroraSafeArea className="flex-1" edges={["top", "left", "right"]}>
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="planet-outline" size={56} color={tc.iconSecondary} />
          <Text className="mt-4 text-center text-lg font-semibold" style={{ color: tc.textPrimary }}>
            {t("transits.incompleteTitle")}
          </Text>
          <Text className="mt-2 text-center text-sm" style={{ color: tc.textSecondary }}>
            {t("transits.incompleteMessage")}
          </Text>
          <Pressable
            onPress={() => router.push("/(main)/edit-profile")}
            className="mt-6 rounded-xl bg-indigo-500 px-6 py-3"
          >
            <Text className="font-semibold text-white">{t("transits.completeBirthDetails")}</Text>
          </Pressable>
        </View>
      </AuroraSafeArea>
    );
  }

  const list = currentData?.transits ?? [];
  const showTabSkeleton = !currentData && tabLoading;
  const showInlineError = Boolean(error && !currentData && !tabLoading && !noDataAnywhere);

  const moodLabelColor = tc.isDark ? "#a5b4fc" : "#4338ca";

  return (
    <AuroraSafeArea className="flex-1" edges={["top", "left", "right"]}>
      {header}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {showInlineError ? (
          <View className="mx-4 mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-4">
            <Text className="text-center text-sm" style={{ color: tc.textPrimary }}>
              {t("transits.errorTitle")}
            </Text>
            <Pressable
              onPress={() => {
                setError(null);
                void loadTransits(timeframe, true);
              }}
              className="mt-3 self-center rounded-xl bg-indigo-500 px-5 py-2"
            >
              <Text className="font-semibold text-white">{t("transits.retry")}</Text>
            </Pressable>
          </View>
        ) : null}

        {showTabSkeleton ? (
          <SkeletonOutlook tc={tc} />
        ) : currentData?.isGenerating ? (
          <View className="mx-4 mt-4">
            <SkeletonOutlook tc={tc} />
            <Text className="mt-2 text-center text-xs" style={{ color: tc.textTertiary }}>
              {t("transits.polishingOutlook")}
            </Text>
          </View>
        ) : currentData?.dailyOutlook ? (
          <View
            className="mx-4 mt-4 rounded-2xl border p-4"
            style={{ borderColor: tc.border, backgroundColor: tc.surfacePrimary }}
          >
            <View className="mb-2 flex-row items-start justify-between">
              <Text className="mr-3 flex-1 text-lg font-bold" style={{ color: tc.textPrimary }}>
                {currentData.dailyOutlook.title}
              </Text>
              <View className="rounded-full px-3 py-1" style={{ backgroundColor: tc.isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.15)" }}>
                <Text className="text-xs font-medium" style={{ color: moodLabelColor }}>
                  {currentData.dailyOutlook.moodLabel}
                </Text>
              </View>
            </View>
            <Text className="text-sm leading-relaxed" style={{ color: tc.textSecondary }}>
              {currentData.dailyOutlook.text}
            </Text>
          </View>
        ) : null}

        {showTabSkeleton ? (
          <View className="mx-4 mt-3 flex-row flex-wrap gap-2">
            {[1, 2, 3].map((i) => (
              <View key={i} className="h-7 w-24 rounded-full" style={{ backgroundColor: tc.skeletonMuted }} />
            ))}
          </View>
        ) : currentData?.bigThree ? (
          <View className="mx-4 mt-3 flex-row flex-wrap gap-2">
            {[
              { label: "☉", value: currentData.bigThree.sun },
              { label: "☽", value: currentData.bigThree.moon ?? "—" },
              ...(currentData.bigThree.rising
                ? [{ label: "↑", value: currentData.bigThree.rising }]
                : []),
            ].map((item, i) => (
              <View
                key={i}
                className="flex-row items-center rounded-full border px-3 py-1.5"
                style={{ borderColor: tc.border, backgroundColor: tc.surfacePrimary }}
              >
                <Text className="mr-1 text-xs" style={{ color: tc.textSecondary }}>
                  {item.label}
                </Text>
                <Text className="text-xs font-medium" style={{ color: tc.textPrimary }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {!showTabSkeleton && currentData?.precisionNote ? (
          <Text className="mx-4 mt-2 text-xs italic" style={{ color: tc.textTertiary }}>
            {currentData.precisionNote}
          </Text>
        ) : null}

        <View className="mx-4 mt-4 flex-row gap-2">
          {(["today", "week", "month"] as const).map((tf) => (
            <Pressable
              key={tf}
              onPress={() => handleTimeframeChange(tf)}
              className={`rounded-full px-4 py-2 ${timeframe === tf ? "bg-indigo-500" : "border"}`}
              style={timeframe === tf ? undefined : { borderColor: tc.border, backgroundColor: tc.surfacePrimary }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: timeframe === tf ? "#ffffff" : tc.textSecondary }}
              >
                {tf === "today" ? t("transits.today") : tf === "week" ? t("transits.thisWeek") : t("transits.thisMonth")}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="mx-4 mb-3 mt-6 text-xs font-semibold uppercase tracking-wider" style={{ color: tc.textSecondary }}>
          {t("transits.upcomingTitle")}
        </Text>

        {showTabSkeleton ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} tc={tc} />
            ))}
          </>
        ) : list.length === 0 ? (
          <View className="mx-4 items-center py-12">
            <Ionicons name="planet-outline" size={40} color={tc.iconSecondary} />
            <Text className="mt-3 text-center text-sm" style={{ color: tc.textTertiary }}>
              {t("transits.noTransits")}
            </Text>
          </View>
        ) : (
          list.map((transit) => (
            <Pressable
              key={transit.id}
              onPress={() => void handleTransitTap(transit)}
              className="mx-4 mb-3 min-h-[88px] flex-row items-stretch overflow-hidden rounded-2xl border active:opacity-70"
              style={{ borderColor: tc.border, backgroundColor: tc.surfacePrimary }}
            >
              <View className="w-16 items-center justify-center px-2 py-3">
                <Text className="text-center text-xs font-medium" style={{ color: tc.textTertiary }}>
                  {formatDate(transit.startAt)}
                </Text>
                <View
                  style={{
                    backgroundColor: transit.colorHex ?? "#8b8cff",
                    width: 4,
                    borderRadius: 2,
                    flex: 1,
                    marginVertical: 4,
                    minHeight: 20,
                  }}
                />
                <Text className="text-center text-xs font-medium" style={{ color: tc.textTertiary }}>
                  {formatDate(transit.endAt)}
                </Text>
              </View>
              <View className="flex-1 justify-center py-3 pr-2">
                {transit.isActiveNow ? (
                  <View className="mb-1 self-start rounded-full bg-green-500/20 px-2 py-0.5">
                    <Text className="text-xs font-semibold text-green-400">{t("transits.now")}</Text>
                  </View>
                ) : null}
                <Text className="mb-1 text-sm font-semibold" style={{ color: tc.textPrimary }} numberOfLines={1}>
                  {transit.title}
                </Text>
                <Text className="text-xs leading-relaxed" style={{ color: tc.textSecondary }} numberOfLines={2}>
                  {transit.shortSummary}
                </Text>
              </View>
              <View className="w-8 items-center justify-center">
                <Ionicons name="chevron-forward" size={16} color={tc.iconSecondary} />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="max-h-[85%] rounded-t-3xl" style={{ backgroundColor: tc.sheetBackground }}>
            <View className="flex-row items-center border-b px-4 pb-3 pt-4" style={{ borderBottomColor: tc.borderSubtle }}>
              <View className="flex-1">
                <Text className="text-base font-bold" style={{ color: tc.textPrimary }}>
                  {selectedTransit?.title ?? t("transits.detailTitle")}
                </Text>
                {detailData?.subtitle ? (
                  <Text className="mt-0.5 text-xs" style={{ color: tc.textTertiary }}>
                    {detailData.subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => setShowDetail(false)} className="p-2" hitSlop={12}>
                <Ionicons name="close" size={22} color={tc.iconPrimary} />
              </Pressable>
            </View>

            <ScrollView className="px-4 py-4" contentContainerStyle={{ paddingBottom: 32 }}>
              {detailLoading ? (
                <View className="items-center py-12">
                  <ActivityIndicator color="#8b8cff" />
                  <Text className="mt-3 text-sm" style={{ color: tc.textTertiary }}>
                    {t("transits.loading")}
                  </Text>
                </View>
              ) : detailData ? (
                <>
                  <View
                    style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: selectedTransit?.colorHex ?? "#8b8cff",
                      marginBottom: 16,
                    }}
                  />
                  {detailData.whyThisIsHappening ? (
                    <View className="mb-4">
                      <Text className="mb-2 text-xs uppercase tracking-wider" style={{ color: tc.textTertiary }}>
                        {t("transits.whyHappening")}
                      </Text>
                      <Text className="text-sm leading-relaxed" style={{ color: tc.textPrimary }}>
                        {detailData.whyThisIsHappening}
                      </Text>
                    </View>
                  ) : null}
                  {detailData.whyItMattersForYou ? (
                    <View className="mb-4">
                      <Text className="mb-2 text-xs uppercase tracking-wider" style={{ color: tc.textTertiary }}>
                        {t("transits.whyMatters")}
                      </Text>
                      <Text className="text-sm leading-relaxed" style={{ color: tc.textPrimary }}>
                        {detailData.whyItMattersForYou}
                      </Text>
                    </View>
                  ) : null}
                  {detailData.leanInto && detailData.leanInto.length > 0 ? (
                    <View className="mb-4">
                      <Text className="mb-2 text-xs uppercase tracking-wider" style={{ color: tc.textTertiary }}>
                        {t("transits.leanInto")}
                      </Text>
                      {detailData.leanInto.map((item, i) => (
                        <View key={i} className="mb-2 flex-row items-start">
                          <Text className="mr-2 mt-0.5 text-indigo-400">✦</Text>
                          <Text className="flex-1 text-sm leading-relaxed" style={{ color: tc.textSecondary }}>
                            {item}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {detailData.beMindfulOf && detailData.beMindfulOf.length > 0 ? (
                    <View className="mb-4">
                      <Text className="mb-2 text-xs uppercase tracking-wider" style={{ color: tc.textTertiary }}>
                        {t("transits.beMindful")}
                      </Text>
                      {detailData.beMindfulOf.map((item, i) => (
                        <View key={i} className="mb-2 flex-row items-start">
                          <Text className="mr-2 mt-0.5 text-amber-400">◦</Text>
                          <Text className="flex-1 text-sm leading-relaxed" style={{ color: tc.textSecondary }}>
                            {item}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <View className="items-center py-8">
                  <Text className="text-sm" style={{ color: tc.textTertiary }}>
                    {t("common.tryAgain")}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AuroraSafeArea>
  );
};

export default PersonalTransitsScreen;
