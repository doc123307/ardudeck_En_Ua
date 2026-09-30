/**
 * Flying with a gamepad or a USB handset.
 *
 * The transport underneath is the same one the SITL stand-in uses (pseudo-tx →
 * RC_CHANNELS_OVERRIDE, unmapped channels left at 65535 so aux functions and
 * FLTMODE_CH are never hijacked, with a watchdog in main that releases the
 * override if frames stop). What this screen adds is the part that makes it
 * usable in a real cockpit: bind a control by moving it, see every channel
 * live, and take or release the sticks in one obvious place with the
 * preconditions checked first.
 */

import { useEffect, useState } from 'react';
import { Gamepad2, AlertTriangle, Hand, RotateCcw } from 'lucide-react';
import { usePseudoTxStore } from '../../stores/pseudo-tx-store';
import { useConnectionStore } from '../../stores/connection-store';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { preflightForControl, channelPwm } from '../../utils/joystick-safety';
import type { ChannelSource } from '../../utils/pseudo-tx';
import { VirtualSticks } from './VirtualSticks';
import { t } from '../../i18n';

/** The four a pilot must bind before anything else is worth showing. */
const PRIMARY = ['Roll', 'Pitch', 'Throttle', 'Yaw'];

function sourceLabel(src: ChannelSource): string {
  switch (src.kind) {
    case 'none': return 'not assigned';
    case 'axis': return `axis ${src.index}`;
    case 'button': return `button ${src.index}`;
    case 'button3': return `buttons ${src.low}/${src.high}`;
  }
}

function ChannelRow({ index }: { index: number }): JSX.Element {
  const mapping = usePseudoTxStore((s) => s.mapping);
  const raw = usePseudoTxStore((s) => s.raw);
  // On-screen sticks bypass the learned mapping, so recomputing the bar from
  // it shows a number the vehicle is not being sent. Read what was actually
  // put on the wire instead.
  const sent = usePseudoTxStore((s) => s.channels[index]);
  const usingVirtual = usePseudoTxStore((s) => s.virtualAxes !== null);
  const learning = usePseudoTxStore((s) => s.learning);
  const startLearn = usePseudoTxStore((s) => s.startLearn);
  const cancelLearn = usePseudoTxStore((s) => s.cancelLearn);
  const setSource = usePseudoTxStore((s) => s.setSource);
  const updateMap = usePseudoTxStore((s) => s.updateMap);

  const map = mapping[index];
  if (!map) return <></>;
  const pwm = usingVirtual ? (sent ?? null) : channelPwm(mapping, raw, index);
  const assigned = usingVirtual || map.source.kind !== 'none';
  const teaching = learning === index;
  // 1000-2000 over the bar's width; an unassigned channel shows no fill at all
  // rather than a neutral-looking centre it is not actually holding.
  const fill = pwm === null ? 0 : Math.max(0, Math.min(100, ((pwm - 1000) / 1000) * 100));

  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-16 shrink-0 text-[11px] text-content-secondary">
        {PRIMARY[index] ?? `Ch ${index + 1}`}
      </div>
      <div className="relative h-4 flex-1 rounded bg-surface-raised overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 ${assigned ? 'bg-blue-500/60' : 'bg-transparent'}`}
          style={{ width: `${fill}%` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] tabular-nums text-content">
          {pwm === null ? sourceLabel(map.source) : pwm}
        </div>
      </div>
      <button
        onClick={() => (teaching ? cancelLearn() : startLearn(index))}
        disabled={usingVirtual}
        className={`w-20 shrink-0 rounded px-2 py-1 text-[11px] transition-colors disabled:opacity-40 ${
          teaching ? 'bg-amber-500/20 text-amber-300' : 'bg-surface-raised text-content-secondary hover:text-content'
        }`}
      >
        {usingVirtual ? 'on-screen' : teaching ? t('panels.JoystickPanel.moveIt') : assigned ? sourceLabel(map.source) : t('panels.JoystickPanel.assign')}
      </button>
      <button
        onClick={() => updateMap(index, { reverse: !map.reverse })}
        disabled={!assigned}
        data-tip={t('panels.JoystickPanel.reverseThisChannel')}
        className={`w-8 shrink-0 rounded px-1 py-1 text-[11px] disabled:opacity-30 ${
          map.reverse ? 'bg-blue-500/20 text-blue-300' : 'bg-surface-raised text-content-secondary'
        }`}
      >
        ⇄
      </button>
      <button
        onClick={() => setSource(index, { kind: 'none' })}
        disabled={!assigned}
        data-tip={t('panels.JoystickPanel.clearThisAssignment')}
        className="w-8 shrink-0 rounded px-1 py-1 text-[11px] text-content-tertiary hover:text-content disabled:opacity-30"
      >
        ✕
      </button>
    </div>
  );
}

