import { LinearGradient } from "expo-linear-gradient";
import { type FC, type ReactNode } from "react";
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

// ─── Web: CSS animated gradient ───────────────────────────────────────────────

interface CSSGradientProps {
  isDark: boolean;
  mantraMode?: boolean;
  practiceStillness?: boolean;
}

const CSSGradientBackground: FC<CSSGradientProps> = ({ isDark, mantraMode, practiceStillness }) => {
  const animSec = practiceStillness ? 99999 : mantraMode ? 110 : 22;
  const dim = practiceStillness ? 0.25 : mantraMode ? 0.18 : 0;
  const darkGradient = `
    linear-gradient(
      270deg,
      #0f0c29,
      #302b63,
      #24243e,
      #0d3b2e,
      #0f2a4a,
      #302b63,
      #0f0c29
    )
  `;

  const lightGradient = `
    linear-gradient(
      270deg,
      #e8edf5,
      #d4b8f8,
      #e8edf5,
      #9de8cc,
      #a8c8f8,
      #d4b8f8,
      #e8edf5
    )
  `;

  const darkOverlay = `
    radial-gradient(ellipse at 30% 40%, rgba(48,43,99,0.25), transparent 60%),
    radial-gradient(ellipse at 70% 70%, rgba(13,59,46,0.2), transparent 60%)
  `;

  const lightOverlay = `
    radial-gradient(ellipse at 30% 40%, rgba(212,184,248,0.3), transparent 60%),
    radial-gradient(ellipse at 70% 70%, rgba(157,232,204,0.25), transparent 60%)
  `;

  return (
    <>
      <style>{`
        @keyframes akhtarGradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .akhtar-bg {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: ${isDark ? darkGradient : lightGradient};
          background-size: 400% 400%;
          animation: akhtarGradientShift ${animSec}s ease infinite;
        }
        .akhtar-bg-overlay {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: ${isDark ? darkOverlay : lightOverlay};
          pointer-events: none;
        }
        .akhtar-bg-mantra-dim {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0,0,0,${dim});
          pointer-events: none;
        }
      `}</style>
      <div className="akhtar-bg" />
      <div className="akhtar-bg-overlay" />
      {dim > 0 ? <div className="akhtar-bg-mantra-dim" /> : null}
    </>
  );
};

// ─── Native fallback (LinearGradient) ────────────────────────────────────────

interface NativeFallbackProps {
  isDark: boolean;
  mantraMode?: boolean;
  practiceStillness?: boolean;
}

const NativeFallback: FC<NativeFallbackProps> = ({ isDark, mantraMode, practiceStillness }) => {
  const wrapOpacity = practiceStillness ? 0.75 : mantraMode ? 0.85 : 1;
  const base = isDark ? AURORA_BASE_DARK : AURORA_BASE_LIGHT;
  const aurora1 = isDark
    ? (["#0d3b2e", AURORA_BASE_DARK] as const)
    : (["#9de8cc", AURORA_BASE_LIGHT] as const);
  const aurora2 = isDark
    ? (["#0f2a4a", AURORA_BASE_DARK] as const)
    : (["#a8c8f8", AURORA_BASE_LIGHT] as const);
  const aurora3 = isDark
    ? (["#2d1047", AURORA_BASE_DARK] as const)
    : (["#d4b8f8", AURORA_BASE_LIGHT] as const);
  const bottomFade = isDark ? "rgba(6,8,15,0.65)" : "rgba(232,237,245,0.55)";

  return (
    <View
      style={[StyleSheet.absoluteFillObject, { backgroundColor: base, opacity: wrapOpacity }]}
      pointerEvents="none"
    >
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient
          colors={[aurora1[0], aurora1[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 0.65 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      <View style={[StyleSheet.absoluteFillObject, { opacity: 0.7 }]} pointerEvents="none">
        <LinearGradient
          colors={[aurora2[0], aurora2[1]]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 1, y: 0.65 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      <View style={[StyleSheet.absoluteFillObject, { opacity: 0.5 }]} pointerEvents="none">
        <LinearGradient
          colors={[aurora3[0], aurora3[1]]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 0.65 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient
          colors={["transparent", bottomFade]}
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
  /** Kept for API compatibility — no longer changes behavior */
  subtleDrift?: boolean;
  /** Slower gradient + dim overlay (web) / reduced opacity (native). */
  mantraMode?: boolean;
  /** Nearly frozen gradient + stronger dim (web) / lower opacity (native). */
  practiceStillness?: boolean;
};

export const CosmicBackground: FC<CosmicBackgroundProps> = ({
  colorSchemeOverride,
  mantraMode,
  practiceStillness,
}) => {
  const { isDark: prefIsDark } = useTheme();
  const isDark =
    colorSchemeOverride === "dark" ? true : colorSchemeOverride === "light" ? false : prefIsDark;

  if (Platform.OS === "web") {
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <CSSGradientBackground
          isDark={isDark}
          mantraMode={mantraMode}
          practiceStillness={practiceStillness}
        />
      </View>
    );
  }

  return (
    <NativeFallback
      isDark={isDark}
      mantraMode={mantraMode}
      practiceStillness={practiceStillness}
    />
  );
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
