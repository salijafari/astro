import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, type FC, type ReactNode } from "react";
import type { ColorSchemeName, StyleProp, ViewStyle } from "react-native";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeSafeAreaViewProps } from "react-native-safe-area-context";
import { AURORA_BASE_DARK, AURORA_BASE_LIGHT, auroraCanvasBackground } from "@/lib/auroraPalette";
import { useTheme } from "@/providers/ThemeProvider";

export {
  AURORA_BASE_DARK,
  AURORA_BASE_LIGHT,
  auroraCanvasBackground,
  auroraRootBackground,
} from "@/lib/auroraPalette";

/** @deprecated Use `AURORA_BASE_DARK` or `auroraCanvasBackground`. */
export const AURORA_BASE = AURORA_BASE_DARK;

// ─── Mesh gradient colors ────────────────────────────────────────────────────

const DARK_MESH_COLORS = [
  { r: 13, g: 59, b: 46 }, // deep emerald
  { r: 15, g: 42, b: 74 }, // deep cobalt
  { r: 45, g: 16, b: 71 }, // deep violet
  { r: 8, g: 61, b: 42 }, // deep teal
] as const;

const LIGHT_MESH_COLORS = [
  { r: 157, g: 232, b: 204 }, // mint
  { r: 168, g: 200, b: 248 }, // sky blue
  { r: 212, g: 184, b: 248 }, // lavender
  { r: 142, g: 232, b: 216 }, // teal
] as const;

// ─── Native fallback colors (LinearGradient) ─────────────────────────────────

const NATIVE_DARK = {
  base: AURORA_BASE_DARK,
  aurora1: ["#0d3b2e", AURORA_BASE_DARK] as const,
  aurora2: ["#0f2a4a", AURORA_BASE_DARK] as const,
  aurora3: ["#2d1047", AURORA_BASE_DARK] as const,
  bottomFade: "rgba(6,8,15,0.65)",
};

const NATIVE_LIGHT = {
  base: AURORA_BASE_LIGHT,
  aurora1: ["#9de8cc", AURORA_BASE_LIGHT] as const,
  aurora2: ["#a8c8f8", AURORA_BASE_LIGHT] as const,
  aurora3: ["#d4b8f8", AURORA_BASE_LIGHT] as const,
  bottomFade: "rgba(232,237,245,0.55)",
};

// ─── Web mesh gradient canvas ─────────────────────────────────────────────────

interface MeshGradientCanvasProps {
  isDark: boolean;
}

