import { useTelemetryStore } from '../../stores/telemetry-store';
import { useSettingsStore } from '../../stores/settings-store';
import {
  speedValueFromMetersPerSecond,
  verticalSpeedValueFromMetersPerSecond,
  UNIT_LABELS,
} from '../../../shared/user-units.js';
import { PanelContainer, formatNumber } from './panel-utils';
import { t } from '../../i18n';

export function VelocityPanel() {
  const position = useTelemetryStore((s) => s.position);
  const speedUnit = useSettingsStore((s) => s.unitPreferences.speed);
  const verticalSpeedUnit = useSettingsStore((s) => s.unitPreferences.verticalSpeed);
  const speedLabel = UNIT_LABELS.speed[speedUnit];
  const verticalSpeedLabel = UNIT_LABELS.verticalSpeed[verticalSpeedUnit];

  return (
    <PanelContainer>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-content-secondary text-xs mb-1">{t('panels.VelocityPanel.north')}</div>
          <div className="text-content font-mono text-lg">{formatNumber(speedValueFromMetersPerSecond(position.vx, speedUnit), 1)}</div>
          <div className="text-content-tertiary text-[10px]">{speedLabel}</div>
        </div>
        <div>
          <div className="text-content-secondary text-xs mb-1">{t('panels.VelocityPanel.east')}</div>
          <div className="text-content font-mono text-lg">{formatNumber(speedValueFromMetersPerSecond(position.vy, speedUnit), 1)}</div>
          <div className="text-content-tertiary text-[10px]">{speedLabel}</div>
        </div>
        <div>
          <div className="text-content-secondary text-xs mb-1">{t('panels.VelocityPanel.down')}</div>
          <div className="text-content font-mono text-lg">{formatNumber(verticalSpeedValueFromMetersPerSecond(position.vz, verticalSpeedUnit), verticalSpeedUnit === 'fpm' ? 0 : 1)}</div>
          <div className="text-content-tertiary text-[10px]">{verticalSpeedLabel}</div>
        </div>
      </div>
    </PanelContainer>
  );
}
