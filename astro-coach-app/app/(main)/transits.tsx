import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { PaywallScreen } from "@/components/coaching/PaywallScreen";

/* ─── Response types ─── */

type TransitEvent = {
  id: string;
  transitingBody: string;
  natalTargetBody: string | null;
  aspectType: string | null;
  significanceScore: number;
  themeTags: string[];
  title: string;
  shortSummary: string;
  colorKey: string;
  isActiveNow: boolean;
  startAt: string;
  endAt: string;
  longInterpretation: unknown | null;
};

type DailyOutlook = {
  title: string;
  text: string;
  moodLabel: string;
};

type BigThree = {
  sun: string;
  moon: string;
  rising: string | null;
};

type OverviewResponse = {
  status?: string;
  timeframe?: string;
  dailyOutlook?: DailyOutlook;
  bigThree?: BigThree;
  precisionNote?: string | null;
  transits?: TransitEvent[];
};

type TransitInterpretation = {
  subtitle: string;
  whyThisIsHappening: string;
  whyItMattersForYou: string;
  leanInto: string[];
  beMindfulOf: string[];
};

type TransitDetailResponse = TransitEvent & {
  longInterpretation: TransitInterpretation;
};

/* ─── Constants ─── */

const TIMEFRAMES = ["today", "week", "month"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

/* ─── Skeleton loader ─── */

function SkeletonCards({ theme }: { theme: ReturnType<typeof useTheme>["theme"] }) {
  return (
    <View className="px-4 mt-4">
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          className="mb-3 rounded-2xl p-4"
          style={{ backgroundColor: theme.colors.surface, opacity: 0.5 }}
        >
          <View
            className="h-4 w-3/4 rounded"
            style={{ backgroundColor: theme.colors.outline }}
          />
          <View
            className="mt-2 h-3 w-full rounded"
            style={{ backgroundColor: theme.colors.outline }}
          />
          <View
            className="mt-1 h-3 w-2/3 rounded"
            style={{ backgroundColor: theme.colors.outline }}
          />
        </View>
      ))}
    </View>
  );
}

/* ─── Main screen ─── */

