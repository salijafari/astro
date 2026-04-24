import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import NatalWheel from "@/components/chart/NatalWheel";
import { CosmicBackground } from "@/components/CosmicBackground";
import {
  BG,
  BORDER,
  BRAND,
  FONT,
  FONT_SIZE,
  LETTER_SPACING,
  LINE_HEIGHT,
  PLANET_PALETTE,
  RADIUS,
  SPACE,
  TEXT,
} from "@/constants";
import {
  ASPECT_EN_TO_FA,
  localizeHouse,
  localizePlanet,
  localizeSign,
  PLANET_EN_TO_FA,
  PLANET_GLYPHS,
  ZODIAC_EN_TO_FA,
} from "@/constants/astroGlossary";
import { typography } from "@/constants/theme";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isPersian } from "@/lib/i18n";
import { fetchUserProfile } from "@/lib/userProfile";
import { useBottomNavInset } from "@/hooks/useBottomNavInset";
import type { AspectRow, PlanetRow } from "@/types/chart";

type ThemeCard = {
  id: string;
  titleEn: string;
  titleFa: string;
  teaserEn: string;
  teaserFa: string;
  planet: string;
  sign: string;
  house: number;
  salienceScore?: number;
};

type TransitRibbon = {
  transitId: string | null;
  headlineEn: string;
  headlineFa: string;
  subEn: string;
  subFa: string;
  dateRange: string;
  transitingBody: string;
};

type ChartData = {
  bigThree: {
    sun: string;
    moon: string;
    rising: string | null;
    sunFa: string;
    moonFa: string;
    risingFa: string | null;
  };
  synthesisParagraph: string;
  themeCards: ThemeCard[];
  currentTransitRibbon: TransitRibbon | null;
  birthTimeStatus: "exact" | "approximate" | "unknown";
  metadata: {
    birthDate: string | null;
    birthTime: string | null;
    birthCity: string | null;
    houseSystem: string;
    zodiac: string;
    engineVersion: string;
  };
  natalPlanets?: PlanetRow[];
  natalAspects?: AspectRow[];
  ascendantLongitude?: number | null;
  midheavenLongitude?: number | null;
};

const ASPECT_SYMBOLS: Record<string, string> = {
  conjunction: "☌",
  opposition: "☍",
  trine: "△",
  square: "□",
  sextile: "✶",
};

function localizeAspect(type: string, lang: "en" | "fa"): string {
  if (lang === "fa") return ASPECT_EN_TO_FA[type] ?? type;
  return type;
}

const ZODIAC_ORDER = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

function webBlur(px: number): ViewStyle {
  if (Platform.OS !== "web") return {};
  return { backdropFilter: `blur(${px}px)` } as ViewStyle;
}

type SynthesisTextProps = {
  text: string;
  fontSerif: string;
  fontSerifItalic: string;
  isRTL: boolean;
};

const SynthesisText: React.FC<SynthesisTextProps> = ({ text, fontSerif, fontSerifItalic, isRTL }) => {
  const parts = text.split(/\*([^*]+)\*/g);
  return (
    <Text
      style={[
        styles.synthesisTextInner,
        {
          fontFamily: fontSerif,
          textAlign: isRTL ? "right" : "left",
          writingDirection: isRTL ? "rtl" : "ltr",
        },
      ]}
    >
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ fontFamily: fontSerifItalic, color: TEXT.secondary }}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
};

