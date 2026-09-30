/**
 * PlaneTypeStep
 *
 * Step 1: Select aircraft type from visual cards.
 */

import { AircraftPreset, getPresetsByCategory } from '../presets/servo-presets';
import { useServoWizardStore } from '../../../stores/servo-wizard-store';
import { Lightbulb, RotateCcw } from 'lucide-react';
import { t } from '../../../i18n';

// Compact card - moved outside to prevent re-creation on every render
function PresetCard({
  preset,
  isSelected,
  onSelect,
}: {
  preset: AircraftPreset;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(preset.id)}
      className={`p-3 rounded-lg border-2 transition-all text-left ${
        isSelected
          ? 'border-blue-500 bg-blue-500/20'
          : 'border bg-surface hover:border hover:bg-surface'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{preset.icon}</span>
        <div>
          <div className="text-sm font-medium text-content">{preset.name}</div>
          <div className="text-xs text-content-secondary">{preset.servoCount} {t('servo_wizard.PlaneTypeStep.servo')}{preset.servoCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
    </button>
  );
}

export default function PlaneTypeStep() {
  const { selectedPresetId, selectAircraftType, nextStep, isMultirotor } = useServoWizardStore();

  const fixedWingPresets = getPresetsByCategory('fixed_wing');
  const multirotorPresets = getPresetsByCategory('multirotor');
  const otherPresets = getPresetsByCategory('other');

  // For multirotors (quad/hex), only show gimbal option
  if (isMultirotor) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-lg font-bold text-content">{t('servo_wizard.PlaneTypeStep.gimbalServoSetup')}</h2>
          <p className="text-sm text-content-secondary mt-1">
            {t('servo_wizard.PlaneTypeStep.yourBoardIsConfiguredAsA')}
          </p>
        </div>

        {/* Gimbal option only */}
        <div className="flex justify-center">
          {otherPresets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isSelected={selectedPresetId === preset.id}
              onSelect={selectAircraftType}
            />
          ))}
        </div>

        {/* Help tip + Continue button */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 flex items-center gap-2 flex-1">
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-content-secondary">
              {t('servo_wizard.PlaneTypeStep.gimbalUsesRcStickInputTo')}
            </p>
          </div>
          <button
            onClick={() => selectedPresetId && nextStep()}
            disabled={!selectedPresetId}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              selectedPresetId
                ? 'bg-blue-500 text-white hover:bg-blue-400'
                : 'bg-surface-raised text-content-secondary cursor-not-allowed'
            }`}
          >
            {t('servo_wizard.PlaneTypeStep.continue')}
          </button>
        </div>
      </div>
    );
  }

  const handleContinue = () => {
    if (selectedPresetId) {
      nextStep();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-bold text-content">{t('servo_wizard.PlaneTypeStep.whatTypeOfAircraftDoYou')}</h2>
        <p className="text-sm text-content-secondary mt-1">{t('servo_wizard.PlaneTypeStep.selectYourAircraftTypeForThe')}</p>
      </div>

      {/* All categories in a compact grid */}
      <div className="grid grid-cols-4 gap-2">
        {/* Fixed wing */}
        {fixedWingPresets.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            isSelected={selectedPresetId === preset.id}
            onSelect={selectAircraftType}
          />
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {/* Multirotor + Other */}
        {multirotorPresets.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            isSelected={selectedPresetId === preset.id}
            onSelect={selectAircraftType}
          />
        ))}
        {/* Quad/Hex placeholder */}
        <div className="p-3 rounded-lg border-2 border-subtle bg-surface-input opacity-40">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-blue-400" />
            <div>
              <div className="text-sm font-medium text-content-secondary">{t('servo_wizard.PlaneTypeStep.quadHex')}</div>
              <div className="text-xs text-content-tertiary">{t('servo_wizard.PlaneTypeStep.noServos')}</div>
            </div>
          </div>
        </div>
        {/* Other presets */}
        {otherPresets.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            isSelected={selectedPresetId === preset.id}
            onSelect={selectAircraftType}
          />
        ))}
      </div>

      {/* Help tip + Continue button in same row */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 flex items-center gap-2 flex-1">
          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs text-content-secondary">
            <strong className="text-content">{t('servo_wizard.PlaneTypeStep.quadWithCamera')}</strong> {t('servo_wizard.PlaneTypeStep.selectGimbal')}
            <strong className="text-content ml-2">{t('servo_wizard.PlaneTypeStep.plane')}</strong> {t('servo_wizard.PlaneTypeStep.mostAreTraditional')}
          </p>
        </div>
        <button
          onClick={handleContinue}
          disabled={!selectedPresetId}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
            selectedPresetId
              ? 'bg-blue-500 text-white hover:bg-blue-400'
              : 'bg-surface-raised text-content-secondary cursor-not-allowed'
          }`}
        >
          {t('servo_wizard.PlaneTypeStep.continue')}
        </button>
      </div>
    </div>
  );
}
