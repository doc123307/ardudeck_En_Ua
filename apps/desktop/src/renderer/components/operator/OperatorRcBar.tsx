/**
 * The operator's driving controls: joystick on/off, reverse driving, cruise, and the
 * buttons, switches and sliders the administrator set up. Each one is an RC channel;
 * what is sent, and when it is let go, is decided in the main process.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, ChevronDown, ChevronUp, Gamepad2, Gauge, Minus, Plus } from 'lucide-react';
import { useOperatorStore } from '../../stores/operator-store';
import { useOperatorRcStore } from '../../stores/operator-rc-store';
import {
  functionInitial, functionRest,
  type OperatorRcFunction, type RcActionResult, type RcFunctionRuntime, type RcRefusal,
} from '../../../shared/operator-rc';
import { t } from '../../i18n';

const BTN = 'flex h-10 items-center gap-2 rounded-lg border border-subtle bg-surface-raised px-3 text-sm font-medium text-content transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40';
const ON = 'border-emerald-500/60 bg-emerald-600/30 text-emerald-100';
const WARN = 'border-amber-500/70 bg-amber-500/25 text-amber-100';
const SEG = 'flex h-10 w-9 items-center justify-center border-y border-r border-subtle bg-surface-raised text-content first:rounded-l-lg first:border-l last:rounded-r-lg hover:brightness-110';
const SEG_ON = 'bg-emerald-600/40 text-emerald-100';
/** A slider is sent at most this often while it is being dragged. */
const SLIDER_SEND_MS = 60;

export function refusalText(reason: RcRefusal | undefined): string {
  return t(`operator.OperatorRcBar.refused_${reason ?? 'disabled'}`);
}

/** Where the stick is, as a dot in a small square: proof that the joystick is being read. */
function StickDot({ steer, throttle, live }: { steer: number; throttle: number; live: boolean }) {
  return (
    <span className="relative block h-6 w-6 shrink-0 rounded border border-white/25 bg-black/30">
      <span
        className={`absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${live ? 'bg-emerald-300' : 'bg-content-tertiary'}`}
        style={{ left: `${50 + steer * 42}%`, top: `${50 - throttle * 42}%` }}
      />
    </span>
  );
}

