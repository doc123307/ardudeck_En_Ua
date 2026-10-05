/**
 * Vehicle output buttons: lights, marker lights, IR... on the flight controller's relays.
 * Each button shows the state the vehicle reports (lit = on), blinks while a click waits
 * for confirmation, and says so when the vehicle did not confirm or has no such relay.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Plus, Settings2, Trash2 } from 'lucide-react';
import {
  relayButtonState, useRelayStore, type RelayButton, type RelayButtonState, type RelayColor, type RelayIcon,
} from '../../stores/relay-store';
import { ICON_COMPONENTS as ICONS } from '../operator/operator-look';
import { t } from '../../i18n';

/** Lit look per colour: background, text and glow. IR is shown violet since it is invisible. */
export const LIT: Record<RelayColor, string> = {
  // The ring keeps a lit white button (and its swatch) visible on the light theme's white panels.
  white: 'bg-white text-slate-900 shadow-[0_0_12px_rgba(255,255,255,0.7)] ring-1 ring-slate-400/70',
  amber: 'bg-amber-400 text-slate-900 shadow-[0_0_12px_rgba(251,191,36,0.7)]',
  red: 'bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.7)]',
  ir: 'bg-violet-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.7)]',
  green: 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.7)]',
  blue: 'bg-sky-500 text-white shadow-[0_0_12px_rgba(14,165,233,0.7)]',
};

/** RELAY_STATUS rate requested while buttons are on screen. */
const STATUS_INTERVAL_US = 1_000_000;
const RELAY_STATUS_ID = 376;

export function stateTip(state: RelayButtonState): string {
  return t(`vehicle_outputs.RelayButtons.state_${state}`);
}

