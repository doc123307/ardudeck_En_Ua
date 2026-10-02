/**
 * StickTestPanel - injects synthetic RC stick positions via RC_CHANNELS_OVERRIDE
 * so the mixer drives outputs the same way real sticks would, for bench-testing
 * mixer-assigned outputs (DO_SET_SERVO gets overwritten by the mixer each cycle).
 *
 * Frame-aware: Plane shows Roll/Pitch/Throttle/Yaw and pins FLTMODE_CH to MANUAL;
 * Rover shows Steering/Throttle on the RCMAP channels and pins MODE_CH. Copter is
 * not supported here - force-arming a multirotor and injecting throttle spins the
 * props, so it points to Motor Test (DO_MOTOR_TEST) instead.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Gamepad2, Square, AlertTriangle } from 'lucide-react';
import { useParameterStore } from '../../../stores/parameter-store';
import { useTelemetryStore } from '../../../stores/telemetry-store';
import { useConnectionStore } from '../../../stores/connection-store';
import { t as tr } from '../../../i18n';

// 50 Hz so we can outpace ELRS-MAVLink's RC stream when the GCS connection is
// over ELRS. At 10Hz we lose the race; at 50Hz our values dominate.
const SEND_INTERVAL_MS = 20;
// custom_mode for MANUAL is 0 on both ArduPlane and ArduRover.
const MANUAL_MODE = 0;

type VehicleCategory = 'rover' | 'plane' | 'copter';
function categoryFromMavType(t: number | undefined): VehicleCategory {
  if (t === undefined) return 'copter';
  if (t === 10 || t === 11) return 'rover';           // GROUND_ROVER / SURFACE_BOAT
  if (t === 1 || (t >= 19 && t <= 25)) return 'plane'; // FIXED_WING / VTOL
  return 'copter';
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  center: number;
  onChange: (v: number) => void;
}

interface SliderRowExtProps extends SliderRowProps {
  fcValue: number;
}

const SliderRow: React.FC<SliderRowExtProps> = ({ label, value, min, max, center, onChange, fcValue }) => {
  const matches = Math.abs(fcValue - value) < 30; // within RC deadzone
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-sm text-content-secondary font-medium">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(center)}
        className="flex-1 accent-pink-500"
      />
      <div className="w-16 text-right text-sm font-mono text-content">{value}</div>
      <div className={`w-20 text-right text-xs font-mono ${fcValue === 0 ? 'text-content-tertiary' : matches ? 'text-emerald-400' : 'text-amber-400'}`}>
        FC: {fcValue || '-'}
      </div>
    </div>
  );
};

export const StickTestPanel: React.FC = () => {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roll, setRoll] = useState(1500);
  const [pitch, setPitch] = useState(1500);
  const [throttle, setThrottle] = useState(1100);
  const [yaw, setYaw] = useState(1500);

  // Track the original ARMING_CHECK so we can restore it on Release. We zero
  // it during the test because RC_CHANNELS_OVERRIDE doesn't satisfy ArduPilot's
  // "RC found" pre-arm gate even with force=21196.
  const savedArmingCheckRef = useRef<number | null>(null);
  // True from the first thing the test changes on the vehicle until Release has
  // undone it. The unmount cleanup only acts when this is set: opening and
  // leaving this tab must never disarm a vehicle that is driving or flying.
  const engagedRef = useRef(false);

  const parameters = useParameterStore((s) => s.parameters);
  const setParameter = useParameterStore((s) => s.setParameter);
  const mavType = useConnectionStore((s) => s.connectionState.mavType);
  const category = categoryFromMavType(mavType);
  const isRover = category === 'rover';
  // Rover throttle is bidirectional: 1500 = stop. Plane/copter rest at min.
  const throttleNeutral = isRover ? 1500 : 1100;

  // Live RC values as the FC sees them (msg 65 RC_CHANNELS). Diagnostic for
  // whether our RC_CHANNELS_OVERRIDE is winning at the FC's input layer.
  const rcChannels = useTelemetryStore((s) => s.rcChannels);
  const fcCh = (idx: number) => rcChannels?.channels[idx] ?? 0;

  // Mode channel pinned to the MANUAL band so a detached RX reading trim can't
  // switch the FC out of MANUAL mid-test. Plane: FLTMODE_CH, Rover: MODE_CH.
  const num = (name: string): number | undefined => parameters.get(name)?.value as number | undefined;
  const modeChannel = isRover ? num('MODE_CH') : num('FLTMODE_CH');
  const steerCh = num('RCMAP_ROLL') ?? 1;
  const thrCh = num('RCMAP_THROTTLE') ?? 3;

  const valuesRef = useRef({ roll, pitch, throttle, yaw });
  valuesRef.current = { roll, pitch, throttle, yaw };

  const sendOverride = useCallback((r: number, p: number, t: number, y: number) => {
    if (isRover) {
      const channels = new Array(18).fill(65535);
      channels[steerCh - 1] = r; // steering
      channels[thrCh - 1] = t;   // throttle
      if (modeChannel && modeChannel >= 5 && modeChannel <= 18) channels[modeChannel - 1] = 1000;
      void window.electronAPI?.rcOverrideSetChannels?.(channels);
    } else {
      void window.electronAPI?.rcOverrideSet?.(r, p, t, y, modeChannel, 1000);
    }
  }, [isRover, steerCh, thrCh, modeChannel]);

  // Park the throttle slider at the frame's neutral when idle (Rover 1500 = stop).
  useEffect(() => {
    if (!active) setThrottle(throttleNeutral);
  }, [throttleNeutral, active]);

  // Stream the override at 50Hz while active.
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const v = valuesRef.current;
      sendOverride(v.roll, v.pitch, v.throttle, v.yaw);
    };
    tick();
    const id = setInterval(tick, SEND_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, sendOverride]);

  const restoreArmingCheck = useCallback(async () => {
    const saved = savedArmingCheckRef.current;
    if (saved === null) return;
    savedArmingCheckRef.current = null;
    await setParameter('ARMING_CHECK', saved);
  }, [setParameter]);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    let preArmInterval: NodeJS.Timeout | null = null;
    try {
      // 1. Save and zero ARMING_CHECK. RC_CHANNELS_OVERRIDE does not satisfy
      //    the "RC present" pre-arm gate (even with force=21196), so we have
      //    to relax it for the duration of the test. Restored on Release.
      const currentCheck = parameters.get('ARMING_CHECK')?.value;
      if (currentCheck !== undefined && currentCheck !== 0) {
        const ok = await setParameter('ARMING_CHECK', 0);
        if (!ok) {
          setError(tr('mavlink_config.StickTestPanel.failedToRelaxArmingCheck'));
          setBusy(false);
          return;
        }
        savedArmingCheckRef.current = currentCheck;
      }

      // 2. Set mode to MANUAL so the mixer just passes sticks through with no
      //    autopilot stabilization fighting our demands.
      const modeOk = await window.electronAPI?.mavlinkSetMode?.(MANUAL_MODE);
      if (!modeOk) {
        setError(tr('mavlink_config.StickTestPanel.failedToSetManualMode'));
        setBusy(false);
        await restoreArmingCheck();
        return;
      }

      // 3. Stream centered RC override BEFORE arming so ArduPilot sees stable
      //    "RC present" values. Throttle at its neutral (Rover 1500 = stop,
      //    Plane 1100 = min) so it can't lurch on arm.
      setThrottle(throttleNeutral);
      const sendCentered = () => sendOverride(1500, 1500, throttleNeutral, 1500);
      sendCentered();
      preArmInterval = setInterval(sendCentered, SEND_INTERVAL_MS);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 4. Force-arm.
      engagedRef.current = true;
      const armOk = await window.electronAPI?.mavlinkArmDisarm?.(true, true);
      if (!armOk) {
        engagedRef.current = false;
        setError(tr('mavlink_config.StickTestPanel.failedToArmVehicleCheckMessages'));
        setBusy(false);
        if (preArmInterval) clearInterval(preArmInterval);
        void window.electronAPI?.rcOverrideRelease?.();
        await restoreArmingCheck();
        return;
      }

      // 5. Hand off streaming from the prearm interval to the active useEffect.
      if (preArmInterval) clearInterval(preArmInterval);
      setActive(true);
    } catch (e) {
      if (preArmInterval) clearInterval(preArmInterval);
      void window.electronAPI?.rcOverrideRelease?.();
      void restoreArmingCheck();
      setError(e instanceof Error ? e.message : tr('mavlink_config.StickTestPanel.unknownError'));
    } finally {
      setBusy(false);
    }
  }, [parameters, setParameter, sendOverride, throttleNeutral, restoreArmingCheck]);

  const release = useCallback(async () => {
    setBusy(true);
    setActive(false);
    setThrottle(isRover ? 1500 : 1000);
    setRoll(1500);
    setPitch(1500);
    setYaw(1500);
    try {
      await window.electronAPI?.rcOverrideRelease?.();
      await window.electronAPI?.mavlinkArmDisarm?.(false, true);
      engagedRef.current = false;
      // Restore ARMING_CHECK if we changed it.
      await restoreArmingCheck();
    } finally {
      setBusy(false);
    }
  }, [restoreArmingCheck, isRover]);

  // Safety: release on unmount so we don't leave the FC armed with overrides
  // and ARMING_CHECK relaxed if the user navigates away or closes the app.
  // Disarm only what this test armed.
  useEffect(() => {
    return () => {
      if (engagedRef.current) {
        engagedRef.current = false;
        void window.electronAPI?.rcOverrideRelease?.();
        void window.electronAPI?.mavlinkArmDisarm?.(false, true);
      }
      void restoreArmingCheck();
    };
  }, [restoreArmingCheck]);

  if (category === 'copter') {
    return (
      <div className="bg-surface rounded-xl border border-subtle p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
            <Gamepad2 className="w-5 h-5 text-pink-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-content">{tr('mavlink_config.StickTestPanel.stickTest')}</h3>
            <p className="text-sm text-content-secondary">
              {tr('mavlink_config.StickTestPanel.notAvailableOnMultirotorsInjectingThrottle')} <span className="text-pink-300 font-medium">{tr('mavlink_config.StickTestPanel.motorTest')}</span> {tr('mavlink_config.StickTestPanel.toBenchCheckOutputsOneMotor')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-subtle p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
          <Gamepad2 className="w-5 h-5 text-pink-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-content">{tr('mavlink_config.StickTestPanel.stickTest')}</h3>
          <p className="text-sm text-content-secondary">
            {tr('mavlink_config.StickTestPanel.injectSyntheticRcInputMixerDrives')}
          </p>
        </div>
        {active ? (
          <button
            type="button"
            disabled={busy}
            onClick={release}
            className="h-9 px-4 inline-flex items-center gap-2 rounded-lg border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 text-sm font-medium"
          >
            <Square className="w-4 h-4" /> {tr('mavlink_config.StickTestPanel.release')}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={start}
            className="h-9 px-4 inline-flex items-center gap-2 rounded-lg border border-pink-500/40 text-pink-300 bg-pink-500/10 hover:bg-pink-500/20 disabled:opacity-50 text-sm font-medium"
          >
            <Gamepad2 className="w-4 h-4" /> {tr('mavlink_config.StickTestPanel.start')}
          </button>
        )}
      </div>

      {!active && !busy && (
        <div className="mb-4 text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            {tr('mavlink_config.StickTestPanel.startSetsManualModeAndForce')} {isRover ? tr('mavlink_config.StickTestPanel.liftTheDriveWheelsOffThe') : tr('mavlink_config.StickTestPanel.removePropellers')} {tr('mavlink_config.StickTestPanel.beforePressingStart')}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isRover ? (
          <>
            <SliderRow label={tr('mavlink_config.StickTestPanel.steering')} value={roll}     min={1100} max={1900} center={1500} onChange={setRoll}     fcValue={fcCh(steerCh - 1)} />
            <SliderRow label={tr('mavlink_config.StickTestPanel.throttle')} value={throttle} min={1100} max={1900} center={throttleNeutral} onChange={setThrottle} fcValue={fcCh(thrCh - 1)} />
          </>
        ) : (
          <>
            <SliderRow label={tr('mavlink_config.StickTestPanel.roll')}     value={roll}     min={1100} max={1900} center={1500} onChange={setRoll}     fcValue={fcCh(0)} />
            <SliderRow label={tr('mavlink_config.StickTestPanel.pitch')}    value={pitch}    min={1100} max={1900} center={1500} onChange={setPitch}    fcValue={fcCh(1)} />
            <SliderRow label={tr('mavlink_config.StickTestPanel.throttle')} value={throttle} min={1100} max={1900} center={1100} onChange={setThrottle} fcValue={fcCh(2)} />
            <SliderRow label={tr('mavlink_config.StickTestPanel.yaw')}      value={yaw}      min={1100} max={1900} center={1500} onChange={setYaw}      fcValue={fcCh(3)} />
          </>
        )}
      </div>

      <div className="mt-2 text-[11px] text-content-tertiary">
        {tr('mavlink_config.StickTestPanel.fcColumnShowsWhatTheAutopilot')} {isRover ? `RC${steerCh}/RC${thrCh}` : 'RC1-4'} {tr('mavlink_config.StickTestPanel.msg65GreenMatchesYourSlider')}
      </div>

      {active && (
        <div className="mt-4 text-xs text-pink-400/80 bg-pink-500/5 border border-pink-500/20 rounded-lg p-3">
          {tr('mavlink_config.StickTestPanel.armedInManualModeOverrideStreaming')} {Math.round(1000 / SEND_INTERVAL_MS)}{tr('mavlink_config.StickTestPanel.hzClickReleaseToStopAnd')}
        </div>
      )}

      {error && (
        <div className="mt-4 text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
          {error}
        </div>
      )}
    </div>
  );
};
