/**
 * The strip across the top of the operator screen: what the vehicle is doing right now,
 * in large type. Which values it shows, and in what order, is the administrator's choice
 * (Settings → Operator workspace). Roll and pitch change colour as they near the angle
 * at which the vehicle may tip over.
 */

import { useEffect, useState, type ReactNode } from 'react';
import i18n from 'i18next';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { useConnectionStore } from '../../stores/connection-store';
import { useOperatorStore } from '../../stores/operator-store';
import { useSettingsStore } from '../../stores/settings-store';
import { formatAltitudeFromMeters, formatSpeedFromMetersPerSecond } from '../../../shared/user-units.js';
import { OPERATOR_STATUS_FIELDS, type OperatorStatusField } from '../../../shared/operator-types';
import {
  describeSource, formatValue, scaledValue, valueFieldKey, valueLevel, type OperatorValue, type ValueLevel,
} from '../../../shared/operator-panel';
import { useOperatorValues, type LiveValue } from '../../stores/operator-values';
import { fixKind, formatDuration, tiltLevel, type TiltLevel } from './operator-logic';
import { useOperatorRcStore } from '../../stores/operator-rc-store';
import type { OperatorRecording } from './useOperatorFeeds';
import { t } from '../../i18n';

/** The flight controller names its modes in English; the common ones are shown translated. */
export function modeLabel(mode: string): string {
  const key = `operator.modes.${mode.replace(/[^A-Za-z0-9]/g, '')}`;
  return i18n.exists(key) ? t(key) : mode;
}

/** Name of a built-in status value, for the strip and for the administrator's list. */
export function statusFieldLabel(field: OperatorStatusField): string {
  return t(`operator.OperatorStatusBar.${field}`);
}

export const isBuiltinField = (field: string): field is OperatorStatusField => (OPERATOR_STATUS_FIELDS as readonly string[]).includes(field);

const LEVEL_STYLE: Record<ValueLevel, string> = {
  ok: 'text-content',
  warn: 'text-amber-400',
  danger: 'rounded bg-red-600 px-1.5 text-white animate-pulse',
};

