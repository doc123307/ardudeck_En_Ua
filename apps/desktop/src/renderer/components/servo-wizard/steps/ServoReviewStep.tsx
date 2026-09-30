/**
 * ServoReviewStep
 *
 * Step 5: Review configuration and save to flight controller.
 * Shows summary table of all servo assignments and mixer rules.
 */

import { useState } from 'react';
import { useServoWizardStore } from '../../../stores/servo-wizard-store';
import { CONTROL_SURFACE_INFO, SERVO_INPUT_SOURCE } from '../presets/servo-presets';
import { Check, X, Save, Info } from 'lucide-react';
import { t, enPlural } from '../../../i18n';

export default function ServoReviewStep() {
  const {
    selectedPreset,
    assignments,
    saveToFC,
    prevStep,
    closeWizard,
  } = useServoWizardStore();

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Get input source name
  const getInputName = (source: number) => {
    const entry = Object.entries(SERVO_INPUT_SOURCE).find(([, v]) => v === source);
    return entry ? entry[0].replace(/_/g, ' ') : `Source ${source}`;
  };

  // Handle save to flight controller
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    try {
      await saveToFC();
      setSaveStatus('success');
    } catch (err) {
      setSaveStatus('error');
      setErrorMessage(err instanceof Error ? err.message : t('servo_wizard.ServoReviewStep.failedToSaveConfiguration'));
    } finally {
      setIsSaving(false);
    }
  };

  // Handle finish (close wizard)
  const handleFinish = () => {
    closeWizard();
  };

  if (!selectedPreset) {
    return <div className="text-content-secondary">{t('servo_wizard.ServoReviewStep.noConfigurationToReview')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-content">{t('servo_wizard.ServoReviewStep.reviewYourConfiguration')}</h2>
        <p className="text-sm text-content-secondary mt-2">
          {t('servo_wizard.ServoReviewStep.verifyYourServoConfigurationBeforeSaving')}
        </p>
      </div>

      {/* Aircraft type badge */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-3 px-4 py-2 bg-surface rounded-full border border-subtle">
          <span className="text-2xl">{selectedPreset.icon}</span>
          <span className="text-sm font-medium text-content">{selectedPreset.name}</span>
          <span className="text-xs text-content-secondary">
            {selectedPreset.servoCount} {t('servo_wizard.ServoReviewStep.servo')}{selectedPreset.servoCount !== 1 ? enPlural('s') : ''}
          </span>
        </div>
      </div>

      {/* Configuration summary table */}
      <div className="bg-surface-input rounded-xl border border-subtle overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface text-content-secondary text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left">{t('servo_wizard.ServoReviewStep.controlSurface')}</th>
              <th className="px-4 py-3 text-left">{t('servo_wizard.ServoReviewStep.servo2')}</th>
              <th className="px-4 py-3 text-left">{t('servo_wizard.ServoReviewStep.input')}</th>
              <th className="px-4 py-3 text-center">{t('servo_wizard.ServoReviewStep.rate')}</th>
              <th className="px-4 py-3 text-center">{t('servo_wizard.ServoReviewStep.range')}</th>
              <th className="px-4 py-3 text-center">{t('servo_wizard.ServoReviewStep.center')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {assignments.map((assignment) => {
              const surfaceInfo = CONTROL_SURFACE_INFO[assignment.surface];
              const defaultRule = selectedPreset.defaultRules[assignment.surface];

              return (
                <tr key={assignment.surface} className="hover:bg-surface-overlay-subtle">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-content font-medium">{surfaceInfo.name}</span>
                      {assignment.reversed && (
                        <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 rounded text-yellow-400">
                          REV
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-blue-400">S{assignment.servoIndex}</span>
                  </td>
                  <td className="px-4 py-3 text-content-secondary">
                    {defaultRule?.[0] ? getInputName(defaultRule[0].inputSource) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-mono ${
                      assignment.reversed ? 'text-yellow-400' : 'text-content'
                    }`}>
                      {assignment.reversed ? '-' : ''}{(assignment as any).rate || 100}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-content-secondary">
                      {assignment.min} - {assignment.max}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-green-400">{assignment.center}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mixer rules preview */}
      <div className="bg-surface rounded-xl p-4">
        <h3 className="text-sm font-medium text-content mb-3">{t('servo_wizard.ServoReviewStep.mixerRulesPreview')}</h3>
        <div className="font-mono text-xs text-content-secondary space-y-1">
          {assignments.map((assignment) => {
            const defaultRule = selectedPreset.defaultRules[assignment.surface];
            if (!defaultRule) return null;

            const rate = assignment.reversed
              ? -((assignment as any).rate || 100)
              : ((assignment as any).rate || 100);

            return (
              <div key={assignment.surface}>
                <span className="text-content-secondary">{t('servo_wizard.ServoReviewStep.servo2')} {assignment.servoIndex}</span>
                <span className="text-content-tertiary"> → </span>
                <span className="text-blue-400">{getInputName(defaultRule[0]!.inputSource)}</span>
                <span className="text-content-tertiary"> @ </span>
                <span className={rate < 0 ? 'text-yellow-400' : 'text-green-400'}>
                  {rate}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save status */}
      {saveStatus === 'success' && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <Check className="w-6 h-6 text-green-400" />
          <div>
            <p className="text-sm text-green-400 font-medium">{t('servo_wizard.ServoReviewStep.configurationSavedSuccessfully')}</p>
            <p className="text-xs text-content-secondary mt-1">
              {t('servo_wizard.ServoReviewStep.settingsHaveBeenWrittenToThe')}
            </p>
          </div>
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <X className="w-6 h-6 text-red-400" />
          <div>
            <p className="text-sm text-red-400 font-medium">{t('servo_wizard.ServoReviewStep.failedToSaveConfiguration')}</p>
            <p className="text-xs text-content-secondary mt-1">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Important notes */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0" />
        <div>
          <p className="text-sm text-blue-400 font-medium">{t('servo_wizard.ServoReviewStep.beforeSaving')}</p>
          <ul className="text-xs text-content-secondary mt-1 space-y-1 list-disc list-inside">
            <li>{t('servo_wizard.ServoReviewStep.ensureYourFlightControllerIsConnected')}</li>
            <li>{t('servo_wizard.ServoReviewStep.disconnectPropellersForSafety')}</li>
            <li>{t('servo_wizard.ServoReviewStep.afterSavingTestAllControlsBefore')}</li>
            <li>{t('servo_wizard.ServoReviewStep.settingsAreStoredInEepromPersist')}</li>
          </ul>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={prevStep}
          disabled={isSaving}
          className="px-6 py-2.5 rounded-lg font-medium bg-surface-raised text-content hover:bg-surface-raised disabled:opacity-50"
        >
          {t('servo_wizard.ServoReviewStep.back')}
        </button>

        <div className="flex gap-3">
          {saveStatus === 'success' ? (
            <button
              onClick={handleFinish}
              className="px-6 py-2.5 rounded-lg font-medium bg-green-500 text-white hover:bg-green-400"
            >
              <Check className="w-4 h-4 inline mr-1" /> {t('servo_wizard.ServoReviewStep.done')}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-lg font-medium bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  {t('servo_wizard.ServoReviewStep.saving')}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 inline mr-1" /> {t('servo_wizard.ServoReviewStep.saveToFlightController')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
