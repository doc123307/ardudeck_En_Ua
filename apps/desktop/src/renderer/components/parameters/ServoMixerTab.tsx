/**
 * ServoMixerTab
 *
 * Servo Mixer configuration - tell the flight controller what each servo controls.
 */

import { useState, useEffect, useCallback } from 'react';
import { DraftNumberInput } from '../../hooks/useNumericDraft';
import { CompactSlider } from '../ui/DraggableSlider';
import { useServoWizardStore } from '../../stores/servo-wizard-store';
import {
  Settings,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { t } from '../../i18n';

// Types matching msp-ts
interface MSPServoConfig {
  min: number;
  max: number;
  middle: number;
  rate: number;
  forwardFromChannel: number;
  reversedSources: number;
}

interface MSPServoMixerRule {
  targetChannel: number;
  inputSource: number;
  rate: number;
  speed: number;
  min: number;
  max: number;
  box: number;
}

// Human-readable input source names
const INPUT_SOURCE_NAMES: Record<number, string> = {
  0: 'Roll',
  1: 'Pitch',
  2: 'Yaw',
  3: 'Throttle',
  4: 'RC Roll (raw)',
  5: 'RC Pitch (raw)',
  6: 'RC Yaw (raw)',
  7: 'RC Throttle (raw)',
  8: 'AUX 1',
  9: 'AUX 2',
  10: 'AUX 3',
  11: 'AUX 4',
  12: 'Gimbal Pitch',
  13: 'Gimbal Roll',
  14: 'Flap input',
  15: 'Headtracker',
};

// Servo function presets - what the servo is connected to
interface ServoFunction {
  id: string;
  name: string;
  description: string;
  color: string; // gradient + border classes
  activeColor: string; // when selected
  rules: { inputSource: number; rate: number }[];
}

const SERVO_FUNCTIONS: ServoFunction[] = [
  {
    id: 'aileron',
    name: 'Aileron',
    get description() { return t('parameters.ServoMixerTab.respondsToRoll'); },
    color: 'bg-gradient-to-br from-blue-500/25 to-blue-600/15 border-blue-500/40 hover:border-blue-400/60',
    activeColor: 'bg-gradient-to-br from-blue-500/40 to-blue-600/30 border-blue-400 text-blue-200',
    rules: [{ inputSource: 0, rate: 100 }],
  },
  {
    id: 'elevator',
    name: 'Elevator',
    get description() { return t('parameters.ServoMixerTab.respondsToPitch'); },
    color: 'bg-gradient-to-br from-emerald-500/25 to-emerald-600/15 border-emerald-500/40 hover:border-emerald-400/60',
    activeColor: 'bg-gradient-to-br from-emerald-500/40 to-emerald-600/30 border-emerald-400 text-emerald-200',
    rules: [{ inputSource: 1, rate: 100 }],
  },
  {
    id: 'rudder',
    name: 'Rudder',
    get description() { return t('parameters.ServoMixerTab.respondsToYaw'); },
    color: 'bg-gradient-to-br from-purple-500/25 to-purple-600/15 border-purple-500/40 hover:border-purple-400/60',
    activeColor: 'bg-gradient-to-br from-purple-500/40 to-purple-600/30 border-purple-400 text-purple-200',
    rules: [{ inputSource: 2, rate: 100 }],
  },
  {
    id: 'elevon_l',
    name: 'Elevon (Left)',
    get description() { return t('parameters.ServoMixerTab.rollPitchCombined'); },
    color: 'bg-gradient-to-br from-cyan-500/25 to-cyan-600/15 border-cyan-500/40 hover:border-cyan-400/60',
    activeColor: 'bg-gradient-to-br from-cyan-500/40 to-cyan-600/30 border-cyan-400 text-cyan-200',
    rules: [
      { inputSource: 0, rate: 100 },
      { inputSource: 1, rate: 100 },
    ],
  },
  {
    id: 'elevon_r',
    name: 'Elevon (Right)',
    get description() { return t('parameters.ServoMixerTab.rollRevPitch'); },
    color: 'bg-gradient-to-br from-cyan-500/25 to-cyan-600/15 border-cyan-500/40 hover:border-cyan-400/60',
    activeColor: 'bg-gradient-to-br from-cyan-500/40 to-cyan-600/30 border-cyan-400 text-cyan-200',
    rules: [
      { inputSource: 0, rate: -100 },
      { inputSource: 1, rate: 100 },
    ],
  },
  {
    id: 'vtail_l',
    name: 'V-Tail (Left)',
    get description() { return t('parameters.ServoMixerTab.pitchYawMixed'); },
    color: 'bg-gradient-to-br from-amber-500/25 to-amber-600/15 border-amber-500/40 hover:border-amber-400/60',
    activeColor: 'bg-gradient-to-br from-amber-500/40 to-amber-600/30 border-amber-400 text-amber-200',
    rules: [
      { inputSource: 1, rate: 100 },
      { inputSource: 2, rate: -50 },
    ],
  },
  {
    id: 'vtail_r',
    name: 'V-Tail (Right)',
    get description() { return t('parameters.ServoMixerTab.pitchYawRev'); },
    color: 'bg-gradient-to-br from-amber-500/25 to-amber-600/15 border-amber-500/40 hover:border-amber-400/60',
    activeColor: 'bg-gradient-to-br from-amber-500/40 to-amber-600/30 border-amber-400 text-amber-200',
    rules: [
      { inputSource: 1, rate: 100 },
      { inputSource: 2, rate: 50 },
    ],
  },
  {
    id: 'flaperon',
    name: 'Flaperon',
    get description() { return t('parameters.ServoMixerTab.aileronFlapInput'); },
    color: 'bg-gradient-to-br from-rose-500/25 to-rose-600/15 border-rose-500/40 hover:border-rose-400/60',
    activeColor: 'bg-gradient-to-br from-rose-500/40 to-rose-600/30 border-rose-400 text-rose-200',
    rules: [
      { inputSource: 0, rate: 100 },
      { inputSource: 14, rate: 50 },
    ],
  },
  {
    id: 'gimbal_pan',
    name: 'Gimbal Pan',
    get description() { return t('parameters.ServoMixerTab.cameraLeftRight'); },
    color: 'bg-gradient-to-br from-indigo-500/25 to-indigo-600/15 border-indigo-500/40 hover:border-indigo-400/60',
    activeColor: 'bg-gradient-to-br from-indigo-500/40 to-indigo-600/30 border-indigo-400 text-indigo-200',
    rules: [{ inputSource: 13, rate: 100 }],
  },
  {
    id: 'gimbal_tilt',
    name: 'Gimbal Tilt',
    get description() { return t('parameters.ServoMixerTab.cameraUpDown'); },
    color: 'bg-gradient-to-br from-indigo-500/25 to-indigo-600/15 border-indigo-500/40 hover:border-indigo-400/60',
    activeColor: 'bg-gradient-to-br from-indigo-500/40 to-indigo-600/30 border-indigo-400 text-indigo-200',
    rules: [{ inputSource: 12, rate: 100 }],
  },
  {
    id: 'aux_control',
    name: 'AUX Channel',
    get description() { return t('parameters.ServoMixerTab.directAux1Control'); },
    color: 'bg-gradient-to-br from-slate-400/25 to-slate-500/15 border-slate-400/40 hover:border-slate-300/60',
    activeColor: 'bg-gradient-to-br from-slate-400/40 to-slate-500/30 border-slate-300 text-slate-200',
    rules: [{ inputSource: 8, rate: 100 }],
  },
];

interface Props {
  modified: boolean;
  setModified: (v: boolean) => void;
}

export default function ServoMixerTab({ modified, setModified }: Props) {
  const [servoConfigs, setServoConfigs] = useState<MSPServoConfig[]>([]);
  const [mixerRules, setMixerRules] = useState<MSPServoMixerRule[]>([]);
  const [servoValues, setServoValues] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServo, setSelectedServo] = useState<number>(0);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [showAllServos, setShowAllServos] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { msp2PlatformType } = useServoWizardStore();

  // Load servo configuration
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const configs = await window.electronAPI.mspGetServoConfigs();
      if (configs) setServoConfigs(configs as MSPServoConfig[]);

      const mixer = await window.electronAPI.mspGetServoMixer();
      if (mixer) setMixerRules(mixer as MSPServoMixerRule[]);

      const values = await window.electronAPI.mspGetServoValues();
      if (values) setServoValues(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parameters.ServoMixerTab.failedToLoadServoConfig'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Poll servo values
  useEffect(() => {
    if (!pollingEnabled) return;
    const interval = setInterval(async () => {
      try {
        const values = await window.electronAPI.mspGetServoValues();
        if (values) setServoValues(values);
      } catch {
        /* ignore */
      }
    }, 100);
    return () => clearInterval(interval);
  }, [pollingEnabled]);

  const updateServoConfig = (index: number, updates: Partial<MSPServoConfig>) => {
    setServoConfigs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, ...updates };
      return next;
    });
    setModified(true);
  };

  const updateMixerRule = (index: number, updates: Partial<MSPServoMixerRule>) => {
    setMixerRules((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, ...updates };
      return next;
    });
    setModified(true);
  };

  const addMixerRule = (servoIndex: number) => {
    setMixerRules((prev) => [
      ...prev,
      { targetChannel: servoIndex, inputSource: 0, rate: 100, speed: 0, min: 0, max: 0, box: 0 },
    ]);
    setModified(true);
  };

  const removeMixerRule = (index: number) => {
    setMixerRules((prev) => prev.filter((_, i) => i !== index));
    setModified(true);
  };

  const saveAll = async () => {
    setError(null);
    try {
      for (let i = 0; i < servoConfigs.length; i++) {
        const success = await window.electronAPI.mspSetServoConfig(i, servoConfigs[i]);
        if (!success) {
          setError(t('parameters.ServoMixerTab.failedToSaveServoConfig', { i }));
          return;
        }
      }

      for (let i = 0; i < mixerRules.length; i++) {
        await window.electronAPI.mspSetServoMixer(i, mixerRules[i]);
      }

      const eepromSuccess = await window.electronAPI.mspSaveEeprom();
      if (!eepromSuccess) {
        setError(t('parameters.ServoMixerTab.configSentButEepromSaveFailed'));
        return;
      }
      setModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parameters.ServoMixerTab.failedToSave'));
    }
  };

  const applyFunction = (func: ServoFunction) => {
    const existingRules = mixerRules.filter((r) => r.targetChannel !== selectedServo);
    const newRules = func.rules.map((rule) => ({
      targetChannel: selectedServo,
      inputSource: rule.inputSource,
      rate: rule.rate,
      speed: 0,
      min: 0,
      max: 0,
      box: 0,
    }));
    setMixerRules([...existingRules, ...newRules]);
    setModified(true);
  };

  const clearServoRules = () => {
    setMixerRules((prev) => prev.filter((r) => r.targetChannel !== selectedServo));
    setModified(true);
  };

  const getRulesForServo = (servoIndex: number) => {
    const maxServo = servoConfigs.length - 1;
    const maxInputSource = Object.keys(INPUT_SOURCE_NAMES).length - 1; // 15 (Headtracker)

    // First filter valid rules
    const validRules = mixerRules
      .map((rule, idx) => ({ ...rule, originalIndex: idx }))
      .filter((r) =>
        r.targetChannel === servoIndex &&
        r.targetChannel >= 0 &&
        r.targetChannel <= maxServo &&
        r.inputSource >= 0 &&
        r.inputSource <= maxInputSource && // Filter out garbage data (255, etc.)
        r.rate !== 0 // Zero rate = no effect, likely garbage
      );

    // Deduplicate: keep only first rule per unique (inputSource, rate sign) combo
    // Multiple identical rules = garbage EEPROM data
    const seen = new Set<string>();
    return validRules.filter((r) => {
      const key = `${r.inputSource}:${r.rate < 0 ? 'neg' : 'pos'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const getServosWithRules = () => {
    // Filter out invalid servo indices (255 = unassigned, or >= actual servo count)
    // Also filter out rules with invalid inputSource or zero rate
    const maxServo = servoConfigs.length - 1;
    const maxInputSource = Object.keys(INPUT_SOURCE_NAMES).length - 1;
    const validRules = mixerRules.filter(
      (r) =>
        r.targetChannel >= 0 &&
        r.targetChannel <= maxServo &&
        r.inputSource >= 0 &&
        r.inputSource <= maxInputSource &&
        r.rate !== 0
    );
    return [...new Set(validRules.map((r) => r.targetChannel))].sort((a, b) => a - b);
  };

  // Describe what a servo does based on its rules
  const describeServoFunction = (servoIndex: number): string => {
    const rules = getRulesForServo(servoIndex);
    if (rules.length === 0) return 'Not configured';

    const inputs = rules.map((r) => {
      const name = INPUT_SOURCE_NAMES[r.inputSource] || `Input ${r.inputSource}`;
      if (r.rate < 0) return `${name} (rev)`;
      return name;
    });

    return inputs.join(' + ');
  };

  const getVisibleServos = () => {
    if (showAllServos) return servoConfigs.map((_, idx) => idx);
    const withRules = getServosWithRules();
    // Only show servos that have rules configured
    // If no rules at all, show first 4 as fallback for initial setup
    if (withRules.length === 0) return [0, 1, 2, 3];
    return withRules;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-2 mx-auto" />
          <p className="text-content-secondary">{t('parameters.ServoMixerTab.loadingServoConfiguration')}</p>
        </div>
      </div>
    );
  }

  const currentConfig = servoConfigs[selectedServo];
  const currentRules = getRulesForServo(selectedServo);
  const visibleServos = getVisibleServos();
  const hasHiddenServos = servoConfigs.length > visibleServos.length;
  const servosWithRules = getServosWithRules();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-medium text-content">{t('parameters.ServoMixerTab.servoMixer')}</h2>
        <p className="text-sm text-content-secondary">
          {t('parameters.ServoMixerTab.tellTheFlightControllerWhatEach')}
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border-red-500/30 rounded-lg p-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            ×
          </button>
        </div>
      )}

      {/* Servo Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-content-secondary uppercase tracking-wide">{t('parameters.ServoMixerTab.selectServo')}</span>
          {servoConfigs.length > 4 && (
            <button
              onClick={() => setShowAllServos(!showAllServos)}
              className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                showAllServos
                  ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'
                  : 'text-content-secondary hover:text-content hover:bg-surface-raised'
              }`}
            >
              {showAllServos ? (
                <>
                  <ChevronDown className="w-3 h-3" />
                  {t('parameters.ServoMixerTab.hideUnused')}
                </>
              ) : (
                <>
                  <ChevronRight className="w-3 h-3" />
                  {t('parameters.ServoMixerTab.showAll')} {servoConfigs.length}
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {visibleServos.map((idx) => {
            const hasRules = servosWithRules.includes(idx);
            const description = describeServoFunction(idx);
            return (
              <button
                key={idx}
                onClick={() => setSelectedServo(idx)}
                className={`relative px-3 py-2 rounded-lg transition-all text-left min-w-[80px] ${
                  selectedServo === idx
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                    : hasRules
                      ? 'bg-surface-raised border text-content hover:border'
                      : 'bg-surface border-subtle text-content-secondary hover:border'
                }`}
              >
                <div className="text-xs font-medium">{t('parameters.ServoMixerTab.servo')} {idx}</div>
                <div className="text-[10px] opacity-70 truncate max-w-[100px]">{description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {currentConfig && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: What is this servo? */}
          <div className="bg-gradient-to-br from-blue-500/10 to-indigo-600/5 rounded-xl border-blue-500/20 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-blue-200">
                {t('parameters.ServoMixerTab.whatIsServo')} {selectedServo} {t('parameters.ServoMixerTab.connectedTo')}
              </h3>
              <p className="text-xs text-blue-300/60 mt-0.5">
                {t('parameters.ServoMixerTab.selectTheControlSurfaceOrFunction')}
              </p>
            </div>

            {/* Function buttons */}
            <div className="grid grid-cols-3 gap-2">
              {SERVO_FUNCTIONS.map((func) => {
                // Check if this function matches current rules
                const isActive =
                  currentRules.length === func.rules.length &&
                  func.rules.every((fr) =>
                    currentRules.some((cr) => cr.inputSource === fr.inputSource && cr.rate === fr.rate)
                  );

                return (
                  <button
                    key={func.id}
                    onClick={() => applyFunction(func)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isActive ? func.activeColor : `${func.color} text-content`
                    }`}
                  >
                    <div className="text-xs font-medium">{func.name}</div>
                    <div className="text-[10px] opacity-60 mt-0.5">{func.description}</div>
                  </button>
                );
              })}
            </div>

            {/* Clear button */}
            {currentRules.length > 0 && (
              <button
                onClick={clearServoRules}
                className="w-full py-2 text-xs text-blue-300/50 hover:text-blue-200 hover:bg-blue-500/10 rounded transition-colors"
              >
                {t('parameters.ServoMixerTab.clearThisServoDoesNothing')}
              </button>
            )}

            {/* Current configuration summary */}
            {currentRules.length > 0 && (
              <div className="p-3 bg-blue-500/10 border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-300/60">{t('parameters.ServoMixerTab.currentConfiguration')}</p>
                <p className="text-sm text-blue-100 mt-1">
                  {t('parameters.ServoMixerTab.servo')} {selectedServo} {t('parameters.ServoMixerTab.respondsTo')} <strong className="text-blue-200">{describeServoFunction(selectedServo)}</strong>
                </p>
              </div>
            )}
          </div>

          {/* Right: Servo limits + Advanced */}
          <div className="space-y-4">
            {/* Servo Limits */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-600/5 rounded-xl border-emerald-500/20 p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-emerald-200">{t('parameters.ServoMixerTab.servoLimits')}</h3>
                  <p className="text-xs text-emerald-300/60">{t('parameters.ServoMixerTab.adjustTravelRangeIfNeeded')}</p>
                </div>
              </div>

              {/* PWM Visualization */}
              <div className="relative h-5 bg-surface-raised rounded overflow-hidden">
                <div
                  className="absolute h-full bg-blue-500/30"
                  style={{
                    left: `${((currentConfig.min - 750) / 1500) * 100}%`,
                    width: `${((currentConfig.max - currentConfig.min) / 1500) * 100}%`,
                  }}
                />
                <div
                  className="absolute w-0.5 h-full bg-blue-400"
                  style={{
                    left: `${(((servoValues[selectedServo] || currentConfig.middle) - 750) / 1500) * 100}%`,
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CompactSlider
                  label={t('parameters.ServoMixerTab.min')}
                  value={currentConfig.min}
                  onChange={(v) => updateServoConfig(selectedServo, { min: v })}
                  min={750}
                  max={2250}
                  step={10}
                  color="#3B82F6"
                />
                <CompactSlider
                  label={t('parameters.ServoMixerTab.max')}
                  value={currentConfig.max}
                  onChange={(v) => updateServoConfig(selectedServo, { max: v })}
                  min={750}
                  max={2250}
                  step={10}
                  color="#3B82F6"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CompactSlider
                  label={t('parameters.ServoMixerTab.center')}
                  value={currentConfig.middle}
                  onChange={(v) => updateServoConfig(selectedServo, { middle: v })}
                  min={750}
                  max={2250}
                  step={10}
                  color="#22C55E"
                />
                <CompactSlider
                  label={t('parameters.ServoMixerTab.rate')}
                  value={currentConfig.rate}
                  onChange={(v) => updateServoConfig(selectedServo, { rate: v })}
                  min={-125}
                  max={125}
                  step={5}
                  color="#A855F7"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pollingEnabled}
                    onChange={(e) => setPollingEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-emerald-500/40 bg-emerald-900/30 text-emerald-500"
                  />
                  <span className="text-xs text-emerald-300/60">{t('parameters.ServoMixerTab.livePosition')}</span>
                </label>
                <span className="text-xs text-emerald-300/50 font-mono">
                  {servoValues[selectedServo] || 1500} µs
                </span>
              </div>
            </div>

            {/* Advanced: Custom rules */}
            <div className="bg-gradient-to-br from-purple-500/10 to-violet-600/5 rounded-xl border-purple-500/20">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full p-3 flex items-center justify-between text-left"
              >
                <span className="text-xs text-purple-300/70">{t('parameters.ServoMixerTab.advancedCustomMixingRules')}</span>
                {showAdvanced ? (
                  <ChevronDown className="w-4 h-4 text-purple-400/60" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-purple-400/60" />
                )}
              </button>

              {showAdvanced && (
                <div className="p-4 pt-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-purple-300/50">
                      {t('parameters.ServoMixerTab.forComplexSetupsMostUsersDon')}
                    </p>
                    <button
                      onClick={() => addMixerRule(selectedServo)}
                      className="p-1 text-purple-400/60 hover:text-purple-300 hover:bg-purple-500/10 rounded"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {currentRules.length === 0 ? (
                    <p className="text-xs text-purple-300/50 text-center py-2">{t('parameters.ServoMixerTab.noRules')}</p>
                  ) : (
                    currentRules.map((rule) => (
                      <div key={rule.originalIndex} className="flex items-center gap-2">
                        <select
                          value={rule.inputSource}
                          onChange={(e) =>
                            updateMixerRule(rule.originalIndex, { inputSource: Number(e.target.value) })
                          }
                          className="flex-1 px-2 py-1.5 bg-purple-900/30 border-purple-500/30 rounded text-xs text-purple-200"
                        >
                          {Object.entries(INPUT_SOURCE_NAMES).map(([val, name]) => (
                            <option key={val} value={val}>
                              {name}
                            </option>
                          ))}
                        </select>
                        <DraftNumberInput
                          value={rule.rate}
                          integer
                          onCommit={(v) =>
                            updateMixerRule(rule.originalIndex, { rate: v })
                          }
                          className="w-16 px-2 py-1.5 bg-purple-900/30 border-purple-500/30 rounded text-xs text-purple-200 text-center"
                          min={-125}
                          max={125}
                        />
                        <span className="text-[10px] text-purple-300/50">%</span>
                        <button
                          onClick={() => removeMixerRule(rule.originalIndex)}
                          className="p-1 text-purple-400/50 hover:text-red-400 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-between items-center pt-2">
        <button
          onClick={loadConfig}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-content-secondary hover:text-content hover:bg-surface-raised rounded transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('parameters.ServoMixerTab.refresh')}
        </button>
        <button
          onClick={saveAll}
          disabled={!modified}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
            modified
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'bg-surface-raised text-content-secondary cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          {t('parameters.ServoMixerTab.save')}
        </button>
      </div>
    </div>
  );
}
