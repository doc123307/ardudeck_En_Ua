/**
 * The strip across the top of the operator screen: what the vehicle is doing right now,
 * in large type. Roll and pitch change colour as they near the angle at which the
 * vehicle may tip over.
 */

import { useEffect, useState, type ReactNode } from 'react';
import i18n from 'i18next';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { useConnectionStore } from '../../stores/connection-store';
import { useOperatorStore } from '../../stores/operator-store';
import { useSettingsStore } from '../../stores/settings-store';
import { formatSpeedFromMetersPerSecond } from '../../../shared/user-units.js';
import { fixKind, formatDuration, tiltLevel, type TiltLevel } from './operator-logic';
import { t } from '../../i18n';

/** The flight controller names its modes in English; the common ones are shown translated. */
export function modeLabel(mode: string): string {
  const key = `operator.modes.${mode.replace(/[^A-Za-z0-9]/g, '')}`;
  return i18n.exists(key) ? t(key) : mode;
}

const TILT_STYLE: Record<TiltLevel, string> = {
  ok: 'text-content',
  warn: 'text-amber-400',
  danger: 'rounded bg-red-600 px-1.5 text-white animate-pulse',
};

function Stat({ label, children, tip }: { label: string; children: ReactNode; tip?: string }) {
  return (
    <div className="flex flex-col items-start leading-none" data-tip={tip}>
      <span className="text-[10px] font-medium uppercase tracking-wider text-content-tertiary">{label}</span>
      <span className="mt-1 whitespace-nowrap font-mono text-lg font-semibold tabular-nums">{children}</span>
    </div>
  );
}

export function OperatorStatusBar({ recordingSince }: { recordingSince: number | null }) {
  const flight = useTelemetryStore((s) => s.flight);
  const gps = useTelemetryStore((s) => s.gps);
  const battery = useTelemetryStore((s) => s.battery);
  const attitude = useTelemetryStore((s) => s.attitude);
  const groundspeed = useTelemetryStore((s) => s.vfrHud.groundspeed);
  const connectionState = useConnectionStore((s) => s.connectionState);
  const speedUnit = useSettingsStore((s) => s.unitPreferences.speed);
  const warnDeg = useOperatorStore((s) => s.config.tiltWarnDeg);
  const limitDeg = useOperatorStore((s) => s.config.tiltLimitDeg);
  const connected = connectionState.isConnected;

  // The recording clock ticks on its own; telemetry may be silent.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (recordingSince === null && !connectionState.isStale) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [recordingSince, connectionState.isStale]);

  const dash = '--';
  const fix = fixKind(gps.fixType);
  const fixColor = !connected ? 'text-content-tertiary' : fix === 'none' ? 'text-red-400' : fix === '2d' ? 'text-amber-400' : 'text-emerald-400';
  const batteryColor = !connected || battery.remaining < 0
    ? 'text-content'
    : battery.remaining > 30 ? 'text-emerald-400' : battery.remaining > 15 ? 'text-amber-400' : 'text-red-400';
  const staleSeconds = connectionState.isStale && connectionState.staleSince
    ? Math.max(0, Math.floor((now - connectionState.staleSince) / 1000))
    : 0;

  return (
    <div className={`flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b px-4 py-2 ${
      connected && flight.armed ? 'border-red-500/40 bg-red-500/10' : 'border-subtle bg-surface'
    }`}>
      <span className={`whitespace-nowrap rounded px-3 py-1.5 text-sm font-bold uppercase tracking-wide ${
        !connected ? 'bg-surface-raised text-content-tertiary' : flight.armed ? 'bg-red-600 text-white' : 'bg-surface-raised text-content-secondary'
      }`}>
        {!connected ? t('operator.OperatorStatusBar.noLink') : flight.armed ? t('operator.OperatorStatusBar.armed') : t('operator.OperatorStatusBar.disarmed')}
      </span>

      <Stat label={t('operator.OperatorStatusBar.mode')}>
        <span className={connected ? 'text-content' : 'text-content-tertiary'}>{connected ? modeLabel(flight.mode) : dash}</span>
      </Stat>

      <Stat label={t('operator.OperatorStatusBar.satellites')}>
        <span className={fixColor}>
          {connected ? gps.satellites : dash}
          <span className="ml-1.5 text-xs font-medium">{connected ? t(`operator.OperatorStatusBar.fix_${fix}`) : ''}</span>
        </span>
      </Stat>

      <Stat label={t('operator.OperatorStatusBar.battery')}>
        <span className={batteryColor}>
          {connected ? `${battery.voltage.toFixed(1)} ${t('operator.OperatorStatusBar.volt')}` : dash}
          {connected && battery.remaining >= 0 && <span className="ml-1.5 text-sm">{battery.remaining.toFixed(0)}%</span>}
        </span>
      </Stat>

      <Stat label={t('operator.OperatorStatusBar.uptime')} tip={t('operator.OperatorStatusBar.uptimeTip')}>
        <span className="text-content">{connected && attitude.bootMs !== undefined ? formatDuration(attitude.bootMs) : dash}</span>
      </Stat>

      <Stat label={t('operator.OperatorStatusBar.speed')}>
        <span className="text-content">{connected ? formatSpeedFromMetersPerSecond(groundspeed, speedUnit) : dash}</span>
      </Stat>

      <Stat label={t('operator.OperatorStatusBar.roll')} tip={t('operator.OperatorStatusBar.tiltTip', { warn: warnDeg, limit: limitDeg })}>
        <span className={connected ? TILT_STYLE[tiltLevel(attitude.roll, warnDeg, limitDeg)] : 'text-content-tertiary'}>
          {connected ? `${attitude.roll.toFixed(0)}°` : dash}
        </span>
      </Stat>

      <Stat label={t('operator.OperatorStatusBar.pitch')} tip={t('operator.OperatorStatusBar.tiltTip', { warn: warnDeg, limit: limitDeg })}>
        <span className={connected ? TILT_STYLE[tiltLevel(attitude.pitch, warnDeg, limitDeg)] : 'text-content-tertiary'}>
          {connected ? `${attitude.pitch.toFixed(0)}°` : dash}
        </span>
      </Stat>

      <div className="flex-1" />

      {connectionState.isStale && (
        <span className="whitespace-nowrap rounded bg-amber-500/20 px-2.5 py-1 text-sm font-semibold text-amber-300">
          {t('operator.OperatorStatusBar.linkLost', { seconds: staleSeconds })}
        </span>
      )}

      {recordingSince !== null && (
        <span className="flex items-center gap-2 whitespace-nowrap rounded bg-red-600/20 px-2.5 py-1 text-sm font-semibold text-red-300">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          {t('operator.OperatorStatusBar.recording')} {formatDuration(now - recordingSince)}
        </span>
      )}
    </div>
  );
}
