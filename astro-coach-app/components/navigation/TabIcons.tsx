/**
 * Custom SVG icons for Akhtar's island tab bar.
 * Active: signature color + glow; inactive: muted white 35%.
 * No infinite animations — one-shot activation handled by the tab bar container.
 */

import React from "react";
import Svg, {
  Circle,
  Path,
  Ellipse,
  G,
  Defs,
  RadialGradient,
  Stop,
} from "react-native-svg";

const INACTIVE = "rgba(255,255,255,0.35)";

export interface IslandIconProps {
  active: boolean;
  color: string;
  size?: number;
}

export function HomeSparkIcon({ active, color, size = 24 }: IslandIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <RadialGradient id="homeGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {active && <Circle cx="12" cy="12" r="11" fill="url(#homeGlow)" />}
      <Path
        d="M 12 2 C 12 9, 15 12, 22 12 C 15 12, 12 15, 12 22 C 12 15, 9 12, 2 12 C 9 12, 12 9, 12 2 Z"
        fill={active ? color : INACTIVE}
        opacity={active ? 1 : 0.7}
      />
    </Svg>
  );
}

export function TransitPlanetIcon({ active, color, size = 24 }: IslandIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <RadialGradient id="transitsGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="transitsFill" cx="35%" cy="35%" r="70%">
          <Stop offset="0%" stopColor="#8BA3DC" />
          <Stop offset="100%" stopColor="#2E3E82" />
        </RadialGradient>
      </Defs>
      {active && <Circle cx="12" cy="12" r="11" fill="url(#transitsGlow)" />}
      <G originX="12" originY="12" rotation="-18">
        <Ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="3.5"
          fill="none"
          stroke={active ? color : INACTIVE}
          strokeWidth={active ? 1.2 : 1.0}
          strokeOpacity={active ? 0.85 : 0.6}
        />
      </G>
      <Circle
        cx="12"
        cy="12"
        r="5"
        fill={active ? "url(#transitsFill)" : INACTIVE}
        opacity={active ? 1 : 0.7}
      />
      {active && (
        <Circle cx="10.3" cy="10.3" r="1.2" fill="#D4DFFA" opacity={0.5} />
      )}
    </Svg>
  );
}

export function IdentityOrbIcon({ active, color, size = 24 }: IslandIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <RadialGradient id="natalGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="natalFill" cx="38%" cy="38%" r="70%">
          <Stop offset="0%" stopColor="#D4B8E8" />
          <Stop offset="100%" stopColor="#5A3D78" />
        </RadialGradient>
      </Defs>
      {active && <Circle cx="12" cy="12" r="11" fill="url(#natalGlow)" />}
      <Path
        d="M 15.5 4.5 A 8 8 0 1 1 8.5 4.5"
        fill="none"
        stroke={active ? color : INACTIVE}
        strokeWidth={active ? 1.2 : 1.0}
        strokeOpacity={active ? 0.9 : 0.6}
        strokeLinecap="round"
      />
      <Circle
        cx="12"
        cy="13"
        r="5"
        fill={active ? "url(#natalFill)" : INACTIVE}
        opacity={active ? 1 : 0.7}
      />
      {active && (
        <Circle cx="10.2" cy="11.2" r="1.3" fill="#F0D8FF" opacity={0.5} />
      )}
    </Svg>
  );
}

export function PeopleNodesIcon({ active, color, size = 24 }: IslandIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <RadialGradient id="peopleGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="peopleFill" cx="40%" cy="40%" r="70%">
          <Stop offset="0%" stopColor="#9ED0D8" />
          <Stop offset="100%" stopColor="#255660" />
        </RadialGradient>
      </Defs>
      {active && <Circle cx="12" cy="12" r="11" fill="url(#peopleGlow)" />}
      <Path
        d="M 7 8 Q 12 16 17 10"
        fill="none"
        stroke={active ? color : INACTIVE}
        strokeWidth={1}
        strokeOpacity={active ? 0.75 : 0.55}
        strokeLinecap="round"
      />
      <Circle
        cx="12"
        cy="18"
        r="0.9"
        fill={active ? "#C4E4EC" : INACTIVE}
        opacity={active ? 0.8 : 0.5}
      />
      {active && (
        <>
          <Path
            d="M 7 9 L 12 17.5"
            stroke={color}
            strokeWidth="0.5"
            strokeOpacity="0.3"
            strokeLinecap="round"
          />
          <Path
            d="M 17 11 L 12.5 17.5"
            stroke={color}
            strokeWidth="0.5"
            strokeOpacity="0.3"
            strokeLinecap="round"
          />
        </>
      )}
      <Circle
        cx="7"
        cy="8"
        r="3"
        fill={active ? "url(#peopleFill)" : INACTIVE}
        opacity={active ? 1 : 0.7}
      />
      <Circle
        cx="17"
        cy="10"
        r="3"
        fill={active ? "url(#peopleFill)" : INACTIVE}
        opacity={active ? 1 : 0.7}
      />
    </Svg>
  );
}
