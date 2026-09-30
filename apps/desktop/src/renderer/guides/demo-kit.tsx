import { useEffect, useState, type ReactNode } from 'react';

export const DEMO_W = 320;
export const DEMO_H = 170;

/** The demo stage: a dark "map" the size of the mobile guides' canvas. */
export function DemoCanvas({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ width: DEMO_W, height: DEMO_H, background: 'linear-gradient(135deg, #212121, #1B2A20)' }}
    >
      {children}
    </div>
  );
}

/** Steps through `durations` (ms) forever; returns the current phase index. Stops on unmount. */
export function usePhaseLoop(durations: number[]): number {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p + 1) % durations.length), durations[phase]);
    return () => clearTimeout(t);
  }, [phase, durations]);
  return phase;
}

/** Satellite-ish map tile with a route line, for the schematic demos. */
export function MiniMap() {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #3b4a3a, #2c3a33 55%, #3a3f36)' }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points="8,85 30,60 52,68 70,35 92,20" fill="none" stroke="#60a5fa" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        {[[8, 85], [30, 60], [52, 68], [70, 35], [92, 20]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#3b82f6" />
        ))}
      </svg>
    </div>
  );
}

/** Synthetic vision stand-in: sky, terrain and a horizon line. */
export function MiniVision() {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(#2f4f8f 0%, #4a6fb0 48%, #6b7a4a 52%, #3d4a2c 100%)' }}>
      <div className="absolute inset-x-[20%] top-1/2 h-px bg-emerald-300/80" />
      <div className="absolute left-1/2 top-[38%] h-[24%] w-px bg-emerald-300/60" />
    </div>
  );
}
