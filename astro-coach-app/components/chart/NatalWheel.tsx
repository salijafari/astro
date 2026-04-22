import React from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";

import { BG, BORDER, FONT_SIZE, PLANET_PALETTE, TEXT } from "@/constants";
import type { PlanetName } from "@/constants/designTokens";
import type { PlanetRow } from "@/types/chart";

const GLYPHS: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  "North Node": "☊",
};

const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"] as const;

function strokeForPlanet(planet: string): string {
  if (planet in PLANET_PALETTE) return PLANET_PALETTE[planet as PlanetName].mid;
  return TEXT.secondary;
}

function fillForPlanet(planet: string): string {
  if (planet in PLANET_PALETTE) return PLANET_PALETTE[planet as PlanetName].mid;
  return TEXT.secondary;
}

type Props = {
  planets: PlanetRow[];
  ascendantLongitude: number | null;
  midheavenLongitude: number | null;
  size?: number;
};

function lonToAngle(lon: number, ascLon: number): number {
  const relative = (lon - ascLon + 360) % 360;
  return (180 - relative + 360) % 360;
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/**
 * Natal chart wheel (SVG). Colors and spacing use design tokens only.
 */
const NatalWheel: React.FC<Props> = ({
  planets,
  ascendantLongitude,
  midheavenLongitude,
  size = 300,
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - size * 0.03;
  const innerR = outerR * 0.72;
  const coreR = outerR * 0.42;
  const ascLon = ascendantLongitude ?? 0;

  const houseDivisions = Array.from({ length: 12 }, (_, i) => {
    const lon = (ascLon + i * 30) % 360;
    const angle = lonToAngle(lon, ascLon);
    const outer = polarToXY(cx, cy, outerR, angle);
    const inner = polarToXY(cx, cy, coreR, angle);
    return { outer, inner, i };
  });

  const signLabels = SIGN_GLYPHS.map((glyph, i) => {
    const lon = i * 30 + 15;
    const angle = lonToAngle(lon, ascLon);
    const labelR = (outerR + innerR) / 2 + size * 0.015;
    const pos = polarToXY(cx, cy, labelR, angle);
    return { glyph, pos };
  });

  const planetPositions = planets.map((p) => {
    const angle = lonToAngle(p.longitude, ascLon);
    const pos = polarToXY(cx, cy, innerR - size * 0.06, angle);
    return { ...p, pos };
  });

  const ascAngle = lonToAngle(ascLon, ascLon);
  const ascOuter = polarToXY(cx, cy, outerR, ascAngle);
  const ascInner = polarToXY(cx, cy, coreR, ascAngle);

  const mcAngle =
    midheavenLongitude != null ? lonToAngle(midheavenLongitude, ascLon) : null;
  const mcOuter = mcAngle != null ? polarToXY(cx, cy, outerR, mcAngle) : null;
  const mcInner = mcAngle != null ? polarToXY(cx, cy, coreR, mcAngle) : null;

  const dotR = size * 0.007;
  const planetDotR = size * 0.03;
  const labelFs = FONT_SIZE.metadata;
  const glyphFs = FONT_SIZE.metadata;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy} r={outerR} fill={BG.card} stroke={BORDER.default} strokeWidth={0.5} />
        <Circle cx={cx} cy={cy} r={innerR} fill={BG.elevated} stroke={BORDER.subtle} strokeWidth={0.5} />
        <Circle cx={cx} cy={cy} r={coreR} fill={BG.base} stroke={BORDER.subtle} strokeWidth={0.5} />

        {houseDivisions.map(({ outer, inner, i }) => (
          <Line
            key={`house-${i}`}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={BORDER.subtle}
            strokeWidth={0.5}
          />
        ))}

        {signLabels.map(({ glyph, pos }, i) => (
          <SvgText
            key={`sign-${i}`}
            x={pos.x}
            y={pos.y}
            fontSize={glyphFs}
            fill={TEXT.tertiary}
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {glyph}
          </SvgText>
        ))}

        <Line
          x1={ascInner.x}
          y1={ascInner.y}
          x2={ascOuter.x}
          y2={ascOuter.y}
          stroke={TEXT.secondary}
          strokeWidth={0.5}
        />
        <SvgText
          x={ascOuter.x}
          y={ascOuter.y}
          fontSize={labelFs}
          fill={TEXT.secondary}
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          ASC
        </SvgText>

        {mcOuter && mcInner && (
          <>
            <Line
              x1={mcInner.x}
              y1={mcInner.y}
              x2={mcOuter.x}
              y2={mcOuter.y}
              stroke={TEXT.tertiary}
              strokeWidth={0.5}
            />
            <SvgText
              x={mcOuter.x}
              y={mcOuter.y - size * 0.02}
              fontSize={labelFs}
              fill={TEXT.tertiary}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              MC
            </SvgText>
          </>
        )}

        {planetPositions.map((p) => (
          <G key={p.planet}>
            <Circle
              cx={p.pos.x}
              cy={p.pos.y}
              r={planetDotR}
              fill={BG.elevated}
              stroke={strokeForPlanet(p.planet)}
              strokeWidth={0.5}
            />
            <SvgText
              x={p.pos.x}
              y={p.pos.y}
              fontSize={glyphFs}
              fill={fillForPlanet(p.planet)}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {GLYPHS[p.planet] ?? "•"}
            </SvgText>
          </G>
        ))}

        <Circle cx={cx} cy={cy} r={dotR} fill={TEXT.muted} />
      </Svg>
    </View>
  );
};

export default NatalWheel;
