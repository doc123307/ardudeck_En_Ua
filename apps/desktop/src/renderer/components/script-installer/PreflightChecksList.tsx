/**
 * Renders the list of preflight checks with severity color coding and inline
 * fix actions. Used inside the install consent step.
 */

import type { PreflightCheck, PreflightFix } from '../../../shared/script-installer-types';
import { t } from '../../i18n';

interface PreflightChecksListProps {
  checks: PreflightCheck[];
  busyFix: string | null;
  onApplyFix: (check: PreflightCheck, fix: PreflightFix) => void;
}

const SEVERITY_STYLE: Record<PreflightCheck['severity'], { icon: string; color: string; bg: string }> = {
  pass: { icon: '✓', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  warn: { icon: '!', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  block: { icon: '✗', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
};

export function PreflightChecksList({ checks, busyFix, onApplyFix }: PreflightChecksListProps) {
  return (
    <div className="space-y-2">
      {checks.map((check) => {
        const style = SEVERITY_STYLE[check.severity];
        const fixLabel = check.fix ? formatFixLabel(check.fix) : null;
        const isBusy = busyFix === check.id;
        return (
          <div
            key={check.id}
            className={`rounded-lg border ${style.bg} p-3`}
          >
            <div className="flex items-start gap-3">
              <span className={`text-base font-bold ${style.color} mt-0.5`}>{style.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-content">{check.label}</span>
                  {check.currentValue !== undefined && (
                    <span className="text-[11px] font-mono text-content-secondary shrink-0">
                      {t('script_installer.PreflightChecksList.now')} {String(check.currentValue)}
                      {check.expectedValue !== undefined && check.severity !== 'pass' && (
                        <> {t('script_installer.PreflightChecksList.need')} {String(check.expectedValue)}</>
                      )}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-content-secondary leading-relaxed whitespace-pre-line">
                  {check.detail}
                </p>
                {check.fix && fixLabel && (
                  <div className="mt-2">
                    <button
                      onClick={() => onApplyFix(check, check.fix!)}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isBusy ? t('script_installer.PreflightChecksList.applying') : fixLabel}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatFixLabel(fix: PreflightFix): string {
  if (fix.type === 'set_param') {
    const reboot = fix.requiresReboot ? ' + reboot' : '';
    return `Set ${fix.param} = ${fix.value}${reboot}`;
  }
  if (fix.type === 'reboot') return 'Reboot flight controller';
  if (fix.type === 'disarm') return 'Disarm vehicle';
  return 'Fix';
}
