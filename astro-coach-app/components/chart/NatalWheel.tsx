import React from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";

import { BG, FONT_SIZE, PLANET_PALETTE, TEXT } from "@/constants";
import type { PlanetName } from "@/constants/designTokens";
import type { AspectRow, PlanetRow } from "@/types/chart";

/** SVG aspect strokes — muted rgba tuned for readability on dark wheel (design tokens lack SVG-specific alphas). */
const ASPECT_LINE_COLOR: Record<string, string> = {
  conjunction: "rgba(212,195,163,0.35)",
  opposition: "rgba(180,100,100,0.30)",
  trine: "rgba(100,160,180,0.30)",
  square: "rgba(180,120,100,0.28)",
  sextile: "rgba(140,180,140,0.28)",
};

const SIGN_GLYPH_FILL = "rgba(255,255,255,0.85)";
const HOUSE_LINE_STROKE = "rgba(255,255,255,0.35)";
const INNER_RING_STROKE = "rgba(255,255,255,0.35)";
const OUTER_RING_STROKE = "rgba(255,255,255,0.45)";
const CORE_RING_STROKE = "rgba(255,255,255,0.25)";
const ASC_LINE_STROKE = "rgba(255,255,255,0.90)";
const ZODIAC_BAND_STROKE = "rgba(212,195,163,0.15)";

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
  aspects: AspectRow[];
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

function spreadPlanets(
  positions: Array<{ angle: number; [key: string]: unknown }>,
  minGap = 14,
): Array<{ angle: number; spreadAngle: number; [key: string]: unknown }> {
  const sorted = [...positions].sort((a, b) => a.angle - b.angle);
  const result = sorted.map((p) => ({ ...p, spreadAngle: p.angle }));

  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < result.length; i++) {
      const next = (i + 1) % result.length;
      let diff = result[next]!.spreadAngle - result[i]!.spreadAngle;
      if (diff < 0) diff += 360;
      if (diff < minGap && diff >= 0) {
        const push = (minGap - diff) / 2;
        result[i]!.spreadAngle = (result[i]!.spreadAngle - push + 360) % 360;
        result[next]!.spreadAngle = (result[next]!.spreadAngle + push) % 360;
      }
    }
  }
  return result as Array<{ angle: number; spreadAngle: number; [key: string]: unknown }>;
}

/**
 * Natal chart wheel (SVG). Planet positions use design tokens; SVG-specific rgba strokes use named constants above.
 */
const NatalWheel: React.FC<Props> = ({
  planets,
  aspects,
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

  const signLabelR = outerR - 10;
  const signLabels = SIGN_GLYPHS.map((glyph, i) => {
    const lon = i * 30 + 15;
    const angle = lonToAngle(lon, ascLon);
    const pos = polarToXY(cx, cy, signLabelR, angle);
    return { glyph, pos };
  });

  const rawWithAngle = planets.map((p) => {
    const angle = lonToAngle(p.longitude, ascLon);
    return { ...p, angle };
  });
  const spreadRows = spreadPlanets(rawWithAngle, 14);
  const planetRingR = innerR - size * 0.06;

  const planetPositions = spreadRows.map((row) => {
    const pos = polarToXY(cx, cy, planetRingR, row.spreadAngle);
    return { ...(row as PlanetRow & { angle: number; spreadAngle: number }), pos };
  });

  const angleByPlanet: Record<string, number> = {};
  for (const p of rawWithAngle) {
    angleByPlanet[p.planet] = p.angle;
  }

  const aspectLinesToDraw = [...aspects]
    .filter((a) => a.orb <= 4)
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 6);

  const aspectLineRadius = coreR * 0.88;

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
  const signGlyphFs = 13;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy} r={outerR} fill={BG.card} stroke={OUTER_RING_STROKE} strokeWidth={0.5} />

        <Circle
          cx={cx}
          cy={cy}
          r={outerR - 2}
          fill="none"
          stroke={ZODIAC_BAND_STROKE}
          strokeWidth={16}
        />

        <Circle cx={cx} cy={cy} r={innerR} fill={BG.elevated} stroke={INNER_RING_STROKE} strokeWidth={0.5} />
        <Circle cx={cx} cy={cy} r={coreR} fill={BG.base} stroke={CORE_RING_STROKE} strokeWidth={0.5} />

        {aspectLinesToDraw.map((asp, idx) => {
          const a1 = angleByPlanet[asp.body1];
          const a2 = angleByPlanet[asp.body2];
          if (a1 === undefined || a2 === undefined) return null;
          const p1 = polarToXY(cx, cy, aspectLineRadius, a1);
          const p2 = polarToXY(cx, cy, aspectLineRadius, a2);
          const stroke = ASPECT_LINE_COLOR[asp.type] ?? "rgba(255,255,255,0.2)";
          return (
            <Line
              key={`asp-${asp.body1}-${asp.body2}-${asp.type}-${idx}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={stroke}
              strokeWidth={0.5}
            />
          );
        })}

        {houseDivisions.map(({ outer, inner, i }) => (
          <Line
            key={`house-${i}`}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={HOUSE_LINE_STROKE}
            strokeWidth={0.6}
          />
        ))}

        {signLabels.map(({ glyph, pos }, i) => (
          <SvgText
            key={`sign-${i}`}
            x={pos.x}
            y={pos.y}
            fontSize={signGlyphFs}
            fill={SIGN_GLYPH_FILL}
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
          stroke={ASC_LINE_STROKE}
          strokeWidth={1.8}
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
              strokeWidth={1.2}
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