export default function ChartScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { getToken } = useAuth();

  const appLang = isPersian(i18n.language) ? "fa" : "en";
  const isRTL = appLang === "fa";

  const fontSans = appLang === "fa" ? typography.family.regular : FONT.sans;
  const fontSansMedium = appLang === "fa" ? typography.family.medium : FONT.sansMedium;
  const fontSerif = appLang === "fa" ? typography.family.regular : FONT.serif;
  const fontSerifItalic = appLang === "fa" ? typography.family.regular : FONT.serifItalic;

  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [viewMode, setViewMode] = useState<"simple" | "advanced">("simple");
  const bottomNavInset = useBottomNavInset();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError(t("chart.error_generic"));
        setChartData(null);
        return;
      }

      const profile = await fetchUserProfile(token);
      if (profile.user) {
        const u = profile.user;
        const name =
          appLang === "fa" && u.nameFa?.trim()
            ? u.nameFa.trim()
            : (u.name?.trim() ?? u.firstName?.trim() ?? "");
        setUserName(name);
      }

      const res = await apiRequest(`/api/natal-chart?locale=${appLang}`, {
        getToken,
        method: "GET",
      });

      if (res.status === 404) {
        setChartData(null);
        setError(t("chart.error_no_profile"));
        return;
      }

      if (!res.ok) {
        setChartData(null);
        setError(t("chart.error_generic"));
        return;
      }

      const data = (await res.json()) as ChartData & { error?: string };
      if ("error" in data && typeof data.error === "string") {
        setChartData(null);
        setError(t("chart.error_generic"));
        return;
      }
      setChartData(data);
    } catch (e) {
      console.warn("[chart] load error:", e);
      setChartData(null);
      setError(t("chart.error_generic"));
    } finally {
      setLoading(false);
    }
  }, [appLang, getToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAma = useCallback(
    (themeCard: ThemeCard) => {
      const title = appLang === "fa" ? themeCard.titleFa : themeCard.titleEn;
      const planet =
        appLang === "fa" ? (PLANET_EN_TO_FA[themeCard.planet] ?? themeCard.planet) : themeCard.planet;
      const sign = appLang === "fa" ? (ZODIAC_EN_TO_FA[themeCard.sign] ?? themeCard.sign) : themeCard.sign;
      const house = themeCard.house;
      const houseLabel = localizeHouse(themeCard.house, appLang);
      const prefill =
        appLang === "fa"
          ? `درباره ${title} بیشتر بگو. ${planet} من در ${sign} در ${houseLabel} است.`
          : `Tell me more about ${title}. My ${planet} is in ${sign} in the ${houseLabel}.`;
      router.push({ pathname: "/(main)/ask-me-anything", params: { prefill } });
    },
    [appLang, router],
  );

  const openTransits = useCallback(() => {
    router.push("/(main)/transits");
  }, [router]);

  const openEditProfile = useCallback(() => {
    router.push("/(main)/edit-profile");
  }, [router]);

  const cardBlur = useCallback((px: number) => webBlur(px), []);

  if (loading) {
    return (
      <View style={styles.root}>
        <CosmicBackground subtleDrift />
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={TEXT.secondary} />
            <Text style={[styles.loadingText, { fontFamily: fontSans }]}>{t("chart.loading_synthesis")}</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !chartData) {
    return (
      <View style={styles.root}>
        <CosmicBackground subtleDrift />
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.loadingContainer}>
            <Text
              style={[
                styles.errorText,
                { fontFamily: fontSans, textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" },
              ]}
            >
              {error ?? t("chart.error_no_profile")}
            </Text>
            <TouchableOpacity onPress={openEditProfile} style={styles.ctaButton}>
              <Text style={[styles.ctaText, { fontFamily: fontSansMedium }]}>{t("chart.footer_edit")}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const {
    bigThree,
    synthesisParagraph,
    themeCards,
    currentTransitRibbon,
    birthTimeStatus,
    metadata,
    natalPlanets = [],
    natalAspects = [],
    ascendantLongitude = null,
    midheavenLongitude = null,
  } = chartData;
  const noRising = birthTimeStatus === "unknown";

  return (
    <View style={styles.root}>
      <CosmicBackground subtleDrift />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <Text
            style={[
              styles.overline,
              {
                fontFamily: fontSansMedium,
                textAlign: isRTL ? "right" : "left",
                writingDirection: isRTL ? "rtl" : "ltr",
                letterSpacing: LETTER_SPACING.sectionCaps * FONT_SIZE.sectionCaps,
              },
            ]}
          >
            {t("chart.overline")}
          </Text>
          <Text
            style={[
              styles.titleMain,
              {
                fontFamily: fontSerif,
                textAlign: isRTL ? "right" : "left",
                writingDirection: isRTL ? "rtl" : "ltr",
              },
            ]}
          >
            {userName}
            {t("chart.titleSuffix")}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(400).delay(80)} style={styles.toggleRow}>
          <View style={[styles.toggle, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <TouchableOpacity
              onPress={() => setViewMode("simple")}
              accessibilityRole="button"
              hitSlop={SPACE[2]}
              style={viewMode === "simple" ? [styles.toggleActive, cardBlur(20)] : styles.toggleInactiveWrap}
            >
              <Text
                style={[
                  viewMode === "simple" ? styles.toggleActiveText : styles.toggleInactive,
                  { fontFamily: fontSansMedium },
                ]}
              >
                {t("chart.toggle_simple")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode("advanced")}
              accessibilityRole="button"
              hitSlop={SPACE[2]}
              style={viewMode === "advanced" ? [styles.toggleActive, cardBlur(20)] : styles.toggleInactiveWrap}
            >
              <Text
                style={[
                  viewMode === "advanced" ? styles.toggleActiveText : styles.toggleInactive,
                  { fontFamily: fontSansMedium },
                ]}
              >
                {t("chart.toggle_advanced")}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {viewMode === "simple" ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomNavInset }]}
          showsVerticalScrollIndicator={false}
        >
          {noRising ? (
            <Animated.View
              entering={FadeInDown.duration(400).delay(100)}
              style={[styles.bannerCard, cardBlur(20)]}
            >
              <Text
                style={[
                  styles.bannerText,
                  { fontFamily: fontSans, textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" },
                ]}
              >
                {t("chart.no_birth_time_banner")}
              </Text>
              <TouchableOpacity onPress={openEditProfile}>
                <Text style={[styles.bannerCta, { fontFamily: fontSansMedium }]}>{t("chart.no_birth_time_cta")}</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : null}

          <Animated.View
            entering={FadeInDown.duration(500).delay(120)}
            style={[styles.bigThreeRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}
          >
            <View style={[styles.bigPill, cardBlur(16)]}>
              <Text style={[styles.bigGlyph, { color: PLANET_PALETTE.Sun.mid }]}>{PLANET_GLYPHS.Sun}</Text>
              <Text style={[styles.bigLabel, { fontFamily: fontSansMedium }]}>{t("chart.big_three_sun_label")}</Text>
              <Text style={[styles.bigSign, { fontFamily: fontSerifItalic }]}>
                {appLang === "fa" ? bigThree.sunFa : bigThree.sun}
              </Text>
              <Text
                style={[
                  styles.bigEssence,
                  { fontFamily: fontSans, textAlign: "center", writingDirection: isRTL ? "rtl" : "ltr" },
                ]}
              >
                {t("chart.big_three_sun_essence")}
              </Text>
            </View>

            <View style={[styles.bigPill, cardBlur(16)]}>
              <Text style={[styles.bigGlyph, { color: PLANET_PALETTE.Moon.mid }]}>{PLANET_GLYPHS.Moon}</Text>
              <Text style={[styles.bigLabel, { fontFamily: fontSansMedium }]}>{t("chart.big_three_moon_label")}</Text>
              <Text style={[styles.bigSign, { fontFamily: fontSerifItalic }]}>
                {appLang === "fa" ? bigThree.moonFa : bigThree.moon}
              </Text>
              <Text
                style={[
                  styles.bigEssence,
                  { fontFamily: fontSans, textAlign: "center", writingDirection: isRTL ? "rtl" : "ltr" },
                ]}
              >
                {t("chart.big_three_moon_essence")}
              </Text>
            </View>

            {!noRising ? (
              <View style={[styles.bigPill, cardBlur(16)]}>
                <Text style={[styles.bigGlyph, { color: PLANET_PALETTE.Venus.mid }]}>↑</Text>
                <Text style={[styles.bigLabel, { fontFamily: fontSansMedium }]}>
                  {t("chart.big_three_rising_label")}
                </Text>
                <Text style={[styles.bigSign, { fontFamily: fontSerifItalic }]}>
                  {appLang === "fa" ? (bigThree.risingFa ?? "—") : (bigThree.rising ?? "—")}
                </Text>
                <Text
                  style={[
                    styles.bigEssence,
                    { fontFamily: fontSans, textAlign: "center", writingDirection: isRTL ? "rtl" : "ltr" },
                  ]}
                >
                  {t("chart.big_three_rising_essence")}
                </Text>
              </View>
            ) : null}
          </Animated.View>

          {synthesisParagraph ? (
            <Animated.View entering={FadeInDown.duration(500).delay(220)} style={[styles.synthesisBlock, cardBlur(16)]}>
              <Text
                style={[
                  styles.synthesisOverline,
                  {
                    fontFamily: fontSansMedium,
                    textAlign: "center",
                    letterSpacing: LETTER_SPACING.sectionCaps * FONT_SIZE.sectionCaps,
                  },
                ]}
              >
                {t("chart.synthesis_overline")}
              </Text>
              <SynthesisText
                text={synthesisParagraph}
                fontSerif={fontSerif}
                fontSerifItalic={fontSerifItalic}
                isRTL={isRTL}
              />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(400).delay(220)} style={[styles.synthesisBlock, cardBlur(16)]}>
              <ActivityIndicator color={TEXT.muted} size="small" />
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(500).delay(320)} style={[styles.ribbon, cardBlur(20)]}>
            <View style={[styles.ribbonTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={[styles.ribbonTopLeft, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <View style={styles.liveDot} />
                <Text style={[styles.ribbonTag, { fontFamily: fontSansMedium }]}>{t("chart.ribbon_tag")}</Text>
              </View>
              {currentTransitRibbon?.dateRange ? (
                <Text style={[styles.ribbonDate, { fontFamily: fontSans }]}>{currentTransitRibbon.dateRange}</Text>
              ) : null}
            </View>

            {currentTransitRibbon ? (
              <>
                <Text
                  style={[
                    styles.ribbonHeadline,
                    { fontFamily: fontSerif, textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" },
                  ]}
                >
                  {appLang === "fa" ? currentTransitRibbon.headlineFa : currentTransitRibbon.headlineEn}
                </Text>
                <Text
                  style={[
                    styles.ribbonSub,
                    { fontFamily: fontSans, textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" },
                  ]}
                >
                  {appLang === "fa" ? currentTransitRibbon.subFa : currentTransitRibbon.subEn}
                </Text>
              </>
            ) : (
              <>
                <Text
                  style={[
                    styles.ribbonSub,
                    { fontFamily: fontSans, textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" },
                  ]}
                >
                  {t("chart.ribbon_no_data")}
                </Text>
                <TouchableOpacity
                  onPress={openTransits}
                  style={[styles.ribbonCta, { flexDirection: isRTL ? "row-reverse" : "row" }]}
                >
                  <Text style={[styles.ribbonCtaText, { fontFamily: fontSansMedium }]}>{t("chart.ribbon_cta")}</Text>
                  <Text style={[styles.ribbonArrow, { fontFamily: fontSans }]}>{isRTL ? " ←" : " →"}</Text>
                </TouchableOpacity>
              </>
            )}

            {currentTransitRibbon ? (
              <TouchableOpacity
                onPress={openTransits}
                style={[styles.ribbonCta, { flexDirection: isRTL ? "row-reverse" : "row" }]}
              >
                <Text style={[styles.ribbonCtaText, { fontFamily: fontSansMedium }]}>{t("chart.ribbon_cta")}</Text>
                <Text style={[styles.ribbonArrow, { fontFamily: fontSans }]}>{isRTL ? " ←" : " →"}</Text>
              </TouchableOpacity>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(500).delay(420)} style={styles.themesSection}>
            <View style={[styles.sectionHead, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              {isRTL ? (
                <Text style={[styles.sectionTitle, { fontFamily: fontSansMedium, textAlign: "right" }]}>
                  {t("chart.themes_title_prefix")} {t("chart.themes_title_suffix")}
                </Text>
              ) : (
                <Text style={[styles.sectionTitle, { fontFamily: fontSerif }]}>
                  <Text style={{ fontFamily: fontSerifItalic }}>{t("chart.themes_title_prefix")} </Text>
                  {t("chart.themes_title_suffix")}
                </Text>
              )}
              <Text style={[styles.sectionCount, { fontFamily: fontSans }]}>{t("chart.themes_count")}</Text>
            </View>

            {themeCards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={[styles.themeCard, { flexDirection: isRTL ? "row-reverse" : "row" }, cardBlur(12)]}
                onPress={() => openAma(card)}
                activeOpacity={0.7}
              >
                <View style={styles.themeIcon}>
                  <Text style={[styles.themeGlyph, { fontFamily: fontSerif }]}>
                    {PLANET_GLYPHS[card.planet] ?? "✦"}
                  </Text>
                </View>
                <View style={styles.themeBody}>
                  <Text
                    style={[
                      styles.themeTitle,
                      { fontFamily: fontSansMedium, textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" },
                    ]}
                  >
                    {appLang === "fa" ? card.titleFa : card.titleEn}
                  </Text>
                  <Text
                    style={[
                      styles.themeTeaser,
                      { fontFamily: fontSans, textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" },
                    ]}
                  >
                    {appLang === "fa" ? card.teaserFa : card.teaserEn}
                  </Text>
                  <Text
                    style={[
                      styles.themeMeta,
                      {
                        fontFamily: fontSans,
                        textAlign: isRTL ? "right" : "left",
                        writingDirection: isRTL ? "rtl" : "ltr",
                        letterSpacing: LETTER_SPACING.badge * FONT_SIZE.metadata,
                      },
                    ]}
                  >
                    {localizeSign(card.sign, appLang)} · {localizeHouse(card.house, appLang)}
                  </Text>
                </View>
                <Text style={[styles.themeChev, { fontFamily: fontSans }]}>{isRTL ? "‹" : "›"}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(500).delay(520)}>
            <TouchableOpacity
              style={[styles.wheelBlock, { flexDirection: isRTL ? "row-reverse" : "row" }, cardBlur(10)]}
              activeOpacity={0.7}
              onPress={() => setViewMode("advanced")}
            >
              <View style={styles.miniWheel}>
                <Text style={{ color: TEXT.muted, fontFamily: fontSerif, fontSize: FONT_SIZE.cardCompact }}>⊙</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.wheelLabel,
                    { fontFamily: fontSansMedium, textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" },
                  ]}
                >
                  {t("chart.wheel_label")}
                </Text>
                <Text
                  style={[
                    styles.wheelSub,
                    { fontFamily: fontSans, textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" },
                  ]}
                >
                  {t("chart.wheel_sub")}
                </Text>
              </View>
              <Text style={[styles.wheelArrow, { fontFamily: fontSans }]}>↗</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(600)} style={styles.footerMeta}>
            {metadata.birthDate ? (
              <Text
                style={[
                  styles.metaLine,
                  { fontFamily: fontSans, textAlign: "center", writingDirection: isRTL ? "rtl" : "ltr" },
                ]}
              >
                {metadata.birthDate}
                {metadata.birthTime ? ` · ${metadata.birthTime}` : ""}
                {metadata.birthCity ? ` · ${metadata.birthCity}` : ""}
              </Text>
            ) : null}
            <Text style={[styles.metaLine, { fontFamily: fontSans, textAlign: "center" }]}>{t("chart.footer_system")}</Text>
            <TouchableOpacity onPress={openEditProfile}>
              <Text style={[styles.metaEdit, { fontFamily: fontSansMedium }]}>{t("chart.footer_edit")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
        ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomNavInset }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(500)} style={styles.wheelHero}>
            <NatalWheel
              planets={natalPlanets}
              aspects={natalAspects}
              ascendantLongitude={ascendantLongitude}
              midheavenLongitude={midheavenLongitude}
              size={300}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(500).delay(100)} style={[styles.advSection, cardBlur(12)]}>
            <Text style={[styles.advHeading, { fontFamily: fontSansMedium }]}>{t("chart.adv_placements")}</Text>
            {natalPlanets.map((p) => (
              <View
                key={p.planet}
                style={[styles.placementRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}
              >
                <Text style={[styles.placementGlyph, { fontFamily: fontSerif }]}>
                  {PLANET_GLYPHS[p.planet] ?? "•"}
                </Text>
                <Text
                  style={[
                    styles.placementName,
                    {
                      fontFamily: fontSansMedium,
                      flex: 1,
                      textAlign: isRTL ? "right" : "left",
                      writingDirection: isRTL ? "rtl" : "ltr",
                    },
                  ]}
                >
                  {localizePlanet(p.planet, appLang)}
                </Text>
                <Text style={[styles.placementSign, { fontFamily: fontSerifItalic }]}>
                  {localizeSign(p.sign, appLang)}
                </Text>
                <Text style={[styles.placementDegree, { fontFamily: fontSans }]}>{Math.floor(p.degree)}°</Text>
                <Text style={[styles.placementHouse, { fontFamily: fontSans }]}>
                  {localizeHouse(p.house, appLang)}
                </Text>
              </View>
            ))}
          </Animated.View>

          {!noRising && ascendantLongitude != null ? (
            <Animated.View entering={FadeInDown.duration(500).delay(180)} style={[styles.advSection, cardBlur(12)]}>
              <Text style={[styles.advHeading, { fontFamily: fontSansMedium }]}>{t("chart.adv_angles")}</Text>
              <View style={[styles.placementRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Text style={[styles.placementGlyph, { fontFamily: fontSerif }]}>↑</Text>
                <Text
                  style={[
                    styles.placementName,
                    {
                      fontFamily: fontSansMedium,
                      flex: 1,
                      textAlign: isRTL ? "right" : "left",
                      writingDirection: isRTL ? "rtl" : "ltr",
                    },
                  ]}
                >
                  {t("chart.adv_ascendant")}
                </Text>
                <Text style={[styles.placementSign, { fontFamily: fontSerifItalic }]}>
                  {localizeSign(bigThree.rising ?? "", appLang)}
                </Text>
                <Text style={[styles.placementDegree, { fontFamily: fontSans }]}>
                  {Math.floor(ascendantLongitude % 30)}°
                </Text>
              </View>
              {midheavenLongitude != null ? (
                <View style={[styles.placementRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Text style={[styles.placementGlyph, { fontFamily: fontSerif }]}>↕</Text>
                  <Text
                    style={[
                      styles.placementName,
                      {
                        fontFamily: fontSansMedium,
                        flex: 1,
                        textAlign: isRTL ? "right" : "left",
                        writingDirection: isRTL ? "rtl" : "ltr",
                      },
                    ]}
                  >
                    {t("chart.adv_midheaven")}
                  </Text>
                  <Text style={[styles.placementSign, { fontFamily: fontSerifItalic }]}>
                    {localizeSign(
                      ZODIAC_ORDER[Math.floor(midheavenLongitude / 30) % 12] ?? "Aries",
                      appLang,
                    )}
                  </Text>
                  <Text style={[styles.placementDegree, { fontFamily: fontSans }]}>
                    {Math.floor(midheavenLongitude % 30)}°
                  </Text>
                </View>
              ) : null}
            </Animated.View>
          ) : null}

          {natalAspects.length > 0 ? (
            <Animated.View entering={FadeInDown.duration(500).delay(260)} style={[styles.advSection, cardBlur(12)]}>
              <Text style={[styles.advHeading, { fontFamily: fontSansMedium }]}>{t("chart.adv_aspects")}</Text>
              {[...natalAspects]
                .sort((a, b) => a.orb - b.orb)
                .slice(0, 8)
                .map((asp, i) => (
                  <View
                    key={`${asp.body1}-${asp.body2}-${asp.type}-${i}`}
                    style={[styles.aspectRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}
                  >
                    <Text style={[styles.aspectSym, { fontFamily: fontSerif }]}>
                      {ASPECT_SYMBOLS[asp.type] ?? "—"}
                    </Text>
                    <Text
                      style={[
                        styles.aspectBody,
                        {
                          fontFamily: fontSans,
                          flex: 1,
                          textAlign: isRTL ? "right" : "left",
                          writingDirection: isRTL ? "rtl" : "ltr",
                        },
                      ]}
                    >
                      {localizePlanet(asp.body1, appLang)}{" "}
                      {appLang === "fa" ? (
                        <Text style={{ color: TEXT.muted }}>{localizeAspect(asp.type, appLang)}</Text>
                      ) : (
                        <Text style={{ fontFamily: fontSerifItalic, color: TEXT.muted }}>
                          {localizeAspect(asp.type, appLang)}
                        </Text>
                      )}{" "}
                      {localizePlanet(asp.body2, appLang)}
                    </Text>
                    <Text style={[styles.aspectOrb, { fontFamily: fontSans }]}>{asp.orb.toFixed(1)}°</Text>
                  </View>
                ))}
            </Animated.View>
          ) : null}

          <View style={styles.footerMeta}>
            <Text style={[styles.metaLine, { fontFamily: fontSans, textAlign: "center" }]}>
              {t("chart.footer_system")}
            </Text>
            <TouchableOpacity onPress={openEditProfile}>
              <Text style={[styles.metaEdit, { fontFamily: fontSansMedium }]}>{t("chart.footer_edit")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG.base },
  safe: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE[3],
    paddingHorizontal: SPACE[6],
  },
  loadingText: { color: TEXT.muted, fontSize: FONT_SIZE.body, lineHeight: FONT_SIZE.body * LINE_HEIGHT.body },
  errorText: { color: TEXT.secondary, fontSize: FONT_SIZE.body, lineHeight: FONT_SIZE.body * LINE_HEIGHT.body },
  ctaButton: { marginTop: SPACE[3], paddingVertical: SPACE[2], paddingHorizontal: SPACE[4] },
  ctaText: { color: BRAND.rose, fontSize: FONT_SIZE.body },

  header: { paddingHorizontal: SPACE[5], paddingTop: SPACE[3], paddingBottom: SPACE[2] },
  overline: {
    fontSize: FONT_SIZE.sectionCaps,
    textTransform: "uppercase",
    color: TEXT.muted,
    marginBottom: SPACE[1],
  },
  titleMain: {
    fontSize: FONT_SIZE.bannerTitleSm,
    color: TEXT.primary,
    lineHeight: FONT_SIZE.bannerTitleSm * LINE_HEIGHT.snug,
  },

  toggleRow: { paddingHorizontal: SPACE[5], paddingBottom: SPACE[3] },
  toggle: {
    alignSelf: "flex-start",
    backgroundColor: BG.card,
    borderRadius: RADIUS.pill,
    borderWidth: 0.5,
    borderColor: BORDER.subtle,
    padding: SPACE[1],
    alignItems: "center",
  },
  toggleActive: {
    paddingVertical: SPACE[2],
    paddingHorizontal: SPACE[4],
    backgroundColor: TEXT.primary,
    borderRadius: RADIUS.pill,
  },
  toggleActiveText: { fontSize: FONT_SIZE.uiLabel, color: BG.base },
  toggleInactive: {
    fontSize: FONT_SIZE.uiLabel,
    color: TEXT.muted,
  },
  toggleInactiveWrap: {
    paddingVertical: SPACE[2],
    paddingHorizontal: SPACE[4],
  },

  scroll: { flex: 1 },
  scrollContent: {},

  bannerCard: {
    marginHorizontal: SPACE[5],
    marginBottom: SPACE[4],
    padding: SPACE[4],
    borderRadius: RADIUS.lg,
    backgroundColor: BG.card,
    borderWidth: 0.5,
    borderColor: BORDER.subtle,
    gap: SPACE[2],
  },
  bannerText: { fontSize: FONT_SIZE.body, color: TEXT.secondary, lineHeight: FONT_SIZE.body * LINE_HEIGHT.body },
  bannerCta: { fontSize: FONT_SIZE.body, color: BRAND.rose },

  bigThreeRow: {
    gap: SPACE[2],
    paddingHorizontal: SPACE[5],
    marginBottom: SPACE[4],
  },
  bigPill: {
    flex: 1,
    padding: SPACE[4],
    borderRadius: RADIUS.xl,
    alignItems: "center",
    backgroundColor: BG.card,
    borderWidth: 0.5,
    borderColor: BORDER.subtle,
  },
  bigGlyph: { fontSize: FONT_SIZE.cardCompact, marginBottom: SPACE[1] },
  bigLabel: {
    fontSize: FONT_SIZE.sectionCaps,
    textTransform: "uppercase",
    color: TEXT.muted,
    marginBottom: SPACE[1],
  },
  bigSign: { fontSize: FONT_SIZE.cardCompact, color: TEXT.primary, marginBottom: SPACE[1] },
  bigEssence: {
    fontSize: FONT_SIZE.sectionCaps,
    color: TEXT.muted,
    lineHeight: FONT_SIZE.sectionCaps * LINE_HEIGHT.ui,
  },

  synthesisBlock: {
    marginHorizontal: SPACE[5],
    marginBottom: SPACE[4],
    padding: SPACE[5],
    backgroundColor: BG.card,
    borderRadius: RADIUS.xl,
    borderWidth: 0.5,
    borderColor: BORDER.subtle,
  },
  synthesisOverline: {
    fontSize: FONT_SIZE.sectionCaps,
    textTransform: "uppercase",
    color: BRAND.rose,
    marginBottom: SPACE[3],
  },
  synthesisTextInner: { fontSize: FONT_SIZE.cardCompact, color: TEXT.primary, lineHeight: FONT_SIZE.cardCompact * LINE_HEIGHT.snug },

  ribbon: {
    marginHorizontal: SPACE[5],
    marginBottom: SPACE[4],
    padding: SPACE[4],
    borderRadius: RADIUS.xl,
    backgroundColor: BG.card,
    borderWidth: 0.5,
    borderColor: BORDER.strong,
  },
  ribbonTop: { justifyContent: "space-between", alignItems: "center", marginBottom: SPACE[2] },
  ribbonTopLeft: { alignItems: "center", gap: SPACE[2] },
  liveDot: {
    width: SPACE[2],
    height: SPACE[2],
    borderRadius: RADIUS.pill,
    backgroundColor: BRAND.mint,
  },
  ribbonTag: {
    fontSize: FONT_SIZE.sectionCaps,
    textTransform: "uppercase",
    color: BRAND.rose,
  },
  ribbonDate: { fontSize: FONT_SIZE.metadata, color: TEXT.muted },
  ribbonHeadline: {
    fontSize: FONT_SIZE.cardCompact,
    color: TEXT.primary,
    lineHeight: FONT_SIZE.cardCompact * LINE_HEIGHT.snug,
    marginBottom: SPACE[2],
  },
  ribbonSub: {
    fontSize: FONT_SIZE.body,
    color: TEXT.secondary,
    lineHeight: FONT_SIZE.body * LINE_HEIGHT.body,
    marginBottom: SPACE[3],
  },
  ribbonCta: { alignItems: "center", gap: SPACE[1] },
  ribbonCtaText: { fontSize: FONT_SIZE.uiLabel, color: BRAND.rose },
  ribbonArrow: { fontSize: FONT_SIZE.uiLabel, color: BRAND.rose },

  themesSection: { paddingHorizontal: SPACE[5], marginBottom: SPACE[4] },
  sectionHead: { justifyContent: "space-between", alignItems: "baseline", marginBottom: SPACE[3] },
  sectionTitle: { fontSize: FONT_SIZE.cardHero, color: TEXT.primary },
  sectionCount: { fontSize: FONT_SIZE.metadata, color: TEXT.muted },

  themeCard: {
    alignItems: "center",
    gap: SPACE[3],
    padding: SPACE[4],
    borderRadius: RADIUS.xl,
    backgroundColor: BG.card,
    borderWidth: 0.5,
    borderColor: BORDER.subtle,
    marginBottom: SPACE[2],
  },
  themeIcon: {
    width: SPACE[8] + SPACE[2],
    height: SPACE[8] + SPACE[2],
    borderRadius: RADIUS.md,
    backgroundColor: BG.cardBare,
    borderWidth: 0.5,
    borderColor: BORDER.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  themeGlyph: { fontSize: FONT_SIZE.cardCompact, color: TEXT.secondary },
  themeBody: { flex: 1, gap: SPACE[1] },
  themeTitle: { fontSize: FONT_SIZE.body, color: TEXT.primary },
  themeTeaser: { fontSize: FONT_SIZE.uiLabel, color: TEXT.secondary, lineHeight: FONT_SIZE.uiLabel * LINE_HEIGHT.ui },
  themeMeta: { fontSize: FONT_SIZE.sectionCaps, color: TEXT.muted, textTransform: "uppercase", marginTop: SPACE[1] },
  themeChev: { fontSize: FONT_SIZE.cardCompact, color: TEXT.muted },

  wheelBlock: {
    marginHorizontal: SPACE[5],
    marginBottom: SPACE[4],
    padding: SPACE[4],
    borderRadius: RADIUS.xl,
    backgroundColor: BG.card,
    borderWidth: 0.5,
    borderColor: BORDER.subtle,
    alignItems: "center",
    gap: SPACE[3],
  },
  miniWheel: {
    width: SPACE[8] + SPACE[8],
    height: SPACE[8] + SPACE[8],
    borderRadius: RADIUS.pill,
    borderWidth: 0.5,
    borderColor: BORDER.subtle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG.cardBare,
  },
  wheelLabel: { fontSize: FONT_SIZE.body, color: TEXT.primary, marginBottom: SPACE[1] },
  wheelSub: { fontSize: FONT_SIZE.uiLabel, color: TEXT.muted },
  wheelArrow: { fontSize: FONT_SIZE.cardCompact, color: BRAND.rose },

  wheelHero: {
    alignItems: "center",
    paddingVertical: SPACE[5],
  },
  advSection: {
    marginHorizontal: SPACE[5],
    marginBottom: SPACE[3],
    padding: SPACE[4],
    borderRadius: RADIUS.xl,
    backgroundColor: BG.card,
    borderWidth: 0.5,
    borderColor: BORDER.subtle,
  },
  advHeading: {
    fontSize: FONT_SIZE.sectionCaps,
    letterSpacing: LETTER_SPACING.sectionCaps * FONT_SIZE.sectionCaps,
    textTransform: "uppercase",
    color: BRAND.rose,
    marginBottom: SPACE[3],
  },
  placementRow: {
    alignItems: "center",
    gap: SPACE[2],
    paddingVertical: SPACE[2],
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER.subtle,
  },
  placementGlyph: { fontSize: FONT_SIZE.cardCompact, color: TEXT.secondary, width: 22, textAlign: "center" },
  placementName: { fontSize: FONT_SIZE.body, color: TEXT.primary },
  placementSign: { fontSize: FONT_SIZE.body, color: TEXT.secondary },
  placementDegree: { fontSize: FONT_SIZE.metadata, color: TEXT.muted, width: 30, textAlign: "right" },
  placementHouse: { fontSize: FONT_SIZE.metadata, color: TEXT.muted, width: 36, textAlign: "right" },
  aspectRow: {
    alignItems: "center",
    gap: SPACE[2],
    paddingVertical: SPACE[2],
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER.subtle,
  },
  aspectSym: { fontSize: FONT_SIZE.body, color: TEXT.secondary, width: 20, textAlign: "center" },
  aspectBody: { fontSize: FONT_SIZE.uiLabel, color: TEXT.primary },
  aspectOrb: { fontSize: FONT_SIZE.metadata, color: TEXT.muted },

  footerMeta: {
    paddingHorizontal: SPACE[5],
    paddingBottom: SPACE[4],
    alignItems: "center",
    gap: SPACE[1],
  },
  metaLine: { fontSize: FONT_SIZE.metadata, color: TEXT.muted },
  metaEdit: { fontSize: FONT_SIZE.uiLabel, color: BRAND.rose, marginTop: SPACE[2] },
});
