import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type FC, type ReactNode } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { CosmicBackground } from "@/components/CosmicBackground";
import { TransitsChromeHeader } from "@/components/MainInPageChrome";
import {
  AspectWindowBar,
  CyclePositionBar,
  LifecycleDurationBar,
} from "@/components/transits";
import {
  BG,
  BORDER,
  FONT,
  FONT_SIZE,
  HOUSE_THEME,
  LETTER_SPACING,
  LINE_HEIGHT,
  PLANET_PALETTE,
  RADIUS,
  SPACE,
  STATE,
  TEXT,
} from "@/constants";
import { typography } from "@/constants/theme";
import { useBottomNavInset } from "@/hooks/useBottomNavInset";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { useThemeColors } from "@/lib/themeColors";
import type {
  CollectiveTransit,
  LunationHint,
  RetrogradeBody,
  SkyEventBlock,
} from "@/types/transitBlocks";

const ZODIAC_FA: Record<string, string> = {
  Aries: "حمل",
  Taurus: "ثور",
  Gemini: "جوزا",
  Cancer: "سرطان",
  Leo: "اسد",
  Virgo: "سنبله",
  Libra: "میزان",
  Scorpio: "عقرب",
  Sagittarius: "قوس",
  Capricorn: "جدی",
  Aquarius: "دلو",
  Pisces: "حوت",
  Unknown: "—",
};

const PHASE_FA: Record<string, string> = {
  "new moon": "ماه نو",
  "waxing crescent": "هلال رو به رشد",
  "first quarter": "ربع اول",
  "waxing gibbous": "بدر رو به رشد",
  "full moon": "ماه کامل",
  "waning gibbous": "بدر رو به کاهش",
  "last quarter": "ربع آخر",
  "waning crescent": "هلال رو به کاهش",
};

function localizeSign(sign: string, lang: string): string {
  if (lang !== "fa") return sign;
  return ZODIAC_FA[sign] ?? sign;
}

function localizePhase(phase: string, lang: string): string {
  if (lang !== "fa") return phase;
  const normalized = phase.replace(/_/g, " ").toLowerCase();
  return PHASE_FA[normalized] ?? phase;
}

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
  transitNatalHouse?: number | null;
  aspectLifecycle?: string;
  engineVersion?: number;
};

type MoonAmbientPayload = {
  moonSign: string;
  moonDegree: number;
  moonNatalHouse: number | null;
  sunMoonSeparationDeg: number;
  phaseLabel: string;
};

type OverviewData = {
  timeframe: string;
  isGenerating?: boolean;
  dailyOutlook?: {
    title: string;
    text: string;
    moodLabel: string;
  };
  bigThree?: {
    sun: string;
    moon: string | null;
    rising: string | null;
  };
  precisionNote?: string | null;
  transits?: TransitCard[];
  status?: string;
  message?: string;
  dominantEventId?: string | null;
  moonAmbient?: MoonAmbientPayload | null;
  lifecycleVersion?: number;
};

