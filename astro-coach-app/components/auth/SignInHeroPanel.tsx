import { Image } from "expo-image";
import type { FC } from "react";
import { useEffect } from "react";
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

type Props = {
  theme: AppTheme;
  /** Tighter layout when stacked above/below the form on narrow screens */
  compact?: boolean;
};

/**
 * Decorative right panel: rotating orbit rings behind a floating hero image.
 */
export const SignInHeroPanel: FC<Props> = ({ theme, compact }) => {
  const { width } = useWindowDimensions();
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

  const base = compact ? Math.min(width * 0.55, 240) : Math.min(width * 0.35, 320);
  const ringOuter = base * 1.35;
  const ringMid = base * 1.12;

  return (
    <View className="flex-1 items-center justify-center overflow-hidden" style={{ minHeight: compact ? 280 : 420 }}>
      <View className="items-center justify-center" style={{ width: ringOuter * 1.4, height: ringOuter * 1.4 }}>
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
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: base * 0.92,
            height: base * 0.92,
            borderRadius: (base * 0.92) / 2,
            borderWidth: 1,
            borderColor: theme.colors.outline,
            opacity: 0.5,
          }}
        />
        <Animated.View style={[imageFloatStyle, { zIndex: 2, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 }]}>
          <Image
            source={require("@/assets/splash-icon.png")}
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
