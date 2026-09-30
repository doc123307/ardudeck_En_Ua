/**
 * AutoLaunchTab
 *
 * iNav Fixed-Wing Auto Launch configuration.
 * Configure throw/bungee/catapult launch detection and behavior.
 */

import { useState, useEffect, useCallback } from 'react';
import { DraftNumberInput } from '../../hooks/useNumericDraft';
import { DraggableSlider } from '../ui/DraggableSlider';
import {
  Target,
  Zap,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Save,
  Rocket,
  Settings2,
} from 'lucide-react';
import { t } from '../../i18n';

// Launch configuration settings
interface AutoLaunchConfig {
  // Detection Settings
  nav_fw_launch_accel: number; // 1000-20000, threshold acceleration (cm/s/s)
  nav_fw_launch_velocity: number; // 100-10000, threshold velocity
  nav_fw_launch_detect_time: number; // 10-1000 ms
  nav_fw_launch_max_angle: number; // 5-180 degrees

  // Idle/Pre-Launch Settings
  nav_fw_launch_idle_thr: number; // 1000-2000 us
  nav_fw_launch_idle_motor_delay: number; // 0-60000 ms
  nav_fw_launch_wiggle_to_wake_idle: string; // OFF/1/2

  // Motor Startup Settings
  nav_fw_launch_motor_delay: number; // 0-5000 ms
  nav_fw_launch_spinup_time: number; // 0-1000 ms
  nav_fw_launch_thr: number; // 1000-2000 us

  // Climb Settings
  nav_fw_launch_climb_angle: number; // 0-45 degrees
  nav_fw_launch_max_altitude: number; // 0-60000 cm (0 = disabled)

  // Exit Settings
  nav_fw_launch_min_time: number; // 0-60000 ms
  nav_fw_launch_timeout: number; // 0-60000 ms
  nav_fw_launch_end_time: number; // 0-5000 ms
}

// Default values from iNav
const DEFAULT_LAUNCH_CONFIG: AutoLaunchConfig = {
  nav_fw_launch_accel: 1863,
  nav_fw_launch_velocity: 300,
  nav_fw_launch_detect_time: 40,
  nav_fw_launch_max_angle: 45,
  nav_fw_launch_idle_thr: 1000,
  nav_fw_launch_idle_motor_delay: 0,
  nav_fw_launch_wiggle_to_wake_idle: 'OFF',
  nav_fw_launch_motor_delay: 500,
  nav_fw_launch_spinup_time: 100,
  nav_fw_launch_thr: 1700,
  nav_fw_launch_climb_angle: 18,
  nav_fw_launch_max_altitude: 0,
  nav_fw_launch_min_time: 0,
  nav_fw_launch_timeout: 5000,
  nav_fw_launch_end_time: 2000,
};

// Setting names for API
const LAUNCH_SETTINGS = [
  'nav_fw_launch_accel',
  'nav_fw_launch_velocity',
  'nav_fw_launch_detect_time',
  'nav_fw_launch_max_angle',
  'nav_fw_launch_idle_thr',
  'nav_fw_launch_idle_motor_delay',
  'nav_fw_launch_wiggle_to_wake_idle',
  'nav_fw_launch_motor_delay',
  'nav_fw_launch_spinup_time',
  'nav_fw_launch_thr',
  'nav_fw_launch_climb_angle',
  'nav_fw_launch_max_altitude',
  'nav_fw_launch_min_time',
  'nav_fw_launch_timeout',
  'nav_fw_launch_end_time',
];

// Wiggle options
const WIGGLE_OPTIONS = [
  { value: 'OFF', get label() { return t('parameters.AutoLaunchTab.disabled'); } },
  { value: '1', get label() { return t('parameters.AutoLaunchTab.n1WiggleLargerPlanes'); } },
  { value: '2', get label() { return t('parameters.AutoLaunchTab.n2WigglesSmallerPlanes'); } },
];

interface Props {
  modified: boolean;
  setModified: (v: boolean) => void;
}

