/** Consent for a module's vehicle proposal. Host-owned, so a module cannot bypass it. */

import { useEffect, useState } from 'react';
import {
  getPendingProposal,
  subscribeProposal,
  type PendingProposal,
} from './module-proposal-registry';
import { t, enPlural } from '../i18n';

function extent(points: { lat: number; lng: number }[]): string {
  if (points.length === 0) return '';
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const h = (Math.max(...lats) - Math.min(...lats)) * 111320;
  const w = (Math.max(...lngs) - Math.min(...lngs)) * 111320 * Math.cos((midLat * Math.PI) / 180);
  return `${Math.round(w)} m by ${Math.round(h)} m`;
}

/** The outline, so the pilot sees the shape rather than a point count. */
function Outline({ points }: { points: { lat: number; lng: number }[] }): JSX.Element | null {
  if (points.length < 3) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 1e-6;
  const spanLng = maxLng - minLng || 1e-6;
  const d = points
    .map((p, i) => {
      const x = 4 + ((p.lng - minLng) / spanLng) * 192;
      // SVG y grows downward; north should be up.
      const y = 4 + (1 - (p.lat - minLat) / spanLat) * 92;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 200 100" className="w-full h-[100px]" role="img" aria-label={t('modules.ModuleProposalDialog.proposedFenceOutline')}>
      <rect x="0" y="0" width="200" height="100" fill="rgba(255,255,255,0.03)" />
      <path d={`${d} Z`} fill="rgba(34,197,94,0.12)" stroke="#22c55e" strokeWidth="1.5" />
    </svg>
  );
}

export function ModuleProposalDialog(): JSX.Element | null {
  const [pending, setPending] = useState<PendingProposal | null>(getPendingProposal);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeProposal(() => setPending(getPendingProposal())), []);
  useEffect(() => {
    if (pending) setBusy(false);
  }, [pending]);

  if (!pending) return null;
  const { proposal, from, existing } = pending;
  const kept: string[] = [];
  if (existing.exclusionShapes > 0) {
    kept.push(`${existing.exclusionShapes} exclusion zone${existing.exclusionShapes === 1 ? '' : enPlural('s')}`);
  }
  if (existing.hasReturnPoint) kept.push(t('modules.ModuleProposalDialog.theReturnPoint'));

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50">
      <div className="w-[420px] max-w-[92vw] rounded-lg border border-subtle bg-surface-solid shadow-xl">
        <div className="px-4 pt-4">
          <div className="text-[11px] uppercase tracking-wide text-content-tertiary">
            {from} {t('modules.ModuleProposalDialog.asksToWriteToTheAircraft')}
          </div>
          <div className="mt-1 text-base font-semibold text-content">{proposal.name}</div>
          <p className="mt-1 text-xs text-content-secondary">{proposal.reason}</p>
        </div>

        <div className="px-4 pt-3">
          <Outline points={proposal.inclusion} />
          <div className="mt-2 text-xs text-content-secondary tabular-nums">
            {t('modules.ModuleProposalDialog.inclusionFence')} {proposal.inclusion.length} {t('modules.ModuleProposalDialog.points')} {extent(proposal.inclusion)}
          </div>
          {existing.inclusionShapes > 0 && (
            <div className="mt-2 rounded border border-amber-500/60 px-2 py-1.5 text-xs text-amber-400">
              {t('modules.ModuleProposalDialog.thisReplacesTheInclusionFenceAlready')}{existing.inclusionShapes} {t('modules.ModuleProposalDialog.shape')}
              {existing.inclusionShapes === 1 ? '' : enPlural('s')}, {existing.inclusionPoints} {t('modules.ModuleProposalDialog.pointsItWillNoLongerApply')}
            </div>
          )}
          {kept.length > 0 && (
            <div className="mt-2 text-xs text-content-tertiary">
              {t('modules.ModuleProposalDialog.keptAsTheyAre')} {kept.join(' and ')}.
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-subtle px-4 py-3">
          <button
            type="button"
            className="rounded px-3 py-1.5 text-sm text-content-secondary hover:text-content"
            onClick={() => pending.resolve({ accepted: false })}
          >
            {t('modules.ModuleProposalDialog.cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => {
              setBusy(true);
              pending.resolve({ accepted: true });
            }}
          >
            {busy ? t('modules.ModuleProposalDialog.writing') : t('modules.ModuleProposalDialog.writeToAircraft')}
          </button>
        </div>
      </div>
    </div>
  );
}
