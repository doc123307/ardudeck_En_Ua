/**
 * Rates Tab for MAVLink/ArduPilot
 *
 * Auto-detects rate parameter scheme:
 * - Modern ArduCopter 3.5+: ACRO_RP_RATE (deg/s) + ACRO_RP_EXPO
 * - Legacy ArduCopter <3.5: ACRO_RP_P (multiplier), no expo
 *
 * Features:
 * - Per-axis rate curve visualization
 * - Sliders for rate and expo
 * - Quick presets mapped to detected scheme
 * - Custom profile save/load
 */

import React, { useMemo, useCallback } from 'react';
import { MoveHorizontal, MoveVertical, RefreshCw, Link, Lightbulb, AlertTriangle, Info } from 'lucide-react';
import { useParameterStore } from '../../stores/parameter-store';
import { DraggableSlider } from '../ui/DraggableSlider';
import { RateResponsePlot } from './RateResponsePlot';
import { PresetSelector } from '../ui/PresetSelector';
import { ProfileManager } from '../ui/ProfileManager';
import { InfoCard } from '../ui/InfoCard';
import { RateCurve } from '../ui/RateCurve';
import { RATE_PRESETS } from './presets/mavlink-presets';
import { detectRateScheme, buildRatePresetParams, type RateScheme } from './mavlink-pid-schemes';
import { t } from '../../i18n';

// Storage key for custom profiles
const RATE_PROFILES_KEY = 'ardudeck_mavlink_rate_profiles';

