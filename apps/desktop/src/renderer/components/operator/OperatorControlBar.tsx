/**
 * The operator's bottom bar: every control the administrator put there, in their order -
 * joystick, reverse, cruise, vehicle outputs, the administrator's own buttons, switches and
 * sliders, and the view tools. Mode, ARM and STOP sit at the right end (OperatorScreen).
 */

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight, ChevronDown, ChevronUp, Circle, Columns2, Gamepad2, Gauge, LayoutGrid, Minus, PictureInPicture2, Pin,
  Plus, RotateCcw, X,
} from 'lucide-react';
import { useOperatorStore } from '../../stores/operator-store';
import { useOperatorRcStore } from '../../stores/operator-rc-store';
import { useOperatorUiStore } from '../../stores/operator-ui-store';
import { relayButtonState, useRelayStore, type RelayButton } from '../../stores/relay-store';
import { stateTip } from '../vehicle-outputs/RelayButtons';
import {
  arrangeControls, controlGroup, controlKind, defaultControlOrder,
} from '../../../shared/operator-panel';
import {
  functionInitial, functionRest,
  type OperatorRcFunction, type RcActionResult, type RcFunctionRuntime, type RcRefusal,
} from '../../../shared/operator-rc';
import { Chip, ChipFrame, Divider, ICON_COMPONENTS, Segment } from './operator-look';
import { t } from '../../i18n';

/** A slider is sent at most this often while it is being dragged. */
const SLIDER_SEND_MS = 60;
/** RELAY_STATUS rate asked for while outputs are on screen. */
const RELAY_STATUS_INTERVAL_US = 1_000_000;
const RELAY_STATUS_ID = 376;

export function refusalText(reason: RcRefusal | undefined): string {
  return t(`operator.OperatorRcBar.refused_${reason ?? 'disabled'}`);
}

/** Where the stick is: proof that the joystick is being read. */
function StickDot({ steer, throttle, live }: { steer: number; throttle: number; live: boolean }) {
  return (
    <span className="relative block h-5 w-5 shrink-0 rounded-sm border border-white/30 bg-black/20">
      <span
        className={`absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${live ? 'bg-current' : 'bg-content-tertiary'}`}
        style={{ left: `${50 + steer * 40}%`, top: `${50 - throttle * 40}%` }}
      />
    </span>
  );
}

/** A small mark on a control whose channel is going out to the vehicle. */
function SendingMark({ on }: { on: boolean }) {
  if (!on) return null;
  return <span aria-hidden className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-surface" />;
}

