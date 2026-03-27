import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { FC } from "react";
import { useEffect, useMemo } from "react";
import { Platform, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
/** Gold accent for orbit rings (celestial sign-in art direction). */
const GOLD_RING = "rgba(212, 175, 55, 0.45)";
const GOLD_RING_SOFT = "rgba(212, 175, 55, 0.22)";

/** Web: `public/assets/sign-in-hero.png` → `/assets/sign-in-hero.png`. Override with `EXPO_PUBLIC_SIGN_IN_HERO_URL`. Native: bundled `assets/sign-in-hero.png`. */
const WEB_HERO_PATH = "/assets/sign-in-hero.png";

function signInHeroSource(): number | { uri: string } {
  if (Platform.OS === "web") {
    const custom = process.env.EXPO_PUBLIC_SIGN_IN_HERO_URL?.trim();
    return { uri: custom && custom.length > 0 ? custom : WEB_HERO_PATH };
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/assets/sign-in-hero.png");
}

type Props = {
  /** Tighter layout when stacked above/below the form on narrow screens */
  compact?: boolean;
};

/**
 * Decorative right panel: rotating orbit rings behind a floating hero image.
 */
export const SignInHeroPanel: FC<Props> = ({ compact }) => {
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

  const base = compact ? Math.min(width * 0.55, 260) : Math.min(width * 0.36, 420);
  const ringOuter = base * 1.35;
  const ringMid = base * 1.12;

  return (
    <View className="flex-1 items-center justify-center overflow-hidden" style={{ minHeight: compact ? 280 : 420 }}>
      <View className="items-center justify-center" style={{ width: ringOuter * 1.4, height: ringOuter * 1.4, position: "relative" }}>
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
              borderColor: GOLD_RING_SOFT,
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
              borderColor: GOLD_RING,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: base * 0.92,
            height: base * 0.92,
            borderRadius: (base * 0.92) / 2,
            borderWidth: 1,
            borderColor: GOLD_RING_SOFT,
            opacity: 0.55,
          }}
        />
        <Animated.View style={[imageFloatStyle, { zIndex: 2, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 }]}>
          <Image
            source={heroSource}
            style={{
              width: base,
              height: base,
              borderRadius: base / 2,
            }}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
        <View
          pointerEvents="none"
          style={{ position: "absolute", bottom: compact ? 8 : 20, right: compact ? 8 : 28, opacity: 0.85 }}
        >
          <Ionicons name="sparkles" size={compact ? 18 : 24} color="#D4AF37" />
        </View>
      </View>
    </View>
  );
};
