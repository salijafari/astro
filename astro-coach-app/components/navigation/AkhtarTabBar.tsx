import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import React, { useCallback, useEffect, useRef } from "react";
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  SharedValue,
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

const ISLAND_H = 62;
const ISLAND_MARGIN_H = 20;
const ISLAND_MARGIN_BOTTOM = 10;
const SPRING_CFG = { damping: 18, stiffness: 160, mass: 0.9 };
const ACTIVE_FLEX = 2.0;
const INACTIVE_FLEX = 0.85;
const GLOW_POOL_W = 80;

/** Map current route name to visual tab index 0–3, or -1 when not a primary tab. */
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
  const activeRouteName = state.routes[state.index]?.name;

  const selectedIndex = useSharedValue(0);
  const glowX = useSharedValue(0);
  const islandWidthSV = useSharedValue(0);

  const lastPrimaryIndex = useRef(0);

  const rawVisual = visualIndexForRoute(activeRouteName);
  const displayIndex = rawVisual >= 0 ? rawVisual : lastPrimaryIndex.current;

  useEffect(() => {
    if (rawVisual >= 0) lastPrimaryIndex.current = rawVisual;
  }, [rawVisual]);

  useEffect(() => {
    selectedIndex.value = withSpring(displayIndex, SPRING_CFG);
    glowX.value = withSpring(displayIndex, SPRING_CFG);
  }, [displayIndex]);

  const onIslandLayout = useCallback((e: LayoutChangeEvent) => {
    islandWidthSV.value = e.nativeEvent.layout.width;
  }, [islandWidthSV]);

  const glowStyle = useAnimatedStyle(() => {
    const w = islandWidthSV.value;
    if (w < 8) return { opacity: 0 };
    const segW = w / 4;
    const cx = interpolate(
      glowX.value,
      [0, 1, 2, 3],
      [
        segW * 0.5,
        segW * 1.5,
        segW * 2.5,
        segW * 3.5,
      ],
      Extrapolation.CLAMP,
    );
    const leftEdge = cx - GLOW_POOL_W / 2;
    return {
      opacity: 0.18,
      transform: [{ translateX: leftEdge }],
    };
  });

  const glowColorStyle = useAnimatedStyle(() => {
    const c = TAB_CONFIG.map((t) => t.color);
    const bg = interpolateColor(glowX.value, [0, 1, 2, 3], c);
    return { backgroundColor: bg };
  });

  return (
    <View
      style={[styles.wrapper, { paddingBottom: insets.bottom + ISLAND_MARGIN_BOTTOM }]}
      pointerEvents="box-none"
    >
      <View style={styles.island} onLayout={onIslandLayout}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.androidBlur]} />
        )}

        <View style={styles.topHighlight} pointerEvents="none" />

        <Animated.View
          style={[styles.glowPool, glowColorStyle, glowStyle]}
          pointerEvents="none"
        />

        <View style={styles.row}>
          {TAB_CONFIG.map((tab, index) => {
            const route = state.routes.find((r) => r.name === tab.key);
            if (!route) return null;

            const isFocused = displayIndex === index;

            return (
              <AkhtarTabItem
                key={tab.key}
                tab={tab}
                index={index}
                isFocused={isFocused}
                selectedIndex={selectedIndex}
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
  index: number;
  isFocused: boolean;
  selectedIndex: SharedValue<number>;
  labelKey: `main.${TabKey}`;
  onPress: () => void;
}

function AkhtarTabItem({
  tab,
  index,
  isFocused,
  selectedIndex,
  labelKey,
  onPress,
}: TabItemProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const label = t(labelKey);
  const appLang = i18n.language.startsWith("fa") ? "fa" : "en";
  const Icon = tab.Icon;

  const containerStyle = useAnimatedStyle(() => {
    const flex = interpolate(
      selectedIndex.value,
      [index - 1, index, index + 1],
      [INACTIVE_FLEX, ACTIVE_FLEX, INACTIVE_FLEX],
      Extrapolation.CLAMP,
    );
    return { flex };
  });

  const iconStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      selectedIndex.value,
      [index - 0.5, index, index + 0.5],
      [0.88, 1.08, 0.88],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }] };
  });

  const labelStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      selectedIndex.value,
      [index - 0.4, index, index + 0.4],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    const translateX = interpolate(
      progress,
      [0, 1],
      [isRTL ? -6 : 6, 0],
    );
    const maxWidth = interpolate(progress, [0, 1], [0, 160]);
    return {
      opacity: progress,
      transform: [{ translateX }],
      maxWidth,
      overflow: "hidden" as const,
    };
  });

  return (
    <Animated.View style={[styles.tabItem, containerStyle]}>
      <Pressable
        onPress={onPress}
        style={styles.tabPressable}
        hitSlop={6}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: isFocused }}
      >
        <View style={[styles.tabInner, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Animated.View style={iconStyle}>
            <Icon active={isFocused} color={tab.color} size={22} />
          </Animated.View>
          <Animated.Text
            style={[
              styles.label,
              {
                color: tab.color,
                fontFamily:
                  appLang === "fa" ? "Vazirmatn_500Medium" : "DMSans_500Medium",
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
  wrapper: {
    alignItems: "center",
    width: "100%",
    pointerEvents: "box-none",
  },
  island: {
    width: "80%",
    height: ISLAND_H,
    borderRadius: ISLAND_H / 2,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(10,10,28,0.75)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 20,
  },
  androidBlur: {
    backgroundColor: "rgba(8,8,24,0.88)",
  },
  topHighlight: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 1,
  },
  glowPool: {
    position: "absolute",
    top: 6,
    left: 0,
    width: GLOW_POOL_W,
    height: 50,
    borderRadius: 40,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  tabItem: {
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  tabPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    height: "100%",
    minWidth: 0,
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    maxWidth: "100%",
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
});
