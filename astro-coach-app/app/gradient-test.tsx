import { useEffect, useRef } from "react";
import { Platform, StyleSheet, View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Mesh gradient test — web only (Canvas API).
 * Visit /gradient-test in the browser to see it.
 * Delete this file when done testing.
 */

// The 4 colors that morph into each other
const COLORS = [
  { r: 13, g: 59, b: 46 }, // deep emerald
  { r: 15, g: 42, b: 74 }, // deep cobalt
  { r: 45, g: 16, b: 71 }, // deep violet
  { r: 8, g: 61, b: 42 }, // deep teal
] as const;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function MeshGradientCanvas() {
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

    const draw = (timestamp: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const t = timestamp * 0.0001; // slow global time driver

      // Move points using sine waves — smooth organic motion, no bouncing
      const positions = [
        {
          x: 0.5 + Math.sin(t * 1.1) * 0.35,
          y: 0.5 + Math.cos(t * 0.9) * 0.35,
          color: COLORS[0]!,
        },
        {
          x: 0.5 + Math.sin(t * 0.8 + 1.5) * 0.4,
          y: 0.5 + Math.cos(t * 1.2 + 1.0) * 0.3,
          color: COLORS[1]!,
        },
        {
          x: 0.5 + Math.sin(t * 1.3 + 3.0) * 0.3,
          y: 0.5 + Math.cos(t * 0.7 + 2.0) * 0.4,
          color: COLORS[2]!,
        },
        {
          x: 0.5 + Math.sin(t * 0.6 + 4.5) * 0.35,
          y: 0.5 + Math.cos(t * 1.4 + 0.5) * 0.35,
          color: COLORS[3]!,
        },
      ];

      // Low-res pixel pass
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
  }, []);

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
}

export default function GradientTestScreen() {
  const insets = useSafeAreaInsets();

  if (Platform.OS !== "web") {
    return (
      <View style={[styles.container, { backgroundColor: "#06080f" }]}>
        <Text style={styles.text}>Web only test screen</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MeshGradientCanvas />
      <View style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.label}>Mesh Gradient Test</Text>
        <Text style={styles.sublabel}>
          4 color points moving and blending{"\n"}
          Emerald · Cobalt · Violet · Teal
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#06080f",
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  label: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 22,
    fontWeight: "600",
  },
  sublabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  text: {
    color: "white",
    fontSize: 16,
  },
});