/** Converts #RRGGBB design-token hex to rgba() for translucent borders/fills. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function normalizePlanet(body: string): keyof typeof PLANET_PALETTE {
  const keys = Object.keys(PLANET_PALETTE) as (keyof typeof PLANET_PALETTE)[];
  const found = keys.find((k) => k === body);
  return found ?? "Moon";
}

function accentBarColor(lifecycleNorm: string): string {
  switch (lifecycleNorm) {
    case "peak":
      return STATE.peak;
    case "applying":
      return STATE.building;
    case "approaching":
      return STATE.approaching;
    case "separating":
      return STATE.separating;
    case "fading":
      return STATE.fading;
    default:
      return STATE.peak;
  }
}

const SkeletonCard: FC = () => (
  <View
    style={{
      marginHorizontal: SPACE[4],
      marginBottom: SPACE[2],
      minHeight: 80,
      borderRadius: RADIUS.lg,
      backgroundColor: BG.surface2,
      opacity: 0.5,
    }}
  />
);

const SkeletonOutlook: FC = () => (
  <View
    style={{
      marginHorizontal: SPACE[4],
      marginTop: SPACE[4],
      gap: SPACE[2],
      borderRadius: RADIUS.lg,
      borderWidth: 0.5,
      borderColor: BORDER.subtle,
      padding: SPACE[4],
      backgroundColor: hexToRgba(BG.surface1, 0.8),
    }}
  >
    <View style={{ height: FONT_SIZE.bannerTitleSm, width: "50%", borderRadius: RADIUS.sm, backgroundColor: BG.surface2, opacity: 0.5 }} />
    <View style={{ height: SPACE[3], width: "100%", borderRadius: RADIUS.sm, backgroundColor: BG.surface2, opacity: 0.5 }} />
    <View style={{ height: SPACE[3], width: "83%", borderRadius: RADIUS.sm, backgroundColor: BG.surface2, opacity: 0.5 }} />
    <View style={{ height: SPACE[3], width: "66%", borderRadius: RADIUS.sm, backgroundColor: BG.surface2, opacity: 0.5 }} />
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

const LIFECYCLE_STATUS_EN: Record<string, { verb: string; dateField: "peakAt" | "endAt" }> = {
  approaching: { verb: "Approaching ·", dateField: "peakAt" },
  applying: { verb: "Building · peaks", dateField: "peakAt" },
  peak: { verb: "Peaking now · ends", dateField: "endAt" },
  separating: { verb: "Integrating · ends", dateField: "endAt" },
  fading: { verb: "Fading · ends", dateField: "endAt" },
};
const LIFECYCLE_STATUS_FA: Record<string, { verb: string; dateField: "peakAt" | "endAt" }> = {
  approaching: { verb: "در حال نزدیک‌شدن ·", dateField: "peakAt" },
  applying: { verb: "در حال شکل‌گیری · اوج", dateField: "peakAt" },
  peak: { verb: "در اوج · تا", dateField: "endAt" },
  separating: { verb: "در حال حل‌شدن · تا", dateField: "endAt" },
  fading: { verb: "در حال پایان · تا", dateField: "endAt" },
};

const TransitCardRow: FC<{
  transit: TransitCard;
  isDominant: boolean;
  dominantPlanetMid: string;
  appLang: "en" | "fa";
  formatDate: (iso: string) => string;
  onOpen: () => void;
  badgePeaking: string;
  badgeBuilding: string;
  badgeApproaching: string;
  badgeIntegrating: string;
  badgeFading: string;
  fontSans: string;
  fontSansMedium: string;
  fontSerif: string;
}> = ({
  transit,
  isDominant,
  dominantPlanetMid,
  appLang,
  formatDate,
  onOpen,
  badgePeaking,
  badgeBuilding,
  badgeApproaching,
  badgeIntegrating,
  badgeFading,
  fontSans,
  fontSansMedium,
  fontSerif,
}) => {
  const planetKey = normalizePlanet(transit.transitingBody);
  const planetMid = PLANET_PALETTE[planetKey].mid;

  const houseLabel =
    transit.transitNatalHouse != null
      ? HOUSE_THEME[transit.transitNatalHouse]?.[appLang === "fa" ? "fa" : "en"] ?? null
      : null;

  const rawLifecycle = transit.aspectLifecycle ?? "";
  const lifecycleNorm = rawLifecycle === "exact" ? "peak" : rawLifecycle;

  const barColor = accentBarColor(lifecycleNorm);

  let badgeFill: string;
  let badgeBorder: string;
  let badgeTextColor: string;
  if (lifecycleNorm === "peak" && isDominant) {
    badgeFill = hexToRgba(dominantPlanetMid, 0.1);
    badgeBorder = hexToRgba(dominantPlanetMid, 0.25);
    badgeTextColor = dominantPlanetMid;
  } else if (lifecycleNorm === "peak") {
    badgeFill = hexToRgba(planetMid, 0.1);
    badgeBorder = hexToRgba(planetMid, 0.25);
    badgeTextColor = planetMid;
  } else {
    const sc = accentBarColor(lifecycleNorm);
    badgeFill = hexToRgba(sc, 0.1);
    badgeBorder = hexToRgba(sc, 0.25);
    badgeTextColor = sc;
  }

  const cardBorderColor = isDominant ? hexToRgba(dominantPlanetMid, 0.35) : BORDER.subtle;
  const cardBorderWidth = isDominant ? 1 : 0.5;

  const titleSize = isDominant ? FONT_SIZE.cardHero : FONT_SIZE.cardCompact;
  const titleLineHeight = titleSize * LINE_HEIGHT.snug;

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        {
          marginHorizontal: SPACE[4],
          marginBottom: SPACE[2],
          minHeight: 80,
          borderRadius: RADIUS.lg,
          overflow: "hidden",
          borderWidth: cardBorderWidth,
          borderColor: cardBorderColor,
          backgroundColor: `${BG.surface1}cc`,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "stretch", minHeight: 80 }}>
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: barColor,
          }}
        />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            paddingLeft: 3 + SPACE[4],
            paddingRight: SPACE[2],
            paddingVertical: SPACE[3],
          }}
        >
          <View style={{ marginBottom: SPACE[1], flexDirection: "row", flexWrap: "wrap", gap: SPACE[1] }}>
            {lifecycleNorm ? (
              <View
                style={{
                  borderRadius: RADIUS.pill,
                  paddingHorizontal: SPACE[2],
                  paddingVertical: SPACE[1],
                  backgroundColor: badgeFill,
                  borderWidth: 0.5,
                  borderColor: badgeBorder,
                }}
              >
                <Text
                  style={{
                    fontFamily: fontSansMedium,
                    fontSize: FONT_SIZE.metadata,
                    letterSpacing: LETTER_SPACING.badge * FONT_SIZE.metadata,
                    color: badgeTextColor,
                  }}
                >
                  {lifecycleNorm === "peak"
                    ? badgePeaking
                    : lifecycleNorm === "applying"
                      ? badgeBuilding
                      : lifecycleNorm === "approaching"
                        ? badgeApproaching
                        : lifecycleNorm === "separating"
                          ? badgeIntegrating
                          : lifecycleNorm === "fading"
                            ? badgeFading
                            : lifecycleNorm}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fontSerif,
              fontSize: titleSize,
              fontWeight: "400",
              color: TEXT.primary,
              lineHeight: titleLineHeight,
              marginBottom: SPACE[1],
            }}
          >
            {transit.title}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: fontSans,
              fontSize: FONT_SIZE.body,
              fontWeight: "400",
              color: TEXT.secondary,
              lineHeight: FONT_SIZE.body * LINE_HEIGHT.body,
            }}
          >
            {transit.shortSummary}
          </Text>
          {(() => {
            const statusMap = appLang === "fa" ? LIFECYCLE_STATUS_FA : LIFECYCLE_STATUS_EN;
            const statusEntry = statusMap[lifecycleNorm];
            const dateField = statusEntry?.dateField ?? "endAt";
            const dateVal = dateField === "peakAt" ? transit.peakAt : transit.endAt;
            const dateStr = dateVal ? formatDate(dateVal) : "";
            const statusLabel = statusEntry ? `${statusEntry.verb} ${dateStr}`.trim() : lifecycleNorm;
            const parts = [statusLabel, houseLabel].filter(Boolean);
            return parts.length > 0 ? (
              <Text
                numberOfLines={1}
                style={{
                  marginTop: SPACE[1],
                  fontFamily: fontSans,
                  fontSize: FONT_SIZE.metadata,
                  fontWeight: "400",
                  color: TEXT.secondary,
                }}
              >
                {parts.join(" · ")}
              </Text>
            ) : null;
          })()}
        </View>
        <View style={{ width: SPACE[8], alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-forward" size={22} color={TEXT.muted} />
        </View>
      </View>
    </Pressable>
  );
};

const transitBlockContainers = StyleSheet.create({
  block1Styles: {
    borderRadius: RADIUS.xl,
    borderWidth: 0.5,
    borderColor: hexToRgba(STATE.lunation, 0.2),
    backgroundColor: BG.card,
    padding: SPACE[4],
    marginHorizontal: SPACE[4],
    marginBottom: SPACE[4],
    marginTop: SPACE[4],
  },
  block2Styles: {
    borderRadius: RADIUS.xl,
    borderWidth: 0.5,
    borderColor: BORDER.default,
    backgroundColor: BG.card,
    padding: SPACE[4],
    marginHorizontal: SPACE[4],
    marginBottom: SPACE[4],
  },
  block3Styles: {
    borderRadius: RADIUS.xl,
    borderWidth: 0.5,
    borderColor: BORDER.default,
    backgroundColor: BG.card,
    padding: SPACE[4],
    marginHorizontal: SPACE[4],
    marginBottom: SPACE[4],
  },
});

const PersonalTransitsScreen: FC = () => {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const bottomInset = useBottomNavInset();
  const { getToken } = useAuth();

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
  const [lunations, setLunations] = useState<LunationHint[]>([]);
  const [retrogrades, setRetrogrades] = useState<RetrogradeBody[]>([]);
  const [collective, setCollective] = useState<CollectiveTransit[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  void blocksLoading;

  const tc = useThemeColors();
  void tc;

  const byTfRef = useRef(byTf);
  byTfRef.current = byTf;

  const loadedLanguageRef = useRef<string | null>(null);

  const currentData = byTf[timeframe];
  const list = currentData?.transits ?? [];
  const dominantTransit = list.find((tr) => tr.id === currentData?.dominantEventId);
  const dominantPlanetMid = PLANET_PALETTE[normalizePlanet(dominantTransit?.transitingBody ?? "Moon")].mid;

  // Block 1 — pick the most time-relevant sky event
  const skyEventBlock: SkyEventBlock = (() => {
    // Priority 1: any planet currently retrograde
    const retroNow = retrogrades.find(
      (r) => r.isRetrograde && ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"].includes(r.body),
    );
    if (retroNow) return { kind: "retrograde" as const, data: retroNow };

    // Priority 2: upcoming or recent lunation within ±3 days
    const now = Date.now();
    const THREE_DAYS = 7 * 24 * 60 * 60 * 1000;
    const nearLunation = lunations.find((l) => {
      const diff = Math.abs(new Date(l.approximateAt).getTime() - now);
      return diff <= THREE_DAYS;
    });
    if (nearLunation) {
      const LUNAR_CYCLE_MS = 29.53 * 24 * 60 * 60 * 1000;
      const lunationTime = new Date(nearLunation.approximateAt).getTime();

      let cycleProgress: number;

      if (nearLunation.kind === "new_moon") {
        const msFromNewMoon = now - lunationTime;
        if (msFromNewMoon < 0) {
          cycleProgress = 1 + msFromNewMoon / LUNAR_CYCLE_MS;
        } else {
          cycleProgress = msFromNewMoon / LUNAR_CYCLE_MS;
        }
      } else {
        const msFromFullMoon = now - lunationTime;
        cycleProgress = 0.5 + msFromFullMoon / LUNAR_CYCLE_MS;
      }

      cycleProgress = Math.min(Math.max(cycleProgress, 0.02), 0.98);

      return {
        kind: "lunation" as const,
        data: nearLunation,
        cycleProgressFraction: cycleProgress,
      };
    }

    return null;
  })();

  // Block 3 — top collective transit (first = most relevant)
  const topCollective: CollectiveTransit | null = collective[0] ?? null;

  const loadTransits = useCallback(
    async (tf: Timeframe, force = false) => {
      const appLang = i18n.language.startsWith("fa") ? "fa" : "en";
      if (!force && byTfRef.current[tf] && loadedLanguageRef.current === appLang) {
        setTfLoading((p) => ({ ...p, [tf]: false }));
        return;
      }

      setTfLoading((p) => ({ ...p, [tf]: true }));
      setError(null);
      try {
        const res = await apiRequest(`/api/transits/overview?timeframe=${tf}&lang=${appLang}`, {
          method: "GET",
          getToken,
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Error ${res.status}`);
        }

        const json = (await res.json()) as OverviewData;
        setByTf((prev) => ({ ...prev, [tf]: json }));
        loadedLanguageRef.current = appLang;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[personal-transits] load error:", msg);
        setError(msg);
      } finally {
        setTfLoading((p) => ({ ...p, [tf]: false }));
      }
    },
    [getToken, i18n.language],
  );

  const loadSkyBlocks = useCallback(async () => {
    setBlocksLoading(true);
    try {
      const [lunRes, retRes, colRes] = await Promise.all([
        apiRequest("/api/transits/lunations", { getToken, method: "GET" }),
        apiRequest("/api/transits/retrogrades", { getToken, method: "GET" }),
        apiRequest("/api/transits/collective", { getToken, method: "GET" }),
      ]);
      if (lunRes.ok) {
        const j = (await lunRes.json()) as { lunations: LunationHint[] };
        setLunations(j.lunations ?? []);
      }
      if (retRes.ok) {
        const j = (await retRes.json()) as { retrogrades: RetrogradeBody[] };
        setRetrogrades(j.retrogrades ?? []);
      }
      if (colRes.ok) {
        const j = (await colRes.json()) as { collective: CollectiveTransit[] };
        setCollective(j.collective ?? []);
      }
    } catch (e) {
      console.warn("[transits/blocks] loadSkyBlocks error:", e);
    } finally {
      setBlocksLoading(false);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      const appLang = i18n.language.startsWith("fa") ? "fa" : "en";
      const hadMismatch =
        loadedLanguageRef.current !== null && loadedLanguageRef.current !== appLang;
      if (hadMismatch) {
        setByTf({ today: null, week: null, month: null });
        setError(null);
      }
      void loadTransits(timeframe, hadMismatch);
      void loadSkyBlocks();
    }, [timeframe, loadTransits, loadSkyBlocks, i18n.language]),
  );

  useEffect(() => {
    if (!currentData?.isGenerating) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      if (n > 12) {
        clearInterval(id);
        setByTf((prev) => {
          const existing = prev[timeframe];
          if (!existing) return prev;
          return { ...prev, [timeframe]: { ...existing, isGenerating: false } };
        });
        return;
      }
      void loadTransits(timeframe, true);
    }, 2500);
    return () => clearInterval(id);
  }, [currentData?.isGenerating, timeframe, loadTransits]);

  const appLang = i18n.language.startsWith("fa") ? "fa" : "en";

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const locale = i18n.language === "fa" ? "fa-IR" : "en-US";
    return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
  };

  const fontSans = appLang === "fa" ? typography.family.regular : FONT.sans;
  const fontSansMedium = appLang === "fa" ? typography.family.medium : FONT.sansMedium;
  const fontSerif = appLang === "fa" ? typography.family.regular : FONT.serif;
  const fontSerifItalic = appLang === "fa" ? typography.family.regular : FONT.serifItalic;

  const blockStyles = useMemo(
    () => ({
      sectionLabelStyle: {
        fontFamily: fontSansMedium,
        fontSize: FONT_SIZE.sectionCaps,
        letterSpacing: 1.2,
        color: TEXT.secondary,
        textTransform: "uppercase" as const,
        marginBottom: SPACE[2],
        textAlign: (appLang === "fa" ? "right" : "left") as "right" | "left",
      },
      block1TitleStyle: {
        fontFamily: fontSerifItalic,
        fontSize: FONT_SIZE.cardHero,
        color: STATE.lunation,
        marginBottom: SPACE[1],
        textAlign: (appLang === "fa" ? "right" : "left") as "right" | "left",
      },
      block1SubtitleStyle: {
        fontFamily: fontSans,
        fontSize: FONT_SIZE.body,
        color: TEXT.primary,
        textAlign: (appLang === "fa" ? "right" : "left") as "right" | "left",
      },
      block2TitleStyle: {
        fontFamily: fontSerifItalic,
        fontSize: FONT_SIZE.cardHero,
        color: TEXT.primary,
        marginBottom: SPACE[1],
        textAlign: (appLang === "fa" ? "right" : "left") as "right" | "left",
      },
      block2SummaryStyle: {
        fontFamily: fontSans,
        fontSize: FONT_SIZE.body,
        color: TEXT.primary,
        lineHeight: FONT_SIZE.body * 1.5,
        textAlign: (appLang === "fa" ? "right" : "left") as "right" | "left",
      },
      block3TitleStyle: {
        fontFamily: fontSansMedium,
        fontSize: FONT_SIZE.cardCompact,
        color: TEXT.primary,
        marginBottom: SPACE[1],
        textAlign: (appLang === "fa" ? "right" : "left") as "right" | "left",
      },
      block3StatusStyle: {
        fontFamily: fontSans,
        fontSize: FONT_SIZE.metadata,
        color: TEXT.secondary,
        textAlign: (appLang === "fa" ? "right" : "left") as "right" | "left",
      },
    }),
    [appLang, fontSans, fontSansMedium, fontSerif, fontSerifItalic],
  );

  const handleTimeframeChange = (tf: Timeframe) => {
    const appLang = i18n.language.startsWith("fa") ? "fa" : "en";
    setTimeframe(tf);
    if (byTfRef.current[tf] && loadedLanguageRef.current === appLang) {
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

  function formatPlanetName(body: string, lang: string): string {
    const FA: Record<string, string> = {
      Mercury: "عطارد",
      Venus: "زهره",
      Mars: "مریخ",
      Jupiter: "مشتری",
      Saturn: "زحل",
      Uranus: "اورانوس",
      Neptune: "نپتون",
      Moon: "ماه",
      Sun: "خورشید",
    };
    return lang === "fa" ? (FA[body] ?? body) : body;
  }

  const transitLifecycle = (tr: TransitCard): string => {
    const raw = tr.aspectLifecycle ?? "";
    return raw === "exact" ? "peak" : raw;
  };

  const displayList =
    timeframe === "month" ? list : list.filter((tr) => transitLifecycle(tr) !== "approaching");

  const peakingNow = displayList.filter((tr) => transitLifecycle(tr) === "peak");
  const building = displayList.filter((tr) => transitLifecycle(tr) === "applying");
  const integratingGroup = displayList.filter((tr) =>
    ["separating", "fading"].includes(transitLifecycle(tr)),
  );
  const approachingGroup =
    timeframe === "month" ? list.filter((tr) => transitLifecycle(tr) === "approaching") : [];

  const totalCardCount =
    peakingNow.length + building.length + integratingGroup.length + approachingGroup.length;

  const showTabSkeleton = !currentData && tabLoading;
  const showInlineError = Boolean(error && !currentData && !tabLoading && !noDataAnywhere);

  const sheetMaxHeight = Dimensions.get("window").height * 0.85;

  const auroraShell = (children: ReactNode) => (
    <View className="flex-1" style={{ backgroundColor: "transparent" }}>
      <CosmicBackground subtleDrift />
      <View style={{ flex: 1, zIndex: 10 }}>{children}</View>
    </View>
  );

  if (tabLoading && !currentData && !error && noDataAnywhere) {
    return auroraShell(
      <>
        <TransitsChromeHeader title={t("transits.screenTitle")} />
        <ScrollView
          style={{ flex: 1, backgroundColor: "transparent" }}
          contentContainerStyle={{ paddingBottom: bottomInset }}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonOutlook />
          <View style={{ marginHorizontal: SPACE[4], marginTop: SPACE[3], flexDirection: "row", flexWrap: "wrap", gap: SPACE[2] }}>
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  height: 28,
                  width: 96,
                  borderRadius: RADIUS.pill,
                  backgroundColor: BG.surface2,
                  opacity: 0.5,
                }}
              />
            ))}
          </View>
          <View style={{ marginHorizontal: SPACE[4], marginTop: SPACE[4], flexDirection: "row", gap: SPACE[2] }}>
            {(["today", "week", "month"] as const).map((tf) => (
              <Pressable
                key={tf}
                onPress={() => handleTimeframeChange(tf)}
                style={{
                  minHeight: 48,
                  justifyContent: "center",
                  borderRadius: RADIUS.pill,
                  paddingHorizontal: SPACE[4],
                  paddingVertical: SPACE[2],
                  borderWidth: 0.5,
                  borderColor: timeframe === tf ? BORDER.strong : BORDER.subtle,
                  backgroundColor: timeframe === tf ? BG.surface3 : BG.surface2,
                }}
              >
                <Text
                  style={{
                    fontFamily: fontSansMedium,
                    fontSize: FONT_SIZE.uiLabel,
                    color: timeframe === tf ? TEXT.primary : TEXT.tertiary,
                  }}
                >
                  {tf === "today" ? t("transits.today") : tf === "week" ? t("transits.thisWeek") : t("transits.thisMonth")}
                </Text>
              </Pressable>
            ))}
          </View>
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </ScrollView>
      </>,
    );
  }

  if (error && !currentData && !tabLoading && noDataAnywhere) {
    return auroraShell(
      <>
        <TransitsChromeHeader title={t("transits.screenTitle")} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACE[8] }}>
          <Ionicons name="warning-outline" size={48} color={TEXT.secondary} />
          <Text
            style={{
              marginTop: SPACE[4],
              textAlign: "center",
              fontFamily: fontSans,
              fontSize: FONT_SIZE.body,
              color: TEXT.secondary,
            }}
          >
            {t("transits.errorTitle")}
          </Text>
          <Pressable
            onPress={() => {
              setByTf({ today: null, week: null, month: null });
              setError(null);
              void loadTransits(timeframe, true);
            }}
            style={{
              marginTop: SPACE[6],
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: RADIUS.md,
              paddingHorizontal: SPACE[6],
              paddingVertical: SPACE[2],
              backgroundColor: BG.surface3,
              borderWidth: 0.5,
              borderColor: BORDER.strong,
            }}
          >
            <Text style={{ fontFamily: fontSansMedium, fontSize: FONT_SIZE.uiLabel, color: TEXT.primary }}>
              {t("transits.retry")}
            </Text>
          </Pressable>
        </View>
      </>,
    );
  }

  if (currentData?.status === "incomplete_profile") {
    return auroraShell(
      <>
        <TransitsChromeHeader title={t("transits.screenTitle")} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACE[8] }}>
          <Ionicons name="planet-outline" size={56} color={TEXT.secondary} />
          <Text
            style={{
              marginTop: SPACE[4],
              textAlign: "center",
              fontFamily: fontSerif,
              fontSize: FONT_SIZE.bannerTitleSm,
              fontWeight: "400",
              color: TEXT.primary,
            }}
          >
            {t("transits.incompleteTitle")}
          </Text>
          <Text
            style={{
              marginTop: SPACE[2],
              textAlign: "center",
              fontFamily: fontSans,
              fontSize: FONT_SIZE.body,
              color: TEXT.secondary,
            }}
          >
            {t("transits.incompleteMessage")}
          </Text>
          <Pressable
            onPress={() => router.push("/(main)/edit-profile")}
            style={{
              marginTop: SPACE[6],
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: RADIUS.md,
              paddingHorizontal: SPACE[6],
              paddingVertical: SPACE[2],
              backgroundColor: BG.surface3,
              borderWidth: 0.5,
              borderColor: BORDER.strong,
            }}
          >
            <Text style={{ fontFamily: fontSansMedium, fontSize: FONT_SIZE.uiLabel, color: TEXT.primary }}>
              {t("transits.completeBirthDetails")}
            </Text>
          </Pressable>
        </View>
      </>,
    );
  }

  const SectionHeader = ({ labelKey, first }: { labelKey: string; first?: boolean }) => (
    <Text
      style={{
        marginHorizontal: SPACE[4],
        marginBottom: SPACE[2],
        marginTop: first ? SPACE[4] : SPACE[6],
        fontFamily: fontSansMedium,
        fontSize: FONT_SIZE.sectionCaps,
        fontWeight: "500",
        letterSpacing: LETTER_SPACING.sectionCaps * FONT_SIZE.sectionCaps,
        textTransform: "uppercase",
        color: TEXT.secondary,
        textAlign: appLang === "fa" ? "right" : "left",
      }}
    >
      {labelKey}
    </Text>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: "transparent" }}>
      <CosmicBackground subtleDrift />

      <View style={{ flex: 1, zIndex: 10 }}>
        <TransitsChromeHeader title={t("transits.screenTitle")} />

        <ScrollView
          style={{ flex: 1, backgroundColor: "transparent" }}
          contentContainerStyle={{ paddingBottom: bottomInset }}
          showsVerticalScrollIndicator={false}
        >
          {showInlineError ? (
            <View
              style={{
                marginHorizontal: SPACE[4],
                marginTop: SPACE[4],
                borderRadius: RADIUS.lg,
                borderWidth: 0.5,
                borderColor: hexToRgba(STATE.peak, 0.25),
                backgroundColor: hexToRgba(STATE.peak, 0.06),
                padding: SPACE[4],
              }}
            >
              <Text style={{ textAlign: "center", fontFamily: fontSans, fontSize: FONT_SIZE.body, color: TEXT.secondary }}>
                {t("transits.errorTitle")}
              </Text>
              <Pressable
                onPress={() => {
                  setError(null);
                  void loadTransits(timeframe, true);
                }}
                style={{
                  marginTop: SPACE[3],
                  minHeight: 48,
                  alignSelf: "center",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: RADIUS.md,
                  paddingHorizontal: SPACE[6],
                  paddingVertical: SPACE[2],
                  backgroundColor: BG.surface3,
                  borderWidth: 0.5,
                  borderColor: BORDER.strong,
                }}
              >
                <Text style={{ fontFamily: fontSansMedium, fontSize: FONT_SIZE.uiLabel, color: TEXT.primary }}>
                  {t("transits.retry")}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── BLOCK 1 — Current Sky Event ── */}
          {skyEventBlock ? (
            <View style={transitBlockContainers.block1Styles}>
              <Text style={blockStyles.sectionLabelStyle}>{t("transits.skyEvent.sectionTitle")}</Text>

              {skyEventBlock.kind === "lunation" ? (
                <>
                  <Text style={blockStyles.block1TitleStyle}>
                    {skyEventBlock.data.kind === "full_moon"
                      ? t("transits.skyEvent.fullMoon")
                      : t("transits.skyEvent.newMoon")}
                  </Text>
                  <Text style={blockStyles.block1SubtitleStyle}>
                    {new Date(skyEventBlock.data.approximateAt).toLocaleDateString(appLang === "fa" ? "fa-IR" : "en-US", {
                      month: "long",
                      day: "numeric",
                    })}
                  </Text>
                  <View style={{ marginTop: SPACE[3] }}>
                    <CyclePositionBar
                      progress={skyEventBlock.cycleProgressFraction}
                      startLabel={t("transits.skyEvent.newMoonCycle")}
                      endLabel={t("transits.skyEvent.fullMoonCycle")}
                      todayLabel={t("transits.now")}
                      pulse
                    />
                  </View>
                </>
              ) : null}

              {skyEventBlock.kind === "retrograde" ? (
                <>
                  <Text style={blockStyles.block1TitleStyle}>
                    {formatPlanetName(skyEventBlock.data.body, appLang)} {t("transits.skyEvent.retrograde")}
                  </Text>
                  <Text style={blockStyles.block1SubtitleStyle}>
                    {skyEventBlock.data.speedDegPerDay.toFixed(3)}°
                    {appLang === "fa" ? " در روز" : " / day"}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}

          {/* ── BLOCK 2 — Personal Dominant Transit ── */}
          {dominantTransit ? (
            <View style={[transitBlockContainers.block2Styles, !skyEventBlock ? { marginTop: SPACE[4] } : null]}>
              <Text style={blockStyles.sectionLabelStyle}>{t("transits.skyEvent.personalTitle")}</Text>
              <Text style={blockStyles.block2TitleStyle}>{dominantTransit.title}</Text>
              {dominantTransit.shortSummary ? (
                <Text style={blockStyles.block2SummaryStyle} numberOfLines={2}>
                  {dominantTransit.shortSummary}
                </Text>
              ) : null}
              <View style={{ marginTop: SPACE[3] }}>
                <LifecycleDurationBar
                  startAt={dominantTransit.startAt}
                  peakAt={dominantTransit.peakAt}
                  endAt={dominantTransit.endAt}
                  accentColor={
                    PLANET_PALETTE[normalizePlanet(dominantTransit.transitingBody)]?.mid ?? STATE.building
                  }
                  lifecycle={
                    ((): "approaching" | "applying" | "peak" | "separating" | "fading" | undefined => {
                      const n = transitLifecycle(dominantTransit);
                      return n === "approaching" ||
                        n === "applying" ||
                        n === "peak" ||
                        n === "separating" ||
                        n === "fading"
                        ? n
                        : undefined;
                    })()
                  }
                  lang={appLang}
                />
              </View>
            </View>
          ) : null}

          {/* ── Timeframe tabs ── */}
          <View style={{ marginHorizontal: SPACE[4], marginTop: SPACE[4], flexDirection: "row", gap: SPACE[2] }}>
            {(["today", "week", "month"] as const).map((tf) => (
              <Pressable
                key={tf}
                onPress={() => handleTimeframeChange(tf)}
                style={{
                  minHeight: 48,
                  justifyContent: "center",
                  borderRadius: RADIUS.pill,
                  paddingHorizontal: SPACE[4],
                  paddingVertical: SPACE[2],
                  borderWidth: 0.5,
                  borderColor: timeframe === tf ? BORDER.strong : BORDER.subtle,
                  backgroundColor: timeframe === tf ? BG.surface3 : BG.surface2,
                }}
              >
                <Text
                  style={{
                    fontFamily: fontSansMedium,
                    fontSize: FONT_SIZE.uiLabel,
                    color: timeframe === tf ? TEXT.primary : TEXT.tertiary,
                  }}
                >
                  {tf === "today" ? t("transits.today") : tf === "week" ? t("transits.thisWeek") : t("transits.thisMonth")}
                </Text>
              </Pressable>
            ))}
          </View>

          {showTabSkeleton ? (
            <SkeletonOutlook />
          ) : currentData?.isGenerating ? (
            <View style={{ marginHorizontal: SPACE[4], marginTop: SPACE[4] }}>
              <SkeletonOutlook />
              <Text
                style={{
                  marginTop: SPACE[2],
                  textAlign: "center",
                  fontFamily: fontSans,
                  fontSize: FONT_SIZE.metadata,
                  fontStyle: "italic",
                  color: TEXT.muted,
                }}
              >
                {t("transits.polishingOutlook")}
              </Text>
            </View>
          ) : currentData?.dailyOutlook ? (
            <View
              style={{
                marginHorizontal: SPACE[4],
                marginBottom: SPACE[4],
                marginTop: SPACE[4],
                borderRadius: RADIUS.xl,
                borderWidth: 0.5,
                borderColor: BORDER.subtle,
                padding: SPACE[5],
                backgroundColor: `${BG.surface1}cc`,
              }}
            >
              <View style={{ flexDirection: "column", marginBottom: SPACE[2] }}>
                <View
                  style={{
                    alignSelf: appLang === "fa" ? "flex-start" : "flex-end",
                    borderRadius: RADIUS.pill,
                    paddingHorizontal: SPACE[3],
                    paddingVertical: SPACE[1],
                    backgroundColor: hexToRgba(dominantPlanetMid, 0.12),
                    borderWidth: 0.5,
                    borderColor: hexToRgba(dominantPlanetMid, 0.25),
                    marginBottom: SPACE[2],
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fontSansMedium,
                      fontSize: FONT_SIZE.metadata,
                      color: dominantPlanetMid,
                    }}
                    numberOfLines={1}
                  >
                    {currentData.dailyOutlook.moodLabel}
                  </Text>
                </View>

                <Text
                  style={{
                    fontFamily: fontSerif,
                    fontSize: FONT_SIZE.bannerTitle,
                    fontWeight: "400",
                    color: TEXT.primary,
                    lineHeight: FONT_SIZE.bannerTitle * LINE_HEIGHT.tight,
                    textAlign: appLang === "fa" ? "right" : "left",
                    writingDirection: appLang === "fa" ? "rtl" : "ltr",
                  }}
                >
                  {currentData.dailyOutlook.title}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fontSans,
                  fontSize: FONT_SIZE.body,
                  fontWeight: "400",
                  color: TEXT.primary,
                  lineHeight: FONT_SIZE.body * LINE_HEIGHT.body,
                }}
              >
                {currentData.dailyOutlook.text}
              </Text>
            </View>
          ) : null}

          {showTabSkeleton ? (
            <View style={{ marginHorizontal: SPACE[4], marginTop: SPACE[3], flexDirection: "row", flexWrap: "wrap", gap: SPACE[2] }}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    height: 28,
                    width: 96,
                    borderRadius: RADIUS.pill,
                    backgroundColor: BG.surface2,
                    opacity: 0.5,
                  }}
                />
              ))}
            </View>
          ) : currentData?.bigThree ? (
            <View style={{ marginHorizontal: SPACE[4], marginTop: SPACE[3], flexDirection: "row", flexWrap: "wrap", gap: SPACE[2] }}>
              {[
                {
                  label: "☉",
                  value: localizeSign(currentData.bigThree.sun ?? "", appLang),
                },
                {
                  label: "☽",
                  value: currentData.bigThree.moon
                    ? localizeSign(currentData.bigThree.moon, appLang)
                    : "—",
                },
                ...(currentData.bigThree.rising
                  ? [{ label: "↑", value: localizeSign(currentData.bigThree.rising, appLang) }]
                  : []),
              ].map((item, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: RADIUS.pill,
                    borderWidth: 0.5,
                    borderColor: BORDER.subtle,
                    paddingHorizontal: SPACE[2],
                    paddingVertical: SPACE[1],
                    backgroundColor: hexToRgba(BG.surface2, 0.8),
                  }}
                >
                  <Text style={{ marginRight: SPACE[1], fontFamily: fontSans, fontSize: FONT_SIZE.metadata, color: TEXT.secondary }}>
                    {item.label}
                  </Text>
                  <Text style={{ fontFamily: fontSans, fontSize: FONT_SIZE.metadata, color: TEXT.secondary }}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {!showTabSkeleton && currentData?.precisionNote ? (
            <Text
              style={{
                marginHorizontal: SPACE[4],
                marginTop: SPACE[2],
                fontFamily: fontSans,
                fontSize: FONT_SIZE.metadata,
                fontStyle: "italic",
                color: TEXT.muted,
              }}
            >
              {currentData.precisionNote}
            </Text>
          ) : null}

          {!showTabSkeleton && currentData?.moonAmbient ? (
            <View
              style={{
                marginHorizontal: SPACE[4],
                marginTop: SPACE[3],
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                gap: SPACE[2],
                borderRadius: RADIUS.lg,
                borderWidth: 0.5,
                borderColor: BORDER.subtle,
                paddingHorizontal: SPACE[3],
                paddingVertical: SPACE[2],
                backgroundColor: `${BG.surface1}cc`,
              }}
            >
              <Text
                style={{
                  fontFamily: fontSansMedium,
                  fontSize: FONT_SIZE.metadata,
                  textTransform: "uppercase",
                  letterSpacing: LETTER_SPACING.sectionCaps * FONT_SIZE.metadata,
                  color: TEXT.secondary,
                }}
              >
                {t("transits.moonBackdrop")}
              </Text>
              <View style={{ borderRadius: RADIUS.pill, borderWidth: 0.5, borderColor: BORDER.subtle, paddingHorizontal: SPACE[2], paddingVertical: SPACE[1] }}>
                <Text style={{ fontFamily: fontSansMedium, fontSize: FONT_SIZE.metadata, color: TEXT.primary }}>
                  {localizeSign(currentData.moonAmbient.moonSign ?? "", appLang)}
                </Text>
              </View>
              <Text style={{ fontFamily: fontSans, fontSize: FONT_SIZE.metadata, color: TEXT.secondary }}>
                {localizePhase(currentData.moonAmbient.phaseLabel ?? "", appLang)}
              </Text>
              {currentData.moonAmbient.moonNatalHouse != null ? (
                <Text style={{ fontFamily: fontSans, fontSize: FONT_SIZE.metadata, color: TEXT.secondary }}>
                  {t("transits.moonInHouse", { n: currentData.moonAmbient.moonNatalHouse })}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* ── BLOCK 3 — Collective Sky Transit ── */}
          {topCollective ? (
            <View style={[transitBlockContainers.block3Styles, { marginTop: SPACE[4] }]}>
              <Text style={blockStyles.sectionLabelStyle}>{t("transits.skyEvent.collectiveTitle")}</Text>
              <Text style={blockStyles.block3TitleStyle}>
                {appLang === "fa" ? topCollective.titleFa : topCollective.titleEn}
              </Text>
              <Text style={blockStyles.block3StatusStyle}>
                {topCollective.isActiveNow ? t("transits.collective.active") : t("transits.collective.approaching")}
                {" · "}
                {topCollective.orbDegrees.toFixed(1)}° {appLang === "fa" ? "اُرب" : "orb"}
              </Text>
              <View style={{ marginTop: SPACE[3] }}>
                <AspectWindowBar
                  startAt={topCollective.startAt}
                  exactAt={topCollective.exactAt}
                  endAt={topCollective.endAt}
                  isApproaching={topCollective.isApproaching}
                  lang={appLang}
                />
              </View>
            </View>
          ) : null}

          {showTabSkeleton ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </>
          ) : totalCardCount === 0 ? (
            <View style={{ marginHorizontal: SPACE[4], alignItems: "center", paddingVertical: SPACE[8] }}>
              <Ionicons name="planet-outline" size={40} color={TEXT.secondary} />
              <Text
                style={{
                  marginTop: SPACE[3],
                  textAlign: "center",
                  fontFamily: fontSans,
                  fontSize: FONT_SIZE.body,
                  color: TEXT.tertiary,
                }}
              >
                {t("transits.noTransits")}
              </Text>
            </View>
          ) : (
            <>
              {peakingNow.length > 0 ? (
                <>
                  <SectionHeader labelKey={t("transits.peakingNow")} first />
                  {peakingNow.map((transit) => (
                    <TransitCardRow
                      key={transit.id}
                      transit={transit}
                      isDominant={Boolean(currentData?.dominantEventId && currentData.dominantEventId === transit.id)}
                      dominantPlanetMid={dominantPlanetMid}
                      appLang={appLang}
                      formatDate={formatDate}
                      onOpen={() => void handleTransitTap(transit)}
                      badgePeaking={t("transits.peakingNow")}
                      badgeBuilding={t("transits.building")}
                      badgeApproaching={t("transits.approaching")}
                      badgeIntegrating={t("transits.integrating")}
                      badgeFading={t("transits.fading")}
                      fontSans={fontSans}
                      fontSansMedium={fontSansMedium}
                      fontSerif={fontSerif}
                    />
                  ))}
                </>
              ) : null}
              {building.length > 0 ? (
                <>
                  <SectionHeader labelKey={t("transits.building")} first={peakingNow.length === 0} />
                  {building.map((transit) => (
                    <TransitCardRow
                      key={transit.id}
                      transit={transit}
                      isDominant={Boolean(currentData?.dominantEventId && currentData.dominantEventId === transit.id)}
                      dominantPlanetMid={dominantPlanetMid}
                      appLang={appLang}
                      formatDate={formatDate}
                      onOpen={() => void handleTransitTap(transit)}
                      badgePeaking={t("transits.peakingNow")}
                      badgeBuilding={t("transits.building")}
                      badgeApproaching={t("transits.approaching")}
                      badgeIntegrating={t("transits.integrating")}
                      badgeFading={t("transits.fading")}
                      fontSans={fontSans}
                      fontSansMedium={fontSansMedium}
                      fontSerif={fontSerif}
                    />
                  ))}
                </>
              ) : null}
              {integratingGroup.length > 0 ? (
                <>
                  <SectionHeader
                    labelKey={t("transits.integrating")}
                    first={peakingNow.length === 0 && building.length === 0}
                  />
                  {integratingGroup.map((transit) => (
                    <TransitCardRow
                      key={transit.id}
                      transit={transit}
                      isDominant={Boolean(currentData?.dominantEventId && currentData.dominantEventId === transit.id)}
                      dominantPlanetMid={dominantPlanetMid}
                      appLang={appLang}
                      formatDate={formatDate}
                      onOpen={() => void handleTransitTap(transit)}
                      badgePeaking={t("transits.peakingNow")}
                      badgeBuilding={t("transits.building")}
                      badgeApproaching={t("transits.approaching")}
                      badgeIntegrating={t("transits.integrating")}
                      badgeFading={t("transits.fading")}
                      fontSans={fontSans}
                      fontSansMedium={fontSansMedium}
                      fontSerif={fontSerif}
                    />
                  ))}
                </>
              ) : null}
              {approachingGroup.length > 0 ? (
                <>
                  <SectionHeader
                    labelKey={t("transits.comingThisMonth")}
                    first={peakingNow.length === 0 && building.length === 0 && integratingGroup.length === 0}
                  />
                  {approachingGroup.map((transit) => (
                    <TransitCardRow
                      key={transit.id}
                      transit={transit}
                      isDominant={Boolean(currentData?.dominantEventId && currentData.dominantEventId === transit.id)}
                      dominantPlanetMid={dominantPlanetMid}
                      appLang={appLang}
                      formatDate={formatDate}
                      onOpen={() => void handleTransitTap(transit)}
                      badgePeaking={t("transits.peakingNow")}
                      badgeBuilding={t("transits.building")}
                      badgeApproaching={t("transits.approaching")}
                      badgeIntegrating={t("transits.integrating")}
                      badgeFading={t("transits.fading")}
                      fontSans={fontSans}
                      fontSansMedium={fontSansMedium}
                      fontSerif={fontSerif}
                    />
                  ))}
                </>
              ) : null}
            </>
          )}
        </ScrollView>

        <Modal visible={showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(false)}>
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: hexToRgba(BG.base, 0.75) }}>
            <View style={{ maxHeight: sheetMaxHeight }}>
              <View
                style={{
                  borderTopLeftRadius: RADIUS.xxl,
                  borderTopRightRadius: RADIUS.xxl,
                  backgroundColor: BG.surface2,
                }}
              >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderBottomWidth: 0.5,
                      borderBottomColor: BORDER.subtle,
                      paddingHorizontal: SPACE[4],
                      paddingBottom: SPACE[3],
                      paddingTop: SPACE[4],
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: fontSerif,
                          fontSize: FONT_SIZE.cardHero,
                          fontWeight: "400",
                          color: TEXT.primary,
                        }}
                      >
                        {selectedTransit?.title ?? t("transits.detailTitle")}
                      </Text>
                      {detailData?.subtitle ? (
                        <Text style={{ marginTop: 2, fontFamily: fontSans, fontSize: FONT_SIZE.metadata, color: TEXT.tertiary }}>
                          {detailData.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setShowDetail(false)}
                      style={{
                        height: 40,
                        width: 40,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: RADIUS.pill,
                      }}
                      hitSlop={{ top: SPACE[1], right: SPACE[1], bottom: SPACE[1], left: SPACE[1] }}
                    >
                      <Ionicons name="close" size={22} color={TEXT.tertiary} />
                    </Pressable>
                  </View>

                  <ScrollView style={{ paddingHorizontal: SPACE[4], paddingVertical: SPACE[4] }} contentContainerStyle={{ paddingBottom: bottomInset }}>
                    {detailLoading ? (
                      <View style={{ alignItems: "center", paddingVertical: SPACE[8] }}>
                        <ActivityIndicator color={TEXT.tertiary} />
                        <Text style={{ marginTop: SPACE[3], fontFamily: fontSans, fontSize: FONT_SIZE.body, color: TEXT.tertiary }}>
                          {t("transits.loading")}
                        </Text>
                      </View>
                    ) : detailData ? (
                      <>
                        <View
                          style={{
                            height: 4,
                            borderRadius: RADIUS.sm,
                            backgroundColor: PLANET_PALETTE[normalizePlanet(selectedTransit?.transitingBody ?? "Moon")].mid,
                            marginBottom: SPACE[4],
                          }}
                        />
                        {detailData.whyThisIsHappening ? (
                          <View style={{ marginBottom: SPACE[4] }}>
                            <Text
                              style={{
                                marginBottom: SPACE[2],
                                fontFamily: fontSansMedium,
                                fontSize: FONT_SIZE.sectionCaps,
                                letterSpacing: LETTER_SPACING.sectionCaps * FONT_SIZE.sectionCaps,
                                textTransform: "uppercase",
                                color: TEXT.muted,
                              }}
                            >
                              {t("transits.whyHappening")}
                            </Text>
                            <Text
                              style={{
                                fontFamily: fontSans,
                                fontSize: FONT_SIZE.body,
                                color: TEXT.secondary,
                                lineHeight: FONT_SIZE.body * LINE_HEIGHT.body,
                              }}
                            >
                              {detailData.whyThisIsHappening}
                            </Text>
                          </View>
                        ) : null}
                        {detailData.whyItMattersForYou ? (
                          <View style={{ marginBottom: SPACE[4] }}>
                            <Text
                              style={{
                                marginBottom: SPACE[2],
                                fontFamily: fontSansMedium,
                                fontSize: FONT_SIZE.sectionCaps,
                                letterSpacing: LETTER_SPACING.sectionCaps * FONT_SIZE.sectionCaps,
                                textTransform: "uppercase",
                                color: TEXT.muted,
                              }}
                            >
                              {t("transits.whyMatters")}
                            </Text>
                            <Text
                              style={{
                                fontFamily: fontSans,
                                fontSize: FONT_SIZE.body,
                                color: TEXT.secondary,
                                lineHeight: FONT_SIZE.body * LINE_HEIGHT.body,
                              }}
                            >
                              {detailData.whyItMattersForYou}
                            </Text>
                          </View>
                        ) : null}
                        {detailData.leanInto && detailData.leanInto.length > 0 ? (
                          <View style={{ marginBottom: SPACE[4] }}>
                            <Text
                              style={{
                                marginBottom: SPACE[2],
                                fontFamily: fontSansMedium,
                                fontSize: FONT_SIZE.sectionCaps,
                                letterSpacing: LETTER_SPACING.sectionCaps * FONT_SIZE.sectionCaps,
                                textTransform: "uppercase",
                                color: TEXT.muted,
                              }}
                            >
                              {t("transits.leanInto")}
                            </Text>
                            {detailData.leanInto.map((item, i) => (
                              <View key={i} style={{ marginBottom: SPACE[2], flexDirection: "row", alignItems: "flex-start" }}>
                                <Text style={{ marginRight: SPACE[2], marginTop: 2, fontFamily: fontSans, color: TEXT.tertiary }}>✦</Text>
                                <Text
                                  style={{
                                    flex: 1,
                                    fontFamily: fontSans,
                                    fontSize: FONT_SIZE.body,
                                    color: TEXT.secondary,
                                    lineHeight: FONT_SIZE.body * LINE_HEIGHT.body,
                                  }}
                                >
                                  {item}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                        {detailData.beMindfulOf && detailData.beMindfulOf.length > 0 ? (
                          <View style={{ marginBottom: SPACE[4] }}>
                            <Text
                              style={{
                                marginBottom: SPACE[2],
                                fontFamily: fontSansMedium,
                                fontSize: FONT_SIZE.sectionCaps,
                                letterSpacing: LETTER_SPACING.sectionCaps * FONT_SIZE.sectionCaps,
                                textTransform: "uppercase",
                                color: TEXT.muted,
                              }}
                            >
                              {t("transits.beMindful")}
                            </Text>
                            {detailData.beMindfulOf.map((item, i) => (
                              <View key={i} style={{ marginBottom: SPACE[2], flexDirection: "row", alignItems: "flex-start" }}>
                                <Text style={{ marginRight: SPACE[2], marginTop: 2, fontFamily: fontSans, color: TEXT.tertiary }}>◦</Text>
                                <Text
                                  style={{
                                    flex: 1,
                                    fontFamily: fontSans,
                                    fontSize: FONT_SIZE.body,
                                    color: TEXT.secondary,
                                    lineHeight: FONT_SIZE.body * LINE_HEIGHT.body,
                                  }}
                                >
                                  {item}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </>
                    ) : (
                      <View style={{ alignItems: "center", paddingVertical: SPACE[8] }}>
                        <Text style={{ fontFamily: fontSans, fontSize: FONT_SIZE.body, color: TEXT.tertiary }}>{t("common.tryAgain")}</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
};

export default PersonalTransitsScreen;
