/**
 * Collective aspect orb window — quiet treatment for sky aspects.
 */
import type { FC } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  FONT,
  FONT_SIZE,
  RADIUS,
  STATE,
  TEXT,
} from "@/constants";
import { useThemeColors } from "@/lib/themeColors";

export type AspectWindowBarProps = {
  startAt: string;
  exactAt: string;
  endAt: string;
  isApproaching: boolean;
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TRACK_H = 3;
const TODAY_DOT = 8;
const TODAY_R = TODAY_DOT / 2;
const TICK_W = 1;
const TICK_H = 8;

export const AspectWindowBar: FC<AspectWindowBarProps> = ({
  startAt,
  exactAt,
  endAt,
}) => {
  const tc = useThemeColors();
  const now = Date.now();
  const start = new Date(startAt).getTime();
  const exact = new Date(exactAt).getTime();
  const end = new Date(endAt).getTime();
  const total = end - start;
  const safeTotal = total > 0 && Number.isFinite(total) ? total : 1;
  const todayProgress = Math.min(Math.max((now - start) / safeTotal, 0), 1);
  const exactProgress = Math.min(Math.max((exact - start) / safeTotal, 0), 1);

  const trackBg = tc.isDark ? tc.borderSubtle : "rgba(0,0,0,0.06)";
  const sep = STATE.separating;
  const tickColor = TEXT.tertiary;

  return (
    <View style={[styles.wrap, { paddingBottom: 16 }]}>
      <View
        style={[
          styles.track,
          {
            height: TRACK_H,
            borderRadius: RADIUS.pill,
            backgroundColor: trackBg,
          },
        ]}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${todayProgress * 100}%`,
            borderRadius: RADIUS.pill,
            backgroundColor: sep,
          }}
        />
        <View
          style={[styles.exactTickWrap, { left: `${exactProgress * 100}%` }]}
          pointerEvents="none"
        >
          <View
            style={{
              width: TICK_W,
              height: TICK_H,
              backgroundColor: tickColor,
              opacity: 0.5,
              borderRadius: RADIUS.sm,
            }}
          />
        </View>
        <View
          style={[
            styles.todayDot,
            {
              left: `${todayProgress * 100}%`,
              backgroundColor: sep,
            },
          ]}
          pointerEvents="none"
        />
      </View>

      <View style={styles.bottomRow}>
        <Text
          style={{
            flex: 1,
            fontFamily: FONT.sans,
            fontSize: FONT_SIZE.metadata,
            color: TEXT.tertiary,
            textAlign: "left",
          }}
          numberOfLines={2}
        >
          {`Enters orb ${fmtDate(startAt)}`}
        </Text>
        <Text
          style={{
            flex: 1,
            fontFamily: FONT.sans,
            fontSize: FONT_SIZE.metadata,
            color: TEXT.tertiary,
            textAlign: "right",
          }}
          numberOfLines={2}
        >
          {`Leaves orb ${fmtDate(endAt)}`}
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
  exactTickWrap: {
    position: "absolute",
    top: "50%",
    marginTop: -(TICK_H + 18),
    marginLeft: -20,
    width: 40,
    alignItems: "center",
    zIndex: 1,
  },
  todayDot: {
    position: "absolute",
    top: "50%",
    marginTop: -TODAY_R,
    marginLeft: -TODAY_R,
    width: TODAY_DOT,
    height: TODAY_DOT,
    borderRadius: TODAY_R,
    zIndex: 2,
  },
  bottomRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: 10,
    justifyContent: "space-between",
  },
});
