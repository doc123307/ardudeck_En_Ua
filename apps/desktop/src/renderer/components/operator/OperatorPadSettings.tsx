/**
 * Settings → "Operator workspace" → "Transmitter": everything about the joystick or RC
 * transmitter plugged into the station in one place - which device is read, a set-up that
 * asks the user to show which stick is which and learns the sticks' real travel, a live
 * check drawn as the two sticks, and what each control is assigned to.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  RC_STICK_KEYS, calibrationFinish, calibrationGrow, calibrationStart, detectStickAxis, driveSticks, rcAssignmentClashes,
  rcAssignments, stickPositions, sticksAtRest,
  type OperatorRcConfig, type RcAssignment, type RcPad, type RcPadCalibration, type RcStickKey, type RcStickLayout,
} from '../../../shared/operator-rc';
import type { OperatorConfig } from '../../../shared/operator-types';
import { BTN, Card, FIELD, Toggle } from './OperatorSettingsParts';
import { InputEditor, Learn, Meter, useJoystick } from './OperatorRcSettings';
import { t } from '../../i18n';

const BUILT_IN_ROLE: Record<string, string> = {
  steer: 'operator.OperatorPadSettings.role_steer',
  throttle: 'operator.OperatorPadSettings.role_throttle',
  engage: 'operator.OperatorPadSettings.role_engage',
  cruiseToggle: 'operator.OperatorPadSettings.role_cruiseToggle',
  cruiseUp: 'operator.OperatorPadSettings.role_cruiseUp',
  cruiseDown: 'operator.OperatorPadSettings.role_cruiseDown',
  reverseToggle: 'operator.OperatorPadSettings.role_reverseToggle',
};

function roleName(rc: OperatorRcConfig, role: string): string {
  if (role.startsWith('fn:')) return rc.functions.find((f) => `fn:${f.id}` === role)?.label ?? role;
  const key = BUILT_IN_ROLE[role];
  return key ? t(key) : role;
}

const rolesOf = (rc: OperatorRcConfig, all: RcAssignment[], control: RcAssignment['control'], index: number) =>
  [...new Set(all.filter((a) => a.control === control && a.index === index).map((a) => roleName(rc, a.role)))];

/** One axis: where it is now, raw and after calibration, and (while setting up) the travel seen so far. */
function AxisRow({ index, raw, value, roles, range }: {
  index: number; raw: number; value: number; roles: string[]; range?: { min: number; center: number; max: number } | null;
}) {
  const pos = (v: number) => `${(Math.min(1, Math.max(-1, v)) + 1) * 50}%`;
  const half = Math.min(1, Math.abs(value)) * 50;
  return (
    <div className="flex items-center gap-3 text-xs text-content-secondary">
      <span className="w-12 shrink-0 text-content">{t('operator.OperatorRcSettings.axisN', { n: index + 1 })}</span>
      <span className="relative h-3 w-56 shrink-0 rounded bg-surface-raised">
        {range && <span className="absolute inset-y-0 rounded bg-blue-500/30" style={{ left: pos(range.min), width: `${(range.max - range.min) * 50}%` }} />}
        <span className="absolute inset-y-0 w-px bg-content-tertiary" style={{ left: '50%' }} />
        {!range && <span className="absolute inset-y-0 rounded bg-emerald-500/80" style={{ left: value >= 0 ? '50%' : `${50 - half}%`, width: `${half}%` }} />}
        <span className="absolute inset-y-[-2px] w-0.5 rounded bg-content" style={{ left: pos(raw) }} />
      </span>
      <span className="w-12 shrink-0 text-right font-mono tabular-nums text-content">{Math.round(value * 100)}%</span>
      <span className="w-16 shrink-0 font-mono tabular-nums text-content-tertiary">{raw.toFixed(2)}</span>
      <span className="min-w-0 truncate text-emerald-400">{roles.join(', ')}</span>
    </div>
  );
}

/**
 * A stick seen from above: the dot is the stick. `ask` lights the direction the set-up is
 * asking for; a stick the program does not know yet is drawn empty.
 */
