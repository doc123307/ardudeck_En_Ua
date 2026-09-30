import { useTelemetryStore } from '../../stores/telemetry-store';
import { useSettingsStore } from '../../stores/settings-store';
import { formatAltitudeFromMeters } from '../../../shared/user-units.js';
import { PanelContainer, formatNumber } from './panel-utils';
import { t } from '../../i18n';

export function PositionPanel() {
  const position = useTelemetryStore((s) => s.position);
  const altitudeUnit = useSettingsStore((s) => s.unitPreferences.altitude);

  return (
    <PanelContainer>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-content-secondary text-xs">{t('panels.PositionPanel.latitude')}</span>
          <span className="text-content font-mono text-sm">{formatNumber(position.lat, 6)}°</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-content-secondary text-xs">{t('panels.PositionPanel.longitude')}</span>
          <span className="text-content font-mono text-sm">{formatNumber(position.lon, 6)}°</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-content-secondary text-xs">{t('panels.PositionPanel.altitude')}</span>
          <span className="text-content font-mono text-sm">{formatAltitudeFromMeters(position.alt, altitudeUnit)}</span>
        </div>
      </div>
    </PanelContainer>
  );
}
