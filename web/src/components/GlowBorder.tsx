import { useLayoutEffect, useRef, useState } from "react";
import { PulsingBorder } from "@paper-design/shaders-react";

/** Paper's PulsingBorder shader as a perimeter layer.
 *
 *  Geometry notes (hard-won): the library force-sets its canvas to z-index
 *  -1, so it needs an isolated positioned wrapper; margins are FRACTIONS of
 *  the canvas dimension per axis, so to land the ring exactly on the host's
 *  border we overhang the canvas by `edge` px on every side and feed back
 *  measured per-side fractions. Parent must be position:relative; siblings
 *  sit at z-index ≥ 1. */
export function GlowBorder({
  colors,
  borderRadius = 16,
  inset = -10,
  intensity = 0.5,
}: {
  colors: string[];
  borderRadius?: number;
  inset?: number;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setDims({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const edge = -inset; // canvas overhang in px = bloom room outside the border

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        inset,
        borderRadius,
        pointerEvents: "none",
        zIndex: 0,
        isolation: "isolate",
      }}
    >
      {dims && (
        <PulsingBorder
          colors={colors}
          colorBack="#00000000"
          aspectRatio="auto"
          roundness={0.35}
          thickness={0.07}
          softness={0.45}
          intensity={intensity}
          bloom={0.5}
          spots={3}
          spotSize={0.55}
          pulse={0.45}
          smoke={0}
          smokeSize={0}
          speed={1}
          marginLeft={edge / dims.w}
          marginRight={edge / dims.w}
          marginTop={edge / dims.h}
          marginBottom={edge / dims.h}
          style={{ width: "100%", height: "100%" }}
        />
      )}
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
