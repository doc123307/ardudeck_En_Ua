/**
 * Settings → "Operator workspace" → "Transmitter": everything about the joystick or RC
 * transmitter plugged into the station in one place - which device is read, a live check of
 * every stick, slider and button, calibration of the sticks' real travel, and what each
 * control is assigned to.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  calibrationFinish, calibrationGrow, calibrationStart, driveSticks, rcAssignmentClashes, rcAssignments,
  type OperatorRcConfig, type RcAssignment, type RcPad, type RcPadCalibration,
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

/** One axis: where it is now, raw and after calibration, and (while calibrating) the travel seen so far. */
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

type CalibrationStep = { step: 'center' } | { step: 'ends'; draft: RcPadCalibration };

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

  // Calibration: rest position first, then the ends, gathered from every reading while the sticks are moved.
  const [calibrating, setCalibrating] = useState<CalibrationStep | null>(null);
  const latestRaw = useRef<RcPad | null>(raw);
  latestRaw.current = raw;
  useEffect(() => {
    if (calibrating?.step !== 'ends' || !raw) return;
    setCalibrating((now) => (now?.step === 'ends' ? { step: 'ends', draft: calibrationGrow(now.draft, raw) } : now));
  }, [raw, calibrating?.step]);
  // The device was unplugged half-way: nothing to finish.
  useEffect(() => { if (!raw) setCalibrating(null); }, [raw]);

  const calibrated = config.padCalibration && raw && config.padCalibration.pad === raw.id ? config.padCalibration : null;
  const calibratedCount = calibrated?.axes.filter(Boolean).length ?? 0;
  const finish = () => {
    if (calibrating?.step === 'ends') save({ padCalibration: calibrationFinish(calibrating.draft) });
    setCalibrating(null);
  };

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
      </Card>

      {raw && pad && (
        <>
          <Card title={t('operator.OperatorPadSettings.check')} hint={t('operator.OperatorPadSettings.checkHint')}>
            <div className="flex flex-col gap-1.5">
              {raw.axes.map((value, i) => (
                <AxisRow
                  key={i}
                  index={i}
                  raw={value}
                  value={pad.axes[i] ?? 0}
                  roles={rolesOf(rc, assignments, 'axis', i)}
                  range={calibrating?.step === 'ends' ? calibrating.draft.axes[i] : undefined}
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

          <Card title={t('operator.OperatorPadSettings.calibration')} hint={t('operator.OperatorPadSettings.calibrationHint')}>
            {!calibrating && (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={`${BTN} flex items-center gap-2`} onClick={() => setCalibrating({ step: 'center' })}>
                  <SlidersHorizontal className="h-4 w-4" />{t('operator.OperatorPadSettings.calibrate')}
                </button>
                {calibrated && (
                  <button type="button" className={`${BTN} flex items-center gap-2`} onClick={() => save({ padCalibration: null })}>
                    <RotateCcw className="h-4 w-4" />{t('operator.OperatorPadSettings.calibrationReset')}
                  </button>
                )}
                <span className={`text-xs ${calibrated ? 'text-emerald-400' : 'text-content-tertiary'}`}>
                  {calibrated
                    ? t('operator.OperatorPadSettings.calibrated', { n: calibratedCount })
                    : config.padCalibration
                      ? t('operator.OperatorPadSettings.calibratedOther', { name: config.padCalibration.pad })
                      : t('operator.OperatorPadSettings.notCalibrated')}
                </span>
              </div>
            )}
            {calibrating?.step === 'center' && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-content">{t('operator.OperatorPadSettings.stepCenter')}</p>
                <div className="flex gap-2">
                  <button type="button" className={`${BTN} border-blue-500 text-blue-300`}
                    onClick={() => { if (latestRaw.current) setCalibrating({ step: 'ends', draft: calibrationStart(latestRaw.current) }); }}>
                    {t('operator.OperatorPadSettings.next')}
                  </button>
                  <button type="button" className={BTN} onClick={() => setCalibrating(null)}>{t('operator.OperatorPadSettings.cancel')}</button>
                </div>
              </div>
            )}
            {calibrating?.step === 'ends' && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-content">{t('operator.OperatorPadSettings.stepEnds')}</p>
                <div className="flex gap-2">
                  <button type="button" className={`${BTN} flex items-center gap-2 border-emerald-500 text-emerald-300`} onClick={finish}>
                    <Check className="h-4 w-4" />{t('operator.OperatorPadSettings.done')}
                  </button>
                  <button type="button" className={BTN} onClick={() => setCalibrating(null)}>{t('operator.OperatorPadSettings.cancel')}</button>
                </div>
              </div>
            )}
          </Card>
        </>
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
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Learn pad={pad} want="axis" value={rc.drive.steerAxis} clearable={false} label={t('operator.OperatorRcSettings.steerAxis')}
                onChange={(v) => { if (v !== null) drive({ steerAxis: v }); }} />
              <Toggle checked={rc.drive.steerReverse} onChange={(steerReverse) => drive({ steerReverse })} label={t('operator.OperatorRcSettings.reversed')} />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Learn pad={pad} want="axis" value={rc.drive.throttleAxis} clearable={false} label={t('operator.OperatorRcSettings.throttleAxis')}
                onChange={(v) => { if (v !== null) drive({ throttleAxis: v }); }} />
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
