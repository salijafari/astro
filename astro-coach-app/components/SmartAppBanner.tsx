import { FONT, FONT_SIZE, LINE_HEIGHT, RADIUS, SPACE } from "@/constants";
import { isPersian } from "@/lib/i18n";
import { readPersistedValue, writePersistedValue } from "@/lib/storage";
import { useThemeColors } from "@/lib/themeColors";
import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

/** PWA smart-banner accent (amber) — CTA button fill. */
const SMART_BANNER_AMBER = "#c4a882";

const ANDROID_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=today.akhtar.astrocoach";

const STORAGE_CLOSED_AT = "akhtar.smartBanner.closedAt";

const BANNER_HEIGHT = 68;

const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

type SmartAppBannerProps = {
  onHeightChange?: (height: number) => void;
};

/**
 * Dismissible install banner for Akhtar PWA on supported mobile browsers (web only).
 * Hides for 24h after dismiss or CTA; re-shows on later visits.
 */
export const SmartAppBanner = ({ onHeightChange }: SmartAppBannerProps) => {
  const { t, i18n } = useTranslation();
  const tc = useThemeColors();
  const isRTL = isPersian(i18n.language);
  const [visible, setVisible] = useState(false);
  const slideY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissInFlight = useRef(false);

  const runDismissAnimation = useCallback(
    (after: () => void | Promise<void>) => {
      if (dismissInFlight.current) return;
      dismissInFlight.current = true;
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: -BANNER_HEIGHT,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        dismissInFlight.current = false;
        if (finished) void after();
      });
    },
    [opacity, slideY],
  );

  const handleDismiss = useCallback(() => {
    runDismissAnimation(async () => {
      await writePersistedValue(STORAGE_CLOSED_AT, new Date().toISOString());
      setVisible(false);
      onHeightChange?.(0);
    });
  }, [onHeightChange, runDismissAnimation]);

  const handleOpenStore = useCallback(() => {
    runDismissAnimation(async () => {
      await writePersistedValue(STORAGE_CLOSED_AT, new Date().toISOString());
      if (typeof globalThis.window !== "undefined") {
        globalThis.window.open(ANDROID_PLAY_STORE_URL, "_blank", "noopener,noreferrer");
      }
      setVisible(false);
      onHeightChange?.(0);
    });
  }, [onHeightChange, runDismissAnimation]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      onHeightChange?.(0);
      return;
    }

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    if (/iPhone/i.test(ua)) {
      onHeightChange?.(0);
      return;
    }
    if (!/Android/i.test(ua) || !/Mobile/i.test(ua)) {
      onHeightChange?.(0);
      return;
    }

    let cancelled = false;

    void (async () => {
      const closedAtRaw = await readPersistedValue(STORAGE_CLOSED_AT);
      if (cancelled) return;
      if (closedAtRaw) {
        const closedMs = Date.parse(closedAtRaw);
        if (!Number.isNaN(closedMs) && Date.now() - closedMs < TWENTY_FOUR_H_MS) {
          onHeightChange?.(0);
          return;
        }
      }

      slideY.setValue(-BANNER_HEIGHT);
      opacity.setValue(0);
      setVisible(true);
      onHeightChange?.(BANNER_HEIGHT);

      Animated.parallel([
        Animated.timing(slideY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    })();

    return () => {
      cancelled = true;
    };
  }, [onHeightChange, opacity, slideY]);

  if (Platform.OS !== "web" || !visible) {
    return null;
  }

  const bg = tc.isDark ? "rgba(15,13,35,0.97)" : "rgba(255,255,255,0.97)";
  const borderBottom = tc.isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.09)";

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.banner,
        {
          backgroundColor: bg,
          borderBottomColor: borderBottom,
          opacity,
          transform: [{ translateY: slideY }],
        },
      ]}
    >
      <View style={[styles.row, { flexDirection: "row", direction: "ltr" }]}>
        <View style={[styles.iconRing, { backgroundColor: "#ffffff", overflow: "hidden" }]}>
          <Image
            source={require("@/assets/icon.png")}
            style={{ width: 40, height: 40 }}
            contentFit="cover"
          />
        </View>

        <View style={[styles.copyBlock, { marginStart: SPACE[3] }]}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: FONT.sansMedium,
              fontSize: FONT_SIZE.body,
              lineHeight: FONT_SIZE.body * LINE_HEIGHT.snug,
              color: tc.textPrimary,
              textAlign: isRTL ? "right" : "left",
              writingDirection: isRTL ? "rtl" : "ltr",
            }}
          >
            Akhtar Horoscope
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: FONT.sans,
              fontSize: FONT_SIZE.metadata,
              lineHeight: FONT_SIZE.metadata * LINE_HEIGHT.ui,
              color: tc.textSecondary,
              marginTop: 2,
              textAlign: isRTL ? "right" : "left",
              writingDirection: isRTL ? "rtl" : "ltr",
            }}
          >
            {t("smartBanner.subtitle")}
          </Text>
        </View>

        <View style={{ width: SPACE[4] }} />

        <Pressable
          onPress={handleOpenStore}
          accessibilityRole="button"
          accessibilityLabel={t("smartBanner.cta")}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: SMART_BANNER_AMBER, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text
            numberOfLines={1}
            style={{
              fontFamily: FONT.sansMedium,
              fontSize: FONT_SIZE.metadata,
              lineHeight: FONT_SIZE.metadata * LINE_HEIGHT.ui,
              color: "rgba(15,13,35,0.95)",
              textAlign: "center",
            }}
          >
            {t("smartBanner.cta")}
          </Text>
        </Pressable>

        <View style={{ width: SPACE[3] }} />

        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel={t("smartBanner.dismiss")}
          hitSlop={8}
          style={({ pressed }) => [styles.dismissHit, { opacity: pressed ? 0.65 : 1 }]}
        >
          <Text style={{ color: tc.textTertiary, fontSize: 22, lineHeight: 24 }}>×</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  /** RN typings omit `position: fixed`; react-native-web applies it on web. */
  banner: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    height: BANNER_HEIGHT,
    paddingHorizontal: SPACE[4],
    borderBottomWidth: 0.5,
  } as unknown as ViewStyle,
  row: {
    alignItems: "center",
    height: BANNER_HEIGHT,
  },
  iconRing: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  copyBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  cta: {
    paddingHorizontal: SPACE[3],
    paddingVertical: SPACE[2],
    borderRadius: RADIUS.md,
    flexShrink: 1,
    maxWidth: "48%",
  },
  dismissHit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
