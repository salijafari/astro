/**
 * Personal transit lifespan bar — start, peak, end with today + peak markers.
 */
import type { FC } from "react";
import { StyleSheet, Text, View, type DimensionValue } from "react-native";
import { useTranslation } from "react-i18next";
import {
  BG,
  FONT,
  FONT_SIZE,
  RADIUS,
  TEXT,
} from "@/constants";
import { useThemeColors } from "@/lib/themeColors";

export type LifecycleDurationBarProps = {
  startAt: string;
  peakAt: string;
  endAt: string;
  accentColor: string;
  /** Reserved for future semantic styling — currently unused */
  lifecycle?: "approaching" | "applying" | "peak" | "separating" | "fading";
  /** Locale for dates — `"fa"` or `"en"` */
  lang?: string;
};

function fmtDate(iso: string, localeTag: string): string {
  const d = new Date(iso);
  const locale = localeTag === "fa" ? "fa-IR" : "en-US";
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const TRACK_H = 4;
const TODAY_DOT = 10;
const TODAY_R = TODAY_DOT / 2;
const PEAK_DIAMOND = 8;

export const LifecycleDurationBar: FC<LifecycleDurationBarProps> = ({
  startAt,
  peakAt,
  endAt,
  accentColor,
  lang = "en",
}) => {
  const tc = useThemeColors();
  const { t } = useTranslation();
  const isFa = lang === "fa";
  const now = Date.now();
  const start = new Date(startAt).getTime();
  const peak = new Date(peakAt).getTime();
  const end = new Date(endAt).getTime();
  const total = end - start;
  const safeTotal = total > 0 && Number.isFinite(total) ? total : 1;
  const todayProgress = Math.min(Math.max((now - start) / safeTotal, 0), 1);
  const peakProgress = Math.min(Math.max((peak - start) / safeTotal, 0), 1);

  const trackBg = tc.isDark ? tc.surfacePrimary : "rgba(0,0,0,0.08)";
  const ringBorder = tc.isDark ? BG.base : tc.sheetBackground;
  const ghostColor = hexToRgba(accentColor, 0.3);
  const showGhost = peakProgress > todayProgress;
  const ghostWidthPct = Math.max(0, (peakProgress - todayProgress) * 100);
  const todayLeftPct = `${todayProgress * 100}%` as DimensionValue;
  const peakLeftPct = `${peakProgress * 100}%` as DimensionValue;
  const showPeakMarker = peakProgress > todayProgress + 0.05;

  return (
    <View style={[styles.wrap, { paddingBottom: 20 }]}>
      <View style={[styles.track, { height: TRACK_H, borderRadius: RADIUS.pill, backgroundColor: trackBg }]}>
        {showGhost ? (
          <View
            style={{
              position: "absolute",
              left: todayLeftPct,
              top: 0,
              bottom: 0,
              width: `${ghostWidthPct}%`,
              borderRadius: RADIUS.pill,
              backgroundColor: ghostColor,
            }}
          />
        ) : null}
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${todayProgress * 100}%`,
            borderRadius: RADIUS.pill,
            backgroundColor: accentColor,
          }}
        />
        <View
          style={[
            styles.markerToday,
            {
              left: todayLeftPct,
              borderColor: ringBorder,
              backgroundColor: accentColor,
            },
          ]}
          pointerEvents="none"
        />
        {showPeakMarker ? (
          <View
            style={[styles.peakWrap, { left: peakLeftPct }]}
            pointerEvents="none"
          >
            <View
              style={{
                width: PEAK_DIAMOND,
                height: PEAK_DIAMOND,
                backgroundColor: accentColor,
                transform: [{ rotate: "45deg" }, { translateY: -2 }],
              }}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.labelsRow}>
        <Text
          style={{
            flex: 1,
            fontFamily: FONT.sans,
            fontSize: FONT_SIZE.metadata,
            color: TEXT.tertiary,
            textAlign: isFa ? "right" : "left",
          }}
          numberOfLines={1}
        >
          {fmtDate(startAt, lang)}
        </Text>
        <Text
          style={{
            flex: 1,
            fontFamily: FONT.sansMedium,
            fontSize: FONT_SIZE.metadata,
            color: accentColor,
            textAlign: "center",
          }}
          numberOfLines={2}
        >
          {`${t("transits.bar.peak")} ${fmtDate(peakAt, lang)}`}
        </Text>
        <Text
          style={{
            flex: 1,
            fontFamily: FONT.sans,
            fontSize: FONT_SIZE.metadata,
            color: TEXT.tertiary,
            textAlign: isFa ? "left" : "right",
          }}
          numberOfLines={1}
        >
          {fmtDate(endAt, lang)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    position: "relative",
  },
  track: {
    width: "100%",
    position: "relative",
    overflow: "visible",
  },
  markerToday: {
    position: "absolute",
    top: "50%",
    marginTop: -TODAY_R,
    marginLeft: -TODAY_R,
    width: TODAY_DOT,
    height: TODAY_DOT,
    borderRadius: TODAY_R,
    borderWidth: 2,
    zIndex: 2,
  },
  peakWrap: {
    position: "absolute",
    top: "50%",
    marginTop: -PEAK_DIAMOND / 2,
    marginLeft: -PEAK_DIAMOND / 2,
    width: PEAK_DIAMOND,
    height: PEAK_DIAMOND,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  labelsRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: 10,
    alignItems: "flex-start",
  },
});
