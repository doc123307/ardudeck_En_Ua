/**
 * ConfigReviewStep
 *
 * Review step showing a summary of all configuration that will be applied.
 * Allows user to see exactly what changes will be made before applying.
 */

import React from 'react';
import { useQuickSetupStore } from '../../../stores/quick-setup-store';
import {
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
  Gauge,
  Gamepad2,
  Shield,
  Plane,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { t } from '../../../i18n';

// Section component for displaying configuration details
const ConfigSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  items: string[];
  color: string;
}> = ({ icon, title, items, color }) => {
  return (
    <div className={`p-4 rounded-xl border bg-gradient-to-br ${color}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-medium text-content">{title}</h3>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2 text-sm text-content">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ConfigReviewStep: React.FC = () => {
  const { selectedPreset, nextStep, prevStep, boardType } = useQuickSetupStore();

  if (!selectedPreset) {
    return (
      <div className="text-center py-8">
        <p className="text-content-secondary">{t('quick_setup.ConfigReviewStep.noPresetSelectedPleaseGoBack')}</p>
      </div>
    );
  }

  // Generate summary items
  const pidItems = [
    `Roll: P=${selectedPreset.pids.roll.p} I=${selectedPreset.pids.roll.i} D=${selectedPreset.pids.roll.d}`,
    `Pitch: P=${selectedPreset.pids.pitch.p} I=${selectedPreset.pids.pitch.i} D=${selectedPreset.pids.pitch.d}`,
    `Yaw: P=${selectedPreset.pids.yaw.p} I=${selectedPreset.pids.yaw.i}`,
  ];

  const rateItems = [
    `RC Rate: ${selectedPreset.rates.rcRate}`,
    `Expo: ${selectedPreset.rates.rcExpo}%`,
    t('quick_setup.ConfigReviewStep.rollPitchRate', { rollRate: selectedPreset.rates.rollRate }),
    t('quick_setup.ConfigReviewStep.yawRate', { yawRate: selectedPreset.rates.yawRate }),
  ];

  // Mode names lookup (iNav permanent box IDs)
  const modeNames: Record<number, string> = {
    0: 'ARM',
    1: 'ANGLE',
    2: 'HORIZON',
    3: 'NAV ALTHOLD',
    5: 'HEADING HOLD',
    10: 'NAV RTH',
    11: 'NAV POSHOLD',
    12: 'MANUAL',
    13: 'BEEPER',
    27: 'FAILSAFE',
    28: 'NAV WP',
    29: 'AIRMODE',
    30: 'HOME RESET',
    31: 'GCS NAV',
    35: 'TURN ASSIST',
    36: 'NAV LAUNCH',
    45: 'NAV CRUISE',
    51: 'PREARM',
    52: 'TURTLE',
    53: 'COURSE HOLD',
  };

  const modeItems = selectedPreset.modes.map((mode) => {
    const name = modeNames[mode.boxId] || `Mode ${mode.boxId}`;
    const channel = `AUX${mode.auxChannel + 1}`;
    return `${name} on ${channel} (${mode.rangeStart}-${mode.rangeEnd})`;
  });

  const failsafeItems = [
    `Procedure: ${selectedPreset.failsafe.procedure}`,
    `Delay: ${selectedPreset.failsafe.delay} seconds`,
    t('quick_setup.ConfigReviewStep.landingTimeoutSeconds', { offDelay: selectedPreset.failsafe.offDelay }),
  ];

  const aircraftItems =
    selectedPreset.category === 'fixed_wing'
      ? [
          t('quick_setup.ConfigReviewStep.platformAirplane'),
          t('quick_setup.ConfigReviewStep.servoMixerRules', { length: selectedPreset.aircraft.servoMixerRules.length }),
          t('quick_setup.ConfigReviewStep.motorMixerMotors', { length: selectedPreset.aircraft.motorMixerRules.length }),
        ]
      : [
          t('quick_setup.ConfigReviewStep.platformMultirotor'),
          t('quick_setup.ConfigReviewStep.motorMixerQuadXMotors', { length: selectedPreset.aircraft.motorMixerRules.length }),
        ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 mb-4">
          <selectedPreset.icon className="w-8 h-8 text-content" />
        </div>
        <h2 className="text-xl font-semibold text-content">
          {t('quick_setup.ConfigReviewStep.review')} {selectedPreset.name}
        </h2>
        <p className="text-sm text-content-secondary mt-2 max-w-md mx-auto">
          {t('quick_setup.ConfigReviewStep.theFollowingConfigurationWillBeApplied')}
        </p>
      </div>

      {/* Board type badge */}
      <div className="flex justify-center">
        <span
          className={`px-3 py-1 text-xs font-medium rounded-full ${
            boardType === 'msp'
              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}
        >
          {boardType === 'msp' ? t('quick_setup.ConfigReviewStep.viaMspProtocol') : t('quick_setup.ConfigReviewStep.viaCliCommands')}
        </span>
      </div>

      {/* Configuration sections */}
      <div className="grid gap-4">
        {/* Aircraft Type */}
        <ConfigSection
          icon={<Plane className="w-5 h-5 text-sky-400" />}
          title={t('quick_setup.ConfigReviewStep.aircraftType')}
          items={aircraftItems}
          color="from-sky-500/10 to-blue-500/5 border-sky-500/20"
        />

        {/* PIDs */}
        <ConfigSection
          icon={<SlidersHorizontal className="w-5 h-5 text-purple-400" />}
          title={t('quick_setup.ConfigReviewStep.pidTuning')}
          items={pidItems}
          color="from-purple-500/10 to-violet-500/5 border-purple-500/20"
        />

        {/* Rates */}
        <ConfigSection
          icon={<Gauge className="w-5 h-5 text-blue-400" />}
          title={t('quick_setup.ConfigReviewStep.rates')}
          items={rateItems}
          color="from-blue-500/10 to-cyan-500/5 border-blue-500/20"
        />

        {/* Modes */}
        <ConfigSection
          icon={<Gamepad2 className="w-5 h-5 text-green-400" />}
          title={t('quick_setup.ConfigReviewStep.flightModes')}
          items={modeItems}
          color="from-green-500/10 to-emerald-500/5 border-green-500/20"
        />

        {/* Failsafe */}
        <ConfigSection
          icon={<Shield className="w-5 h-5 text-orange-400" />}
          title={t('quick_setup.ConfigReviewStep.failsafe')}
          items={failsafeItems}
          color="from-orange-500/10 to-amber-500/5 border-orange-500/20"
        />
      </div>

      {/* Warning */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <div>
            <h4 className="font-medium text-amber-200 text-sm">
              {t('quick_setup.ConfigReviewStep.thisWillOverwriteYourCurrentSettings')}
            </h4>
            <p className="text-xs text-amber-100/70 mt-1">
              {t('quick_setup.ConfigReviewStep.makeSureYouVeBackedUp')}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-4 border-t border">
        <button
          onClick={prevStep}
          className="flex items-center gap-2 px-4 py-2 text-sm text-content-secondary hover:text-content hover:bg-surface-raised rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('quick_setup.ConfigReviewStep.back')}
        </button>

        <button
          onClick={nextStep}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          {t('quick_setup.ConfigReviewStep.applyConfiguration')}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ConfigReviewStep;