/** One of the administrator's own values, as the strip shows it. */
export function ValueText({ value, live }: { value: OperatorValue; live: LiveValue | undefined }) {
  const shown = live?.raw === null || live?.raw === undefined ? null : scaledValue(value, live.raw);
  const level = shown === null ? 'ok' : valueLevel(value, shown);
  return (
    <span className={shown === null || live?.stale ? 'text-content-tertiary' : LEVEL_STYLE[level]}>
      {formatValue(value, shown)}
    </span>
  );
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

export function OperatorStatusBar({ recording }: { recording: OperatorRecording }) {
  const recordingSince = recording.writingSince;
  const reverse = useOperatorRcStore((s) => s.state.reverse);
  const flight = useTelemetryStore((s) => s.flight);
  const gps = useTelemetryStore((s) => s.gps);
  const battery = useTelemetryStore((s) => s.battery);
  const attitude = useTelemetryStore((s) => s.attitude);
  const vfrHud = useTelemetryStore((s) => s.vfrHud);
  const connectionState = useConnectionStore((s) => s.connectionState);
  const speedUnit = useSettingsStore((s) => s.unitPreferences.speed);
  const altitudeUnit = useSettingsStore((s) => s.unitPreferences.altitude);
  const fields = useOperatorStore((s) => s.config.statusFields);
  const values = useOperatorStore((s) => s.config.values);
  const shownValues = values.filter((v) => fields.includes(valueFieldKey(v.id)));
  const live = useOperatorValues(shownValues);
  const warnDeg = useOperatorStore((s) => s.config.tiltWarnDeg);
  const limitDeg = useOperatorStore((s) => s.config.tiltLimitDeg);
  const connected = connectionState.isConnected;

  // The clocks tick on their own; telemetry may be silent.
  const wantsClock = fields.includes('clock');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (recordingSince === null && !connectionState.isStale && !wantsClock) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [recordingSince, connectionState.isStale, wantsClock]);

  const dash = '--';
  const plain = (text: string) => <span className={connected ? 'text-content' : 'text-content-tertiary'}>{connected ? text : dash}</span>;
  const tilt = (deg: number) => (
    <span className={connected ? TILT_STYLE[tiltLevel(deg, warnDeg, limitDeg)] : 'text-content-tertiary'}>
      {connected ? `${Math.round(deg) || 0}°` : dash}
    </span>
  );
  const tiltTip = t('operator.OperatorStatusBar.tiltTip', { warn: warnDeg, limit: limitDeg });

  const fix = fixKind(gps.fixType);
  const fixColor = !connected ? 'text-content-tertiary' : fix === 'none' ? 'text-red-400' : fix === '2d' ? 'text-amber-400' : 'text-emerald-400';
  const batteryColor = !connected || battery.remaining < 0
    ? 'text-content'
    : battery.remaining > 30 ? 'text-emerald-400' : battery.remaining > 15 ? 'text-amber-400' : 'text-red-400';

  const render: Record<OperatorStatusField, () => { value: ReactNode; tip?: string }> = {
    mode: () => ({ value: plain(modeLabel(flight.mode)) }),
    satellites: () => ({
      value: (
        <span className={fixColor}>
          {connected ? gps.satellites : dash}
          <span className="ml-1.5 text-xs font-medium">{connected ? t(`operator.OperatorStatusBar.fix_${fix}`) : ''}</span>
        </span>
      ),
    }),
    hdop: () => ({ value: plain(gps.hdop > 0 && gps.hdop < 99 ? gps.hdop.toFixed(1) : dash), tip: t('operator.OperatorStatusBar.hdopTip') }),
    battery: () => ({
      value: (
        <span className={batteryColor}>
          {connected ? `${battery.voltage.toFixed(1)} ${t('operator.OperatorStatusBar.volt')}` : dash}
          {connected && battery.remaining >= 0 && <span className="ml-1.5 text-sm">{battery.remaining.toFixed(0)}%</span>}
        </span>
      ),
    }),
    current: () => ({ value: plain(`${battery.current.toFixed(1)} ${t('operator.OperatorStatusBar.ampere')}`) }),
    uptime: () => ({
      value: <span className="text-content">{connected && attitude.bootMs !== undefined ? formatDuration(attitude.bootMs) : dash}</span>,
      tip: t('operator.OperatorStatusBar.uptimeTip'),
    }),
    speed: () => ({ value: plain(formatSpeedFromMetersPerSecond(vfrHud.groundspeed, speedUnit)) }),
    heading: () => ({ value: plain(`${vfrHud.heading.toFixed(0)}°`) }),
    altitude: () => ({ value: plain(formatAltitudeFromMeters(vfrHud.alt, altitudeUnit)) }),
    throttle: () => ({ value: plain(`${vfrHud.throttle.toFixed(0)}%`) }),
    roll: () => ({ value: tilt(attitude.roll), tip: tiltTip }),
    pitch: () => ({ value: tilt(attitude.pitch), tip: tiltTip }),
    clock: () => ({ value: <span className="text-content">{new Date(now).toLocaleTimeString([], { hour12: false })}</span> }),
  };

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

      {fields.map((field) => {
        if (isBuiltinField(field)) {
          const { value, tip } = render[field]();
          return <Stat key={field} label={statusFieldLabel(field)} tip={tip}>{value}</Stat>;
        }
        const own = values.find((v) => valueFieldKey(v.id) === field);
        if (!own) return null;
        return (
          <Stat key={field} label={own.label} tip={describeSource(own.source)}>
            <ValueText value={own} live={live[own.id]} />
          </Stat>
        );
      })}

      <div className="flex-1" />

      {connectionState.isStale && (
        <span className="whitespace-nowrap rounded bg-amber-500/20 px-2.5 py-1 text-sm font-semibold text-amber-300">
          {t('operator.OperatorStatusBar.linkLost', { seconds: staleSeconds })}
        </span>
      )}

      {reverse && (
        <span className="whitespace-nowrap rounded bg-amber-500 px-2.5 py-1 text-sm font-bold uppercase tracking-wide text-black" data-tip={t('operator.OperatorRcBar.reverseTip')}>
          {t('operator.OperatorStatusBar.reverse')}
        </span>
      )}

      {recording.wanted > 0 && recordingSince !== null && (
        <span
          className="flex items-center gap-2 whitespace-nowrap rounded bg-red-600/20 px-2.5 py-1 text-sm font-semibold text-red-300"
          data-tip={t('operator.OperatorStatusBar.recordingTip', { n: recording.writing, of: recording.wanted, dir: recording.dir })}
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          {t('operator.OperatorStatusBar.recording')} {formatDuration(now - recordingSince)}
          {recording.writing < recording.wanted && <span className="text-amber-300">{recording.writing}/{recording.wanted}</span>}
        </span>
      )}
      {recording.wanted > 0 && recordingSince === null && (
        recording.blocked ? (
          <span className="whitespace-nowrap rounded bg-red-600 px-2.5 py-1 text-sm font-semibold text-white" data-tip={recording.dir}>
            {t(recording.blocked === 'no-space' ? 'operator.OperatorStatusBar.recordNoSpace' : 'operator.OperatorStatusBar.recordNoFfmpeg')}
          </span>
        ) : (
          <span
            className="flex items-center gap-2 whitespace-nowrap rounded bg-amber-500/20 px-2.5 py-1 text-sm font-semibold text-amber-300"
            data-tip={t('operator.OperatorStatusBar.recordWaitingTip')}
          >
            <span className="h-2.5 w-2.5 rounded-full border-2 border-amber-400" />
            {t('operator.OperatorStatusBar.recordWaiting')}
          </span>
        )
      )}
    </div>
  );
}
