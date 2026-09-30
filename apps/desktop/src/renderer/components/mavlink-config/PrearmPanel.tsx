/**
 * Why the vehicle will not arm, and what to do about it.
 *
 * ArduPilot already says why, one line at a time, buried in the message stream
 * and worded for the firmware rather than the pilot. This gathers the live
 * refusals, names the check each one belongs to, and offers the action that
 * clears it, including switching a check off when the hardware is genuinely
 * not there.
 */

import { useMemo } from 'react';
import { ShieldCheck, ShieldAlert, ArrowRight } from 'lucide-react';
import { useMessagesStore } from '../../stores/messages-store';
import { useNavigationStore, type ViewId } from '../../stores/navigation-store';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { currentPrearmFailures } from './prearm-status';
import {
  ARMING_CHECK_BITS,
  isCheckEnabled,
  withCheckDisabled,
  type ArmingModel,
} from './arming-checks';
import { t } from '../../i18n';

interface PrearmPanelProps {
  model: ArmingModel | null;
  value: number;
  onWrite: (value: number) => void;
  /** Jump to another configuration tab, when one can fix this. */
  onGoTo?: (tab: string) => void;
}

/** What actually clears each refusal, in the pilot's terms. */
const ADVICE: Record<number, { fix: string; tab?: string; view?: string; tabLabel?: string }> = {
  1: { fix: 'Let the board settle, or check the barometer is not in airflow.' },
  3: { fix: 'Wait for a 3D fix, or move where the sky is open.' },
  // Level writes AHRS_TRIM_* only; this check reads INS_ACCOFFS_*/INS_ACCSCAL_*,
  // which only the six-point calibration writes.
  4: { fix: 'Run the Quick accelerometer calibration (one position, vehicle level) or the 6-point one. Level only sets trims and never clears this.', view: 'calibration', get tabLabel() { return t('mavlink_config.PrearmPanel.openCalibration'); } },
  2: { fix: 'Calibrate the compass.', view: 'calibration', get tabLabel() { return t('mavlink_config.PrearmPanel.openCalibration'); } },
  5: { fix: 'A parameter is out of range; the message names it.', tab: 'parameters', get tabLabel() { return t('mavlink_config.PrearmPanel.openParameters'); } },
  6: { fix: 'Calibrate the radio and centre the sticks.', tab: 'receiver', get tabLabel() { return t('mavlink_config.PrearmPanel.openRc'); } },
  7: { fix: 'Check the supply to the autopilot, it is outside the safe range.' },
  8: { fix: 'Charge the pack or lower the arming voltage.', tab: 'battery', get tabLabel() { return t('mavlink_config.PrearmPanel.openBattery'); } },
  9: { fix: 'Calibrate or disable the airspeed sensor.' },
  10: { fix: 'No card, or logging failed to start. Turn logging off if the vehicle has no card.', tab: 'logging', get tabLabel() { return t('mavlink_config.PrearmPanel.openLogging'); } },
  11: { fix: 'Press the safety switch until the light goes solid.' },
  12: { fix: 'The receiver is not configured as ArduPilot expects; let it finish, or re-seat it.' },
  13: { fix: 'The estimator is not happy yet. Keep the vehicle still, or check the messages above.' },
  14: { fix: 'Load a valid mission, or clear the one on board.', tab: 'mission', get tabLabel() { return t('mavlink_config.PrearmPanel.openMission'); } },
  15: { fix: 'Check the rangefinder wiring and its parameters.' },
  16: { fix: 'Check the camera or gimbal is powered and reporting.' },
  17: { fix: 'The companion computer has not authorised arming.' },
  18: { fix: 'Visual odometry is not reporting.' },
  19: { fix: 'The in-flight FFT is not producing data.' },
};

export function PrearmPanel({ model, value, onWrite, onGoTo }: PrearmPanelProps): JSX.Element {
  const statusMessages = useMessagesStore((s) => s.messages);
  const armed = useTelemetryStore((s) => s.flight.armed);
  const setView = useNavigationStore((s) => s.setView);

  const failures = useMemo(
    () => currentPrearmFailures(statusMessages as Array<{ text: string; timestamp?: number }>),
    [statusMessages],
  );

  const blocked = failures.length > 0 && !armed;
  const nameFor = (bit: number | null) =>
    ARMING_CHECK_BITS.find((b) => b.bit === bit)?.name ?? null;

  return (
    <div className={`rounded-xl border p-5 ${
      armed
        ? 'border-blue-500/40 bg-blue-500/5'
        : blocked ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${
          blocked ? 'bg-amber-500/20' : 'bg-emerald-500/20'
        }`}>
          {blocked
            ? <ShieldAlert className="w-6 h-6 text-amber-400" />
            : <ShieldCheck className="w-6 h-6 text-emerald-400" />}
        </div>
        <div className="flex-1">
          <h3 className={`text-lg font-medium ${blocked ? 'text-amber-300' : 'text-emerald-300'}`}>
            {armed ? t('mavlink_config.PrearmPanel.armed') : blocked ? t('mavlink_config.PrearmPanel.willNotArm') : t('mavlink_config.PrearmPanel.readyToArm')}
          </h3>
          <p className="text-xs text-content-secondary">
            {armed
              ? t('mavlink_config.PrearmPanel.checksPassedAndTheMotorsAre')
              : blocked
                ? t('mavlink_config.PrearmPanel.inTheWayNewestFirst', { length: failures.length, v2: failures.length === 1 ? 'thing is' : 'things are' })
                : t('mavlink_config.PrearmPanel.noRefusalsReportedTheVehicleArms')}
          </p>
        </div>
      </div>

      {blocked && (
        <div className="mt-4 space-y-2">
          {failures.map((f) => {
            const name = nameFor(f.bit);
            const advice = f.bit !== null ? ADVICE[f.bit] : undefined;
            const canSkip = model !== null && f.bit !== null && isCheckEnabled(model, value, f.bit);
            return (
              <div key={f.text} className="rounded-lg border border-subtle bg-surface p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="text-sm text-content">{f.text}</div>
                    <div className="mt-0.5 text-[11px] text-content-tertiary">
                      {name ? `${name} check` : t('mavlink_config.PrearmPanel.noMatchingCheck')}
                      {advice ? ` · ${advice.fix}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {(advice?.tab || advice?.view) && (
                      <button
                        onClick={() => {
                          if (advice.view) setView(advice.view as ViewId);
                          else if (advice.tab && onGoTo) onGoTo(advice.tab);
                        }}
                        className="flex items-center gap-1 rounded-md bg-surface-raised px-2.5 py-1.5 text-[11px] text-content-secondary hover:text-content"
                      >
                        {advice.tabLabel} <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                    {canSkip && (
                      <button
                        onClick={() => onWrite(withCheckDisabled(model!, value, f.bit!))}
                        data-tip={t('mavlink_config.PrearmPanel.stopCheckingBeforeArmingOnlyDo', { name })}
                        className="rounded-md bg-amber-500/20 px-2.5 py-1.5 text-[11px] text-amber-200 hover:bg-amber-500/30"
                      >
                        {t('mavlink_config.PrearmPanel.skipThisCheck')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
