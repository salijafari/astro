import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState, type FC } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

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

  const [timeframe, setTimeframe] = useState<Timeframe>("today");
  const [byTf, setByTf] = useState<Record<Timeframe, OverviewData | null>>({
    today: null,
    week: null,
    month: null,
  });
  const [loading, setLoading] = useState(true);
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
        setLoading(false);
        return;
      }

      setLoading(true);
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
        setLoading(false);
      }
    },
    [getToken],
  );

  useFocusEffect(
    useCallback(() => {
      void loadTransits(timeframe);
    }, [timeframe, loadTransits]),
  );

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    if (!byTfRef.current[tf]) {
      void loadTransits(tf);
    } else {
      setLoading(false);
      setError(null);
    }
  };

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
    <View className="flex-row items-center border-b border-white/10 px-4 py-3">
      <Pressable onPress={() => router.back()} className="-ml-2 p-2" hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </Pressable>
      <Text className="mr-8 flex-1 text-center text-lg font-semibold text-white">
        {t("transits.screenTitle")}
      </Text>
    </View>
  );

  if (loading && !currentData) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950" edges={["top", "left", "right"]}>
        {header}
        <ScrollView className="flex-1 px-4 pt-4">
          {[1, 2, 3].map((i) => (
            <View key={i} className="mb-3 h-20 rounded-2xl bg-white/5" />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error && !currentData) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950" edges={["top", "left", "right"]}>
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="warning-outline" size={48} color="rgba(255,255,255,0.3)" />
          <Text className="mt-4 text-center text-white/50">{t("transits.errorTitle")}</Text>
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
      </SafeAreaView>
    );
  }

  if (currentData?.status === "incomplete_profile") {
    return (
      <SafeAreaView className="flex-1 bg-slate-950" edges={["top", "left", "right"]}>
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="planet-outline" size={56} color="rgba(255,255,255,0.2)" />
          <Text className="mt-4 text-center text-lg font-semibold text-white">
            {t("transits.incompleteTitle")}
          </Text>
          <Text className="mt-2 text-center text-sm text-white/50">{t("transits.incompleteMessage")}</Text>
          <Pressable
            onPress={() => router.push("/(main)/edit-profile")}
            className="mt-6 rounded-xl bg-indigo-500 px-6 py-3"
          >
            <Text className="font-semibold text-white">{t("transits.completeBirthDetails")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const list = currentData?.transits ?? [];

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top", "left", "right"]}>
      {header}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {currentData?.dailyOutlook ? (
          <View className="mx-4 mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <View className="mb-2 flex-row items-start justify-between">
              <Text className="mr-3 flex-1 text-lg font-bold text-white">
                {currentData.dailyOutlook.title}
              </Text>
              <View className="rounded-full bg-indigo-500/20 px-3 py-1">
                <Text className="text-xs font-medium text-indigo-300">
                  {currentData.dailyOutlook.moodLabel}
                </Text>
              </View>
            </View>
            <Text className="text-sm leading-relaxed text-white/70">{currentData.dailyOutlook.text}</Text>
          </View>
        ) : null}

        {currentData?.bigThree ? (
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
                className="flex-row items-center rounded-full border border-white/10 bg-white/10 px-3 py-1.5"
              >
                <Text className="mr-1 text-xs text-white/50">{item.label}</Text>
                <Text className="text-xs font-medium text-white">{item.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {currentData?.precisionNote ? (
          <Text className="mx-4 mt-2 text-xs italic text-white/30">{currentData.precisionNote}</Text>
        ) : null}

        <View className="mx-4 mt-4 flex-row gap-2">
          {(["today", "week", "month"] as const).map((tf) => (
            <Pressable
              key={tf}
              onPress={() => handleTimeframeChange(tf)}
              className={`rounded-full px-4 py-2 ${timeframe === tf ? "bg-indigo-500" : "border border-white/10 bg-white/10"}`}
            >
              <Text
                className={`text-sm font-medium ${timeframe === tf ? "text-white" : "text-white/50"}`}
              >
                {tf === "today" ? t("transits.today") : tf === "week" ? t("transits.thisWeek") : t("transits.thisMonth")}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="mx-4 mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-white/50">
          {t("transits.upcomingTitle")}
        </Text>

        {list.length === 0 ? (
          <View className="mx-4 items-center py-12">
            <Ionicons name="planet-outline" size={40} color="rgba(255,255,255,0.15)" />
            <Text className="mt-3 text-center text-sm text-white/30">{t("transits.noTransits")}</Text>
          </View>
        ) : (
          list.map((transit) => (
            <Pressable
              key={transit.id}
              onPress={() => void handleTransitTap(transit)}
              className="mx-4 mb-3 min-h-[88px] flex-row items-stretch overflow-hidden rounded-2xl border border-white/10 bg-white/5 active:opacity-70"
            >
              <View className="w-16 items-center justify-center px-2 py-3">
                <Text className="text-center text-xs font-medium text-white/40">{formatDate(transit.startAt)}</Text>
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
                <Text className="text-center text-xs font-medium text-white/40">{formatDate(transit.endAt)}</Text>
              </View>
              <View className="flex-1 justify-center py-3 pr-2">
                {transit.isActiveNow ? (
                  <View className="mb-1 self-start rounded-full bg-green-500/20 px-2 py-0.5">
                    <Text className="text-xs font-semibold text-green-400">{t("transits.now")}</Text>
                  </View>
                ) : null}
                <Text className="mb-1 text-sm font-semibold text-white" numberOfLines={1}>
                  {transit.title}
                </Text>
                <Text className="text-xs leading-relaxed text-white/50" numberOfLines={2}>
                  {transit.shortSummary}
                </Text>
              </View>
              <View className="w-8 items-center justify-center">
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="max-h-[85%] rounded-t-3xl bg-slate-900">
            <View className="flex-row items-center border-b border-white/10 px-4 pb-3 pt-4">
              <View className="flex-1">
                <Text className="text-base font-bold text-white">
                  {selectedTransit?.title ?? t("transits.detailTitle")}
                </Text>
                {detailData?.subtitle ? (
                  <Text className="mt-0.5 text-xs text-white/40">{detailData.subtitle}</Text>
                ) : null}
              </View>
              <Pressable onPress={() => setShowDetail(false)} className="p-2" hitSlop={12}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>

            <ScrollView className="px-4 py-4" contentContainerStyle={{ paddingBottom: 32 }}>
              {detailLoading ? (
                <View className="items-center py-12">
                  <ActivityIndicator color="#8b8cff" />
                  <Text className="mt-3 text-sm text-white/40">{t("transits.loading")}</Text>
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
                      <Text className="mb-2 text-xs uppercase tracking-wider text-white/40">
                        {t("transits.whyHappening")}
                      </Text>
                      <Text className="text-sm leading-relaxed text-white/80">{detailData.whyThisIsHappening}</Text>
                    </View>
                  ) : null}
                  {detailData.whyItMattersForYou ? (
                    <View className="mb-4">
                      <Text className="mb-2 text-xs uppercase tracking-wider text-white/40">
                        {t("transits.whyMatters")}
                      </Text>
                      <Text className="text-sm leading-relaxed text-white/80">{detailData.whyItMattersForYou}</Text>
                    </View>
                  ) : null}
                  {detailData.leanInto && detailData.leanInto.length > 0 ? (
                    <View className="mb-4">
                      <Text className="mb-2 text-xs uppercase tracking-wider text-white/40">
                        {t("transits.leanInto")}
                      </Text>
                      {detailData.leanInto.map((item, i) => (
                        <View key={i} className="mb-2 flex-row items-start">
                          <Text className="mr-2 mt-0.5 text-indigo-400">✦</Text>
                          <Text className="flex-1 text-sm leading-relaxed text-white/70">{item}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {detailData.beMindfulOf && detailData.beMindfulOf.length > 0 ? (
                    <View className="mb-4">
                      <Text className="mb-2 text-xs uppercase tracking-wider text-white/40">
                        {t("transits.beMindful")}
                      </Text>
                      {detailData.beMindfulOf.map((item, i) => (
                        <View key={i} className="mb-2 flex-row items-start">
                          <Text className="mr-2 mt-0.5 text-amber-400">◦</Text>
                          <Text className="flex-1 text-sm leading-relaxed text-white/70">{item}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <View className="items-center py-8">
                  <Text className="text-sm text-white/40">{t("common.tryAgain")}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default PersonalTransitsScreen;
