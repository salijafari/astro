import { Image } from "expo-image";
import type { FC } from "react";
import { useEffect, useMemo } from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { AppTheme } from "@/constants/theme";

/**
 * Default hero: Metro-bundled `assets/AskAnythingcard.png` (native + web).
 * Optional: `EXPO_PUBLIC_SIGN_IN_HERO_URL` for a full CDN URL.
 */
function signInHeroSource(): number | { uri: string } {
  const custom = process.env.EXPO_PUBLIC_SIGN_IN_HERO_URL?.trim();
  if (custom && custom.length > 0) {
    return { uri: custom };
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/assets/AskAnythingcard.png");
}

type Props = {
  theme: AppTheme;
  /** Tighter layout when stacked above/below the form on narrow screens */
  compact?: boolean;
  /** `banner`: mobile auth band; `decision`: smallest, one-screen welcome; `panel`: desktop split */
  layout?: "banner" | "decision" | "panel";
};

/**
 * Decorative right panel: rotating orbit rings behind a floating hero image.
 */
export const SignInHeroPanel: FC<Props> = ({ theme, compact, layout = "panel" }) => {
  const { width } = useWindowDimensions();
  const heroSource = useMemo(() => signInHeroSource(), []);
  const orbitSlow = useSharedValue(0);
  const orbitFast = useSharedValue(0);
  const floatY = useSharedValue(0);

  useEffect(() => {
    orbitSlow.value = withRepeat(
      withTiming(360, { duration: 72000, easing: Easing.linear }),
      -1,
      false,
    );
    orbitFast.value = withRepeat(
      withTiming(-360, { duration: 48000, easing: Easing.linear }),
      -1,
      false,
    );
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(10, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [floatY, orbitFast, orbitSlow]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbitSlow.value}deg` }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbitFast.value}deg` }],
  }));
  const imageFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const base =
    layout === "decision"
      ? Math.min(width * 0.3, 104)
      : layout === "banner"
        ? Math.min(width * 0.48, 188)
        : compact
          ? Math.min(width * 0.55, 240)
          : Math.min(width * 0.35, 320);
  const ringOuter =
    layout === "decision" ? base * 1.08 : layout === "banner" ? base * 1.14 : base * 1.35;
  const ringMid =
    layout === "decision" ? base * 1.02 : layout === "banner" ? base * 1.06 : base * 1.12;
  const ringStage =
    layout === "decision" ? ringOuter * 1.04 : layout === "banner" ? ringOuter * 1.08 : ringOuter * 1.4;

  const outerClassName =
    layout === "banner" || layout === "decision"
      ? "h-full w-full items-center justify-center overflow-visible"
      : "flex-1 items-center justify-center overflow-hidden";
  const outerStyle =
    layout === "banner" || layout === "decision" ? undefined : { minHeight: compact ? 280 : 420 };

  return (
    <View className={outerClassName} style={outerStyle}>
      <View className="items-center justify-center" style={{ width: ringStage, height: ringStage }}>
        <Animated.View
          pointerEvents="none"
          style={[
            ring1Style,
            {
              position: "absolute",
              width: ringOuter,
              height: ringOuter,
              borderRadius: ringOuter / 2,
              borderWidth: 1,
              borderColor: `${theme.colors.primary}55`,
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            ring2Style,
            {
              position: "absolute",
              width: ringMid,
              height: ringMid,
              borderRadius: ringMid / 2,
              borderWidth: 1,
              borderColor: `${theme.colors.secondary}55`,
            },
          ]}
        />
        <Animated.View style={[imageFloatStyle, { zIndex: 2 }]}>
          <Image
            source={heroSource}
            style={{
              width: base,
              height: base,
              borderRadius: base * 0.22,
            }}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      </View>
    </View>
  );
};
