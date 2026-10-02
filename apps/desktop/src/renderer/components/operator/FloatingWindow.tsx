/**
 * A window the operator can drag by its title strip and resize by its corner, inside
 * the camera area. With `docked` it gives all that up and simply fills the given box -
 * the SAME element either way, so a camera moving between "thumbnail" and "full size"
 * never remounts (and never restarts its stream).
 */

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { GripHorizontal } from 'lucide-react';
import {
  MIN_FLOAT_HEIGHT, MIN_FLOAT_WIDTH, movedBy, resizedBy, toFractions, toPixels, type FloatRect, type PixelRect, type Size,
} from './float-layout';

interface FloatingWindowProps {
  /** Size of the camera area in px. */
  area: Size;
  /** Saved place; `fallback` is used until the operator moves the window. */
  rect: FloatRect | undefined;
  fallback: FloatRect;
  onChange: (rect: FloatRect) => void;
  onFocus?: () => void;
  /** Fill this box instead of floating (no title strip, no handles). */
  docked?: CSSProperties;
  front?: boolean;
  title: ReactNode;
  /** Buttons at the right end of the title strip. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tip?: string;
}

type Gesture = { kind: 'move' | 'resize'; x: number; y: number; start: PixelRect };

export function FloatingWindow({ area, rect, fallback, onChange, onFocus, docked, front = false, title, actions, children, className = '', tip }: FloatingWindowProps) {
  // While a drag is in progress the window follows the pointer from local state; the
  // store is written once, on release.
  const [live, setLive] = useState<PixelRect | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const liveRef = useRef<PixelRect | null>(null);
  const follow = (next: PixelRect | null) => { liveRef.current = next; setLive(next); };

  const placed = live ?? toPixels(rect ?? fallback, area);

  const begin = (kind: Gesture['kind']) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    // Capture keeps the drag alive when the pointer outruns the handle; without it the drag still works over the handle.
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    gesture.current = { kind, x: e.clientX, y: e.clientY, start: placed };
    follow(placed);
    onFocus?.();
  };
  const track = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    follow(g.kind === 'move' ? movedBy(g.start, dx, dy, area) : resizedBy(g.start, dx, dy, area, MIN_FLOAT_WIDTH, MIN_FLOAT_HEIGHT));
  };
  const end = (e: React.PointerEvent) => {
    if (!gesture.current) return;
    gesture.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    const final = liveRef.current;
    follow(null);
    if (final) onChange(toFractions(final, area));
  };
  const handlers = (kind: Gesture['kind']) => ({ onPointerDown: begin(kind), onPointerMove: track, onPointerUp: end, onPointerCancel: end });

  const style: CSSProperties = docked ?? { left: placed.left, top: placed.top, width: placed.width, height: placed.height, zIndex: front ? 16 : 15 };

  return (
    <div
      style={style}
      onPointerDownCapture={docked ? undefined : onFocus}
      className={`group/feed absolute flex flex-col ${docked ? '' : 'overflow-hidden rounded-lg border border-white/25 bg-black shadow-xl'} ${className}`}
    >
      {!docked && (
        <div
          {...handlers('move')}
          data-tip={tip}
          className="flex h-6 shrink-0 cursor-move touch-none select-none items-center gap-1.5 bg-surface-solid px-1.5 text-[11px] font-medium text-content"
        >
          <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-content-tertiary" />
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {/* Buttons must not start a drag. */}
          <span className="flex shrink-0 items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>{actions}</span>
        </div>
      )}
      <div className="relative min-h-0 flex-1">{children}</div>
      {!docked && (
        <div
          {...handlers('resize')}
          className="absolute bottom-0 right-0 z-20 h-4 w-4 cursor-nwse-resize touch-none"
          style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.55) 50%)' }}
        />
      )}
    </div>
  );
}
