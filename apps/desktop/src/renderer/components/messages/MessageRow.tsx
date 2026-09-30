import type { StatusMessage } from '../../../shared/ipc-channels';

/** Severity → Tailwind color class */
export function severityColor(severity: number): string {
  switch (severity) {
    case 0: // EMERGENCY
    case 1: // ALERT
    case 2: // CRITICAL
      return 'text-red-400';
    case 3: // ERROR
      return 'text-red-400';
    case 4: // WARNING
      return 'text-amber-500';
    case 5: // NOTICE
      return 'text-blue-400';
    case 6: // INFO
      return 'text-content';
    case 7: // DEBUG
      return 'text-content-secondary';
    default:
      return 'text-content-secondary';
  }
}

/** Severity → left border color */
export function severityBorder(severity: number): string {
  switch (severity) {
    case 0:
    case 1:
    case 2:
    case 3:
      return 'border-l-red-500';
    case 4:
      return 'border-l-yellow-500';
    case 5:
      return 'border-l-blue-500';
    case 6:
      return 'border-l-subtle';
    case 7:
      return 'border-l-subtle';
    default:
      return 'border-l-subtle';
  }
}

/** Severity badge bg color */
export function severityBadgeBg(severity: number): string {
  switch (severity) {
    case 0:
    case 1:
    case 2:
    case 3:
      return 'bg-red-500/20 text-red-400';
    case 4:
      return 'bg-amber-500/20 text-amber-500';
    case 5:
      return 'bg-blue-500/20 text-blue-400';
    case 6:
      return 'bg-surface-raised text-content-secondary';
    case 7:
      return 'bg-surface-raised text-content-tertiary';
    default:
      return 'bg-surface-raised text-content-tertiary';
  }
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

/** Badge, text and repeat count: the part of a message row shared by the panel and the map instrument. */
export function MessageRowBody({ msg, clampLines }: { msg: StatusMessage; clampLines?: number }) {
  return (
    <>
      <span className={`shrink-0 text-[9px] font-mono font-bold px-1 py-0.5 rounded ${severityBadgeBg(msg.severity)} mt-0.5`}>
        {msg.severityLabel.slice(0, 4)}
      </span>
      <span
        className={`flex-1 min-w-0 text-xs font-mono leading-relaxed [overflow-wrap:anywhere] ${severityColor(msg.severity)} ${clampLines === 2 ? 'line-clamp-2' : ''}`}
        title={clampLines ? msg.text : undefined}
      >
        {msg.text}
      </span>
      {msg.count > 1 && (
        <span className="shrink-0 text-[9px] font-mono bg-surface-raised text-content-secondary px-1.5 py-0.5 rounded-full mt-0.5">
          x{msg.count}
        </span>
      )}
    </>
  );
}
