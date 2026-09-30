/**
 * ApplyStep
 *
 * Final step that applies the preset configuration to the flight controller.
 * Shows progress, success, or error states.
 */

import React, { useEffect, useRef } from 'react';
import { useQuickSetupStore } from '../../../stores/quick-setup-store';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Rocket,
  RefreshCw,
  AlertTriangle,
  Plane,
  RotateCcw,
  Wifi,
} from 'lucide-react';
import { t } from '../../../i18n';

// Task status icon component
const TaskStatusIcon: React.FC<{ status: 'pending' | 'in_progress' | 'completed' | 'error' }> = ({
  status,
}) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case 'in_progress':
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <div className="w-4 h-4 rounded-full border-2 border" />;
  }
};

export const ApplyStep: React.FC = () => {
  const {
    selectedPreset,
    isApplying,
    applyProgress,
    applyError,
    applySuccess,
    applyPreset,
    prevStep,
    closeWizard,
    platformMismatch,
    platformChangeState,
    platformChangeError,
    changePlatform,
    dismissPlatformMismatch,
  } = useQuickSetupStore();

  // Track if we've already started applying
  const hasStartedRef = useRef(false);

  // Start applying when this step is reached
  useEffect(() => {
    if (!hasStartedRef.current && !isApplying && !applySuccess && !applyError) {
      hasStartedRef.current = true;
      applyPreset();
    }
  }, [applyPreset, isApplying, applySuccess, applyError]);

  // Reset ref when component unmounts
  useEffect(() => {
    return () => {
      hasStartedRef.current = false;
    };
  }, []);

  if (!selectedPreset) {
    return (
      <div className="text-center py-8">
        <p className="text-content-secondary">{t('quick_setup.ApplyStep.noPresetSelected')}</p>
      </div>
    );
  }

  // Progress percentage
  const progressPercent =
    applyProgress.total > 0
      ? Math.round((applyProgress.current / applyProgress.total) * 100)
      : 0;

  // Platform mismatch dialog
  if (platformMismatch) {
    const isPlatformChanging = platformChangeState !== 'idle' && platformChangeState !== 'error';

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-amber-500/20">
            {platformChangeState === 'disconnected' ? (
              <Wifi className="w-8 h-8 text-amber-400" />
            ) : platformChangeState === 'rebooting' ? (
              <RotateCcw className="w-8 h-8 text-amber-400 animate-spin" />
            ) : platformChangeState === 'error' ? (
              <XCircle className="w-8 h-8 text-red-400" />
            ) : isPlatformChanging ? (
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            )}
          </div>
          <h2 className="text-xl font-semibold text-content">
            {platformChangeState === 'error'
              ? t('quick_setup.ApplyStep.platformChangeFailed')
              : platformChangeState === 'disconnected'
              ? t('quick_setup.ApplyStep.reconnecting')
              : platformChangeState === 'rebooting'
              ? t('quick_setup.ApplyStep.rebootingFlightController')
              : platformChangeState === 'saving'
              ? t('quick_setup.ApplyStep.savingConfiguration')
              : platformChangeState === 'changing'
              ? t('quick_setup.ApplyStep.changingPlatform')
              : t('quick_setup.ApplyStep.platformMismatch')}
          </h2>
          <p className="text-sm text-content-secondary mt-2 max-w-md mx-auto">
            {platformChangeState === 'error'
              ? platformChangeError || t('quick_setup.ApplyStep.anErrorOccurredWhileChangingThe')
              : platformChangeState === 'disconnected'
              ? t('quick_setup.ApplyStep.boardIsRebootingAttemptingToReconnect')
              : platformChangeState === 'rebooting'
              ? t('quick_setup.ApplyStep.waitingForTheFlightControllerTo')
              : isPlatformChanging
              ? t('quick_setup.ApplyStep.pleaseWaitWhileThePlatformType')
              : t('quick_setup.ApplyStep.theSelectedPresetRequiresPlatformBut', { requiredName: platformMismatch.requiredName, currentName: platformMismatch.currentName })}
          </p>
        </div>

        {/* Platform comparison */}
        {platformChangeState === 'idle' && (
          <div className="p-4 bg-surface rounded-xl">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center mx-auto mb-2">
                  <Plane className="w-6 h-6 text-content-secondary" />
                </div>
                <p className="text-xs text-content-secondary">{t('quick_setup.ApplyStep.current')}</p>
                <p className="text-sm font-medium text-content">{platformMismatch.currentName}</p>
              </div>
              <div className="text-2xl text-content-tertiary">→</div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-2">
                  <Plane className="w-6 h-6 text-amber-400" />
                </div>
                <p className="text-xs text-content-secondary">{t('quick_setup.ApplyStep.required')}</p>
                <p className="text-sm font-medium text-amber-300">{platformMismatch.requiredName}</p>
              </div>
            </div>
          </div>
        )}

        {/* Progress indicator during platform change */}
        {isPlatformChanging && (
          <div className="p-4 bg-surface rounded-xl">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              <span className="text-sm text-content">
                {platformChangeState === 'changing' && t('quick_setup.ApplyStep.settingPlatformType')}
                {platformChangeState === 'saving' && t('quick_setup.ApplyStep.savingToEeprom')}
                {platformChangeState === 'rebooting' && t('quick_setup.ApplyStep.rebootingFlightController2')}
                {platformChangeState === 'disconnected' && t('quick_setup.ApplyStep.waitingForReconnection')}
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {platformChangeState === 'error' && platformChangeError && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-200 text-sm">{t('quick_setup.ApplyStep.errorDetails')}</h4>
                <p className="text-xs text-red-100/70 mt-1">{platformChangeError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info box */}
        {platformChangeState === 'idle' && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-200 text-sm">{t('quick_setup.ApplyStep.whatHappensWhenYouChangePlatform')}</h4>
                <ul className="text-xs text-blue-100/70 mt-1 space-y-1 list-disc list-inside">
                  <li>{t('quick_setup.ApplyStep.thePlatformTypeWillBeChanged')}</li>
                  <li>{t('quick_setup.ApplyStep.configurationWillBeSavedToEeprom')}</li>
                  <li>{t('quick_setup.ApplyStep.theBoardWillRebootAutomatically')}</li>
                  <li>{t('quick_setup.ApplyStep.weLlReconnectAndContinueApplying')}</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-4 border-t border">
          {platformChangeState === 'error' ? (
            <>
              <button
                onClick={dismissPlatformMismatch}
                className="flex items-center gap-2 px-4 py-2 text-sm text-content-secondary hover:text-content hover:bg-surface-raised rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('quick_setup.ApplyStep.cancel')}
              </button>
              <button
                onClick={changePlatform}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t('quick_setup.ApplyStep.retry')}
              </button>
            </>
          ) : isPlatformChanging ? (
            <>
              <div /> {/* Spacer */}
              <div className="flex items-center gap-2 text-sm text-content-secondary">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('quick_setup.ApplyStep.pleaseWait')}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={dismissPlatformMismatch}
                className="flex items-center gap-2 px-4 py-2 text-sm text-content-secondary hover:text-content hover:bg-surface-raised rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('quick_setup.ApplyStep.cancel')}
              </button>
              <button
                onClick={changePlatform}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors"
              >
                <Plane className="w-4 h-4" />
                {t('quick_setup.ApplyStep.changePlatform')}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div
          className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            applySuccess
              ? 'bg-green-500/20'
              : applyError
              ? 'bg-red-500/20'
              : 'bg-blue-500/20'
          }`}
        >
          {applySuccess ? (
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          ) : applyError ? (
            <XCircle className="w-8 h-8 text-red-400" />
          ) : (
            <Rocket className="w-8 h-8 text-blue-400 animate-bounce" />
          )}
        </div>
        <h2 className="text-xl font-semibold text-content">
          {applySuccess
            ? t('quick_setup.ApplyStep.configurationApplied')
            : applyError
            ? t('quick_setup.ApplyStep.configurationFailed')
            : t('quick_setup.ApplyStep.applyingConfiguration')}
        </h2>
        <p className="text-sm text-content-secondary mt-2 max-w-md mx-auto">
          {applySuccess
            ? t('quick_setup.ApplyStep.yourPresetHasBeenSuccessfullyApplied', { name: selectedPreset.name })
            : applyError
            ? t('quick_setup.ApplyStep.thereWasAnErrorApplyingThe')
            : t('quick_setup.ApplyStep.applyingPresetToYourFlightController', { name: selectedPreset.name })}
        </p>
      </div>

      {/* Progress bar */}
      {!applySuccess && !applyError && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-content-secondary">{applyProgress.currentTask || t('quick_setup.ApplyStep.starting')}</span>
            <span className="text-content-secondary">{progressPercent}%</span>
          </div>
          <div className="h-2 bg-surface-inset rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="p-4 bg-surface rounded-xl">
        <h3 className="text-sm font-medium text-content mb-3">{t('quick_setup.ApplyStep.configurationTasks')}</h3>
        <div className="space-y-2">
          {applyProgress.tasks.map((task, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-2 rounded-lg ${
                task.status === 'in_progress'
                  ? 'bg-blue-500/10'
                  : task.status === 'error'
                  ? 'bg-red-500/10'
                  : task.status === 'completed'
                  ? 'bg-green-500/5'
                  : ''
              }`}
            >
              <TaskStatusIcon status={task.status} />
              <span
                className={`text-sm ${
                  task.status === 'completed'
                    ? 'text-content-secondary'
                    : task.status === 'in_progress'
                    ? 'text-content'
                    : task.status === 'error'
                    ? 'text-red-300'
                    : 'text-content-secondary'
                }`}
              >
                {task.name}
              </span>
              {task.error && (
                <span className="text-xs text-red-400 ml-auto">{task.error}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error message */}
      {applyError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-200 text-sm">{t('quick_setup.ApplyStep.errorDetails')}</h4>
              <p className="text-xs text-red-100/70 mt-1">{applyError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Success message */}
      {applySuccess && (
        <div className="space-y-3">
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-200 text-sm">{t('quick_setup.ApplyStep.configurationApplied')}</h4>
                <p className="text-xs text-green-100/70 mt-1">
                  {t('quick_setup.ApplyStep.yourConfigurationHasBeenSavedTo')}
                </p>
              </div>
            </div>
          </div>

          {/* Servo verification reminder - only show if servo mixer was configured */}
          {selectedPreset?.aircraft?.servoMixerRules?.length > 0 && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-200 text-sm">{t('quick_setup.ApplyStep.verifyYourServoSetup')}</h4>
                  <ul className="text-xs text-amber-100/70 mt-1 space-y-1 list-disc list-inside">
                    <li>{t('quick_setup.ApplyStep.checkThe')} <strong>{t('quick_setup.ApplyStep.servoMixer')}</strong> {t('quick_setup.ApplyStep.tabAndVerifyServosAreConnected')}</li>
                    <li>{t('quick_setup.ApplyStep.testServoDirectionsControlSurfacesShould')}</li>
                    <li>{t('quick_setup.ApplyStep.verifyMotorOutputIsConnectedAnd')}</li>
                    <li>{t('quick_setup.ApplyStep.alwaysTestInASafeEnvironment')}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-4 border-t border">
        {applySuccess ? (
          <>
            <div /> {/* Spacer */}
            <button
              onClick={closeWizard}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t('quick_setup.ApplyStep.done')}
            </button>
          </>
        ) : applyError ? (
          <>
            <button
              onClick={prevStep}
              className="flex items-center gap-2 px-4 py-2 text-sm text-content-secondary hover:text-content hover:bg-surface-raised rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('quick_setup.ApplyStep.back')}
            </button>
            <button
              onClick={() => {
                hasStartedRef.current = false;
                applyPreset();
              }}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {t('quick_setup.ApplyStep.retry')}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={prevStep}
              disabled={isApplying}
              className="flex items-center gap-2 px-4 py-2 text-sm text-content-secondary hover:text-content hover:bg-surface-raised rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('quick_setup.ApplyStep.cancel')}
            </button>
            <div className="flex items-center gap-2 text-sm text-content-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('quick_setup.ApplyStep.pleaseWait')}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ApplyStep;
