import { useEffect, useRef } from "react";
import { Animated, Platform } from "react-native";

type Props = {
  color?: string;
  /** Alias for `color` (Ask Me Anything legacy prop). */
  cursorColor?: string;
};

/**
 * Blinking caret for in-progress assistant streams (matches AMA timing).
 */
export const StreamingCursor: React.FC<Props> = ({ color, cursorColor }) => {
  const resolved = color ?? cursorColor ?? "rgba(255,255,255,0.7)";
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width: 2,
        height: 16,
        backgroundColor: resolved,
        marginStart: 2,
        borderRadius: 1,
        opacity,
        alignSelf: "flex-end",
        marginBottom: 2,
      }}
    />
  );
};