export function JoystickPanel(): JSX.Element {
  const enabled = usePseudoTxStore((s) => s.enabled);
  const connected = usePseudoTxStore((s) => s.connected);
  const setVirtualAxes = usePseudoTxStore((s) => s.setVirtualAxes);
  const usingVirtual = usePseudoTxStore((s) => s.virtualAxes !== null);
  const deviceName = usePseudoTxStore((s) => s.deviceName);
  const mappingMode = usePseudoTxStore((s) => s.mappingMode);
  const mapping = usePseudoTxStore((s) => s.mapping);
  const raw = usePseudoTxStore((s) => s.raw);
  const enable = usePseudoTxStore((s) => s.enable);
  const disable = usePseudoTxStore((s) => s.disable);
  const resetMapping = usePseudoTxStore((s) => s.resetMapping);
  const vehicleControl = usePseudoTxStore((s) => s.vehicleControl);
  const vehicleFps = usePseudoTxStore((s) => s.vehicleFps);
  const vehicleSendError = usePseudoTxStore((s) => s.vehicleSendError);
  const enableVehicleControl = usePseudoTxStore((s) => s.enableVehicleControl);
  const disableVehicleControl = usePseudoTxStore((s) => s.disableVehicleControl);

  const isConnected = useConnectionStore((s) => s.connectionState.isConnected);
  const armed = useTelemetryStore((s) => s.flight.armed);
  const [refused, setRefused] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const check = preflightForControl(mapping, raw);

  // Losing the device mid-flight must not leave the vehicle waiting on frames
  // that will never come: main's watchdog releases after 700 ms, and this stops
  // pretending the sticks are still ours.
  useEffect(() => {
    if (vehicleControl && !connected) {
      disableVehicleControl();
      setRefused('Controller disconnected, sticks released');
    }
  }, [vehicleControl, connected, disableVehicleControl]);

  const take = () => {
    setRefused(null);
    if (!check.ok) {
      setRefused(check.problems.join(' · '));
      return;
    }
    const r = enableVehicleControl();
    if (!r.ok) setRefused(r.reason ?? 'Could not take the sticks');
  };

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {/* Device */}
      <div className="rounded-xl border border-subtle bg-surface p-3">
        <div className="flex items-center gap-2">
          <Gamepad2 className={`w-4 h-4 ${connected ? 'text-emerald-400' : 'text-content-tertiary'}`} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-content">
              1 &middot; {connected ? deviceName || t('panels.JoystickPanel.controller') : enabled ? t('panels.JoystickPanel.waitingForAController') : t('panels.JoystickPanel.joystickInputIsOff')}
            </div>
            <div className="text-[11px] text-content-tertiary">
              {connected
                ? `${raw.axes.length} axes · ${raw.buttons.length} buttons`
                : enabled
                  ? t('panels.JoystickPanel.plugInAGamepadAndPress')
                  : t('panels.JoystickPanel.everythingBelowIsSwitchedOffUntil')}
            </div>
          </div>
          <button
            onClick={() => (enabled ? disable() : enable())}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-surface-raised text-content-secondary hover:text-content'
            }`}
          >
            {enabled ? 'On' : t('panels.JoystickPanel.off')}
          </button>
        </div>
        {enabled && connected && mappingMode === 'standard' && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-300">
            <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
            <span>
              {t('panels.JoystickPanel.theBrowserForcedThisDeviceInto')}
            </span>
          </div>
        )}
      </div>

      {/* Sticks */}
      {enabled && (
        <div className="rounded-xl border border-subtle bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-content">{t('panels.JoystickPanel.channels')}</span>
            {!usingVirtual && (
              <button
                onClick={resetMapping}
                className="flex items-center gap-1 text-[11px] text-content-tertiary hover:text-content"
              >
                <RotateCcw className="w-3 h-3" /> {t('panels.JoystickPanel.reset')}
              </button>
            )}
          </div>
          {usingVirtual && (
            <div className="mb-2 rounded-md bg-surface-raised px-2 py-1.5 text-[11px] text-content-tertiary">
              {t('panels.JoystickPanel.theOnScreenSticksDoNot')}
            </div>
          )}
          {[0, 1, 2, 3].map((i) => <ChannelRow key={i} index={i} />)}
          {showAll && Array.from({ length: 12 }, (_, k) => k + 4).map((i) => <ChannelRow key={i} index={i} />)}
          <button
            onClick={() => setShowAll((v) => !v)}
            className="mt-1 text-[11px] text-content-tertiary hover:text-content"
          >
            {showAll ? t('panels.JoystickPanel.hideChannels516') : t('panels.JoystickPanel.channels516')}
          </button>
        </div>
      )}

      {/* On-screen sticks: the fallback when there is no pad in the bag. */}
      <div className="rounded-xl border border-subtle bg-surface p-3">
        <div className="mb-2 flex items-center gap-2">
          <Hand className={`h-4 w-4 ${usingVirtual ? 'text-cyan-400' : 'text-content-tertiary'}`} />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-content">{t('panels.JoystickPanel.n2OnScreenSticks')}</div>
            <div className="text-[11px] text-content-tertiary">
              {enabled
                ? t('panels.JoystickPanel.whereTheStickPositionsComeFrom')
                : t('panels.JoystickPanel.turnJoystickInputOnAboveTo')}
            </div>
          </div>
          <button
            onClick={() => setVirtualAxes(usingVirtual ? null : [0, 1, 0, 0])}
            disabled={!enabled}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
              usingVirtual
                ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                : 'bg-surface-raised text-content-secondary hover:text-content'
            }`}
          >
            {usingVirtual ? t('panels.JoystickPanel.usingSticks') : t('panels.JoystickPanel.useSticks')}
          </button>
        </div>
        {usingVirtual && <VirtualSticks onAxes={setVirtualAxes} disabled={!enabled} />}
      </div>

      {/* Control */}
      <div className={`rounded-xl border p-3 ${vehicleControl ? 'border-blue-500/50 bg-blue-500/5' : 'border-subtle bg-surface'}`}>
        <div className="flex items-center gap-2">
          <Hand className={`w-4 h-4 ${vehicleControl ? 'text-blue-400' : 'text-content-tertiary'}`} />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-content">
              3 &middot; {vehicleControl ? t('panels.JoystickPanel.joystickHasTheSticks') : t('panels.JoystickPanel.vehicleFliesOnItsOwnReceiver')}
            </div>
            <div className="text-[11px] text-content-tertiary">
              {vehicleControl
                ? t('panels.JoystickPanel.framesSStopSendingAndThe', { vehicleFps })
                : !enabled
                  ? t('panels.JoystickPanel.turnJoystickInputOnAboveFirst')
                  : !connected
                    ? t('panels.JoystickPanel.pickAnInputFirstConnectA')
                    : !isConnected
                      ? t('panels.JoystickPanel.noVehicleConnected')
                      : t('panels.JoystickPanel.sendsYourSticksToTheVehicle')}
            </div>
          </div>
          <button
            onClick={() => (vehicleControl ? disableVehicleControl() : take())}
            disabled={!isConnected || !enabled || !connected}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
              vehicleControl
                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {vehicleControl ? t('panels.JoystickPanel.release') : t('panels.JoystickPanel.takeControl')}
          </button>
        </div>

        {!vehicleControl && enabled && connected && !check.ok && (
          <div className="mt-2 space-y-1">
            {check.problems.map((p) => (
              <div key={p} className="text-[11px] text-amber-300">{p}</div>
            ))}
          </div>
        )}
        {refused && <div className="mt-2 text-[11px] text-red-300">{refused}</div>}
        {vehicleSendError && <div className="mt-2 text-[11px] text-red-300">{vehicleSendError}</div>}
        {vehicleControl && armed && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-300">
            <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
            <span>
              {t('panels.JoystickPanel.armedTheSticksAreLiveThis')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