function StickCircle({ title, position, ask, caption }: {
  title: string; position: { x: number; y: number } | null; ask?: 'x' | 'y' | null; caption?: string;
}) {
  const x = Math.min(1, Math.max(-1, position?.x ?? 0));
  const y = Math.min(1, Math.max(-1, position?.y ?? 0));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-content">{title}</span>
      <div className={`relative h-36 w-36 rounded-full border-2 bg-surface-raised ${ask ? 'border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.15)]' : position ? 'border-subtle' : 'border-dashed border-subtle'}`}>
        <span className="absolute inset-x-3 top-1/2 h-px bg-content-tertiary/40" />
        <span className="absolute inset-y-3 left-1/2 w-px bg-content-tertiary/40" />
        {ask === 'x' && <ArrowRight className="absolute right-1.5 top-1/2 h-6 w-6 -translate-y-1/2 animate-pulse text-blue-400" />}
        {ask === 'y' && <ArrowUp className="absolute left-1/2 top-1.5 h-6 w-6 -translate-x-1/2 animate-pulse text-blue-400" />}
        {position && (
          <span
            className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 bg-emerald-500 shadow"
            style={{ left: `${50 + x * 40}%`, top: `${50 - y * 40}%` }}
          />
        )}
      </div>
      <span className="h-4 font-mono text-[11px] tabular-nums text-content-tertiary">
        {caption ?? (position ? `${Math.round(x * 100)} / ${Math.round(y * 100)}` : t('operator.OperatorPadSettings.stickUnknown'))}
      </span>
    </div>
  );
}

/** The set-up, one question at a time: rest, the four stick directions, then the ends. */
type SetupStep = 'center' | RcStickKey | 'ends';
interface Setup {
  step: SetupStep;
  draft: RcPadCalibration | null;
  /** Where the sticks rested; directions are judged from here. */
  rest: number[];
  /** The stick just shown has to come back before the next question is asked. */
  waitRest: boolean;
}

const nextStep = (step: SetupStep): SetupStep => {
  if (step === 'center') return 'lx';
  const i = RC_STICK_KEYS.indexOf(step as RcStickKey);
  return i >= 0 && i < RC_STICK_KEYS.length - 1 ? RC_STICK_KEYS[i + 1]! : 'ends';
};

/** Stick positions while setting up: straight from the raw readings, measured from rest. */
function draftPositions(raw: RcPad, setup: Setup) {
  const moved = raw.axes.map((a, i) => Math.min(1, Math.max(-1, (a - (setup.rest[i] ?? 0)) * 1.1)));
  return stickPositions(moved, setup.draft?.sticks ?? { lx: null, ly: null, rx: null, ry: null });
}

const STICK_OPTIONS: { key: RcStickKey; label: string }[] = [
  { key: 'lx', label: 'operator.OperatorPadSettings.stick_lx' },
  { key: 'ly', label: 'operator.OperatorPadSettings.stick_ly' },
  { key: 'rx', label: 'operator.OperatorPadSettings.stick_rx' },
  { key: 'ry', label: 'operator.OperatorPadSettings.stick_ry' },
];

/** "Which stick": picks the axis and its direction from what the set-up learned. */
function StickPick({ sticks, axis, onPick }: { sticks: RcStickLayout; axis: number; onPick: (axis: number, reverse: boolean) => void }) {
  const known = STICK_OPTIONS.filter((o) => sticks[o.key]);
  if (known.length === 0) return null;
  const current = known.find((o) => sticks[o.key]!.axis === axis)?.key ?? '';
  return (
    <select
      value={current}
      onChange={(e) => { const s = sticks[e.target.value as RcStickKey]; if (s) onPick(s.axis, s.invert); }}
      className={`${FIELD} py-1`}
    >
      {current === '' && <option value="">{t('operator.OperatorPadSettings.stickOther')}</option>}
      {known.map((o) => <option key={o.key} value={o.key}>{t(o.label)}</option>)}
    </select>
  );
}