const RatesTab: React.FC = () => {
  const { parameters, setParameter, fetchParameters, isLoading, downloadState } = useParameterStore();

  // A completed download, not just whatever parameters happen to be present:
  // connect-time batch reads leave a handful behind and the tab would render
  // its fields against those.
  const hasParameters = downloadState === 'complete' && parameters.size > 0;

  // Auto-detect rate scheme
  const scheme = useMemo((): RateScheme | null => {
    if (!hasParameters) return null;
    return detectRateScheme(parameters);
  }, [hasParameters, parameters]);

  const isUnknown = scheme?.id === 'unknown';

  // Get current rate values from parameters using detected scheme
  const rateValues = useMemo(() => {
    if (!scheme) return null;
    const get = (name: string, fallback: number) => parameters.get(name)?.value ?? fallback;
    return {
      rpRate: get(scheme.rollPitch.rate, scheme.defaults.rpRate),
      pitchRate: scheme.pitch ? get(scheme.pitch.rate, scheme.defaults.pitchRate ?? scheme.defaults.rpRate) : undefined,
      yawRate: get(scheme.yaw.rate, scheme.defaults.yawRate),
      rpExpo: scheme.rollPitch.expo ? get(scheme.rollPitch.expo, scheme.defaults.rpExpo) : 0,
      yawExpo: scheme.yaw.expo ? get(scheme.yaw.expo, scheme.defaults.yawExpo) : 0,
    };
  }, [scheme, parameters]);

  // Build profile data as flat Record
  const profileData = useMemo(() => {
    if (!scheme || !rateValues) return {};
    return buildRatePresetParams(scheme, rateValues);
  }, [scheme, rateValues]);

  // Apply a preset
  const applyPreset = useCallback(async (presetKey: string) => {
    if (!scheme) return;
    const preset = RATE_PRESETS[presetKey];
    if (preset) {
      const params = buildRatePresetParams(scheme, preset.values);
      for (const [param, value] of Object.entries(params)) {
        await setParameter(param, value);
      }
    }
  }, [scheme, setParameter]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    if (!scheme) return;
    const params = buildRatePresetParams(scheme, scheme.defaults);
    Object.entries(params).forEach(([param, value]) => {
      setParameter(param, value);
    });
  }, [scheme, setParameter]);

  // Load profile
  const loadProfile = useCallback((data: Record<string, number>) => {
    Object.entries(data).forEach(([param, value]) => {
      setParameter(param, value);
    });
  }, [setParameter]);

  return (
    <div className="p-6 space-y-6">
      {/* Parameters not loaded warning */}
      {!hasParameters && (
        <div className="bg-amber-500/10 rounded-xl border border-amber-500/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-amber-300 font-medium">{t('mavlink_config.RatesTab.parametersNotLoaded')}</p>
              <p className="text-xs text-content-secondary">{t('mavlink_config.RatesTab.fetchParametersFromTheFcTo')}</p>
            </div>
          </div>
          <button
            onClick={() => fetchParameters({ force: true })}
            disabled={isLoading}
            className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? t('mavlink_config.RatesTab.loading') : t('mavlink_config.RatesTab.fetchParameters')}
          </button>
        </div>
      )}

      {/* Warning: No recognized rate scheme (suppress while still loading) */}
      {hasParameters && !isLoading && isUnknown && (
        <div className="bg-red-500/10 rounded-xl border-red-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-red-300 font-medium">{t('mavlink_config.RatesTab.unrecognizedRateParameters')}</p>
              <p className="text-sm text-content-secondary mt-1">
                {t('mavlink_config.RatesTab.couldNotDetect')} <span className="font-mono text-content">ACRO_RP_RATE</span> {t('mavlink_config.RatesTab.or')}
                <span className="font-mono text-content"> ACRO_RP_P</span> {t('mavlink_config.RatesTab.parametersOnThisBoard')}
              </p>
              <p className="text-sm text-content-secondary mt-1">
                {t('mavlink_config.RatesTab.useThe')} <span className="font-medium text-content">{t('mavlink_config.RatesTab.allParameters')}</span> {t('mavlink_config.RatesTab.tabToFindAndEditRate')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detected scheme badge */}
      {hasParameters && scheme && !isUnknown && (
        <div className="bg-blue-500/10 rounded-xl border-blue-500/20 p-3 flex items-center gap-3">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <p className="text-sm text-blue-300">
            {t('mavlink_config.RatesTab.detected')} <span className="font-medium">{scheme.label}</span> {t('mavlink_config.RatesTab.rateParameters')}{scheme.rateUnit})
            {!scheme.hasExpo && <span className="text-blue-400/60"> {t('mavlink_config.RatesTab.noExpoOnThisFirmware')}</span>}
          </p>
        </div>
      )}

      {/* Info card */}
      <InfoCard title={t('mavlink_config.RatesTab.whatAreRates')} variant="info">
        {t('mavlink_config.RatesTab.ratesControlHowFastYourAircraft')}{scheme?.hasExpo ? t('mavlink_config.RatesTab.expoAddsACurveSoSmall') : ''}
      </InfoCard>

      {/* Controls disabled when scheme unknown */}
      <div className={isUnknown || !scheme ? 'opacity-40 pointer-events-none' : ''}>
      <div className="space-y-6">
      <PresetSelector
        presets={RATE_PRESETS}
        onApply={applyPreset}
        label={t('mavlink_config.RatesTab.quickPresets')}
        hint={t('mavlink_config.RatesTab.clickToApplyARateStyle')}
      />

      <ProfileManager<Record<string, number>>
        storageKey={RATE_PROFILES_KEY}
        currentData={profileData}
        onLoad={loadProfile}
        onReset={resetToDefaults}
        label={t('mavlink_config.RatesTab.myProfiles')}
      />

      {/* The two numbers as one picture, before the sliders that set them. */}
      {scheme && rateValues && scheme.hasExpo && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs text-content-secondary">{t('mavlink_config.RatesTab.rollAndPitch')}</div>
            <RateResponsePlot
              maxRate={rateValues.rpRate}
              expo={rateValues.rpExpo}
              unit={scheme.rateUnit}
              axis="roll"
              accent="#3B82F6"
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs text-content-secondary">{t('mavlink_config.RatesTab.yaw')}</div>
            <RateResponsePlot
              maxRate={rateValues.yawRate}
              expo={rateValues.yawExpo}
              unit={scheme.rateUnit}
              axis="yaw"
              accent="#F97316"
            />
          </div>
        </div>
      )}

      {/* Rate controls - 3 column layout */}
      {scheme && rateValues && (
      <div className="grid grid-cols-3 gap-5">
        {/* Roll */}
        <div className="bg-surface rounded-xl border border-subtle p-5">
          <h3 className="text-lg font-medium text-content mb-4 flex items-center gap-2">
            <MoveHorizontal className="w-5 h-5 text-blue-400" /> {t('mavlink_config.RatesTab.roll')}
          </h3>
          <div className="space-y-4">
            <DraggableSlider
              label={t('mavlink_config.RatesTab.maxRate', { rateUnit: scheme.rateUnit })}
              value={rateValues.rpRate}
              onChange={(v) => setParameter(scheme.rollPitch.rate, v)}
              min={scheme.rpRateMin}
              max={scheme.rpRateMax}
              step={scheme.rpRateStep}
              color="#3B82F6"
              hint={scheme.hasExpo ? t('mavlink_config.RatesTab.atFullStickDeflection') : t('mavlink_config.RatesTab.rateMultiplier')}
            />
            {scheme.hasExpo && scheme.rollPitch.expo && (
              <DraggableSlider
                label={t('mavlink_config.RatesTab.expo')}
                value={Math.round(rateValues.rpExpo * scheme.expoScale)}
                onChange={(v) => setParameter(scheme.rollPitch.expo!, v / scheme.expoScale)}
                min={0}
                max={100}
                step={5}
                color="#3B82F6"
                hint={t('mavlink_config.RatesTab.curveSoftnessNearCenter')}
              />
            )}
          </div>
          {scheme.hasExpo && (
            <div className="mt-4">
              <RateCurve
                rcRate={rateValues.rpRate}
                superRate={0}
                expo={rateValues.rpExpo * scheme.expoScale}
                color="#3B82F6"
                ratesType="ardupilot"
              />
            </div>
          )}
        </div>

        {/* Pitch */}
        <div className="bg-surface rounded-xl border border-subtle p-5">
          <h3 className="text-lg font-medium text-content mb-4 flex items-center gap-2">
            <MoveVertical className="w-5 h-5 text-emerald-400" /> {t('mavlink_config.RatesTab.pitch')}
            {scheme.rpLinked && (
              <span className="ml-auto flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">
                <Link className="w-3 h-3" /> {t('mavlink_config.RatesTab.linkedToRoll')}
              </span>
            )}
          </h3>
          <div className="space-y-4">
            <DraggableSlider
              label={t('mavlink_config.RatesTab.maxRate', { rateUnit: scheme.rateUnit })}
              value={!scheme.rpLinked && rateValues.pitchRate !== undefined ? rateValues.pitchRate : rateValues.rpRate}
              onChange={!scheme.rpLinked && scheme.pitch ? (v) => setParameter(scheme.pitch!.rate, v) : () => {}}
              min={scheme.rpRateMin}
              max={scheme.rpRateMax}
              step={scheme.rpRateStep}
              color="#10B981"
              hint={scheme.rpLinked ? t('mavlink_config.RatesTab.controlledByRollSettings') : t('mavlink_config.RatesTab.atFullStickDeflection')}
              disabled={scheme.rpLinked}
            />
            {scheme.hasExpo && scheme.rollPitch.expo && (
              <DraggableSlider
                label={t('mavlink_config.RatesTab.expo')}
                value={Math.round(rateValues.rpExpo * scheme.expoScale)}
                onChange={() => {}}
                min={0}
                max={100}
                step={5}
                color="#10B981"
                hint={scheme.rpLinked ? t('mavlink_config.RatesTab.controlledByRollSettings') : ''}
                disabled={scheme.rpLinked}
              />
            )}
          </div>
          {scheme.hasExpo && (
            <div className="mt-4">
              <RateCurve
                rcRate={!scheme.rpLinked && rateValues.pitchRate !== undefined ? rateValues.pitchRate : rateValues.rpRate}
                superRate={0}
                expo={rateValues.rpExpo * scheme.expoScale}
                color="#10B981"
                ratesType="ardupilot"
              />
            </div>
          )}
        </div>

        {/* Yaw */}
        <div className="bg-surface rounded-xl border border-subtle p-5">
          <h3 className="text-lg font-medium text-content mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-orange-400" /> {t('mavlink_config.RatesTab.yaw')}
          </h3>
          <div className="space-y-4">
            <DraggableSlider
              label={t('mavlink_config.RatesTab.maxRate', { rateUnit: scheme.rateUnit })}
              value={rateValues.yawRate}
              onChange={(v) => setParameter(scheme.yaw.rate, v)}
              min={scheme.yawRateMin}
              max={scheme.yawRateMax}
              step={scheme.yawRateStep}
              color="#F97316"
              hint={scheme.hasExpo ? t('mavlink_config.RatesTab.atFullStickDeflection') : t('mavlink_config.RatesTab.rateMultiplier')}
            />
            {scheme.hasExpo && scheme.yaw.expo && (
              <DraggableSlider
                label={t('mavlink_config.RatesTab.expo')}
                value={Math.round(rateValues.yawExpo * scheme.expoScale)}
                onChange={(v) => setParameter(scheme.yaw.expo!, v / scheme.expoScale)}
                min={0}
                max={100}
                step={5}
                color="#F97316"
                hint={t('mavlink_config.RatesTab.curveSoftnessNearCenter')}
              />
            )}
          </div>
          {scheme.hasExpo && (
            <div className="mt-4">
              <RateCurve
                rcRate={rateValues.yawRate}
                superRate={0}
                expo={rateValues.yawExpo * scheme.expoScale}
                color="#F97316"
                ratesType="ardupilot"
              />
            </div>
          )}
        </div>
      </div>
      )}

      {/* Current settings summary */}
      {scheme && rateValues && (
      <div className="bg-surface rounded-xl border border-subtle p-4">
        <h3 className="text-sm font-medium text-content mb-3">{t('mavlink_config.RatesTab.currentSettingsSummary')}</h3>
        <div className={`grid ${scheme.hasExpo ? 'grid-cols-4' : scheme.rpLinked ? 'grid-cols-2' : 'grid-cols-3'} gap-4 text-center`}>
          <div>
            <div className="text-2xl font-mono text-blue-400">{rateValues.rpRate}</div>
            <div className="text-xs text-content-secondary">{scheme.rpLinked ? t('mavlink_config.RatesTab.rollPitch') : t('mavlink_config.RatesTab.roll')} {t('mavlink_config.RatesTab.rate')}{scheme.rateUnit})</div>
          </div>
          {!scheme.rpLinked && rateValues.pitchRate !== undefined && (
            <div>
              <div className="text-2xl font-mono text-emerald-400">{rateValues.pitchRate}</div>
              <div className="text-xs text-content-secondary">{t('mavlink_config.RatesTab.pitchRate')}{scheme.rateUnit})</div>
            </div>
          )}
          <div>
            <div className="text-2xl font-mono text-orange-400">{rateValues.yawRate}</div>
            <div className="text-xs text-content-secondary">{t('mavlink_config.RatesTab.yawRate')}{scheme.rateUnit})</div>
          </div>
          {scheme.hasExpo && (
            <>
              <div>
                <div className="text-2xl font-mono text-emerald-400">
                  {Math.round(rateValues.rpExpo * scheme.expoScale)}%
                </div>
                <div className="text-xs text-content-secondary">{t('mavlink_config.RatesTab.rollPitchExpo')}</div>
              </div>
              <div>
                <div className="text-2xl font-mono text-amber-400">
                  {Math.round(rateValues.yawExpo * scheme.expoScale)}%
                </div>
                <div className="text-xs text-content-secondary">{t('mavlink_config.RatesTab.yawExpo')}</div>
              </div>
            </>
          )}
        </div>
      </div>
      )}
      </div>
      </div>

      {/* Tip */}
      <InfoCard title={t('mavlink_config.RatesTab.findingTheRightRates')} variant="tip">
        {t('mavlink_config.RatesTab.startWithABeginnerPresetAnd')}
        {scheme?.hasExpo
          ? t('mavlink_config.RatesTab.mostPilotsUse180360Deg')
          : t('mavlink_config.RatesTab.adjustTheMultiplierToControlHow')
        }
      </InfoCard>
    </div>
  );
};

export default RatesTab;
