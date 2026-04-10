import type { FC } from "react";
import { useMemo } from "react";
import { View } from "react-native";

const ORB = 56;
const PARTICLE_COUNT = 12;

/** Stable particle offsets (no Math.random per render — avoids flicker). */
const PARTICLE_TABLE = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const t = (i * 9973) % 1000;
  return { ox: ((t * 17) % 40) - 20, oy: ((t * 23) % 40) - 20, size: 3 + (i % 3) };
});

type VoiceOrbProps = {
  active: boolean;
  accentColor: string;
  dimColor: string;
};

/**
 * Soft “listening” orb with fixed particle layout (no extra native deps).
 */
export const VoiceOrb: FC<VoiceOrbProps> = ({ active, accentColor, dimColor }) => {
  const particles = useMemo(() => {
    const cx = ORB / 2;
    const cy = ORB / 2;
    const ring = ORB * 0.36;
    return PARTICLE_TABLE.map((p, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const x = cx + Math.cos(angle) * ring + p.ox * 0.25 - p.size / 2;
      const y = cy + Math.sin(angle) * ring + p.oy * 0.25 - p.size / 2;
      return { x, y, size: p.size };
    });
  }, []);

  const dot = active ? accentColor : dimColor;
  const core = active ? accentColor : dimColor;

  return (
    <View
      className="relative items-center justify-center"
      style={{ width: ORB, height: ORB }}
    >
      {particles.map((p, i) => (
        <View
          key={`pt_${i}`}
          className="absolute rounded-full"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: dot,
            opacity: active ? 0.9 : 0.35,
          }}
        />
      ))}
      <View
        className="rounded-full"
        style={{
          width: 32,
          height: 32,
          backgroundColor: core,
          opacity: active ? 1 : 0.55,
        }}
      />
    </View>
  );
};
