import { Layout, X, AlertTriangle } from 'lucide-react';
import type { FeatureTour } from '../../feature-tours';
import { PANEL_COMPONENTS } from '../panels';
import { t } from '../../i18n';

interface TourPanelsGateProps {
  tour: FeatureTour;
  missingPanels: string[];
  onSwitchPreset: () => void;
  onCancel: () => void;
}

function panelLabel(panelId: string): string {
  const entry = PANEL_COMPONENTS[panelId as keyof typeof PANEL_COMPONENTS];
  return entry?.title ?? panelId;
}

export function TourPanelsGate({ tour, missingPanels, onSwitchPreset, onCancel }: TourPanelsGateProps) {
  const presetLabel = tour.requires?.presetLabel ?? tour.requires?.preset ?? 'recommended layout';
  const panelNames = missingPanels.map(panelLabel);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70">
      <div
        className="w-full max-w-md mx-4 rounded-xl overflow-hidden shadow-2xl"
        style={{
          background: 'var(--bg-tooltip)',
          border: '1px solid var(--border-default)',
        }}
      >
        <div className="h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        <div className="px-6 py-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgb(37 99 235)' }}>
                {t('tours.TourPanelsGate.layoutAdjustment')}
              </div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {tour.title}
              </h2>
            </div>
            <button
              onClick={onCancel}
              className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              aria-label={t('tours.TourPanelsGate.cancel')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('tours.TourPanelsGate.thisTourWalksThroughPanelsThat')}
          </p>

          <div
            className="mb-4 px-3 py-2 rounded-md flex items-start gap-2 text-xs"
            style={{
              background: 'rgb(234 179 8 / 0.1)',
              border: '1px solid rgb(234 179 8 / 0.35)',
              color: 'rgb(250 204 21)',
            }}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              {t('tours.TourPanelsGate.missing')} <span className="font-semibold">{panelNames.join(', ')}</span>
            </span>
          </div>

          <p className="text-xs leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
            {t('tours.TourPanelsGate.switchToThe')} <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{presetLabel}</span> {t('tours.TourPanelsGate.layoutToSeeTheTourYour')}
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={onSwitchPreset}
              className="w-full px-4 py-2.5 rounded-md text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              style={{ background: 'rgb(37 99 235)', color: '#fff' }}
            >
              <Layout className="w-4 h-4" />
              {t('tours.TourPanelsGate.switchTo')} {presetLabel}
            </button>
            <button
              onClick={onCancel}
              className="w-full px-4 py-1.5 text-xs transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('tours.TourPanelsGate.skipThisTour')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
