import { useState } from 'react';
import { GraduationCap, PlayCircle, RotateCcw } from 'lucide-react';
import { APP_GUIDES } from '../../guides/registry';
import { FEATURE_TOURS } from '../../feature-tours';
import { useGuidesStore } from '../../stores/guides-store';
import { useToursStore } from '../../stores/tours-store';
import { useSettingsStore } from '../../stores/settings-store';
import { t as tr } from '../../i18n';

const ROW = 'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-raised transition-colors';

/** Replay any guide or tour, and put them all back to "not seen". */
export function GuidesAndToursList() {
  const [reset, setReset] = useState(false);

  const replayTour = (id: string) => useToursStore.getState().requestTour(id);
  const resetAll = () => {
    useToursStore.getState().resetAll();
    useGuidesStore.getState().resetSeen(APP_GUIDES.map((g) => g.id));
    setReset(true);
    window.setTimeout(() => setReset(false), 2000);
  };

  return (
    <div className="mt-3 border-t border-subtle pt-3">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-medium text-content">{tr('guides.GuidesAndToursList.guidesTours')}</div>
        <button onClick={resetAll} className="flex items-center gap-1 text-[11px] text-content-secondary hover:text-content transition-colors">
          <RotateCcw className="h-3 w-3" />
          {reset ? tr('guides.GuidesAndToursList.allMarkedUnseen') : tr('guides.GuidesAndToursList.resetAll')}
        </button>
      </div>
      <div className="text-[10px] uppercase tracking-wide text-content-tertiary">{tr('guides.GuidesAndToursList.guides')}</div>
      {APP_GUIDES.map((g) => (
        <button key={g.id} onClick={() => useGuidesStore.getState().start([g.id])} className={ROW}>
          <PlayCircle className="h-3.5 w-3.5 shrink-0 text-blue-400" />
          <span className="flex-1 truncate text-xs text-content">{g.title}</span>
        </button>
      ))}
      <div className="mt-2 text-[10px] uppercase tracking-wide text-content-tertiary">{tr('guides.GuidesAndToursList.tours')}</div>
      {FEATURE_TOURS.map((t) => (
        <button key={t.id} onClick={() => replayTour(t.id)} className={ROW}>
          <PlayCircle className="h-3.5 w-3.5 shrink-0 text-blue-400" />
          <span className="flex-1 truncate text-xs text-content">{t.title}</span>
          <span className="shrink-0 text-[10px] text-content-tertiary">{t.view}</span>
        </button>
      ))}
    </div>
  );
}

/** Settings card: the auto-prompt switch plus every guide and tour to replay. */
export function GuidesAndToursCard() {
  const enabled = useSettingsStore((s) => s.tourPromptsEnabled);
  const setEnabled = useSettingsStore((s) => s.setTourPromptsEnabled);

  return (
    <div className="bg-gradient-to-br from-surface to-surface-base rounded-xl border border-subtle p-4 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-4 h-4 text-blue-400" />
          <div>
            <div className="text-sm font-medium text-content">{tr('guides.GuidesAndToursList.guidesTours')}</div>
            <div className="text-[11px] text-content-secondary">{tr('guides.GuidesAndToursList.offerWalkthroughsWhenOpeningAView')}</div>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
            enabled ? 'bg-blue-600' : 'bg-surface-inset border border-subtle'
          }`}
        >
          <div className={`w-4 h-4 rounded-full bg-white border border-strong shadow-sm absolute top-0.5 transition-all ${
            enabled ? 'left-[18px]' : 'left-0.5'
          }`} />
        </button>
      </div>
      <GuidesAndToursList />
    </div>
  );
}