/** Let go of a held control wherever the pointer ends up, and when the control goes away. */
function useRelease(onRelease: () => void) {
  const held = useRef(false);
  const latest = useRef(onRelease);
  latest.current = onRelease;
  useEffect(() => {
    const release = () => {
      if (!held.current) return;
      held.current = false;
      latest.current();
    };
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
  return held;
}

function FunctionControl({ fn, runtime, onSet, iconsOnly }: { fn: OperatorRcFunction; runtime: RcFunctionRuntime | undefined; onSet: (value: number) => void; iconsOnly: boolean }) {
  const value = runtime?.value ?? functionInitial(fn);
  const rest = functionRest(fn);
  const held = useRelease(() => { if (rest !== null) onSet(rest); });
  const Icon = ICON_COMPONENTS[fn.icon];
  const where = fn.output === 'rc' ? t('operator.OperatorRcBar.channelTip', { n: fn.channel }) : t('operator.OperatorRcBar.servoTip', { n: fn.channel });
  const tip = `${fn.label} · ${where}${runtime?.active ? '' : ` · ${t('operator.OperatorRcBar.notSending')}`}`;
  const press = (v: number) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    held.current = true;
    onSet(v);
  };

  if (fn.kind === 'button') {
    return (
      <Chip
        tone={value ? fn.color : 'off'}
        icon={Icon}
        label={iconsOnly ? undefined : fn.label}
        square={iconsOnly}
        data-tip={tip}
        {...(fn.latching ? { onClick: () => onSet(value ? 0 : 1) } : { onPointerDown: press(1) })}
      >
        <SendingMark on={!!runtime?.active} />
      </Chip>
    );
  }

  if (fn.kind === 'switch3') {
    const positions = [
      { v: -1, icon: <ChevronDown className="h-3.5 w-3.5" /> },
      { v: 0, icon: <Minus className="h-3 w-3" /> },
      { v: 1, icon: <ChevronUp className="h-3.5 w-3.5" /> },
    ];
    return (
      <ChipFrame icon={Icon} label={iconsOnly ? null : fn.label} tip={tip} active={!!runtime?.active}>
        {positions.map((p) => (
          <Segment
            key={p.v}
            on={value === p.v}
            tone={fn.color}
            {...(fn.springCenter && p.v !== 0 ? { onPointerDown: press(p.v) } : { onClick: () => onSet(p.v) })}
          >
            {p.icon}
          </Segment>
        ))}
      </ChipFrame>
    );
  }

  return <SliderControl fn={fn} value={value} active={!!runtime?.active} rest={rest} tip={tip} onSet={onSet} iconsOnly={iconsOnly} />;
}

function SliderControl({ fn, value, active, rest, tip, onSet, iconsOnly }: {
  fn: OperatorRcFunction; value: number; active: boolean; rest: number | null; tip: string; onSet: (value: number) => void; iconsOnly: boolean;
}) {
  // While dragging, the thumb follows the pointer, not the echo coming back from the engine.
  const [drag, setDrag] = useState<number | null>(null);
  const lastSent = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const send = (v: number) => {
    if (pending.current) clearTimeout(pending.current);
    const wait = SLIDER_SEND_MS - (Date.now() - lastSent.current);
    const go = () => { lastSent.current = Date.now(); pending.current = null; onSet(v); };
    if (wait <= 0) go(); else pending.current = setTimeout(go, wait);
  };
  const finish = useRef(() => {});
  finish.current = () => {
    if (drag === null) return;
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
    onSet(rest ?? drag);
    setDrag(null);
  };
  useEffect(() => {
    const release = () => finish.current();
    window.addEventListener('pointerup', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('blur', release);
      if (pending.current) clearTimeout(pending.current);
    };
  }, []);
  const shown = drag ?? value;
  const Icon = ICON_COMPONENTS[fn.icon];
  return (
    <ChipFrame icon={Icon} label={iconsOnly ? null : fn.label} tip={tip} active={active}>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(shown * 100)}
        aria-label={fn.label}
        onChange={(e) => { const v = Number(e.target.value) / 100; setDrag(v); send(v); }}
        onKeyUp={() => finish.current()}
        className="h-1.5 w-16 cursor-pointer accent-emerald-500"
      />
      <span className="w-8 pr-0.5 text-right font-mono text-[11px] tabular-nums">{Math.round(shown * 100)}%</span>
    </ChipFrame>
  );
}

function RelayControl({ button, vehicleKey, now, preview, iconsOnly }: { button: RelayButton; vehicleKey: string | null; now: number; preview: boolean; iconsOnly: boolean }) {
  const status = useRelayStore((s) => s.status);
  const pending = useRelayStore((s) => s.pending);
  const failed = useRelayStore((s) => s.failed);
  const setRelay = useRelayStore((s) => s.setRelay);
  const state = relayButtonState({ status, pending, failed }, vehicleKey, button.instance, now);
  const lit = state === 'on' || (state === 'pending' && pending[`${vehicleKey}:${button.instance}`]?.want);
  const press = (on: boolean) => { if (vehicleKey) void setRelay(vehicleKey, button.instance, on); };
  const held = useRelease(() => press(false));
  const handlers = button.kind === 'momentary'
    ? { onPointerDown: (e: React.PointerEvent) => { if (e.button !== 0) return; held.current = true; press(true); } }
    : { onClick: () => press(!(state === 'on')) };
  return (
    <Chip
      tone={lit ? button.color : 'off'}
      icon={ICON_COMPONENTS[button.icon]}
      label={iconsOnly ? undefined : button.label}
      square={iconsOnly}
      disabled={!vehicleKey && !preview}
      data-tip={`${button.label}: ${stateTip(state)} · RELAY${button.instance + 1}`}
      className={preview ? '' : `${state === 'pending' ? 'animate-pulse' : ''} ${state === 'failed' || state === 'absent' ? 'ring-1 ring-red-500' : ''} ${state === 'unknown' && !lit ? 'border-dashed' : ''}`}
      {...handlers}
    />
  );
}