/** `editable` off hides the button editor: on the operator screen the set of buttons is the administrator's. */
export function RelayButtons({ vehicleKey, compact = false, editable = true }: { vehicleKey: string | null; compact?: boolean; editable?: boolean }) {
  const buttons = useRelayStore((s) => s.buttons);
  const status = useRelayStore((s) => s.status);
  const pending = useRelayStore((s) => s.pending);
  const failed = useRelayStore((s) => s.failed);
  const setRelay = useRelayStore((s) => s.setRelay);
  const [editing, setEditing] = useState<DOMRect | null>(null);
  const gearRef = useRef<HTMLButtonElement>(null);
  // Re-evaluate staleness and expired failures even when no message arrives.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ArduPilot does not stream RELAY_STATUS by default; ask for it while the buttons are shown.
  useEffect(() => {
    if (!vehicleKey) return;
    void window.electronAPI.vehicleCommand(vehicleKey, { kind: 'message-interval', messageId: RELAY_STATUS_ID, intervalUs: STATUS_INTERVAL_US });
  }, [vehicleKey]);

  const size = compact ? 'h-8 min-w-8 px-1.5 text-[10px]' : 'h-10 min-w-10 px-2 text-[11px]';

  return (
    <div className="relative flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {buttons.map((b) => {
        const state = relayButtonState({ status, pending, failed }, vehicleKey, b.instance, now);
        const Icon = ICONS[b.icon];
        const lit = state === 'on' || (state === 'pending' && pending[`${vehicleKey}:${b.instance}`]?.want);
        const press = (on: boolean) => { if (vehicleKey) void setRelay(vehicleKey, b.instance, on); };
        const handlers = b.kind === 'momentary'
          ? {
            onPointerDown: () => press(true),
            onPointerUp: () => press(false),
            onPointerLeave: (e: React.PointerEvent) => { if (e.buttons) press(false); },
          }
          : { onClick: () => press(!(state === 'on')) };
        return (
          <button
            key={b.id}
            type="button"
            disabled={!vehicleKey}
            {...handlers}
            data-tip={`${b.label}: ${stateTip(state)} · RELAY${b.instance + 1}`}
            className={`flex select-none flex-col items-center justify-center gap-0.5 rounded-lg border font-medium transition-all disabled:opacity-40 ${size} ${
              lit ? `${LIT[b.color]} border-transparent` : 'border-subtle bg-surface-raised text-content-secondary hover:text-content'
            } ${state === 'pending' ? 'animate-pulse' : ''} ${
              state === 'failed' || state === 'absent' ? 'ring-2 ring-red-500' : state === 'unknown' ? 'border-dashed' : ''
            }`}
          >
            <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            {!compact && <span className="max-w-[6rem] truncate leading-none">{b.label}</span>}
          </button>
        );
      })}
      {editable && <button
        ref={gearRef}
        type="button"
        onClick={() => setEditing((v) => (v ? null : gearRef.current?.getBoundingClientRect() ?? null))}
        data-tip={t('vehicle_outputs.RelayButtons.configure')}
        className="flex h-6 w-6 items-center justify-center rounded text-content-tertiary hover:bg-surface-raised hover:text-content"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>}
      {editing && <RelayButtonsEditor anchor={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const COLORS: RelayColor[] = ['white', 'amber', 'red', 'ir', 'green', 'blue'];

const EDITOR_WIDTH = 416;
const EDGE = 8;

/**
 * Rendered in a body-level portal: inside the dock panel it would be cut by the
 * panel's own scroll box. Opens above the gear when the gear is in the lower half
 * of the window, below it otherwise, and never leaves the window.
 */
function RelayButtonsEditor({ anchor, onClose }: { anchor: DOMRect; onClose: () => void }) {
  const { buttons, addButton, updateButton, removeButton, moveButton } = useRelayStore();
  const width = Math.min(EDITOR_WIDTH, window.innerWidth - 2 * EDGE);
  const left = Math.max(EDGE, Math.min(anchor.left, window.innerWidth - width - EDGE));
  const above = anchor.top > window.innerHeight / 2;
  const place: React.CSSProperties = above
    ? { left, width, bottom: window.innerHeight - anchor.top + EDGE, maxHeight: anchor.top - 2 * EDGE }
    : { left, width, top: anchor.bottom + EDGE, maxHeight: window.innerHeight - anchor.bottom - 2 * EDGE };
  const field = 'min-w-0 rounded bg-surface-input px-1.5 py-0.5 text-[11px] text-content';
  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div style={place} className="fixed z-[61] overflow-y-auto rounded-xl border border-default bg-surface-solid p-3 shadow-xl">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-content-secondary">
          {t('vehicle_outputs.RelayButtons.outputs')}
        </div>
        <p className="mb-2 text-[10px] leading-snug text-content-tertiary">{t('vehicle_outputs.RelayButtons.howItWorks')}</p>
        <div className="flex flex-col gap-1.5">
          {buttons.map((b: RelayButton, i) => (
            <div key={b.id} className="rounded-lg border border-subtle p-1.5">
              <div className="flex items-center gap-1">
                <input value={b.label} onChange={(e) => updateButton(b.id, { label: e.target.value })} className={`${field} flex-1`} />
                <label className="flex items-center gap-1 text-[10px] text-content-secondary" title={t('vehicle_outputs.RelayButtons.relayNumberTip')}>
                  RELAY
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={b.instance + 1}
                    onChange={(e) => updateButton(b.id, { instance: Math.max(0, Math.min(15, Number(e.target.value) - 1)) })}
                    className={`${field} w-11`}
                  />
                </label>
                <button onClick={() => moveButton(b.id, -1)} disabled={i === 0} className="text-content-tertiary hover:text-content disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => moveButton(b.id, 1)} disabled={i === buttons.length - 1} className="text-content-tertiary hover:text-content disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                <button onClick={() => removeButton(b.id)} className="text-content-tertiary hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <select value={b.kind} onChange={(e) => updateButton(b.id, { kind: e.target.value as RelayButton['kind'] })} className={field}>
                  <option value="toggle">{t('vehicle_outputs.RelayButtons.kindToggle')}</option>
                  <option value="momentary">{t('vehicle_outputs.RelayButtons.kindMomentary')}</option>
                </select>
                <div className="flex gap-0.5">
                  {(Object.keys(ICONS) as RelayIcon[]).map((ic) => {
                    const Icon = ICONS[ic];
                    return (
                      <button key={ic} onClick={() => updateButton(b.id, { icon: ic })}
                        className={`rounded p-0.5 ${b.icon === ic ? 'bg-blue-600 text-white' : 'text-content-secondary hover:bg-surface-raised'}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-0.5">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => updateButton(b.id, { color: c })}
                      data-tip={t(`vehicle_outputs.RelayButtons.color_${c}`)}
                      className={`h-4 w-4 rounded-full ${LIT[c].split(' ')[0]} ${b.color === c ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-surface-solid' : c === 'white' ? 'ring-1 ring-slate-400/70' : ''}`} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => addButton()} className="mt-2 flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500">
          <Plus className="h-3.5 w-3.5" />{t('vehicle_outputs.RelayButtons.addOutput')}
        </button>
      </div>
    </>,
    document.body,
  );
}
