/**
 * Legacy Mixer Tab
 *
 * Motor mixer (mmix) and servo mixer (smix) for legacy F3 boards.
 * Modern UI with visual mixing representation.
 */

import { useState } from 'react';
import { DraftNumberInput } from '../../hooks/useNumericDraft';
import { useLegacyConfigStore, type LegacyMotorMix, type LegacyServoMix } from '../../stores/legacy-config-store';
import { Wrench, Settings, Cog } from 'lucide-react';
import { t } from '../../i18n';

// Maximum mixer entries (iNav limits)
const MAX_MOTOR_MIXERS = 8;
const MAX_SERVO_MIXERS = 16;

// Servo input sources for iNav
const SERVO_SOURCES: Record<number, { label: string; color: string }> = {
  0: { get label() { return t('legacy_config.LegacyMixerTab.stabilizedRoll'); }, color: '#EF4444' },
  1: { get label() { return t('legacy_config.LegacyMixerTab.stabilizedPitch'); }, color: '#22C55E' },
  2: { get label() { return t('legacy_config.LegacyMixerTab.stabilizedYaw'); }, color: '#3B82F6' },
  3: { get label() { return t('legacy_config.LegacyMixerTab.stabilizedThrottle'); }, color: '#F59E0B' },
  4: { get label() { return t('legacy_config.LegacyMixerTab.rcRoll'); }, color: '#EF4444' },
  5: { get label() { return t('legacy_config.LegacyMixerTab.rcPitch'); }, color: '#22C55E' },
  6: { get label() { return t('legacy_config.LegacyMixerTab.rcYaw'); }, color: '#3B82F6' },
  7: { get label() { return t('legacy_config.LegacyMixerTab.rcThrottle'); }, color: '#F59E0B' },
  8: { label: 'RC AUX 1', color: '#8B5CF6' },
  9: { label: 'RC AUX 2', color: '#EC4899' },
  10: { label: 'RC AUX 3', color: '#06B6D4' },
  11: { label: 'RC AUX 4', color: '#10B981' },
};

// Mixing value bar component
function MixBar({ value, color, label }: { value: number; color: string; label: string }) {
  const percentage = Math.abs(value) * 100;
  const isNegative = value < 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-content-secondary">{label}</span>
        <span className="font-mono" style={{ color }}>{value.toFixed(3)}</span>
      </div>
      <div className="relative h-2 bg-surface-inset rounded-full overflow-hidden">
        <div
          className="absolute top-0 h-full rounded-full transition-all"
          style={{
            left: isNegative ? `${50 - percentage / 2}%` : '50%',
            width: `${percentage / 2}%`,
            backgroundColor: color,
          }}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-surface-raised" />
      </div>
    </div>
  );
}

