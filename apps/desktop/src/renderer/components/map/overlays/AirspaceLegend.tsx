import { t } from '../../../i18n';
const LEGEND_ITEMS = [
  { label: 'CTR', color: 'rgba(0, 100, 255, 0.45)' },
  { get label() { return t('map.AirspaceLegend.restricted'); }, color: 'rgba(255, 0, 0, 0.45)' },
  { get label() { return t('map.AirspaceLegend.danger'); }, color: 'rgba(255, 150, 0, 0.45)' },
  { label: 'TMA', color: 'rgba(160, 32, 240, 0.40)' },
];

export function AirspaceLegend() {
  return (
    // bottom-14, not bottom-3: the mission map's action bar lives at bottom-3 left-3 and
    // would otherwise be drawn on top of this box.
    <div className="absolute bottom-14 left-3 z-[1000] bg-surface-overlay rounded-lg px-3 py-2 text-xs text-content space-y-1">
      {LEGEND_ITEMS.map(({ label, color }) => (
        <div key={label} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
          {label}
        </div>
      ))}
    </div>
  );
}
