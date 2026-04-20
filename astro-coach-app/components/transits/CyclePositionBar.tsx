/**
 * Lunar / cycle rhythm bar — position within full cycle (0–1).
 */
import type { FC } from "react";
import { useEffect } from "react";
import { StyleSheet, Text, View, type DimensionValue } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  FONT,
  FONT_SIZE,
  RADIUS,
  STATE,
  TEXT,
} from "@/constants";
import { useThemeColors } from "@/lib/themeColors";

export type CyclePositionBarProps = {
  progress: number;
  startLabel: string;
  endLabel: string;
  todayLabel?: string;
  pulse?: boolean;
};

const TRACK_H = 5;
const DOT = 12;
const DOT_R = DOT / 2;
const LABEL_SLOT = 20;

export const CyclePositionBar: FC<CyclePositionBarProps> = ({
  progress,
  startLabel,
  endLabel,
  todayLabel,
  pulse = false,
}) => {
  const tc = useThemeColors();
  const p = Math.min(Math.max(progress, 0), 1);
  const trackBg = tc.isDark ? tc.surfacePrimary : "rgba(0,0,0,0.08)";
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (!pulse) {
      pulseScale.value = 1;
      return;
    }
    pulseScale.value = 1;
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [pulse, pulseScale]);

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const pct = `${p * 100}%` as DimensionValue;

  return (
    <View style={[styles.outer, { paddingTop: LABEL_SLOT, paddingBottom: 16 }]}>
      {todayLabel ? (
        <View
          style={[styles.todayLabelSlot, { left: pct }]}
          pointerEvents="none"
        >
          <Text
            style={{
              fontFamily: FONT.sansMedium,
              fontSize: FONT_SIZE.metadata,
              color: STATE.lunation,
              textAlign: "center",
            }}
            numberOfLines={1}
          >
            {todayLabel}
          </Text>
        </View>
      ) : null}

      <View style={styles.trackShell}>
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
              width: `${p * 100}%`,
              borderRadius: RADIUS.pill,
              backgroundColor: STATE.lunation,
            }}
          />
          <View style={[styles.dotAnchor, { left: pct }]} pointerEvents="none">
            {pulse ? (
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    backgroundColor: STATE.lunation,
                    opacity: 0.3,
                    width: DOT,
                    height: DOT,
                    borderRadius: DOT_R,
                  },
                  ringAnimatedStyle,
                ]}
              />
            ) : null}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: DOT,
                height: DOT,
                borderRadius: DOT_R,
                backgroundColor: STATE.lunation,
                zIndex: 1,
              }}
            />
          </View>
        </View>
      </View>

      <View style={styles.edgeLabels}>
        <Text
          style={{
            flex: 1,
            fontFamily: FONT.sans,
            fontSize: FONT_SIZE.metadata,
            color: TEXT.tertiary,
            textAlign: "left",
          }}
          numberOfLines={1}
        >
          {startLabel}
        </Text>
        <Text
          style={{
            flex: 1,
            fontFamily: FONT.sans,
            fontSize: FONT_SIZE.metadata,
            color: TEXT.tertiary,
            textAlign: "right",
          }}
          numberOfLines={1}
        >
          {endLabel}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    width: "100%",
    position: "relative",
  },
  todayLabelSlot: {
    position: "absolute",
    top: 0,
    width: 96,
    marginLeft: -48,
    alignItems: "center",
  },
  trackShell: {
    width: "100%",
  },
  track: {
    width: "100%",
    overflow: "visible",
    position: "relative",
  },
  dotAnchor: {
    position: "absolute",
    top: "50%",
    marginTop: -DOT_R,
    marginLeft: -DOT_R,
    width: DOT,
    height: DOT,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  edgeLabels: {
    flexDirection: "row",
    width: "100%",
    marginTop: 8,
  },
});
