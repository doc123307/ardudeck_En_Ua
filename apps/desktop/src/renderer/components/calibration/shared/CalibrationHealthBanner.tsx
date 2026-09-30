/**
 * Standing statement of what the vehicle's calibration is actually worth.
 *
 * The wizard's completion screen is seen once and then the operator reboots,
 * disconnects, comes back another day and has no way to tell whether the
 * calibration took. This banner answers that on the first screen of the
 * wizard, every time, from the record stored against this board:
 *
 *   - confirmed on the vehicle after a reboot
 *   - accepted, but the values are weak
 *   - did not survive the reboot, which is a do-not-fly
 *   - still waiting to be checked
 *
 * "No record" says exactly that rather than implying anything is fine.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, ShieldAlert } from 'lucide-react';
import { useConnectionStore } from '../../../stores/connection-store';
import { useCalibrationStore } from '../../../stores/calibration-store';
import { CALIBRATION_TYPES } from '../../../../shared/calibration-types';
import type { CalibrationRecordIpc } from '../../../../shared/calibration-quality';
import { t as tr } from '../../../i18n';

type Tone = 'good' | 'warn' | 'danger' | 'neutral';

const TONE_STYLE: Record<Tone, string> = {
  good: 'bg-green-500/10 border-green-500/30 text-green-300',
  warn: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  danger: 'bg-red-500/10 border-red-500/30 text-red-300',
  neutral: 'bg-surface-raised border-subtle text-content-secondary',
};

function typeLabel(type: string): string {
  return CALIBRATION_TYPES.find((t) => t.id === type)?.name ?? type;
}

/** The record's overall standing. Persistence outranks fit quality: a value
 *  that is not on the vehicle cannot be good, however well it measured. */
function assess(record: CalibrationRecordIpc): { tone: Tone; headline: string; detail: string } {
  const name = typeLabel(record.type);

  if (record.persistence && record.persistence.state !== 'verified') {
    return {
      tone: 'danger',
      headline: `${name} calibration did not survive the reboot`,
      detail: tr('calibration.CalibrationHealthBanner.doNotFlyOnThisCalibration', { summary: record.persistence.summary }),
    };
  }
  if (!record.persistence) {
    return {
      tone: 'warn',
      headline: `${name} calibration not yet confirmed`,
      detail: tr('calibration.CalibrationHealthBanner.rebootTheFlightControllerAndReconnect'),
    };
  }
  if (record.verdict === 'bad' || record.verdict === 'marginal') {
    return {
      tone: record.verdict === 'bad' ? 'danger' : 'warn',
      headline: `${name} calibration is on the vehicle, but weak`,
      detail: record.summary,
    };
  }
  return {
    tone: 'good',
    headline: `${name} calibration confirmed on the vehicle`,
    detail: record.summary,
  };
}

const TONE_ICON: Record<Tone, typeof CheckCircle2> = {
  good: CheckCircle2,
  warn: AlertTriangle,
  danger: ShieldAlert,
  neutral: HelpCircle,
};

export function CalibrationHealthBanner() {
  const boardUid = useConnectionStore((s) => s.connectionState.boardUid);
  const isConnected = useConnectionStore((s) => s.connectionState.isConnected);
  const currentStep = useCalibrationStore((s) => s.currentStep);
  const [records, setRecords] = useState<CalibrationRecordIpc[]>([]);

  // Re-read whenever the wizard returns to the select screen, so a calibration
  // just finished (or just invalidated by a reboot) shows without a restart.
  useEffect(() => {
    if (!boardUid) {
      setRecords([]);
      return;
    }
    let cancelled = false;
    void window.electronAPI?.calibrationRecordList?.(boardUid).then((list) => {
      if (!cancelled) setRecords(list ?? []);
    });
    return () => { cancelled = true; };
  }, [boardUid, currentStep, isConnected]);

  if (!boardUid || records.length === 0) return null;

  // Worst first: the thing that stops you flying belongs at the top.
  const rank: Record<Tone, number> = { danger: 0, warn: 1, neutral: 2, good: 3 };
  const rows = records
    .map((record) => ({ record, ...assess(record) }))
    .sort((a, b) => rank[a.tone] - rank[b.tone]);

  return (
    <div className="space-y-2">
      {rows.map(({ record, tone, headline, detail }) => {
        const Icon = TONE_ICON[tone];
        return (
          <div
            key={record.type}
            className={`flex items-start gap-3 rounded-lg border p-3 ${TONE_STYLE[tone]}`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium">{headline}</div>
              <div className="text-xs opacity-90 mt-0.5">{detail}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
