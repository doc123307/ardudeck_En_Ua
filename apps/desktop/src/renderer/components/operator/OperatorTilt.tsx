/**
 * Roll and pitch of a ground vehicle as two small drawings: the vehicle seen from behind
 * leans with the roll, the vehicle seen from the side noses up and down with the pitch.
 * The colours follow the administrator's warning and limit angles, like the numbers do.
 */

import { useTelemetryStore } from '../../stores/telemetry-store';
import { useConnectionStore } from '../../stores/connection-store';
import { useOperatorStore } from '../../stores/operator-store';
import { tiltLevel, type TiltLevel } from './operator-logic';
import { t } from '../../i18n';

const STROKE: Record<TiltLevel, string> = { ok: '#67e8f9', warn: '#fbbf24', danger: '#f87171' };
const TEXT: Record<TiltLevel, string> = { ok: 'text-white', warn: 'text-amber-400', danger: 'text-red-400' };

function Gauge({ view, deg, level, live, label }: { view: 'rear' | 'side'; deg: number; level: TiltLevel; live: boolean; label: string }) {
  const color = live ? STROKE[level] : 'rgba(255,255,255,0.3)';
  // Drawn angles stop at 45°: past that the picture says "over", the number says how far.
  const shown = Math.max(-45, Math.min(45, deg));
  // From behind, a roll to the right drops the right side. From the side (nose to the right), pitch up lifts the nose.
  const angle = view === 'rear' ? shown : -shown;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 64 44" className={`h-11 w-16 ${live && level === 'danger' ? 'animate-pulse' : ''}`}>
        <line x1="4" y1="38" x2="60" y2="38" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="3 3" />
        <g transform={`rotate(${live ? angle : 0} 32 30)`} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
          {view === 'rear' ? (
            <>
              <rect x="20" y="14" width="24" height="14" rx="2" />
              <rect x="12" y="22" width="7" height="14" rx="2" fill={color} />
              <rect x="45" y="22" width="7" height="14" rx="2" fill={color} />
              <line x1="19" y1="28" x2="45" y2="28" />
            </>
          ) : (
            <>
              <path d="M12 28 V20 H40 L52 25 V28 Z" />
              <circle cx="20" cy="31" r="5" fill={color} />
              <circle cx="44" cy="31" r="5" fill={color} />
            </>
          )}
        </g>
      </svg>
      <span className="text-[9px] font-medium uppercase tracking-wider text-white/60">{label}</span>
      <span className={`font-mono text-sm font-semibold tabular-nums ${live ? TEXT[level] : 'text-white/40'}`}>
        {live ? `${Math.round(deg) || 0}°` : '--'}
      </span>
    </div>
  );
}

export function OperatorTilt() {
  const connected = useConnectionStore((s) => s.connectionState.isConnected);
  const roll = useTelemetryStore((s) => s.attitude.roll);
  const pitch = useTelemetryStore((s) => s.attitude.pitch);
  const warnDeg = useOperatorStore((s) => s.config.tiltWarnDeg);
  const limitDeg = useOperatorStore((s) => s.config.tiltLimitDeg);
  return (
    <div className="flex items-end gap-2" data-tip={t('operator.OperatorStatusBar.tiltTip', { warn: warnDeg, limit: limitDeg })}>
      <Gauge view="rear" deg={roll} level={tiltLevel(roll, warnDeg, limitDeg)} live={connected} label={t('operator.OperatorTilt.roll')} />
      <Gauge view="side" deg={pitch} level={tiltLevel(pitch, warnDeg, limitDeg)} live={connected} label={t('operator.OperatorTilt.pitch')} />
    </div>
  );
}
