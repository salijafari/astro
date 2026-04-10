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
  const startRef = useRef<number>(0);

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

    // 4 control points that move around the canvas
    // Each point carries a color and drifts on its own path
    const points = [
      { x: 0.2, y: 0.2, vx: 0.00018, vy: 0.00012, color: COLORS[0]! },
      { x: 0.8, y: 0.3, vx: -0.00014, vy: 0.00016, color: COLORS[1]! },
      { x: 0.3, y: 0.8, vx: 0.00016, vy: -0.00013, color: COLORS[2]! },
      { x: 0.7, y: 0.7, vx: -0.00012, vy: -0.00018, color: COLORS[3]! },
    ];

    const draw = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const w = canvas.width;
      const h = canvas.height;

      // Move points — bounce off edges
      for (const p of points) {
        p.x += p.vx * elapsed * 0.016;
        p.y += p.vy * elapsed * 0.016;
        if (p.x < 0.05 || p.x > 0.95) p.vx *= -1;
        if (p.y < 0.05 || p.y > 0.95) p.vy *= -1;
        p.x = Math.max(0.05, Math.min(0.95, p.x));
        p.y = Math.max(0.05, Math.min(0.95, p.y));
      }

      startRef.current = timestamp;

      // Render: for each pixel compute weighted color from all 4 points
      // Use a lower resolution for performance then scale up
      const scale = 0.15;
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

          for (const p of points) {
            const dx = nx - p.x;
            const dy = ny - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const weight = 1 / (dist * dist + 0.01);
            totalWeight += weight;
            r += p.color.r * weight;
            g += p.color.g * weight;
            b += p.color.b * weight;
          }

          r = Math.round(r / totalWeight);
          g = Math.round(g / totalWeight);
          b = Math.round(b / totalWeight);

          const i = (py * sw + px) * 4;
          imageData.data[i] = r;
          imageData.data[i + 1] = g;
          imageData.data[i + 2] = b;
          imageData.data[i + 3] = 255;
        }
      }

      // Draw low-res to offscreen, scale up with blur for smooth look
      const offscreen = document.createElement("canvas");
      offscreen.width = sw;
      offscreen.height = sh;
      offscreen.getContext("2d")!.putImageData(imageData, 0, 0);

      ctx.clearRect(0, 0, w, h);
      ctx.filter = `blur(${Math.floor(w * 0.04)}px)`;
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
