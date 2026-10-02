/** Bottom-right corner of the operator screen: heading, altitude, speed and the time of day. */

import { useEffect, useState } from 'react';
import { Navigation2 } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { useConnectionStore } from '../../stores/connection-store';
import { useSettingsStore } from '../../stores/settings-store';
import { formatAltitudeFromMeters, formatSpeedFromMetersPerSecond } from '../../../shared/user-units.js';
import { t } from '../../i18n';

/** 0..360 -> one of eight compass points, as a translation key suffix. */
export function compassPoint(headingDeg: number): 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' {
  const points = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
  return points[Math.round((((headingDeg % 360) + 360) % 360) / 45) % 8]!;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/60">{label}</span>
      <span className="whitespace-nowrap font-mono text-base font-semibold tabular-nums text-white">{value}</span>
    </div>
  );
}

export function OperatorInfoBlock() {
  const connected = useConnectionStore((s) => s.connectionState.isConnected);
  const heading = useTelemetryStore((s) => s.vfrHud.heading);
  const groundspeed = useTelemetryStore((s) => s.vfrHud.groundspeed);
  const altitude = useTelemetryStore((s) => s.vfrHud.alt);
  const altitudeUnit = useSettingsStore((s) => s.unitPreferences.altitude);
  const speedUnit = useSettingsStore((s) => s.unitPreferences.speed);

  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dash = '--';
  return (
    <div className="pointer-events-auto flex items-center gap-4 rounded-xl border border-white/25 bg-black/70 px-4 py-3 shadow-xl">
      <div className="flex flex-col items-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/40">
          <span className="absolute -top-0.5 text-[10px] font-bold text-red-400">{t('operator.OperatorInfoBlock.point_n')}</span>
          <Navigation2
            className={`h-7 w-7 ${connected ? 'text-cyan-300' : 'text-white/30'}`}
            style={{ transform: `rotate(${connected ? heading : 0}deg)` }}
            fill="currentColor"
          />
        </div>
        <span className="mt-1 whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-white">
          {connected ? `${heading.toFixed(0)}° ${t(`operator.OperatorInfoBlock.point_${compassPoint(heading)}`)}` : dash}
        </span>
      </div>
      <div className="flex min-w-[9.5rem] flex-col gap-1.5">
        <Row label={t('operator.OperatorInfoBlock.altitude')} value={connected ? formatAltitudeFromMeters(altitude, altitudeUnit) : dash} />
        <Row label={t('operator.OperatorInfoBlock.speed')} value={connected ? formatSpeedFromMetersPerSecond(groundspeed, speedUnit) : dash} />
        <Row label={t('operator.OperatorInfoBlock.time')} value={clock.toLocaleTimeString([], { hour12: false })} />
      </div>
    </div>
  );
}