export default function LegacyMixerTab() {
  const {
    motorMixer,
    servoMixer,
    updateMotorMix,
    updateServoMix,
    addMotorMix,
    removeMotorMix,
    addServoMix,
    removeServoMix,
  } = useLegacyConfigStore();
  const [activeSection, setActiveSection] = useState<'motor' | 'servo'>('motor');

  const canAddMotor = motorMixer.length < MAX_MOTOR_MIXERS;
  const canAddServo = servoMixer.length < MAX_SERVO_MIXERS;

  const handleMotorMixChange = (mix: LegacyMotorMix) => {
    updateMotorMix(mix.index, mix);
    window.electronAPI.cliSendCommand(
      `mmix ${mix.index} ${mix.throttle.toFixed(3)} ${mix.roll.toFixed(3)} ${mix.pitch.toFixed(3)} ${mix.yaw.toFixed(3)}`
    );
  };

  const handleServoMixChange = (mix: LegacyServoMix) => {
    updateServoMix(mix.index, mix);
    window.electronAPI.cliSendCommand(
      `smix ${mix.index} ${mix.targetChannel} ${mix.inputSource} ${mix.rate} ${mix.speed} ${mix.min} ${mix.max} ${mix.box}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Wrench className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm text-amber-300 font-medium">{t('legacy_config.LegacyMixerTab.mixerConfiguration')}</p>
            <p className="text-xs text-amber-300/70 mt-1">
              {t('legacy_config.LegacyMixerTab.defineHowMotorsAndServosRespond')}
            </p>
          </div>
        </div>
      </div>

      {/* Section Tabs and Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 p-1 bg-surface-input rounded-lg w-fit">
          <button
            onClick={() => setActiveSection('motor')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeSection === 'motor'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-content-secondary hover:text-content'
            }`}
          >
            <Settings className="w-4 h-4 mr-2 inline" />
            {t('legacy_config.LegacyMixerTab.motorMixer')}{motorMixer.length})
          </button>
          <button
            onClick={() => setActiveSection('servo')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeSection === 'servo'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-content-secondary hover:text-content'
            }`}
          >
            <Cog className="w-4 h-4 mr-2 inline" />
            {t('legacy_config.LegacyMixerTab.servoMixer')}{servoMixer.length})
          </button>
        </div>

        {/* Add button */}
        {activeSection === 'motor' && (
          <button
            onClick={() => addMotorMix()}
            disabled={!canAddMotor}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              canAddMotor
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-surface-raised text-content-secondary cursor-not-allowed'
            }`}
          >
            <span>+</span>
            {t('legacy_config.LegacyMixerTab.addMotor')}{motorMixer.length}/{MAX_MOTOR_MIXERS})
          </button>
        )}
        {activeSection === 'servo' && (
          <button
            onClick={() => addServoMix()}
            disabled={!canAddServo}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              canAddServo
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-surface-raised text-content-secondary cursor-not-allowed'
            }`}
          >
            <span>+</span>
            {t('legacy_config.LegacyMixerTab.addServoRule')}{servoMixer.length}/{MAX_SERVO_MIXERS})
          </button>
        )}
      </div>

      {/* Motor Mixer */}
      {activeSection === 'motor' && (
        <div>
          {motorMixer.length === 0 ? (
            <div className="text-center py-12 text-content-secondary">
              <Settings className="w-10 h-10 text-content-secondary mb-3 mx-auto" />
              <p>{t('legacy_config.LegacyMixerTab.noMotorMixerRulesFound')}</p>
              <p className="text-sm mt-1">{t('legacy_config.LegacyMixerTab.thisIsNormalForFixedWing')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {motorMixer.map((mix) => (
                <div key={mix.index} className="bg-surface-input rounded-xl border border-subtle overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold">
                        M{mix.index}
                      </div>
                      <div>
                        <h3 className="font-semibold text-content">{t('legacy_config.LegacyMixerTab.motor')} {mix.index}</h3>
                        <p className="text-xs text-content-secondary">{t('legacy_config.LegacyMixerTab.outputChannel')}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeMotorMix(mix.index)}
                      className="p-2 text-content-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title={t('legacy_config.LegacyMixerTab.removeMotorMixer')}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Mix values */}
                  <div className="p-4 space-y-3">
                    <MixBar value={mix.throttle} color="#F59E0B" label={t('legacy_config.LegacyMixerTab.throttle')} />
                    <MixBar value={mix.roll} color="#EF4444" label={t('legacy_config.LegacyMixerTab.roll')} />
                    <MixBar value={mix.pitch} color="#22C55E" label={t('legacy_config.LegacyMixerTab.pitch')} />
                    <MixBar value={mix.yaw} color="#3B82F6" label={t('legacy_config.LegacyMixerTab.yaw')} />

                    {/* Edit controls */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-subtle">
                      <div>
                        <label className="block text-xs text-content-secondary mb-1">{t('legacy_config.LegacyMixerTab.throttle')}</label>
                        <DraftNumberInput
                          step="0.01"
                          min={-1}
                          max={1}
                          value={mix.throttle}
                          onCommit={(v) => handleMotorMixChange({ ...mix, throttle: v })}
                          className="w-full px-2 py-1 bg-surface-raised border border rounded text-content text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-content-secondary mb-1">{t('legacy_config.LegacyMixerTab.roll')}</label>
                        <DraftNumberInput
                          step="0.01"
                          min={-1}
                          max={1}
                          value={mix.roll}
                          onCommit={(v) => handleMotorMixChange({ ...mix, roll: v })}
                          className="w-full px-2 py-1 bg-surface-raised border border rounded text-content text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-content-secondary mb-1">{t('legacy_config.LegacyMixerTab.pitch')}</label>
                        <DraftNumberInput
                          step="0.01"
                          min={-1}
                          max={1}
                          value={mix.pitch}
                          onCommit={(v) => handleMotorMixChange({ ...mix, pitch: v })}
                          className="w-full px-2 py-1 bg-surface-raised border border rounded text-content text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-content-secondary mb-1">{t('legacy_config.LegacyMixerTab.yaw')}</label>
                        <DraftNumberInput
                          step="0.01"
                          min={-1}
                          max={1}
                          value={mix.yaw}
                          onCommit={(v) => handleMotorMixChange({ ...mix, yaw: v })}
                          className="w-full px-2 py-1 bg-surface-raised border border rounded text-content text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Servo Mixer */}
      {activeSection === 'servo' && (
        <div>
          {servoMixer.length === 0 ? (
            <div className="text-center py-12 text-content-secondary">
              <Cog className="w-10 h-10 text-content-secondary mb-3 mx-auto" />
              <p>{t('legacy_config.LegacyMixerTab.noServoMixerRulesFound')}</p>
              <p className="text-sm mt-1">{t('legacy_config.LegacyMixerTab.addRulesToControlServosFrom')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {servoMixer.map((mix) => {
                const source = SERVO_SOURCES[mix.inputSource] || { label: t('legacy_config.LegacyMixerTab.source', { inputSource: mix.inputSource }), color: '#6B7280' };

                return (
                  <div key={mix.index} className="bg-surface-input rounded-xl border border-subtle overflow-hidden">
                    {/* Header */}
                    <div className="px-5 py-3 border-b border-subtle flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-content-secondary font-mono text-sm">{t('legacy_config.LegacyMixerTab.rule')}{mix.index}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="px-3 py-1 rounded-full text-sm font-medium"
                            style={{ backgroundColor: `${source.color}20`, color: source.color }}
                          >
                            {source.label}
                          </div>
                          <span className="text-content-secondary">→</span>
                          <div className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium">
                            {t('legacy_config.LegacyMixerTab.servo')} {mix.targetChannel}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-content-secondary">{t('legacy_config.LegacyMixerTab.rate')}</span>
                          <span
                            className={`font-mono text-sm ${mix.rate < 0 ? 'text-orange-400' : 'text-green-400'}`}
                          >
                            {mix.rate > 0 ? '+' : ''}{mix.rate}%
                          </span>
                        </div>
                        <button
                          onClick={() => removeServoMix(mix.index)}
                          className="p-2 text-content-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title={t('legacy_config.LegacyMixerTab.removeServoMixerRule')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="p-5">
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div>
                          <label className="block text-xs text-content-secondary mb-1.5">{t('legacy_config.LegacyMixerTab.targetServo')}</label>
                          <select
                            value={mix.targetChannel}
                            onChange={(e) => handleServoMixChange({ ...mix, targetChannel: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 bg-surface-raised border border rounded-lg text-content text-sm focus:border-blue-500 focus:outline-none"
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7].map((servo) => (
                              <option key={servo} value={servo}>{t('legacy_config.LegacyMixerTab.servo')} {servo}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-content-secondary mb-1.5">{t('legacy_config.LegacyMixerTab.inputSource')}</label>
                          <select
                            value={mix.inputSource}
                            onChange={(e) => handleServoMixChange({ ...mix, inputSource: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 bg-surface-raised border border rounded-lg text-content text-sm focus:border-blue-500 focus:outline-none"
                          >
                            {Object.entries(SERVO_SOURCES).map(([id, src]) => (
                              <option key={id} value={id}>{src.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-content-secondary mb-1.5">{t('legacy_config.LegacyMixerTab.rate2')}</label>
                          <DraftNumberInput
                            min={-125}
                            max={125}
                            value={mix.rate}
                            integer
                            onCommit={(v) => handleServoMixChange({ ...mix, rate: v })}
                            className="w-full px-3 py-2 bg-surface-raised border border rounded-lg text-content text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-content-secondary mb-1.5">{t('legacy_config.LegacyMixerTab.speed')}</label>
                          <DraftNumberInput
                            min={0}
                            max={100}
                            value={mix.speed}
                            integer
                            onCommit={(v) => handleServoMixChange({ ...mix, speed: v })}
                            className="w-full px-3 py-2 bg-surface-raised border border rounded-lg text-content text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-content-secondary mb-1.5">{t('legacy_config.LegacyMixerTab.min')}</label>
                          <DraftNumberInput
                            min={-125}
                            max={125}
                            value={mix.min}
                            integer
                            onCommit={(v) => handleServoMixChange({ ...mix, min: v })}
                            className="w-full px-3 py-2 bg-surface-raised border border rounded-lg text-content text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-content-secondary mb-1.5">{t('legacy_config.LegacyMixerTab.max')}</label>
                          <DraftNumberInput
                            min={-125}
                            max={125}
                            value={mix.max}
                            integer
                            onCommit={(v) => handleServoMixChange({ ...mix, max: v })}
                            className="w-full px-3 py-2 bg-surface-raised border border rounded-lg text-content text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Rate visualization */}
                      <div className="mt-4 pt-4 border-t border-subtle">
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-content-secondary">{t('legacy_config.LegacyMixerTab.mixStrength')}</span>
                          <div className="flex-1 relative h-2 bg-surface-inset rounded-full overflow-hidden">
                            <div
                              className="absolute top-0 h-full rounded-full transition-all"
                              style={{
                                left: mix.rate >= 0 ? '50%' : `${50 + (mix.rate / 125) * 50}%`,
                                width: `${(Math.abs(mix.rate) / 125) * 50}%`,
                                backgroundColor: source.color,
                              }}
                            />
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-surface-raised" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
