/**
 * Settings → "Operator workspace": the operator's driving controls (which joystick drives,
 * cruise, reverse driving), and the editor of one RC function with the joystick control
 * that works it. The functions themselves are listed in the panel editor.
 */

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  RC_FUNCTION_OUTPUTS, RC_MAX_CHANNEL, RC_PWM_MAX, RC_PWM_MIN, RC_SLIDER_SPRINGS,
  driveSticks, pickPad, rcChannelConflicts,
  type OperatorRcConfig, type OperatorRcFunction, type RcFunctionOutput, type RcInput, type RcPad, type RcSliderSpring,
} from '../../../shared/operator-rc';
import { useCameraStore } from '../../stores/camera-store';
import { BTN, Card, ColorPicker, FIELD, IconPicker, SmallNumber, TextField, Toggle } from './OperatorSettingsParts';
import { t } from '../../i18n';

const POLL_MS = 60;
const LEARN_TIMEOUT_MS = 8000;

/** The joysticks plugged in, and a live reading of the one in use. */
export function useJoystick(padId: string): { names: string[]; pad: RcPad | null } {
  const [state, setState] = useState<{ names: string[]; pad: RcPad | null }>({ names: [], pad: null });
  useEffect(() => {
    if (typeof navigator.getGamepads !== 'function') return;
    const read = () => {
      const pads = Array.from(navigator.getGamepads()).filter((p): p is Gamepad => !!p);
      const picked = pickPad(pads, padId);
      setState({
        names: pads.map((p) => p.id),
        pad: picked ? { id: picked.id, axes: Array.from(picked.axes), buttons: picked.buttons.map((b) => b.pressed) } : null,
      });
    };
    read();
    const timer = setInterval(read, POLL_MS);
    return () => clearInterval(timer);
  }, [padId]);
  return state;
}

/** What "press the control you want" found: a button going down, or an axis pushed well off where it was. */
function movedControl(baseline: RcPad, now: RcPad, want: 'button' | 'axis'): number | null {
  if (want === 'button') {
    const i = now.buttons.findIndex((b, n) => b && !baseline.buttons[n]);
    return i >= 0 ? i : null;
  }
  let best = -1;
  let bestDelta = 0.5;
  now.axes.forEach((a, n) => {
    const delta = Math.abs(a - (baseline.axes[n] ?? 0));
    if (delta > bestDelta) { best = n; bestDelta = delta; }
  });
  return best >= 0 ? best : null;
}

