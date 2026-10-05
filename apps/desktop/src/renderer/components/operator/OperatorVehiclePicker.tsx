/**
 * The operator's vehicle switch, in the header: the vehicle in use and its link state at a
 * glance; a click opens the vehicle list to choose another (and, when the administrator
 * allows it, to add, change or remove vehicles).
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Truck } from 'lucide-react';
import { useVehiclesStore } from '../../stores/vehicles-store';
import { useOperatorStore } from '../../stores/operator-store';
import { VehicleList } from '../vehicles/VehicleList';
import { t } from '../../i18n';

export function OperatorVehiclePicker({ linkText, dot, tip }: { linkText: string; dot: string; tip: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const state = useVehiclesStore((s) => s.state);
  const canEdit = useOperatorStore((s) => s.config.operatorEditsVehicles);
  const active = state.presets.find((p) => p.id === state.activeId);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-tip={tip}
        className={`flex h-9 min-w-0 max-w-[26rem] items-center gap-2.5 rounded-full border px-3 transition-colors ${
          open ? 'border-blue-500/60 bg-blue-600/15' : 'border-subtle bg-surface hover:border-content-tertiary/60'
        }`}
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
        <Truck className="h-4 w-4 shrink-0 text-content-secondary" />
        <span className="truncate text-sm font-semibold text-content">{active?.name ?? t('vehicles.VehicleList.noneChosen')}</span>
        <span className="hidden truncate text-sm text-content-secondary md:inline">· {linkText}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-content-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-[60] mt-2 max-h-[75vh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-subtle bg-surface-solid p-3 shadow-2xl">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-secondary">{t('vehicles.VehicleList.title')}</div>
          <VehicleList canEdit={canEdit} onPicked={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