function FunctionControl({ fn, runtime, disabled, onSet }: {
  fn: OperatorRcFunction; runtime: RcFunctionRuntime | undefined; disabled: boolean; onSet: (value: number) => void;
}) {
  const value = runtime?.value ?? functionInitial(fn);
  const rest = functionRest(fn);
  // A control held with the pointer is let go wherever the pointer ends up - outside the
  // button, outside the window - and when the control itself goes away.
  const held = useRef(false);
  const letGo = useRef(() => {});
  letGo.current = () => {
    if (!held.current) return;
    held.current = false;
    if (rest !== null) onSet(rest);
  };
  useEffect(() => {
    const release = () => letGo.current();
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
      release();
    };
  }, []);

  const dot = <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${runtime?.active ? 'bg-emerald-400' : 'bg-content-tertiary/50'}`} data-tip={runtime?.active ? t('operator.OperatorRcBar.sending') : t('operator.OperatorRcBar.notSending')} />;
  const tip = t('operator.OperatorRcBar.channelTip', { n: fn.channel });

  if (fn.kind === 'button') {
    const handlers = fn.latching
      ? { onClick: () => onSet(value ? 0 : 1) }
      : { onPointerDown: (e: React.PointerEvent) => { if (e.button !== 0) return; held.current = true; onSet(1); } };
    return (
      <button type="button" disabled={disabled} data-tip={tip} {...handlers} className={`${BTN} ${value ? ON : ''}`}>
        {dot}
        <span className="whitespace-nowrap">{fn.label}</span>
      </button>
    );
  }

  if (fn.kind === 'switch3') {
    const positions = [
      { v: -1, icon: <ChevronDown className="h-4 w-4" /> },
      { v: 0, icon: <Minus className="h-4 w-4" /> },
      { v: 1, icon: <ChevronUp className="h-4 w-4" /> },
    ];
    return (
      <div className="flex items-center gap-2" data-tip={tip}>
        {dot}
        <span className="whitespace-nowrap text-sm font-medium text-content">{fn.label}</span>
        <div className="flex">
          {positions.map((p) => (
            <button
              key={p.v}
              type="button"
              disabled={disabled}
              className={`${SEG} disabled:cursor-not-allowed disabled:opacity-40 ${value === p.v ? SEG_ON : ''}`}
              {...(fn.springCenter && p.v !== 0
                ? { onPointerDown: (e: React.PointerEvent) => { if (e.button !== 0) return; held.current = true; onSet(p.v); } }
                : { onClick: () => onSet(p.v) })}
            >
              {p.icon}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return <SliderControl fn={fn} value={value} disabled={disabled} onSet={onSet} dot={dot} tip={tip} rest={rest} />;
}

function SliderControl({ fn, value, disabled, onSet, dot, tip, rest }: {
  fn: OperatorRcFunction; value: number; disabled: boolean; onSet: (value: number) => void; dot: React.ReactNode; tip: string; rest: number | null;
}) {
  // While dragging the thumb follows the pointer, not the echo coming back from the engine.
  const [drag, setDrag] = useState<number | null>(null);
  const lastSent = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const send = (v: number) => {
    if (pending.current) clearTimeout(pending.current);
    const wait = SLIDER_SEND_MS - (Date.now() - lastSent.current);
    const go = () => { lastSent.current = Date.now(); pending.current = null; onSet(v); };
    if (wait <= 0) go(); else pending.current = setTimeout(go, wait);
  };
  const finish = () => {
    if (drag === null) return;
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
    onSet(rest ?? drag);
    setDrag(null);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  // Letting go outside the slider still counts as letting go.
  useEffect(() => {
    const release = () => finishRef.current();
    window.addEventListener('pointerup', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('blur', release);
      if (pending.current) clearTimeout(pending.current);
    };
  }, []);
  const shown = drag ?? value;
  return (
    <label className="flex items-center gap-2" data-tip={tip}>
      {dot}
      <span className="whitespace-nowrap text-sm font-medium text-content">{fn.label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(shown * 100)}
        disabled={disabled}
        onChange={(e) => { const v = Number(e.target.value) / 100; setDrag(v); send(v); }}
        onKeyUp={finish}
        onBlur={finish}
        className="h-2 w-28 cursor-pointer accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
      />
      <span className="w-9 text-right font-mono text-xs tabular-nums text-content-secondary">{Math.round(shown * 100)}%</span>
    </label>
  );
}

/** `connected`: a MAVLink vehicle is on the link. `onRefused` tells the operator why a press did nothing. */
export function OperatorRcBar({ connected, onRefused }: { connected: boolean; onRefused: (text: string) => void }) {
  const config = useOperatorStore((s) => s.config.rc);
  const rc = useOperatorRcStore((s) => s.state);
  const actions = useOperatorRcStore();

  const tell = (result: Promise<RcActionResult>) => {
    void result.then((r) => { if (!r.ok) onRefused(refusalText(r.reason)); });
  };

  const anything = config.drive.enabled || config.cruise.enabled || config.reverse.enabled || config.functions.length > 0;
  if (!anything) return null;

  const { drive, cruise, reverse } = rc;
  const paused = drive.engaged && !drive.live;
  const driveTip = !rc.padLive && !drive.engaged
    ? t('operator.OperatorRcBar.joystickWakeTip')
    : paused ? t('operator.OperatorRcBar.joystickPausedTip')
      : drive.engaged ? t('operator.OperatorRcBar.joystickOnTip', { name: rc.padName })
        : t('operator.OperatorRcBar.joystickOffTip', { name: rc.padName });

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-subtle bg-surface px-4 py-2">
      {config.drive.enabled && (
        <button
          type="button"
          onClick={() => tell(actions.setDrive(!drive.engaged))}
          data-tip={driveTip}
          className={`${BTN} ${drive.live ? ON : paused ? WARN : ''}`}
        >
          <Gamepad2 className="h-4 w-4" />
          <span className="whitespace-nowrap">
            {paused ? t('operator.OperatorRcBar.joystickPaused') : drive.engaged ? t('operator.OperatorRcBar.joystickOn') : t('operator.OperatorRcBar.joystick')}
          </span>
          <StickDot steer={rc.padLive ? drive.steer : 0} throttle={rc.padLive ? drive.throttle : 0} live={rc.padLive} />
        </button>
      )}

      {config.reverse.enabled && config.drive.enabled && (
        <button
          type="button"
          onClick={() => tell(actions.setReverse(!reverse))}
          data-tip={t('operator.OperatorRcBar.reverseTip')}
          className={`${BTN} ${reverse ? WARN : ''}`}
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span className="whitespace-nowrap">{reverse ? t('operator.OperatorRcBar.reverseOn') : t('operator.OperatorRcBar.reverse')}</span>
        </button>
      )}

      {config.cruise.enabled && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => tell(actions.setCruise(!cruise.on))}
            disabled={!connected}
            data-tip={t('operator.OperatorRcBar.cruiseTip')}
            className={`${BTN} ${cruise.on ? ON : ''}`}
          >
            <Gauge className="h-4 w-4" />
            <span className="whitespace-nowrap">{t('operator.OperatorRcBar.cruise')}</span>
            {cruise.on && <span className="font-mono tabular-nums">{Math.round(cruise.value * 100)}%</span>}
          </button>
          {cruise.on && (
            <>
              <button type="button" onClick={() => tell(actions.adjustCruise(-1))} data-tip={t('operator.OperatorRcBar.cruiseSlower')} className={`${BTN} px-2.5`}>
                <Minus className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => tell(actions.adjustCruise(1))} data-tip={t('operator.OperatorRcBar.cruiseFaster')} className={`${BTN} px-2.5`}>
                <Plus className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      )}

      {config.functions.length > 0 && (config.drive.enabled || config.cruise.enabled) && <span className="h-6 border-l border-subtle" />}

      {config.functions.map((fn) => (
        <FunctionControl
          key={fn.id}
          fn={fn}
          runtime={rc.functions[fn.id]}
          disabled={false}
          onSet={(value) => { void actions.setFunction(fn.id, value); }}
        />
      ))}

      {rc.error && <span className="text-xs text-red-400">{t('operator.OperatorRcBar.sendError', { reason: rc.error })}</span>}
    </div>
  );
}
