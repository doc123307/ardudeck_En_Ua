/**
 * The information block (tilt, heading, altitude, speed, time) in its place on the operator
 * screen. It is held to the bottom-right corner, so it stays put when the window changes
 * size; the operator can make it smaller or larger, drag it elsewhere, and lock it so that
 * nothing moves it by accident. Size and place are remembered on this computer.
 */

import { useRef, useState } from 'react';
import { Lock, LockOpen, Minus, Move, Plus } from 'lucide-react';
import { useOperatorUiStore } from '../../stores/operator-ui-store';
import { OperatorInfoBlock } from './OperatorInfoBlock';
import type { Size } from './float-layout';
import { t } from '../../i18n';

export const INFO_SCALE_MIN = 0.5;
export const INFO_SCALE_MAX = 1.5;
const SCALE_STEP = 0.1;
const MARGIN = 12;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/** The size the block starts with: full size on a wide screen, smaller where it would crowd the picture. */
export function defaultInfoScale(areaWidth: number): number {
  return Math.round(clamp(areaWidth / 1900, 0.6, 1) * 10) / 10;
}

const BTN = 'flex h-6 w-6 items-center justify-center rounded bg-black/80 text-white/80 hover:bg-black hover:text-white disabled:opacity-30';

export function OperatorInfoDock({ area, tilt }: { area: Size; tilt: boolean }) {
  const saved = useOperatorUiStore((s) => s.info);
  const setInfo = useOperatorUiStore((s) => s.setInfo);
  const box = useRef<HTMLDivElement>(null);
  // While dragging the block follows the pointer from local state; the store is written on release.
  const [drag, setDrag] = useState<{ right: number; bottom: number } | null>(null);
  const start = useRef<{ x: number; y: number; right: number; bottom: number } | null>(null);

  const scale = clamp(saved.scale ?? defaultInfoScale(area.width), INFO_SCALE_MIN, INFO_SCALE_MAX);
  const size = () => box.current?.getBoundingClientRect() ?? { width: 0, height: 0 };
  const fit = (right: number, bottom: number) => {
    const { width, height } = size();
    return { right: clamp(right, 0, area.width - width), bottom: clamp(bottom, 0, area.height - height) };
  };
  const placed = drag ?? fit(saved.right === null ? MARGIN : saved.right * area.width, saved.bottom === null ? MARGIN : saved.bottom * area.height);

  const begin = (e: React.PointerEvent) => {
    if (saved.locked || e.button !== 0) return;
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    start.current = { x: e.clientX, y: e.clientY, ...placed };
    setDrag(placed);
  };
  const track = (e: React.PointerEvent) => {
    const s = start.current;
    if (s) setDrag(fit(s.right - (e.clientX - s.x), s.bottom - (e.clientY - s.y)));
  };
  const end = (e: React.PointerEvent) => {
    if (!start.current) return;
    start.current = null;
    if (drag && area.width > 0 && area.height > 0) setInfo({ right: drag.right / area.width, bottom: drag.bottom / area.height });
    setDrag(null);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* it was never captured */ }
  };
  const resize = (by: number) => setInfo({ scale: Math.round(clamp(scale + by, INFO_SCALE_MIN, INFO_SCALE_MAX) * 10) / 10 });

  return (
    <div ref={box} className="group/info pointer-events-auto absolute z-[14]" style={{ right: placed.right, bottom: placed.bottom }}>
      {/* The controls show when the pointer is over the block; locked, only the lock is offered. */}
      <div className="absolute bottom-full right-0 flex items-center gap-1 pb-1 opacity-0 transition-opacity group-hover/info:opacity-100">
        {!saved.locked && (
          <>
            <span className="flex h-6 items-center gap-1 rounded bg-black/80 px-1.5 text-[10px] text-white/70"><Move className="h-3 w-3" />{t('operator.OperatorInfoDock.dragHint')}</span>
            <button type="button" className={BTN} disabled={scale <= INFO_SCALE_MIN} onClick={() => resize(-SCALE_STEP)} data-tip={t('operator.OperatorInfoDock.smaller')}><Minus className="h-3.5 w-3.5" /></button>
            <span className="flex h-6 min-w-[2.5rem] items-center justify-center rounded bg-black/80 px-1 font-mono text-[10px] tabular-nums text-white/80">{Math.round(scale * 100)}%</span>
            <button type="button" className={BTN} disabled={scale >= INFO_SCALE_MAX} onClick={() => resize(SCALE_STEP)} data-tip={t('operator.OperatorInfoDock.larger')}><Plus className="h-3.5 w-3.5" /></button>
          </>
        )}
        <button type="button" className={`${BTN} ${saved.locked ? '' : 'bg-blue-600 text-white hover:bg-blue-500'}`} onClick={() => setInfo({ locked: !saved.locked })}
          data-tip={saved.locked ? t('operator.OperatorInfoDock.unlock') : t('operator.OperatorInfoDock.lock')}>
          {saved.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div
        onPointerDown={begin}
        onPointerMove={track}
        onPointerUp={end}
        onPointerCancel={end}
        className={saved.locked ? '' : 'cursor-move touch-none rounded-xl ring-2 ring-blue-500/70'}
        style={{ zoom: scale }}
      >
        <OperatorInfoBlock tilt={tilt} />
      </div>
    </div>
  );
}