export interface ControlBarProps {
  connected: boolean;
  vehicleKey: string | null;
  /** More than one camera: the grid / one-large switch has a use. */
  severalCameras: boolean;
  recording: { mode: string; on: boolean; toggle: () => void };
  onRefused: (text: string) => void;
  /** Drawn for the administrator's preview: nothing reacts. */
  preview?: boolean;
}

/** The controls, without the mode / ARM / STOP group. */
export function OperatorControls({ connected, vehicleKey, severalCameras, recording, onRefused, preview = false }: ControlBarProps) {
  const config = useOperatorStore((s) => s.config);
  const relays = useRelayStore((s) => s.buttons);
  const rc = useOperatorRcStore((s) => s.state);
  const actions = useOperatorRcStore();
  const ui = useOperatorUiStore();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ArduPilot does not stream RELAY_STATUS by default; ask for it while outputs are on screen.
  const anyRelay = !preview && relays.length > 0 && !!vehicleKey;
  useEffect(() => {
    if (!anyRelay || !vehicleKey) return;
    void window.electronAPI.vehicleCommand(vehicleKey, { kind: 'message-interval', messageId: RELAY_STATUS_ID, intervalUs: RELAY_STATUS_INTERVAL_US });
  }, [anyRelay, vehicleKey]);

  const tell = (result: Promise<RcActionResult>) => {
    void result.then((r) => { if (!r.ok) onRefused(refusalText(r.reason)); });
  };

  const { rc: rcConfig } = config;
  const available = defaultControlOrder(relays.map((r) => r.id), rcConfig.functions.map((f) => f.id)).filter((key) => {
    if (key === 'joystick') return rcConfig.drive.enabled;
    if (key === 'reverse') return rcConfig.drive.enabled && rcConfig.reverse.enabled;
    if (key === 'cruise') return rcConfig.cruise.enabled;
    if (key === 'record') return config.recordMode === 'manual';
    if (key === 'layout') return severalCameras;
    if (key === 'pin') return !config.hiddenElements.includes('cameraControls');
    return true;
  });
  const shown = arrangeControls(config.controlOrder, available)
    .filter((key) => !config.hiddenControls.includes(key) && !config.removedControls.includes(key));
  const iconsOnly = config.panelIconsOnly;

  const { drive, cruise, reverse } = rc;
  const paused = drive.engaged && !drive.live;

  const render = (key: string) => {
    switch (key) {
      case 'joystick': {
        const tip = !rc.padLive && !drive.engaged
          ? t('operator.OperatorRcBar.joystickWakeTip')
          : paused ? t('operator.OperatorRcBar.joystickPausedTip')
            : drive.engaged ? t('operator.OperatorRcBar.joystickOnTip', { name: rc.padName })
              : t('operator.OperatorRcBar.joystickOffTip', { name: rc.padName });
        return (
          <Chip tone={drive.live ? 'green' : paused ? 'warn' : 'off'} icon={Gamepad2} data-tip={tip} onClick={() => tell(actions.setDrive(!drive.engaged))}
            label={iconsOnly ? undefined : paused ? t('operator.OperatorRcBar.joystickPaused') : t('operator.OperatorRcBar.joystick')}>
            <StickDot steer={rc.padLive ? drive.steer : 0} throttle={rc.padLive ? drive.throttle : 0} live={rc.padLive} />
          </Chip>
        );
      }
      case 'reverse':
        return (
          <Chip tone={reverse ? 'amber' : 'off'} icon={ArrowLeftRight} data-tip={t('operator.OperatorRcBar.reverseTip')}
            label={iconsOnly ? undefined : reverse ? t('operator.OperatorRcBar.reverseOn') : t('operator.OperatorRcBar.reverse')} square={iconsOnly}
            onClick={() => tell(actions.setReverse(!reverse))} />
        );
      case 'cruise':
        return cruise.on ? (
          <ChipFrame icon={Gauge} active label={<span className="font-mono tabular-nums">{iconsOnly ? '' : `${t('operator.OperatorRcBar.cruise')} `}{Math.round(cruise.value * 100)}%</span>} tip={t('operator.OperatorRcBar.cruiseTip')}>
            <Segment onClick={() => tell(actions.adjustCruise(-1))} data-tip={t('operator.OperatorRcBar.cruiseSlower')}><Minus className="h-3.5 w-3.5" /></Segment>
            <Segment onClick={() => tell(actions.adjustCruise(1))} data-tip={t('operator.OperatorRcBar.cruiseFaster')}><Plus className="h-3.5 w-3.5" /></Segment>
            <Segment onClick={() => tell(actions.setCruise(false))} data-tip={t('operator.OperatorRcBar.cruiseOff')}><X className="h-3.5 w-3.5" /></Segment>
          </ChipFrame>
        ) : (
          <Chip icon={Gauge} label={iconsOnly ? undefined : t('operator.OperatorRcBar.cruise')} square={iconsOnly} disabled={!connected && !preview} data-tip={t('operator.OperatorRcBar.cruiseTip')}
            onClick={() => tell(actions.setCruise(true))} />
        );
      case 'record':
        return (
          <Chip tone={recording.on ? 'red' : 'off'} icon={Circle} onClick={recording.toggle} square={iconsOnly}
            label={iconsOnly ? undefined : recording.on ? t('operator.OperatorScreen.stopRecording') : t('operator.OperatorScreen.record')}
            data-tip={recording.on ? t('operator.OperatorScreen.stopRecordingTip') : t('operator.OperatorScreen.recordTip')} />
        );
      case 'layout':
        return (
          <Chip square icon={ui.layout === 'pip' ? LayoutGrid : PictureInPicture2} onClick={() => ui.setLayout(ui.layout === 'pip' ? 'grid' : 'pip')}
            data-tip={ui.layout === 'pip' ? t('operator.OperatorScreen.layoutGridTip') : t('operator.OperatorScreen.layoutPipTip')} />
        );
      case 'reset':
        return <Chip square icon={RotateCcw} onClick={ui.resetArrangement} data-tip={t('operator.OperatorScreen.resetArrangementTip')} />;
      case 'pin':
        return (
          <Chip square tone={ui.controlsPinned ? 'blue' : 'off'} icon={ui.controlsPinned ? Pin : Columns2}
            onClick={() => ui.setControlsPinned(!ui.controlsPinned)} data-tip={t('operator.OperatorScreen.pinControlsTip')} />
        );
      default: {
        const kind = controlKind(key);
        if (kind === 'relay') {
          const button = relays.find((r) => `relay:${r.id}` === key);
          return button ? <RelayControl button={button} vehicleKey={connected ? vehicleKey : null} now={now} preview={preview} iconsOnly={iconsOnly} /> : null;
        }
        const fn = rcConfig.functions.find((f) => `fn:${f.id}` === key);
        return fn ? <FunctionControl fn={fn} runtime={rc.functions[fn.id]} iconsOnly={iconsOnly} onSet={(value) => { void actions.setFunction(fn.id, value); }} /> : null;
      }
    }
  };

  return (
    <div className={`flex min-w-0 flex-1 flex-wrap items-center gap-1.5 ${preview ? 'pointer-events-none' : ''}`}>
      {shown.map((key, i) => (
        <span key={key} className="contents">
          {i > 0 && controlGroup(key) !== controlGroup(shown[i - 1]!) && <Divider />}
          {render(key)}
        </span>
      ))}
      {rc.error && !preview && <span className="text-xs text-red-400">{t('operator.OperatorRcBar.sendError', { reason: rc.error })}</span>}
    </div>
  );
}
