/**
 * The vehicle's own messages on the operator screen: one line with the latest, which opens
 * into the list. What the flight controller says about itself - failsafes, pre-arm checks,
 * mode changes - is how the operator knows the state of the vehicle.
 */

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquareText, Trash2 } from 'lucide-react';
import { useMessagesStore } from '../../stores/messages-store';
import type { StatusMessage } from '../../../shared/ipc-channels';
import { t } from '../../i18n';

type Tone = 'danger' | 'warn' | 'info';

/** MAVLink severity: 0 emergency .. 3 error, 4 warning, 5 notice .. 7 debug. */
export function messageTone(severity: number): Tone {
  if (severity <= 3) return 'danger';
  return severity === 4 ? 'warn' : 'info';
}

const TEXT: Record<Tone, string> = { danger: 'text-red-400', warn: 'text-amber-400', info: 'text-content-secondary' };
const BADGE: Record<Tone, string> = {
  danger: 'bg-red-600 text-white',
  warn: 'bg-amber-500 text-black',
  info: 'bg-surface-raised text-content-secondary',
};

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour12: false });

function Line({ message }: { message: StatusMessage }) {
  const tone = messageTone(message.severity);
  return (
    <div className="flex items-baseline gap-2 border-b border-subtle/60 px-3 py-1 last:border-b-0">
      <span className={`w-[4.25rem] shrink-0 rounded px-1 text-center text-[9px] font-bold uppercase leading-4 ${BADGE[tone]}`}>
        {t(`operator.OperatorMessages.tone_${tone}`)}
      </span>
      <span className={`min-w-0 flex-1 select-text break-words text-xs ${TEXT[tone]}`}>{message.text}</span>
      {message.count > 1 && <span className="shrink-0 rounded bg-surface-raised px-1 font-mono text-[10px] text-content-tertiary">×{message.count}</span>}
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-content-tertiary">{time(message.timestamp)}</span>
    </div>
  );
}

export function OperatorMessages() {
  const messages = useMessagesStore((s) => s.messages);
  const clear = useMessagesStore((s) => s.clear);
  const [open, setOpen] = useState(false);
  // Warnings and errors that came since the list was last looked at.
  const [seenAt, setSeenAt] = useState(() => Date.now());
  useEffect(() => { if (open) setSeenAt(Date.now()); }, [open, messages]);

  const latest = messages[0];
  const fresh = open ? 0 : messages.filter((m) => m.timestamp > seenAt && m.severity <= 4).length;
  const latestTone = latest ? messageTone(latest.severity) : 'info';

  return (
    <div className="shrink-0 border-t border-subtle bg-surface">
      {open && (
        <div className="max-h-44 overflow-y-auto border-b border-subtle bg-surface-base">
          {messages.length === 0
            ? <p className="px-3 py-3 text-center text-xs text-content-tertiary">{t('operator.OperatorMessages.empty')}</p>
            : messages.map((m) => <Line key={`${m.severity}:${m.text}`} message={m} />)}
        </div>
      )}
      <div className="flex h-7 items-center gap-2 px-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          data-tip={open ? t('operator.OperatorMessages.hide') : t('operator.OperatorMessages.show')}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-content-tertiary" />
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-content-tertiary">{t('operator.OperatorMessages.title')}</span>
          {fresh > 0 && <span className="shrink-0 rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-4 text-white">{fresh}</span>}
          <span className={`min-w-0 flex-1 truncate text-xs ${latest ? TEXT[latestTone] : 'text-content-tertiary'}`}>
            {latest ? latest.text : t('operator.OperatorMessages.empty')}
          </span>
          {latest && <span className="shrink-0 font-mono text-[10px] tabular-nums text-content-tertiary">{time(latest.timestamp)}</span>}
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-content-tertiary" /> : <ChevronUp className="h-4 w-4 shrink-0 text-content-tertiary" />}
        </button>
        {open && messages.length > 0 && (
          <button type="button" onClick={clear} data-tip={t('operator.OperatorMessages.clear')} className="rounded p-1 text-content-tertiary hover:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
