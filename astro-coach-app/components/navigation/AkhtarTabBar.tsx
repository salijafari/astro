import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React, { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  HomeSparkIcon,
  IdentityOrbIcon,
  PeopleNodesIcon,
  TransitPlanetIcon,
} from "./TabIcons";

const TAB_CONFIG = [
  { key: "home", color: "#FBCB6A", Icon: HomeSparkIcon },
  { key: "transits", color: "#5DA8FF", Icon: TransitPlanetIcon },
  { key: "chart", color: "#B388FF", Icon: IdentityOrbIcon },
  { key: "people", color: "#4DE1C6", Icon: PeopleNodesIcon },
] as const;

/** Capsule height — keep in sync with styles.island. */
export const ISLAND_HEIGHT = 64;
/** Top spacing above capsule in the floating chrome (matches styles.wrapper.paddingTop). */
export const ISLAND_WRAPPER_PADDING_TOP = 10;
/** Fixed stack above home indicator (paddingTop + capsule only; scroll content uses `usePrimaryTabScrollBottomInset`). */
export const ISLAND_BOTTOM_OFFSET = ISLAND_HEIGHT + ISLAND_WRAPPER_PADDING_TOP;
const SPRING_CFG = { damping: 20, stiffness: 180, mass: 0.85 };

/** Map route name → visual tab index 0–3, or -1 when not a primary tab. */
function visualIndexForRoute(name: string | undefined): number {
  if (!name) return -1;
  if (name === "home") return 0;
  if (name === "transits" || name === "personal-transits") return 1;
  if (name === "chart") return 2;
  if (name === "people" || name.startsWith("people/")) return 3;
  return -1;
}

export function AkhtarTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";

  const lastPrimaryIndex = useRef(0);
  const activeRouteName = state.routes[state.index]?.name;
  const rawVisual = visualIndexForRoute(activeRouteName);
  const displayIndex = rawVisual >= 0 ? rawVisual : lastPrimaryIndex.current;

  useEffect(() => {
    if (rawVisual >= 0) lastPrimaryIndex.current = rawVisual;
  }, [rawVisual]);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      <View style={styles.island}>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.glassBase} />
        </View>

        <View style={styles.topShine} pointerEvents="none" />

        <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {TAB_CONFIG.map((tab, index) => {
            const route = state.routes.find((r) => r.name === tab.key);
            if (!route) return null;

            const isFocused = displayIndex === index;

            return (
              <AkhtarTabItem
                key={tab.key}
                tab={tab}
                isFocused={isFocused}
                isRTL={isRTL}
                labelKey={`main.${tab.key}` as const}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name as never);
                  }
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

type TabKey = (typeof TAB_CONFIG)[number]["key"];

interface TabItemProps {
  tab: (typeof TAB_CONFIG)[number];
  isFocused: boolean;
  isRTL: boolean;
  labelKey: `main.${TabKey}`;
  onPress: () => void;
}

function AkhtarTabItem({
  tab,
  isFocused,
  isRTL,
  labelKey,
  onPress,
}: TabItemProps) {
  const { t, i18n } = useTranslation();
  const label = t(labelKey);
  const appLang = i18n.language.startsWith("fa") ? "fa" : "en";
  const Icon = tab.Icon;

  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(isFocused ? 1 : 0, SPRING_CFG);
  }, [isFocused, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    flex: interpolate(progress.value, [0, 1], [1, 2.2], Extrapolation.CLAMP),
  }));

  const pillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scaleX: interpolate(progress.value, [0, 1], [0.7, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(progress.value, [0, 1], [0.85, 1.05], Extrapolation.CLAMP),
      },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [isRTL ? -8 : 8, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
    maxWidth: interpolate(progress.value, [0, 0.3, 1], [0, 0, 120], Extrapolation.CLAMP),
    overflow: "hidden" as const,
  }));

  /** 8-digit hex tint behind active tab (RN supports #RRGGBBAA). */
  const pillTint = `${tab.color}22`;

  return (
    <Animated.View style={[styles.tabItem, containerStyle]}>
      <Pressable
        onPress={onPress}
        style={styles.tabPressable}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: isFocused }}
        hitSlop={4}
      >
        <Animated.View
          style={[styles.activePill, { backgroundColor: pillTint }, pillStyle]}
          pointerEvents="none"
        />

        <View
          style={[
            styles.tabInner,
            { flexDirection: isRTL ? "row-reverse" : "row" },
          ]}
        >
          <Animated.View style={iconStyle}>
            <Icon active={isFocused} color={tab.color} size={28} />
          </Animated.View>

          <Animated.Text
            style={[
              styles.label,
              {
                color: tab.color,
                fontFamily:
                  appLang === "fa"
                    ? "Vazirmatn_500Medium"
                    : "DMSans_500Medium",
              },
              labelStyle,
            ]}
            numberOfLines={1}
          >
            {label}
          </Animated.Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /**
   * Out-of-flow so the tab navigator does not reserve a full-width bottom band.
   * Scenes extend edge-to-edge; only the island (child) is visibly painted on top.
   */
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 100,
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "transparent",
  },
  island: {
    width: "100%",
    height: ISLAND_HEIGHT,
    borderRadius: ISLAND_HEIGHT / 2,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.13)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 20,
  },
  glassBase: {
    flex: 1,
    backgroundColor: "rgba(10,10,24,0.78)",
  },
  topShine: {
    position: "absolute",
    top: 0,
    left: 32,
    right: 32,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 1,
  },
  row: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 6,
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabItem: {
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    minWidth: 0,
  },
  tabPressable: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    minWidth: 0,
  },
  activePill: {
    position: "absolute",
    top: 10,
    bottom: 10,
    left: 4,
    right: 4,
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.10)",
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    maxWidth: "100%",
  },
  label: {
    fontSize: 13,
    includeFontPadding: false,
    flexShrink: 1,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
});