export default function AutoLaunchTab({ modified, setModified }: Props) {
  const [config, setConfig] = useState<AutoLaunchConfig>(DEFAULT_LAUNCH_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load configuration
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const settings = await window.electronAPI.mspGetSettings(LAUNCH_SETTINGS);

      // Check if we got valid settings
      const hasValidSettings = Object.values(settings).some((v) => v !== null);

      if (hasValidSettings) {
        setConfig({
          nav_fw_launch_accel: Number(settings.nav_fw_launch_accel ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_accel),
          nav_fw_launch_velocity: Number(settings.nav_fw_launch_velocity ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_velocity),
          nav_fw_launch_detect_time: Number(settings.nav_fw_launch_detect_time ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_detect_time),
          nav_fw_launch_max_angle: Number(settings.nav_fw_launch_max_angle ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_max_angle),
          nav_fw_launch_idle_thr: Number(settings.nav_fw_launch_idle_thr ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_idle_thr),
          nav_fw_launch_idle_motor_delay: Number(settings.nav_fw_launch_idle_motor_delay ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_idle_motor_delay),
          nav_fw_launch_wiggle_to_wake_idle: String(settings.nav_fw_launch_wiggle_to_wake_idle ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_wiggle_to_wake_idle),
          nav_fw_launch_motor_delay: Number(settings.nav_fw_launch_motor_delay ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_motor_delay),
          nav_fw_launch_spinup_time: Number(settings.nav_fw_launch_spinup_time ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_spinup_time),
          nav_fw_launch_thr: Number(settings.nav_fw_launch_thr ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_thr),
          nav_fw_launch_climb_angle: Number(settings.nav_fw_launch_climb_angle ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_climb_angle),
          nav_fw_launch_max_altitude: Number(settings.nav_fw_launch_max_altitude ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_max_altitude),
          nav_fw_launch_min_time: Number(settings.nav_fw_launch_min_time ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_min_time),
          nav_fw_launch_timeout: Number(settings.nav_fw_launch_timeout ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_timeout),
          nav_fw_launch_end_time: Number(settings.nav_fw_launch_end_time ?? DEFAULT_LAUNCH_CONFIG.nav_fw_launch_end_time),
        });
        console.log('[AutoLaunch] Loaded settings:', settings);
      } else {
        console.log('[AutoLaunch] No settings returned, using defaults');
        setError(t('parameters.AutoLaunchTab.autoLaunchSettingsNotAvailableOn'));
      }
    } catch (err) {
      console.error('[AutoLaunch] Load error:', err);
      setError(err instanceof Error ? err.message : t('parameters.AutoLaunchTab.failedToLoadLaunchConfig'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Update config helper
  const updateConfig = (updates: Partial<AutoLaunchConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setModified(true);
    setSuccess(null);
  };

  // Save configuration
  const saveConfig = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      console.log('[AutoLaunch] Saving config...');

      // Convert config to settings object
      const settingsToSave: Record<string, string | number> = {
        nav_fw_launch_accel: config.nav_fw_launch_accel,
        nav_fw_launch_velocity: config.nav_fw_launch_velocity,
        nav_fw_launch_detect_time: config.nav_fw_launch_detect_time,
        nav_fw_launch_max_angle: config.nav_fw_launch_max_angle,
        nav_fw_launch_idle_thr: config.nav_fw_launch_idle_thr,
        nav_fw_launch_idle_motor_delay: config.nav_fw_launch_idle_motor_delay,
        nav_fw_launch_wiggle_to_wake_idle: config.nav_fw_launch_wiggle_to_wake_idle,
        nav_fw_launch_motor_delay: config.nav_fw_launch_motor_delay,
        nav_fw_launch_spinup_time: config.nav_fw_launch_spinup_time,
        nav_fw_launch_thr: config.nav_fw_launch_thr,
        nav_fw_launch_climb_angle: config.nav_fw_launch_climb_angle,
        nav_fw_launch_max_altitude: config.nav_fw_launch_max_altitude,
        nav_fw_launch_min_time: config.nav_fw_launch_min_time,
        nav_fw_launch_timeout: config.nav_fw_launch_timeout,
        nav_fw_launch_end_time: config.nav_fw_launch_end_time,
      };

      const settingsSuccess = await window.electronAPI.mspSetSettings(settingsToSave);
      if (!settingsSuccess) {
        console.log('[AutoLaunch] Some settings failed to save');
      }

      // Save to EEPROM
      console.log('[AutoLaunch] Saving to EEPROM...');
      const eepromSuccess = await window.electronAPI.mspSaveEeprom();
      if (!eepromSuccess) {
        setError(t('parameters.AutoLaunchTab.configSentButEepromSaveFailed'));
        return;
      }

      console.log('[AutoLaunch] Saved successfully');
      setSuccess(t('parameters.AutoLaunchTab.launchConfigurationSaved'));
      setModified(false);
    } catch (err) {
      console.error('[AutoLaunch] Save error:', err);
      setError(err instanceof Error ? err.message : t('parameters.AutoLaunchTab.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  // Convert cm to m for altitude display
  const cmToM = (cm: number) => cm / 100;
  const mToCm = (m: number) => Math.round(m * 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mb-2 mx-auto" />
          <p className="text-content-secondary">{t('parameters.AutoLaunchTab.loadingLaunchConfiguration')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-orange-500/10 rounded-xl border-orange-500/30 p-4 flex items-start gap-4">
        <Rocket className="w-8 h-8 text-orange-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-orange-400 font-medium">{t('parameters.AutoLaunchTab.autoLaunchSettingsInavFixedWing')}</p>
          <p className="text-sm text-content-secondary mt-1">
            {t('parameters.AutoLaunchTab.configureAutomaticLaunchDetectionFor')} <strong className="text-content">{t('parameters.AutoLaunchTab.throwBungeeOrCatapult')}</strong> {t('parameters.AutoLaunchTab.launchesWhenEnabledViaASwitch')}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-content-secondary">
            <p><span className="text-orange-400"><Target className="w-3 h-3 inline mr-1" />{t('parameters.AutoLaunchTab.detection')}</span>{t('parameters.AutoLaunchTab.accelerationAngleThresholdsToDetectLaunch')}</p>
            <p><span className="text-blue-400"><Zap className="w-3 h-3 inline mr-1" />{t('parameters.AutoLaunchTab.motor')}</span>{t('parameters.AutoLaunchTab.idleDelayAndThrottleSettings')}</p>
            <p><span className="text-green-400"><TrendingUp className="w-3 h-3 inline mr-1" />{t('parameters.AutoLaunchTab.climb')}</span>{t('parameters.AutoLaunchTab.pitchAngleAndTargetAltitude')}</p>
            <p><span className="text-purple-400"><Settings2 className="w-3 h-3 inline mr-1" />{t('parameters.AutoLaunchTab.exit')}</span>{t('parameters.AutoLaunchTab.transitionToNormalFlight')}</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
            ×
          </button>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="bg-green-500/10 border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <Rocket className="w-5 h-5 text-green-400" />
          <p className="text-sm text-green-400">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-400 hover:text-green-300">
            ×
          </button>
        </div>
      )}

      {/* Section 1: Launch Detection */}
      <div className="bg-surface rounded-xl border-subtle p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Target className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-content">{t('parameters.AutoLaunchTab.launchDetection')}</h3>
            <p className="text-xs text-content-secondary">{t('parameters.AutoLaunchTab.thresholdsToDetectWhenAircraftIs')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <DraggableSlider
              label={t('parameters.AutoLaunchTab.thresholdAcceleration')}
              value={config.nav_fw_launch_accel}
              onChange={(v) => updateConfig({ nav_fw_launch_accel: v })}
              min={1000}
              max={20000}
              step={100}
              unit=""
            />
            <p className="text-[10px] text-content-tertiary -mt-2">{t('parameters.AutoLaunchTab.n1g981HigherHarderThrowNeeded')}</p>

            <DraggableSlider
              label={t('parameters.AutoLaunchTab.thresholdVelocity')}
              value={config.nav_fw_launch_velocity}
              onChange={(v) => updateConfig({ nav_fw_launch_velocity: v })}
              min={100}
              max={10000}
              step={50}
              unit=""
            />
            <p className="text-[10px] text-content-tertiary -mt-2">{t('parameters.AutoLaunchTab.forSwingLaunchDetectionDefault300')}</p>
          </div>

          <div className="space-y-4">
            <DraggableSlider
              label={t('parameters.AutoLaunchTab.detectionTime')}
              value={config.nav_fw_launch_detect_time}
              onChange={(v) => updateConfig({ nav_fw_launch_detect_time: v })}
              min={10}
              max={1000}
              step={10}
              unit="ms"
            />
            <p className="text-[10px] text-content-tertiary -mt-2">{t('parameters.AutoLaunchTab.mustExceedThresholdForThisDuration')}</p>

            <DraggableSlider
              label={t('parameters.AutoLaunchTab.maxThrowAngle')}
              value={config.nav_fw_launch_max_angle}
              onChange={(v) => updateConfig({ nav_fw_launch_max_angle: v })}
              min={5}
              max={180}
              step={5}
              unit="°"
            />
            <p className="text-[10px] text-content-tertiary -mt-2">{t('parameters.AutoLaunchTab.maxPitchRollToAcceptLaunch')}</p>
          </div>
        </div>
      </div>

      {/* Section 2: Idle & Motor Startup */}
      <div className="bg-surface rounded-xl border-subtle p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-content">{t('parameters.AutoLaunchTab.idleMotorStartup')}</h3>
            <p className="text-xs text-content-secondary">{t('parameters.AutoLaunchTab.motorBehaviorBeforeAndDuringLaunch')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <DraggableSlider
              label={t('parameters.AutoLaunchTab.idleThrottle')}
              value={config.nav_fw_launch_idle_thr}
              onChange={(v) => updateConfig({ nav_fw_launch_idle_thr: v })}
              min={1000}
              max={2000}
              step={10}
              unit="µs"
            />
            <p className="text-[10px] text-content-tertiary -mt-2">{t('parameters.AutoLaunchTab.motorSpeedBeforeLaunchDetectedDefault')}</p>

            <DraggableSlider
              label={t('parameters.AutoLaunchTab.idleMotorDelay')}
              value={config.nav_fw_launch_idle_motor_delay}
              onChange={(v) => updateConfig({ nav_fw_launch_idle_motor_delay: v })}
              min={0}
              max={60000}
              step={500}
              unit="ms"
            />
            <p className="text-[10px] text-content-tertiary -mt-2">{t('parameters.AutoLaunchTab.delayBeforeIdleMotorsSpinDefault')}</p>

            <div>
              <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.AutoLaunchTab.wiggleToWake')}</label>
              <select
                value={config.nav_fw_launch_wiggle_to_wake_idle}
                onChange={(e) => updateConfig({ nav_fw_launch_wiggle_to_wake_idle: e.target.value })}
                className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
              >
                {WIGGLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-content-tertiary mt-1">{t('parameters.AutoLaunchTab.yawWiggleToStartIdleMotor')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <DraggableSlider
              label={t('parameters.AutoLaunchTab.motorDelay')}
              value={config.nav_fw_launch_motor_delay}
              onChange={(v) => updateConfig({ nav_fw_launch_motor_delay: v })}
              min={0}
              max={5000}
              step={50}
              unit="ms"
            />
            <p className="text-[10px] text-content-tertiary -mt-2">{t('parameters.AutoLaunchTab.delayAfterDetectionBeforeThrottleUp')}</p>

            <DraggableSlider
              label={t('parameters.AutoLaunchTab.motorSpinupTime')}
              value={config.nav_fw_launch_spinup_time}
              onChange={(v) => updateConfig({ nav_fw_launch_spinup_time: v })}
              min={0}
              max={1000}
              step={10}
              unit="ms"
            />
            <p className="text-[10px] text-content-tertiary -mt-2">{t('parameters.AutoLaunchTab.rampTimeFromIdleToLaunch')}</p>

            <DraggableSlider
              label={t('parameters.AutoLaunchTab.launchThrottle')}
              value={config.nav_fw_launch_thr}
              onChange={(v) => updateConfig({ nav_fw_launch_thr: v })}
              min={1000}
              max={2000}
              step={10}
              unit="µs"
            />
            <p className="text-[10px] text-content-tertiary -mt-2">{t('parameters.AutoLaunchTab.throttleDuringClimbDefault1700S')}</p>
          </div>
        </div>
      </div>

      {/* Section 3: Climb & Exit */}
      <div className="bg-surface rounded-xl border-subtle p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-content">{t('parameters.AutoLaunchTab.climbExit')}</h3>
            <p className="text-xs text-content-secondary">{t('parameters.AutoLaunchTab.climbBehaviorAndTransitionToNormal')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <DraggableSlider
              label={t('parameters.AutoLaunchTab.climbAngle')}
              value={config.nav_fw_launch_climb_angle}
              onChange={(v) => updateConfig({ nav_fw_launch_climb_angle: v })}
              min={0}
              max={45}
              step={1}
              unit="°"
            />
            <p className="text-[10px] text-content-tertiary -mt-2">{t('parameters.AutoLaunchTab.pitchAngleDuringClimbDefault18')}</p>

            <div>
              <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.AutoLaunchTab.maximumAltitudeM')}</label>
              <DraftNumberInput
                value={cmToM(config.nav_fw_launch_max_altitude)}
                onCommit={(v) => updateConfig({ nav_fw_launch_max_altitude: mToCm(v) })}
                className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
                min={0}
                max={600}
                step={5}
              />
              <p className="text-[10px] text-content-tertiary mt-1">{t('parameters.AutoLaunchTab.exitLaunchWhenReached0Use')}</p>
            </div>

            <DraggableSlider
              label={t('parameters.AutoLaunchTab.minimumLaunchTime')}
              value={config.nav_fw_launch_min_time}
              onChange={(v) => updateConfig({ nav_fw_launch_min_time: v })}
              min={0}
              max={60000}
              step={500}
              unit="ms"
            />
            <p className="text-[10px] text-content-tertiary -mt-2">{t('parameters.AutoLaunchTab.ignoreStickInputsDuringThisTime')}</p>
          </div>

          <div className="space-y-4">
            <DraggableSlider
              label={t('parameters.AutoLaunchTab.launchTimeout')}
              value={config.nav_fw_launch_timeout}
              onChange={(v) => updateConfig({ nav_fw_launch_timeout: v })}
              min={0}
              max={60000}
              step={500}
              unit="ms"
            />
            <p className="text-[10px] text-content-tertiary -mt-2">{t('parameters.AutoLaunchTab.maxTimeInLaunchModeDefault')}</p>

            <DraggableSlider
              label={t('parameters.AutoLaunchTab.endTransitionTime')}
              value={config.nav_fw_launch_end_time}
              onChange={(v) => updateConfig({ nav_fw_launch_end_time: v })}
              min={0}
              max={5000}
              step={100}
              unit="ms"
            />
            <p className="text-[10px] text-content-tertiary -mt-2">{t('parameters.AutoLaunchTab.smoothTransitionToNormalFlightDefault')}</p>
          </div>
        </div>
      </div>

      {/* Safety Warning */}
      <div className="bg-amber-500/10 rounded-xl border border-amber-500/30 p-4 flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-400 font-medium">{t('parameters.AutoLaunchTab.importantSafetyNotes')}</p>
          <ul className="text-sm text-content-secondary mt-1 space-y-1 list-disc list-inside">
            <li>{t('parameters.AutoLaunchTab.alwaysTestAutoLaunchInAn')}</li>
            <li>{t('parameters.AutoLaunchTab.startWithConservativeSettingsAndAdjust')}</li>
            <li>{t('parameters.AutoLaunchTab.ensureNavLaunchModeIsAssigned')}</li>
            <li>{t('parameters.AutoLaunchTab.haveAWayToAbortDisarm')}</li>
          </ul>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        <button
          onClick={loadConfig}
          disabled={loading}
          className="px-4 py-2 text-sm bg-surface-raised text-content rounded-lg hover:bg-surface-raised flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('parameters.AutoLaunchTab.refresh')}
        </button>
        <button
          onClick={saveConfig}
          disabled={!modified || saving}
          className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 ${
            modified
              ? 'bg-orange-500 text-white hover:bg-orange-400'
              : 'bg-surface-raised text-content-secondary cursor-not-allowed'
          }`}
        >
          <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
          {saving ? t('parameters.AutoLaunchTab.saving') : t('parameters.AutoLaunchTab.saveLaunchConfig')}
        </button>
      </div>
    </div>
  );
}
