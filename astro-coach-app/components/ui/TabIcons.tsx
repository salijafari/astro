/**
 * Custom animated tab bar icons for Akhtar.
 * Each icon accepts `focused` (boolean) and optional `size` (number, default 26).
 * Active: signature color + gradient + glow + spring scale animation.
 * Inactive: muted lavender-gray #8B82A3, no glow.
 *
 * Gradient IDs are globally namespaced — do NOT change them.
 * Animation uses react-native-reanimated exclusively.
 */

import React, { useEffect } from "react";
import Svg, {
  Circle,
  Path,
  Ellipse,
  G,
  Defs,
  RadialGradient,
  Stop,
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export interface TabIconProps {
  focused: boolean;
  size?: number;
}

const INACTIVE = "#8B82A3";

const SPRING = {
  damping: 12,
  stiffness: 180,
  mass: 0.8,
};

// Wrapper that animates scale + opacity on focus change
function AnimatedIconWrapper({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(focused ? 1 : 0.7);

  useEffect(() => {
    if (focused) {
      // Pop on activation
      scale.value = withSequence(
        withSpring(1.22, SPRING),
        withSpring(1.0, SPRING)
      );
      opacity.value = withTiming(1, { duration: 180 });
    } else {
      scale.value = withSpring(1.0, SPRING);
      opacity.value = withTiming(0.7, { duration: 180 });
    }
  }, [focused]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={animStyle}>{children}</Animated.View>;
}

// ─────────────────────────────────────────────
// 1. HOME — The Spark
// A four-pointed luminous star in soft gold.
// ─────────────────────────────────────────────
export const HomeIcon: React.FC<TabIconProps> = ({ focused, size = 26 }) => (
  <AnimatedIconWrapper focused={focused}>
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <RadialGradient id="homeGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#E8D4A8" stopOpacity="0.5" />
          <Stop offset="100%" stopColor="#E8D4A8" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="homeFill" cx="38%" cy="38%" r="70%">
          <Stop offset="0%" stopColor="#F5E6C3" />
          <Stop offset="100%" stopColor="#B8A07A" />
        </RadialGradient>
      </Defs>

      {focused && <Circle cx="12" cy="12" r="11" fill="url(#homeGlow)" />}

      <Path
        d="M 12 2 C 12 9, 15 12, 22 12 C 15 12, 12 15, 12 22 C 12 15, 9 12, 2 12 C 9 12, 12 9, 12 2 Z"
        fill={focused ? "url(#homeFill)" : INACTIVE}
      />
    </Svg>
  </AnimatedIconWrapper>
);

// ─────────────────────────────────────────────
// 2. TRANSITS — The Flow
// A deep blue planet with a tilted elliptical orbital ring.
// ─────────────────────────────────────────────
export const TransitsIcon: React.FC<TabIconProps> = ({ focused, size = 26 }) => (
  <AnimatedIconWrapper focused={focused}>
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <RadialGradient id="transitsGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#4A5FBF" stopOpacity="0.5" />
          <Stop offset="100%" stopColor="#4A5FBF" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="transitsFill" cx="35%" cy="35%" r="70%">
          <Stop offset="0%" stopColor="#8BA3DC" />
          <Stop offset="100%" stopColor="#2E3E82" />
        </RadialGradient>
      </Defs>

      {focused && <Circle cx="12" cy="12" r="11" fill="url(#transitsGlow)" />}

      {/* Orbital ring tilted ~18° */}
      <G originX="12" originY="12" rotation="-18">
        <Ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="3.5"
          fill="none"
          stroke={focused ? "#A8BAE0" : INACTIVE}
          strokeWidth={focused ? 1.2 : 1.1}
          strokeOpacity={focused ? 0.85 : 0.75}
        />
      </G>

      {/* Planet body */}
      <Circle cx="12" cy="12" r="5" fill={focused ? "url(#transitsFill)" : INACTIVE} />

      {/* Highlight */}
      {focused && (
        <Circle cx="10.3" cy="10.3" r="1.3" fill="#D4DFFA" opacity={0.5} />
      )}
    </Svg>
  </AnimatedIconWrapper>
);

// ─────────────────────────────────────────────
// 3. NATAL CHART — The Core
// A violet orb cradled within a 270° unclosed cosmic arc.
// ─────────────────────────────────────────────
export const NatalChartIcon: React.FC<TabIconProps> = ({ focused, size = 26 }) => (
  <AnimatedIconWrapper focused={focused}>
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <RadialGradient id="natalGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#8B5BA8" stopOpacity="0.5" />
          <Stop offset="100%" stopColor="#8B5BA8" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="natalFill" cx="38%" cy="38%" r="70%">
          <Stop offset="0%" stopColor="#D4B8E8" />
          <Stop offset="100%" stopColor="#5A3D78" />
        </RadialGradient>
      </Defs>

      {focused && <Circle cx="12" cy="12" r="11" fill="url(#natalGlow)" />}

      {/* Cosmic arc — opens at top */}
      <Path
        d="M 15.5 4.5 A 8 8 0 1 1 8.5 4.5"
        fill="none"
        stroke={focused ? "#C4A8D8" : INACTIVE}
        strokeWidth={focused ? 1.2 : 1.1}
        strokeOpacity={focused ? 0.9 : 0.75}
        strokeLinecap="round"
      />

      {/* The orb */}
      <Circle cx="12" cy="13" r="5" fill={focused ? "url(#natalFill)" : INACTIVE} />

      {/* Inner highlight */}
      {focused && (
        <Circle cx="10.2" cy="11.2" r="1.4" fill="#F0D8FF" opacity={0.55} />
      )}
    </Svg>
  </AnimatedIconWrapper>
);

// ─────────────────────────────────────────────
// 4. PEOPLE — The Constellation
// Two teal nodes linked by a curved thread + tiny third star.
// ─────────────────────────────────────────────
export const PeopleIcon: React.FC<TabIconProps> = ({ focused, size = 26 }) => (
  <AnimatedIconWrapper focused={focused}>
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <RadialGradient id="peopleGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#3D7E8A" stopOpacity="0.5" />
          <Stop offset="100%" stopColor="#3D7E8A" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="peopleFill" cx="40%" cy="40%" r="70%">
          <Stop offset="0%" stopColor="#9ED0D8" />
          <Stop offset="100%" stopColor="#255660" />
        </RadialGradient>
      </Defs>

      {focused && <Circle cx="12" cy="12" r="11" fill="url(#peopleGlow)" />}

      {/* Curved thread between nodes — drawn before nodes so nodes sit on top */}
      <Path
        d="M 7 8 Q 12 16 17 10"
        fill="none"
        stroke={focused ? "#A8D4DC" : INACTIVE}
        strokeWidth={1}
        strokeOpacity={focused ? 0.7 : 0.6}
        strokeLinecap="round"
      />

      {/* Tiny third star */}
      <Circle
        cx="12"
        cy="18"
        r="0.9"
        fill={focused ? "#C4E4EC" : INACTIVE}
        opacity={focused ? 0.8 : 1}
      />

      {/* Faint lines to third star — active only */}
      {focused && (
        <>
          <Path
            d="M 7 9 L 12 17.5"
            stroke="#A8D4DC"
            strokeWidth="0.5"
            strokeOpacity="0.35"
            strokeLinecap="round"
          />
          <Path
            d="M 17 11 L 12.5 17.5"
            stroke="#A8D4DC"
            strokeWidth="0.5"
            strokeOpacity="0.35"
            strokeLinecap="round"
          />
        </>
      )}

      {/* Two primary nodes — drawn last */}
      <Circle cx="7" cy="8" r="3" fill={focused ? "url(#peopleFill)" : INACTIVE} />
      <Circle cx="17" cy="10" r="3" fill={focused ? "url(#peopleFill)" : INACTIVE} />
    </Svg>
  </AnimatedIconWrapper>
);