/** "Button 3 [change] [x]": click, then press the joystick control to assign. */
function Learn({ pad, want, value, onChange, label, clearable = true }: {
  pad: RcPad | null; want: 'button' | 'axis'; value: number | null; onChange: (v: number | null) => void; label: string; clearable?: boolean;
}) {
  const [baseline, setBaseline] = useState<RcPad | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => {
    if (!baseline) return;
    const timer = setTimeout(() => setBaseline(null), LEARN_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [baseline]);
  useEffect(() => {
    if (!baseline || !pad) return;
    const found = movedControl(baseline, pad, want);
    if (found === null) return;
    setBaseline(null);
    latest.current(found);
  }, [baseline, pad, want]);

  const name = value === null
    ? t('operator.OperatorRcSettings.unassigned')
    : t(want === 'button' ? 'operator.OperatorRcSettings.buttonN' : 'operator.OperatorRcSettings.axisN', { n: value + 1 });
  const live = value !== null && pad
    ? want === 'button' ? pad.buttons[value] === true : Math.abs(pad.axes[value] ?? 0) > 0.5
    : false;
  return (
    <span className="flex items-center gap-1.5 text-sm text-content">
      <span className="text-xs text-content-secondary">{label}</span>
      <button
        type="button"
        disabled={!pad}
        onClick={() => setBaseline(baseline ? null : pad)}
        data-tip={pad ? t('operator.OperatorRcSettings.learnTip') : t('operator.OperatorRcSettings.noJoystickShort')}
        className={`${BTN} px-2 py-1 ${baseline ? 'animate-pulse border-blue-500 text-blue-300' : live ? 'border-emerald-500/70 text-emerald-300' : ''}`}
      >
        {baseline ? t(want === 'button' ? 'operator.OperatorRcSettings.pressButton' : 'operator.OperatorRcSettings.moveAxis') : name}
      </button>
      {clearable && value !== null && !baseline && (
        <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-content-tertiary hover:text-red-400" data-tip={t('operator.OperatorRcSettings.clear')}>
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

/** A bar showing a -1..1 value around its middle. */
function Meter({ value, label }: { value: number; label: string }) {
  const half = Math.min(1, Math.abs(value)) * 50;
  return (
    <span className="flex items-center gap-2 text-xs text-content-secondary">
      <span className="w-14">{label}</span>
      <span className="relative h-2 w-40 rounded bg-surface-raised">
        <span className="absolute inset-y-0 w-px bg-content-tertiary" style={{ left: '50%' }} />
        <span className="absolute inset-y-0 rounded bg-emerald-500" style={{ left: value >= 0 ? '50%' : `${50 - half}%`, width: `${half}%` }} />
      </span>
      <span className="w-10 font-mono tabular-nums">{Math.round(value * 100)}%</span>
    </span>
  );
}

function Percent({ value, onCommit, label, max = 100 }: { value: number; onCommit: (v: number) => void; label: string; max?: number }) {
  return <SmallNumber value={Math.round(value * 100)} min={0} max={max} onCommit={(v) => onCommit(v / 100)} label={label} />;
}

const INPUT_KINDS: RcInput['kind'][] = ['none', 'button', 'buttons', 'axis'];

export function InputEditor({ input, pad, onChange }: { input: RcInput; pad: RcPad | null; onChange: (next: RcInput) => void }) {
  const setKind = (kind: RcInput['kind']) => {
    if (kind === input.kind) return;
    if (kind === 'none') onChange({ kind });
    else if (kind === 'button') onChange({ kind, index: 0 });
    else if (kind === 'buttons') onChange({ kind, down: 0, up: 1 });
    else onChange({ kind, index: 0, reverse: false });
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex items-center gap-2 text-xs text-content-secondary">
        {t('operator.OperatorRcSettings.joystickControl')}
        <select value={input.kind} onChange={(e) => setKind(e.target.value as RcInput['kind'])} className={`${FIELD} py-1`}>
          {INPUT_KINDS.map((k) => <option key={k} value={k}>{t(`operator.OperatorRcSettings.input_${k}`)}</option>)}
        </select>
      </label>
      {input.kind === 'button' && (
        <Learn pad={pad} want="button" value={input.index} clearable={false} label="" onChange={(v) => { if (v !== null) onChange({ ...input, index: v }); }} />
      )}
      {input.kind === 'buttons' && (
        <>
          <Learn pad={pad} want="button" value={input.down} clearable={false} label={t('operator.OperatorRcSettings.buttonDown')} onChange={(v) => { if (v !== null) onChange({ ...input, down: v }); }} />
          <Learn pad={pad} want="button" value={input.up} clearable={false} label={t('operator.OperatorRcSettings.buttonUp')} onChange={(v) => { if (v !== null) onChange({ ...input, up: v }); }} />
        </>
      )}
      {input.kind === 'axis' && (
        <>
          <Learn pad={pad} want="axis" value={input.index} clearable={false} label="" onChange={(v) => { if (v !== null) onChange({ ...input, index: v }); }} />
          <Toggle checked={input.reverse} onChange={(reverse) => onChange({ ...input, reverse })} label={t('operator.OperatorRcSettings.reversed')} />
        </>
      )}
    </div>
  );
}

/** Everything about one of the administrator's buttons, switches or sliders. */
export function FunctionEditor({ fn, pad, conflict, onChange }: {
  fn: OperatorRcFunction; pad: RcPad | null; conflict: boolean; onChange: (next: OperatorRcFunction) => void;
}) {
  const pwm = (value: number, set: (v: number) => void, name: string) => (
    <SmallNumber value={value} min={RC_PWM_MIN} max={RC_PWM_MAX} onCommit={set} label={name} />
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <TextField value={fn.label} label={t('operator.OperatorRcSettings.name')} onCommit={(label) => { if (label) onChange({ ...fn, label }); }} />
        <label className="flex flex-col gap-1 text-xs text-content-secondary">
          {t('operator.OperatorRcSettings.output')}
          <select value={fn.output} onChange={(e) => onChange({ ...fn, output: e.target.value as RcFunctionOutput })} className={`${FIELD} py-1`}>
            {RC_FUNCTION_OUTPUTS.map((o) => <option key={o} value={o}>{t(`operator.OperatorRcSettings.output_${o}`)}</option>)}
          </select>
        </label>
        <SmallNumber value={fn.channel} min={1} max={RC_MAX_CHANNEL} onCommit={(channel) => onChange({ ...fn, channel })}
          label={fn.output === 'rc' ? t('operator.OperatorRcSettings.channel') : t('operator.OperatorRcSettings.servoOutput')} />
        {fn.kind === 'button' && (
          <>
            {pwm(fn.offPwm, (offPwm) => onChange({ ...fn, offPwm }), t('operator.OperatorRcSettings.pwmOff'))}
            {pwm(fn.onPwm, (onPwm) => onChange({ ...fn, onPwm }), t('operator.OperatorRcSettings.pwmOn'))}
          </>
        )}
        {fn.kind === 'switch3' && (
          <>
            {pwm(fn.lowPwm, (lowPwm) => onChange({ ...fn, lowPwm }), t('operator.OperatorRcSettings.pwmLow'))}
            {pwm(fn.midPwm, (midPwm) => onChange({ ...fn, midPwm }), t('operator.OperatorRcSettings.pwmMid'))}
            {pwm(fn.highPwm, (highPwm) => onChange({ ...fn, highPwm }), t('operator.OperatorRcSettings.pwmHigh'))}
          </>
        )}
        {fn.kind === 'slider' && (
          <>
            {pwm(fn.minPwm, (minPwm) => onChange({ ...fn, minPwm }), t('operator.OperatorRcSettings.pwmMin'))}
            {pwm(fn.maxPwm, (maxPwm) => onChange({ ...fn, maxPwm }), t('operator.OperatorRcSettings.pwmMax'))}
          </>
        )}
      </div>
      {fn.output === 'servo' && <p className="text-xs leading-snug text-content-tertiary">{t('operator.OperatorRcSettings.servoHint')}</p>}
      {conflict && <p className="text-xs text-amber-400">{t('operator.OperatorRcSettings.channelConflict', { n: fn.channel })}</p>}

      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        {fn.kind === 'button' && (
          <Toggle checked={fn.latching} onChange={(latching) => onChange({ ...fn, latching })}
            label={t('operator.OperatorRcSettings.latching')} hint={t('operator.OperatorRcSettings.latchingHint')} />
        )}
        {fn.kind === 'switch3' && (
          <Toggle checked={fn.springCenter} onChange={(springCenter) => onChange({ ...fn, springCenter })}
            label={t('operator.OperatorRcSettings.springCenter')} hint={t('operator.OperatorRcSettings.springCenterHint')} />
        )}
        {fn.kind === 'slider' && (
          <label className="flex items-center gap-2 text-sm text-content">
            {t('operator.OperatorRcSettings.spring')}
            <select value={fn.spring} onChange={(e) => onChange({ ...fn, spring: e.target.value as RcSliderSpring })} className={`${FIELD} py-1`}>
              {RC_SLIDER_SPRINGS.map((sp) => <option key={sp} value={sp}>{t(`operator.OperatorRcSettings.spring_${sp}`)}</option>)}
            </select>
          </label>
        )}
        <Toggle checked={fn.sendOnConnect} onChange={(sendOnConnect) => onChange({ ...fn, sendOnConnect })}
          label={t('operator.OperatorRcSettings.sendOnConnect')} hint={t('operator.OperatorRcSettings.sendOnConnectHint')} />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="flex items-center gap-2 text-xs text-content-secondary">{t('operator.OperatorPanelSettings.icon')}<IconPicker value={fn.icon} onChange={(icon) => onChange({ ...fn, icon })} /></span>
        <span className="flex items-center gap-2 text-xs text-content-secondary">{t('operator.OperatorPanelSettings.color')}<ColorPicker value={fn.color} onChange={(color) => onChange({ ...fn, color })} /></span>
      </div>

      <InputEditor input={fn.input} pad={pad} onChange={(input) => onChange({ ...fn, input })} />
    </div>
  );
}

/** Settings → Operator workspace → driving: the joystick, cruise and reverse driving. */
export function OperatorRcSettings({ rc, onChange }: { rc: OperatorRcConfig; onChange: (next: OperatorRcConfig) => void }) {
  const { names, pad } = useJoystick(rc.padId);
  const sources = useCameraStore((s) => s.sources);
  const conflicts = rcChannelConflicts(rc);
  const sticks = driveSticks(rc.drive, pad);

  const drive = (patch: Partial<OperatorRcConfig['drive']>) => onChange({ ...rc, drive: { ...rc.drive, ...patch } });
  const cruise = (patch: Partial<OperatorRcConfig['cruise']>) => onChange({ ...rc, cruise: { ...rc.cruise, ...patch } });
  const reverse = (patch: Partial<OperatorRcConfig['reverse']>) => onChange({ ...rc, reverse: { ...rc.reverse, ...patch } });

  return (
    <>
      <Card title={t('operator.OperatorRcSettings.joystick')} hint={t('operator.OperatorRcSettings.joystickHint')}>
        <div className="flex flex-wrap items-center gap-2 text-sm text-content">
          <span>{t('operator.OperatorRcSettings.device')}</span>
          <select value={rc.padId} onChange={(e) => onChange({ ...rc, padId: e.target.value })} className={`${FIELD} max-w-md py-1`}>
            <option value="">{t('operator.OperatorRcSettings.deviceFirst')}</option>
            {[...new Set([...(rc.padId ? [rc.padId] : []), ...names])].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className={`text-xs ${pad ? 'text-emerald-400' : 'text-amber-400'}`}>
            {pad ? t('operator.OperatorRcSettings.joystickFound', { name: pad.id }) : t('operator.OperatorRcSettings.noJoystick')}
          </span>
        </div>

        <Toggle checked={rc.drive.enabled} onChange={(enabled) => drive({ enabled })}
          label={t('operator.OperatorRcSettings.driveEnabled')} hint={t('operator.OperatorRcSettings.driveEnabledHint')} />

        {rc.drive.enabled && (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Learn pad={pad} want="axis" value={rc.drive.steerAxis} clearable={false} label={t('operator.OperatorRcSettings.steerAxis')}
                onChange={(v) => { if (v !== null) drive({ steerAxis: v }); }} />
              <Toggle checked={rc.drive.steerReverse} onChange={(steerReverse) => drive({ steerReverse })} label={t('operator.OperatorRcSettings.reversed')} />
              <Meter value={sticks.steer} label={t('operator.OperatorRcSettings.steer')} />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Learn pad={pad} want="axis" value={rc.drive.throttleAxis} clearable={false} label={t('operator.OperatorRcSettings.throttleAxis')}
                onChange={(v) => { if (v !== null) drive({ throttleAxis: v }); }} />
              <Toggle checked={rc.drive.throttleReverse} onChange={(throttleReverse) => drive({ throttleReverse })} label={t('operator.OperatorRcSettings.reversed')} />
              <Meter value={sticks.throttle} label={t('operator.OperatorRcSettings.throttle')} />
            </div>
            <p className="text-xs leading-snug text-content-tertiary">{t('operator.OperatorRcSettings.axisCheckHint')}</p>
            <div className="flex flex-wrap items-end gap-3">
              <SmallNumber value={rc.drive.steerChannel} min={1} max={RC_MAX_CHANNEL} onCommit={(steerChannel) => drive({ steerChannel })} label={t('operator.OperatorRcSettings.steerChannel')} />
              <SmallNumber value={rc.drive.throttleChannel} min={1} max={RC_MAX_CHANNEL} onCommit={(throttleChannel) => drive({ throttleChannel })} label={t('operator.OperatorRcSettings.throttleChannel')} />
              <SmallNumber value={rc.drive.pwmMin} min={RC_PWM_MIN} max={RC_PWM_MAX} onCommit={(pwmMin) => drive({ pwmMin })} label={t('operator.OperatorRcSettings.pwmMin')} />
              <SmallNumber value={rc.drive.pwmTrim} min={RC_PWM_MIN} max={RC_PWM_MAX} onCommit={(pwmTrim) => drive({ pwmTrim })} label={t('operator.OperatorRcSettings.pwmTrim')} />
              <SmallNumber value={rc.drive.pwmMax} min={RC_PWM_MIN} max={RC_PWM_MAX} onCommit={(pwmMax) => drive({ pwmMax })} label={t('operator.OperatorRcSettings.pwmMax')} />
              <SmallNumber value={rc.drive.throttleLimit} min={10} max={100} onCommit={(throttleLimit) => drive({ throttleLimit })} label={t('operator.OperatorRcSettings.throttleLimit')} />
              <Percent value={rc.drive.deadband} max={50} onCommit={(deadband) => drive({ deadband })} label={t('operator.OperatorRcSettings.deadband')} />
              <Percent value={rc.drive.expo} onCommit={(expo) => drive({ expo })} label={t('operator.OperatorRcSettings.expo')} />
            </div>
            <Learn pad={pad} want="button" value={rc.drive.engageButton} label={t('operator.OperatorRcSettings.engageButton')}
              onChange={(engageButton) => drive({ engageButton })} />
          </>
        )}
        {conflicts.length > 0 && <p className="text-xs text-amber-400">{t('operator.OperatorRcSettings.conflicts', { list: conflicts.join(', ') })}</p>}
      </Card>

      <Card title={t('operator.OperatorRcSettings.cruise')} hint={t('operator.OperatorRcSettings.cruiseHint')}>
        <Toggle checked={rc.cruise.enabled} onChange={(enabled) => cruise({ enabled })} label={t('operator.OperatorRcSettings.cruiseEnabled')} />
        {rc.cruise.enabled && (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <SmallNumber value={rc.cruise.stepPercent} min={1} max={25} onCommit={(stepPercent) => cruise({ stepPercent })} label={t('operator.OperatorRcSettings.cruiseStep')} />
            <Learn pad={pad} want="button" value={rc.cruise.toggleButton} label={t('operator.OperatorRcSettings.cruiseToggle')} onChange={(toggleButton) => cruise({ toggleButton })} />
            <Learn pad={pad} want="button" value={rc.cruise.upButton} label={t('operator.OperatorRcSettings.cruiseUp')} onChange={(upButton) => cruise({ upButton })} />
            <Learn pad={pad} want="button" value={rc.cruise.downButton} label={t('operator.OperatorRcSettings.cruiseDown')} onChange={(downButton) => cruise({ downButton })} />
          </div>
        )}
      </Card>

      <Card title={t('operator.OperatorRcSettings.reverse')} hint={t('operator.OperatorRcSettings.reverseHint')}>
        <Toggle checked={rc.reverse.enabled} onChange={(enabled) => reverse({ enabled })} label={t('operator.OperatorRcSettings.reverseEnabled')} />
        {rc.reverse.enabled && (
          <>
            <Toggle checked={rc.reverse.invertSteering} onChange={(invertSteering) => reverse({ invertSteering })}
              label={t('operator.OperatorRcSettings.invertSteering')} hint={t('operator.OperatorRcSettings.invertSteeringHint')} />
            <Toggle checked={rc.reverse.switchCamera} onChange={(switchCamera) => reverse({ switchCamera })}
              label={t('operator.OperatorRcSettings.switchCamera')} />
            {rc.reverse.switchCamera && (
              <label className="flex flex-wrap items-center gap-2 text-sm text-content">
                {t('operator.OperatorRcSettings.rearCamera')}
                <select value={rc.reverse.cameraSourceId} onChange={(e) => reverse({ cameraSourceId: e.target.value })} className={`${FIELD} py-1`}>
                  <option value="">{t('operator.OperatorRcSettings.rearCameraAuto')}</option>
                  {Object.values(sources).map((s) => <option key={s.id} value={s.id}>{s.label ?? s.id}</option>)}
                </select>
              </label>
            )}
            <Learn pad={pad} want="button" value={rc.reverse.toggleButton} label={t('operator.OperatorRcSettings.reverseToggle')} onChange={(toggleButton) => reverse({ toggleButton })} />
          </>
        )}
      </Card>

    </>
  );
}