export default function TransitsScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { getToken } = useAuth();
  const router = useRouter();
  const rtl = i18n.language === "fa";

  const [timeframe, setTimeframe] = useState<Timeframe>("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [incompleteProfile, setIncompleteProfile] = useState(false);

  const [outlook, setOutlook] = useState<DailyOutlook | null>(null);
  const [bigThree, setBigThree] = useState<BigThree | null>(null);
  const [precisionNote, setPrecisionNote] = useState<string | null>(null);
  const [transits, setTransits] = useState<TransitEvent[]>([]);

  const [selectedTransit, setSelectedTransit] = useState<TransitEvent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<TransitDetailResponse | null>(null);

  const fetchOverview = useCallback(async (tf: Timeframe) => {
    setLoading(true);
    setError(null);
    setIncompleteProfile(false);
    try {
      const res = await apiRequest(`/api/transits/overview?timeframe=${tf}`, {
        method: "GET",
        getToken,
      });

      if (res.status === 402) {
        setPaywallOpen(true);
        return;
      }

      const data: OverviewResponse = await res.json();

      if (data.status === "incomplete_profile") {
        setIncompleteProfile(true);
        return;
      }

      setOutlook(data.dailyOutlook ?? null);
      setBigThree(data.bigThree ?? null);
      setPrecisionNote(data.precisionNote ?? null);
      setTransits(data.transits ?? []);
    } catch (e) {
      const s = e instanceof Error ? e.message : String(e);
      if (s.includes("premium_required")) setPaywallOpen(true);
      else setError(s);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void fetchOverview(timeframe);
  }, [timeframe, fetchOverview]);

  const handleTransitPress = useCallback(async (transit: TransitEvent) => {
    setSelectedTransit(transit);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const res = await apiRequest(`/api/transits/detail/${transit.id}`, {
        method: "GET",
        getToken,
      });
      if (res.ok) {
        const data: TransitDetailResponse = await res.json();
        setDetailData(data);
      }
    } catch {
      /* detail fetch failed — show fallback in sheet */
    } finally {
      setDetailLoading(false);
    }
  }, [getToken]);

  const timeframeLabel = useMemo(() => ({
    today: t("transits.today"),
    week: t("transits.thisWeek"),
    month: t("transits.thisMonth"),
  }), [t]);

  /* ─── Incomplete profile state ─── */
  if (incompleteProfile) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="planet-outline" size={64} color={theme.colors.primary} />
          <Text
            className="mt-4 text-xl font-semibold text-center"
            style={{ color: theme.colors.onBackground }}
          >
            {t("transits.incompleteTitle")}
          </Text>
          <Text
            className="mt-2 text-center"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("transits.incompleteMessage")}
          </Text>
          <Pressable
            onPress={() => router.push("/(main)/edit-profile")}
            className="mt-6 rounded-2xl px-6 py-3"
            style={{ backgroundColor: theme.colors.primary }}
          >
            <Text className="text-white font-semibold text-base">
              {t("transits.completeBirthDetails")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── Error state ─── */
  if (!loading && error) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error ?? "#ef4444"} />
          <Text
            className="mt-4 text-lg font-semibold text-center"
            style={{ color: theme.colors.onBackground }}
          >
            {t("transits.errorTitle")}
          </Text>
          <Text
            className="mt-2 text-center"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {error}
          </Text>
          <Pressable
            onPress={() => fetchOverview(timeframe)}
            className="mt-6 rounded-2xl px-6 py-3"
            style={{ backgroundColor: theme.colors.primary }}
          >
            <Text className="text-white font-semibold">{t("transits.retry")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── Main content ─── */
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-4 pt-2 pb-4">
          <Text
            className="text-2xl font-bold"
            style={{ color: theme.colors.onBackground, writingDirection: rtl ? "rtl" : "ltr" }}
          >
            {t("transits.screenTitle")}
          </Text>
        </View>

        {loading ? (
          <SkeletonCards theme={theme} />
        ) : (
          <>
            {/* Daily Outlook Card */}
            {outlook && (
              <View
                className="mx-4 rounded-2xl p-4 mb-2"
                style={{ backgroundColor: theme.colors.surface }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text
                    className="text-lg font-semibold flex-1"
                    style={{ color: theme.colors.onSurface, writingDirection: rtl ? "rtl" : "ltr" }}
                  >
                    {outlook.title}
                  </Text>
                  {outlook.moodLabel ? (
                    <View
                      className="rounded-full px-3 py-1 ml-2"
                      style={{ backgroundColor: `${theme.colors.primary}20` }}
                    >
                      <Text
                        className="text-xs font-medium"
                        style={{ color: theme.colors.primary }}
                      >
                        {outlook.moodLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  className="text-sm leading-5"
                  style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr" }}
                >
                  {outlook.text}
                </Text>
              </View>
            )}

            {/* Big Three pills */}
            {bigThree && (
              <View className="flex-row mx-4 mt-3 mb-1">
                {[
                  { label: `☉ ${bigThree.sun}`, key: "sun" },
                  { label: `☽ ${bigThree.moon}`, key: "moon" },
                  ...(bigThree.rising
                    ? [{ label: `↑ ${bigThree.rising}`, key: "rising" }]
                    : []),
                ].map((item) => (
                  <View
                    key={item.key}
                    className="rounded-full px-3 py-1 mr-2"
                    style={{ backgroundColor: theme.colors.surface }}
                  >
                    <Text
                      className="text-xs"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Precision note */}
            {precisionNote ? (
              <Text
                className="mx-4 mt-2 text-xs italic"
                style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {precisionNote}
              </Text>
            ) : null}

            {/* Timeframe filter */}
            <View className="flex-row mx-4 mt-4 mb-3">
              {TIMEFRAMES.map((tf) => {
                const active = tf === timeframe;
                return (
                  <Pressable
                    key={tf}
                    onPress={() => setTimeframe(tf)}
                    className="rounded-full px-4 py-2 mr-2"
                    style={{
                      backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                    }}
                  >
                    <Text
                      className="text-sm font-medium"
                      style={{
                        color: active ? "#ffffff" : theme.colors.onSurfaceVariant,
                      }}
                    >
                      {timeframeLabel[tf]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Transit list */}
            {transits.length > 0 ? (
              <View className="px-4">
                {transits.map((transit) => (
                  <Pressable
                    key={transit.id}
                    onPress={() => handleTransitPress(transit)}
                    className="mb-3 rounded-2xl overflow-hidden flex-row"
                    style={{ backgroundColor: theme.colors.surface }}
                  >
                    <View
                      className="w-1.5"
                      style={{ backgroundColor: transit.colorKey }}
                    />
                    <View className="flex-1 p-4">
                      <View className="flex-row items-center justify-between">
                        <Text
                          className="text-base font-semibold flex-1"
                          style={{ color: theme.colors.onSurface, writingDirection: rtl ? "rtl" : "ltr" }}
                        >
                          {transit.title}
                        </Text>
                        {transit.isActiveNow && (
                          <View
                            className="rounded-full px-2 py-0.5 ml-2"
                            style={{ backgroundColor: "#22c55e20" }}
                          >
                            <Text className="text-xs font-medium" style={{ color: "#22c55e" }}>
                              {t("transits.now")}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        className="mt-1 text-sm leading-5"
                        style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr" }}
                        numberOfLines={2}
                      >
                        {transit.shortSummary}
                      </Text>
                      <Text
                        className="mt-1 text-xs"
                        style={{ color: theme.colors.outline }}
                      >
                        {transit.startAt === transit.endAt
                          ? transit.startAt
                          : `${transit.startAt} — ${transit.endAt}`}
                      </Text>
                    </View>
                    <View className="items-center justify-center pr-3">
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={theme.colors.outline}
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View className="px-4 mt-4 items-center">
                <Ionicons name="planet-outline" size={40} color={theme.colors.outline} />
                <Text
                  className="mt-2 text-sm text-center"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("transits.noTransits")}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Detail bottom sheet */}
      <Modal
        transparent
        visible={Boolean(selectedTransit)}
        animationType="slide"
        onRequestClose={() => setSelectedTransit(null)}
      >
        <Pressable
          className="flex-1 bg-black/40"
          onPress={() => setSelectedTransit(null)}
        />
        <View
          className="rounded-t-3xl px-5 pt-4 pb-8"
          style={{ backgroundColor: theme.colors.surface }}
        >
          <View className="self-center w-10 h-1 rounded-full mb-4" style={{ backgroundColor: theme.colors.outline }} />

          {detailLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : detailData?.longInterpretation ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              <Text
                className="text-lg font-bold mb-1"
                style={{ color: theme.colors.onSurface, writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {selectedTransit?.title}
              </Text>
              <Text
                className="text-sm mb-3"
                style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {detailData.longInterpretation.subtitle}
              </Text>

              <Text
                className="text-sm font-semibold mt-2 mb-1"
                style={{ color: theme.colors.primary, writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {t("transits.whyHappening")}
              </Text>
              <Text
                className="text-sm leading-5 mb-3"
                style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {detailData.longInterpretation.whyThisIsHappening}
              </Text>

              <Text
                className="text-sm font-semibold mb-1"
                style={{ color: theme.colors.primary, writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {t("transits.whyMatters")}
              </Text>
              <Text
                className="text-sm leading-5 mb-3"
                style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {detailData.longInterpretation.whyItMattersForYou}
              </Text>

              <Text
                className="text-sm font-semibold mb-1"
                style={{ color: "#22c55e", writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {t("transits.leanInto")}
              </Text>
              {(detailData.longInterpretation.leanInto ?? []).map(
                (tip, idx) => (
                  <Text
                    key={idx}
                    className="text-sm leading-5 mb-1 ml-2"
                    style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr" }}
                  >
                    • {tip}
                  </Text>
                ),
              )}

              <Text
                className="text-sm font-semibold mt-3 mb-1"
                style={{ color: "#f59e0b", writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {t("transits.beMindful")}
              </Text>
              {(detailData.longInterpretation.beMindfulOf ?? []).map(
                (caution, idx) => (
                  <Text
                    key={idx}
                    className="text-sm leading-5 mb-1 ml-2"
                    style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr" }}
                  >
                    • {caution}
                  </Text>
                ),
              )}
            </ScrollView>
          ) : (
            <>
              <Text
                className="text-lg font-bold mb-2"
                style={{ color: theme.colors.onSurface, writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {selectedTransit?.title}
              </Text>
              <Text
                className="text-sm leading-5"
                style={{ color: theme.colors.onSurfaceVariant, writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {selectedTransit?.shortSummary}
              </Text>
            </>
          )}

          <Pressable
            onPress={() => setSelectedTransit(null)}
            className="mt-5 rounded-2xl py-3 items-center"
            style={{ backgroundColor: theme.colors.primary }}
          >
            <Text className="text-white font-semibold text-base">
              {t("common.done")}
            </Text>
          </Pressable>
        </View>
      </Modal>

      {paywallOpen ? (
        <PaywallScreen
          context="feature"
          onContinueFree={() => setPaywallOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}
