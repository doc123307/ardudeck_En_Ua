/**
 * Mode switching on the operator screen. A few modes are buttons side by side; a longer
 * list folds into one button that names the current mode and opens the list upwards.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Navigation } from 'lucide-react';
import { ROVER_MODE_NUMBER, type OperatorModeButton } from '../../../shared/operator-types';
import { t } from '../../i18n';

/** Up to this many modes are shown as separate buttons. */
const INLINE_MODES = 3;

const BTN = 'flex h-9 items-center gap-2 rounded-md border border-subtle bg-surface-raised px-3 text-[13px] font-medium text-content transition-colors hover:border-content-tertiary/60 disabled:cursor-not-allowed disabled:opacity-40';
const ON = 'border-blue-500/60 bg-blue-600/30';

export const modeButtonLabel = (mode: OperatorModeButton) => t(`operator.OperatorScreen.mode_${mode}`);

export function OperatorModeMenu({ modes, modeNum, currentLabel, disabled, onPick }: {
  modes: OperatorModeButton[];
  /** The vehicle's mode number; null while it is not connected. */
  modeNum: number | null;
  /** The vehicle's mode by name, for a mode that is not among the buttons. */
  currentLabel: string;
  disabled: boolean;
  onPick: (mode: OperatorModeButton) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', close);
    };
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  if (modes.length === 0) return null;

  if (modes.length <= INLINE_MODES) {
    return (
      <>
        {modes.map((m) => (
          <button key={m} type="button" onClick={() => onPick(m)} disabled={disabled} className={`${BTN} ${modeNum === ROVER_MODE_NUMBER[m] ? ON : ''}`}>
            <span className="whitespace-nowrap">{modeButtonLabel(m)}</span>
          </button>
        ))}
      </>
    );
  }

  const current = modes.find((m) => modeNum === ROVER_MODE_NUMBER[m]);
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        data-tip={t('operator.OperatorScreen.modeMenuTip')}
        className={`${BTN} min-w-[9.5rem] justify-between ${open ? ON : ''}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Navigation className="h-4 w-4 shrink-0" />
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <span className="text-[10px] font-medium uppercase tracking-wider text-content-tertiary">{t('operator.OperatorScreen.modeMenu')}</span>
            <span className="max-w-[12rem] truncate">{modeNum === null ? '--' : current ? modeButtonLabel(current) : currentLabel}</span>
          </span>
        </span>
        {/* The list opens upwards: the arrow points where it will appear. */}
        <ChevronUp className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-40 mb-2 flex min-w-full flex-col gap-1 rounded-xl border border-subtle bg-surface-nav p-1.5 shadow-2xl">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setOpen(false); onPick(m); }}
              className={`flex h-9 items-center whitespace-nowrap rounded-md px-3 text-left text-sm font-medium text-content hover:bg-surface-raised ${
                modeNum === ROVER_MODE_NUMBER[m] ? 'bg-blue-600/30 ring-1 ring-blue-500/60' : ''
              }`}
            >
              {modeButtonLabel(m)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
