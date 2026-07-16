import { PulsingBorder } from "@paper-design/shaders-react";

/** Paper's PulsingBorder shader as an absolutely-positioned perimeter layer.
 *  Parent must be position:relative; siblings should sit at z-index ≥ 1. */
export function GlowBorder({
  colors,
  borderRadius = 16,
  inset = -3,
  intensity = 0.5,
  margin = 0,
}: {
  colors: string[];
  borderRadius?: number;
  inset?: number;
  intensity?: number;
  margin?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset,
        borderRadius,
        pointerEvents: "none",
        zIndex: 0,
        isolation: "isolate",
      }}
    >
      <PulsingBorder
      colors={colors}
      colorBack="#00000000"
      roundness={0.4}
      thickness={0.08}
      softness={0.4}
      intensity={intensity}
      bloom={0.45}
      spots={3}
      spotSize={0.55}
      pulse={0.45}
      smoke={0}
      smokeSize={0}
      speed={1}
      margin={margin}
        style={{ width: "100%", height: "100%", borderRadius }}
      />
    </div>
  );
}

/** Band → glow gradient colors (main + bright companion). */
export const BAND_GLOW: Record<string, [string, string]> = {
  excellent: ["#74c887", "#a8e6b2"],
  good: ["#a9d16f", "#cfe8a3"],
  fair: ["#e0c46e", "#f0dc9d"],
  poor: ["#eaa36f", "#f6c79e"],
  bad: ["#ec8873", "#f7b3a3"],
  "no-history": ["#6b7280", "#9ca3af"],
};