export function OperatorPadSettings({ config, save }: { config: OperatorConfig; save: (patch: Partial<OperatorConfig>) => void }) {
  const rc = config.rc;
  const { names, pad, raw } = useJoystick(rc.padId, config.padCalibration);
  const assignments = rcAssignments(rc);
  const clashes = rcAssignmentClashes(rc);
  const sticks = driveSticks(rc.drive, pad);

  const setRc = (next: OperatorRcConfig) => save({ rc: next });
  const drive = (patch: Partial<OperatorRcConfig['drive']>) => setRc({ ...rc, drive: { ...rc.drive, ...patch } });
  const cruise = (patch: Partial<OperatorRcConfig['cruise']>) => setRc({ ...rc, cruise: { ...rc.cruise, ...patch } });
  const reverse = (patch: Partial<OperatorRcConfig['reverse']>) => setRc({ ...rc, reverse: { ...rc.reverse, ...patch } });

  const [setup, setSetup] = useState<Setup | null>(null);
  const latestRaw = useRef<RcPad | null>(raw);
  latestRaw.current = raw;

  // Every reading while the set-up runs: the ends grow, and the stick asked for is looked for.
  useEffect(() => {
    if (!raw) { setSetup(null); return; }
    setSetup((now) => {
      if (!now || !now.draft || now.step === 'center') return now;
      const draft = calibrationGrow(now.draft, raw);
      if (now.step === 'ends') return { ...now, draft };
      if (now.waitRest) return { ...now, draft, waitRest: !sticksAtRest(now.rest, raw.axes) };
      const taken = RC_STICK_KEYS.map((k) => draft.sticks[k]?.axis).filter((a): a is number => a !== undefined);
      const found = detectStickAxis(now.rest, raw.axes, taken);
      if (!found) return { ...now, draft };
      return { ...now, draft: { ...draft, sticks: { ...draft.sticks, [now.step]: found } }, step: nextStep(now.step), waitRest: true };
    });
  }, [raw]);

  const begin = () => setSetup({ step: 'center', draft: null, rest: [], waitRest: false });
  const afterCenter = () => {
    const now = latestRaw.current;
    if (now) setSetup({ step: 'lx', draft: calibrationStart(now), rest: [...now.axes], waitRest: false });
  };
  const skip = () => setSetup((now) => (now ? { ...now, step: nextStep(now.step), waitRest: false } : now));
  const finish = () => {
    if (setup?.draft) {
      const done = calibrationFinish(setup.draft);
      const patch: Partial<OperatorConfig> = { padCalibration: done };
      // The usual way to drive: throttle on the left stick, steering on the right one.
      const steer = done?.sticks.rx;
      const throttle = done?.sticks.ly;
      if (steer && throttle) {
        patch.rc = { ...rc, drive: { ...rc.drive, steerAxis: steer.axis, steerReverse: steer.invert, throttleAxis: throttle.axis, throttleReverse: throttle.invert } };
      }
      save(patch);
    }
    setSetup(null);
  };

  const calibrated = config.padCalibration && raw && config.padCalibration.pad === raw.id ? config.padCalibration : null;
  const layout = calibrated?.sticks ?? { lx: null, ly: null, rx: null, ry: null };
  const positions = raw && setup && setup.step !== 'center' ? draftPositions(raw, setup) : stickPositions(pad?.axes ?? [], layout);
  const ask = setup && setup.step !== 'center' && setup.step !== 'ends' ? setup.step : null;
  const stickKnown = (key: RcStickKey) => (setup?.draft ? setup.draft.sticks[key] : layout[key]);
  const axisName = (key: RcStickKey) => {
    const s = stickKnown(key);
    return s ? t('operator.OperatorRcSettings.axisN', { n: s.axis + 1 }) : '—';
  };
  // A device the station has not been shown yet: say so instead of waiting to be asked.
  const isNew = !!raw && !calibrated && !setup;

  return (
    <>
      <Card title={t('operator.OperatorPadSettings.device')} hint={t('operator.OperatorPadSettings.deviceHint')}>
        <div className="flex flex-wrap items-center gap-2 text-sm text-content">
          <select value={rc.padId} onChange={(e) => setRc({ ...rc, padId: e.target.value })} className={`${FIELD} max-w-md py-1`}>
            <option value="">{t('operator.OperatorPadSettings.deviceAuto')}</option>
            {[...new Set([...(rc.padId ? [rc.padId] : []), ...names])].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className={`flex items-center gap-1.5 text-xs ${raw ? 'text-emerald-400' : 'text-amber-400'}`}>
            <span className={`h-2 w-2 rounded-full ${raw ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            {raw
              ? t('operator.OperatorPadSettings.found', { name: raw.id, axes: raw.axes.length, buttons: raw.buttons.length })
              : t('operator.OperatorPadSettings.notFound')}
          </span>
        </div>
        {!raw && <p className="text-xs leading-snug text-content-tertiary">{t('operator.OperatorPadSettings.notFoundHint')}</p>}
        {isNew && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2">
            <span className="text-sm text-amber-300">
              {config.padCalibration
                ? t('operator.OperatorPadSettings.calibratedOther', { name: config.padCalibration.pad })
                : t('operator.OperatorPadSettings.newDevice')}
            </span>
            <button type="button" className={`${BTN} border-blue-500 bg-blue-600 text-white`} onClick={begin}>{t('operator.OperatorPadSettings.setupStart')}</button>
          </div>
        )}
      </Card>

      {raw && pad && (
        <Card title={t('operator.OperatorPadSettings.sticks')} hint={t('operator.OperatorPadSettings.sticksHint')}>
          <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
            <div className="flex gap-8">
              <StickCircle title={t('operator.OperatorPadSettings.leftStick')} position={positions.left}
                ask={ask === 'lx' ? 'x' : ask === 'ly' ? 'y' : null}
                caption={setup ? `↔ ${axisName('lx')} · ↕ ${axisName('ly')}` : undefined} />
              <StickCircle title={t('operator.OperatorPadSettings.rightStick')} position={positions.right}
                ask={ask === 'rx' ? 'x' : ask === 'ry' ? 'y' : null}
                caption={setup ? `↔ ${axisName('rx')} · ↕ ${axisName('ry')}` : undefined} />
            </div>

            <div className="flex min-w-[16rem] flex-1 flex-col gap-3">
              {!setup && (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className={`${BTN} flex items-center gap-2`} onClick={begin}>
                      <SlidersHorizontal className="h-4 w-4" />{t(calibrated ? 'operator.OperatorPadSettings.setupAgain' : 'operator.OperatorPadSettings.setupStart')}
                    </button>
                    {calibrated && (
                      <button type="button" className={`${BTN} flex items-center gap-2`} onClick={() => save({ padCalibration: null })}>
                        <RotateCcw className="h-4 w-4" />{t('operator.OperatorPadSettings.calibrationReset')}
                      </button>
                    )}
                  </div>
                  <span className={`text-xs ${calibrated ? 'text-emerald-400' : 'text-content-tertiary'}`}>
                    {calibrated
                      ? t('operator.OperatorPadSettings.calibrated', { n: calibrated.axes.filter(Boolean).length })
                      : t('operator.OperatorPadSettings.notCalibrated')}
                  </span>
                </>
              )}
              {setup?.step === 'center' && (
                <>
                  <p className="text-sm text-content">{t('operator.OperatorPadSettings.stepCenter')}</p>
                  <div className="flex gap-2">
                    <button type="button" className={`${BTN} border-blue-500 bg-blue-600 text-white`} onClick={afterCenter}>{t('operator.OperatorPadSettings.next')}</button>
                    <button type="button" className={BTN} onClick={() => setSetup(null)}>{t('operator.OperatorPadSettings.cancel')}</button>
                  </div>
                </>
              )}
              {ask && (
                <>
                  <p className="text-xs text-content-tertiary">{t('operator.OperatorPadSettings.stepOf', { n: RC_STICK_KEYS.indexOf(ask) + 2, total: 6 })}</p>
                  <p className="text-base font-semibold text-content">
                    {setup?.waitRest ? t('operator.OperatorPadSettings.letGo') : t(`operator.OperatorPadSettings.ask_${ask}`)}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" className={BTN} onClick={skip}>{t('operator.OperatorPadSettings.skip')}</button>
                    <button type="button" className={BTN} onClick={() => setSetup(null)}>{t('operator.OperatorPadSettings.cancel')}</button>
                  </div>
                </>
              )}
              {setup?.step === 'ends' && (
                <>
                  <p className="text-xs text-content-tertiary">{t('operator.OperatorPadSettings.stepOf', { n: 6, total: 6 })}</p>
                  <p className="text-sm text-content">{t('operator.OperatorPadSettings.stepEnds')}</p>
                  <div className="flex gap-2">
                    <button type="button" className={`${BTN} flex items-center gap-2 border-emerald-500 bg-emerald-600 text-white`} onClick={finish}>
                      <Check className="h-4 w-4" />{t('operator.OperatorPadSettings.done')}
                    </button>
                    <button type="button" className={BTN} onClick={() => setSetup(null)}>{t('operator.OperatorPadSettings.cancel')}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      {raw && pad && (
        <Card title={t('operator.OperatorPadSettings.check')} hint={t('operator.OperatorPadSettings.checkHint')}>
          <div className="flex flex-col gap-1.5">
            {raw.axes.map((value, i) => (
              <AxisRow
                key={i}
                index={i}
                raw={value}
                value={pad.axes[i] ?? 0}
                roles={rolesOf(rc, assignments, 'axis', i)}
                range={setup?.draft ? setup.draft.axes[i] : undefined}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {raw.buttons.map((down, i) => {
              const roles = rolesOf(rc, assignments, 'button', i);
              return (
                <span
                  key={i}
                  data-tip={roles.length ? roles.join(', ') : t('operator.OperatorPadSettings.buttonFree')}
                  className={`flex h-7 min-w-7 items-center justify-center rounded border px-1 font-mono text-xs tabular-nums ${
                    down ? 'border-emerald-400 bg-emerald-500 text-white' : roles.length ? 'border-emerald-500/60 text-emerald-300' : 'border-subtle text-content-tertiary'
                  }`}
                >
                  {i + 1}
                </span>
              );
            })}
          </div>
          {rc.drive.enabled && (
            <div className="flex flex-wrap items-center gap-x-8 gap-y-1 border-t border-subtle pt-2">
              <span className="text-xs text-content-secondary">{t('operator.OperatorPadSettings.result')}</span>
              <Meter value={sticks.steer} label={t('operator.OperatorRcSettings.steer')} />
              <Meter value={sticks.throttle} label={t('operator.OperatorRcSettings.throttle')} />
            </div>
          )}
        </Card>
      )}

      <Card title={t('operator.OperatorPadSettings.assign')} hint={t('operator.OperatorPadSettings.assignHint')}>
        {clashes.map((group) => (
          <p key={`${group[0]!.control}:${group[0]!.index}`} className="text-xs text-amber-400">
            {t('operator.OperatorPadSettings.clash', {
              control: t(group[0]!.control === 'axis' ? 'operator.OperatorRcSettings.axisN' : 'operator.OperatorRcSettings.buttonN', { n: group[0]!.index + 1 }),
              list: [...new Set(group.map((a) => roleName(rc, a.role)))].join(', '),
            })}
          </p>
        ))}
        {rc.drive.enabled && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Learn pad={pad} want="axis" value={rc.drive.steerAxis} clearable={false} label={t('operator.OperatorRcSettings.steerAxis')}
                onChange={(v) => { if (v !== null) drive({ steerAxis: v }); }} />
              <StickPick sticks={layout} axis={rc.drive.steerAxis} onPick={(steerAxis, steerReverse) => drive({ steerAxis, steerReverse })} />
              <Toggle checked={rc.drive.steerReverse} onChange={(steerReverse) => drive({ steerReverse })} label={t('operator.OperatorRcSettings.reversed')} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Learn pad={pad} want="axis" value={rc.drive.throttleAxis} clearable={false} label={t('operator.OperatorRcSettings.throttleAxis')}
                onChange={(v) => { if (v !== null) drive({ throttleAxis: v }); }} />
              <StickPick sticks={layout} axis={rc.drive.throttleAxis} onPick={(throttleAxis, throttleReverse) => drive({ throttleAxis, throttleReverse })} />
              <Toggle checked={rc.drive.throttleReverse} onChange={(throttleReverse) => drive({ throttleReverse })} label={t('operator.OperatorRcSettings.reversed')} />
            </div>
            <Learn pad={pad} want="button" value={rc.drive.engageButton} label={t('operator.OperatorRcSettings.engageButton')}
              onChange={(engageButton) => drive({ engageButton })} />
          </>
        )}
        {rc.cruise.enabled && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-xs font-medium text-content">{t('operator.OperatorPadSettings.cruise')}</span>
            <Learn pad={pad} want="button" value={rc.cruise.toggleButton} label={t('operator.OperatorRcSettings.cruiseToggle')} onChange={(toggleButton) => cruise({ toggleButton })} />
            <Learn pad={pad} want="button" value={rc.cruise.upButton} label={t('operator.OperatorRcSettings.cruiseUp')} onChange={(upButton) => cruise({ upButton })} />
            <Learn pad={pad} want="button" value={rc.cruise.downButton} label={t('operator.OperatorRcSettings.cruiseDown')} onChange={(downButton) => cruise({ downButton })} />
          </div>
        )}
        {rc.reverse.enabled && (
          <Learn pad={pad} want="button" value={rc.reverse.toggleButton} label={t('operator.OperatorRcSettings.reverseToggle')} onChange={(toggleButton) => reverse({ toggleButton })} />
        )}
        {rc.functions.map((fn) => (
          <div key={fn.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-subtle pt-2">
            <span className="w-28 shrink-0 truncate text-sm font-medium text-content">{fn.label}</span>
            <InputEditor input={fn.input} pad={pad} onChange={(input) => setRc({ ...rc, functions: rc.functions.map((f) => (f.id === fn.id ? { ...f, input } : f)) })} />
          </div>
        ))}
      </Card>
    </>
  );
}