const MeshGradientCanvas: FC<MeshGradientCanvasProps> = ({ isDark }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = isDark ? DARK_MESH_COLORS : LIGHT_MESH_COLORS;

    const draw = (timestamp: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const t = timestamp * 0.0001;

      const positions = [
        {
          x: 0.5 + Math.sin(t * 1.1) * 0.35,
          y: 0.5 + Math.cos(t * 0.9) * 0.35,
          color: colors[0]!,
        },
        {
          x: 0.5 + Math.sin(t * 0.8 + 1.5) * 0.4,
          y: 0.5 + Math.cos(t * 1.2 + 1.0) * 0.3,
          color: colors[1]!,
        },
        {
          x: 0.5 + Math.sin(t * 1.3 + 3.0) * 0.3,
          y: 0.5 + Math.cos(t * 0.7 + 2.0) * 0.4,
          color: colors[2]!,
        },
        {
          x: 0.5 + Math.sin(t * 0.6 + 4.5) * 0.35,
          y: 0.5 + Math.cos(t * 1.4 + 0.5) * 0.35,
          color: colors[3]!,
        },
      ];

      const scale = 0.12;
      const sw = Math.floor(w * scale);
      const sh = Math.floor(h * scale);
      const imageData = ctx.createImageData(sw, sh);

      for (let py = 0; py < sh; py++) {
        for (let px = 0; px < sw; px++) {
          const nx = px / sw;
          const ny = py / sh;

          let totalWeight = 0;
          let r = 0,
            g = 0,
            b = 0;

          for (const p of positions) {
            const dx = nx - p.x;
            const dy = ny - p.y;
            const weight = 1 / (dx * dx + dy * dy + 0.015);
            totalWeight += weight;
            r += p.color.r * weight;
            g += p.color.g * weight;
            b += p.color.b * weight;
          }

          r = Math.min(255, Math.round(r / totalWeight));
          g = Math.min(255, Math.round(g / totalWeight));
          b = Math.min(255, Math.round(b / totalWeight));

          const i = (py * sw + px) * 4;
          imageData.data[i] = r;
          imageData.data[i + 1] = g;
          imageData.data[i + 2] = b;
          imageData.data[i + 3] = 255;
        }
      }

      const offscreen = document.createElement("canvas");
      offscreen.width = sw;
      offscreen.height = sh;
      offscreen.getContext("2d")!.putImageData(imageData, 0, 0);

      ctx.clearRect(0, 0, w, h);
      ctx.filter = `blur(${Math.floor(w * 0.05)}px)`;
      ctx.drawImage(offscreen, 0, 0, w, h);
      ctx.filter = "none";

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
};

// ─── Native fallback (LinearGradient aurora) ──────────────────────────────────

interface NativeFallbackProps {
  isDark: boolean;
}

const NativeFallback: FC<NativeFallbackProps> = ({ isDark }) => {
  const palette = isDark ? NATIVE_DARK : NATIVE_LIGHT;
  return (
    <View
      style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.base }]}
      pointerEvents="none"
    >
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient
          colors={[palette.aurora1[0], palette.aurora1[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 0.65 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      <View style={[StyleSheet.absoluteFillObject, { opacity: 0.7 }]} pointerEvents="none">
        <LinearGradient
          colors={[palette.aurora2[0], palette.aurora2[1]]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 1, y: 0.65 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      <View style={[StyleSheet.absoluteFillObject, { opacity: 0.5 }]} pointerEvents="none">
        <LinearGradient
          colors={[palette.aurora3[0], palette.aurora3[1]]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 0.65 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient
          colors={["transparent", palette.bottomFade]}
          start={{ x: 0.5, y: 0.25 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
    </View>
  );
};

// ─── Public component ─────────────────────────────────────────────────────────

export type CosmicBackgroundProps = {
  colorSchemeOverride?: ColorSchemeName | null;
  /** kept for API compatibility — no longer changes behavior */
  subtleDrift?: boolean;
};

export const CosmicBackground: FC<CosmicBackgroundProps> = ({ colorSchemeOverride }) => {
  const { isDark: prefIsDark } = useTheme();
  const isDark =
    colorSchemeOverride === "dark" ? true : colorSchemeOverride === "light" ? false : prefIsDark;

  if (Platform.OS === "web") {
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <MeshGradientCanvas isDark={isDark} />
      </View>
    );
  }

  return <NativeFallback isDark={isDark} />;
};

// ─── AuroraSafeArea ───────────────────────────────────────────────────────────

export type AuroraSafeAreaProps = {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  edges?: NativeSafeAreaViewProps["edges"];
  colorSchemeOverride?: ColorSchemeName | null;
};

export const AuroraSafeArea: FC<AuroraSafeAreaProps> = ({
  children,
  className,
  style,
  edges,
  colorSchemeOverride,
}) => {
  const { isDark: prefIsDark } = useTheme();
  const isDark =
    colorSchemeOverride === "dark" ? true : colorSchemeOverride === "light" ? false : prefIsDark;
  const rootFill = auroraCanvasBackground(isDark);
  return (
    <SafeAreaView
      className={className}
      edges={edges}
      style={[{ flex: 1, backgroundColor: rootFill }, style]}
    >
      <CosmicBackground colorSchemeOverride={colorSchemeOverride} />
      {children}
    </SafeAreaView>
  );
};
