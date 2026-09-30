/**
 * PID Tuning Tab for MAVLink/ArduPilot
 *
 * Auto-detects the board's PID parameter scheme:
 * - Modern ArduCopter 3.5+: ATC_RAT_RLL_P etc. (with FF)
 * - Legacy ArduCopter <3.5: RATE_RLL_P etc. (no FF)
 * - ArduPlane: RLL2SRV_P etc.
 * - QuadPlane VTOL: Q_A_RAT_RLL_P etc. (with FF)
 *
 * Features:
 * - 3-column color-coded layout (Roll/Pitch/Yaw)
 * - DraggableSlider for all values
 * - Quick presets mapped to detected scheme
 * - Custom profile save/load
 */

import React, { useMemo, useCallback, useState } from 'react';
import { MoveHorizontal, MoveVertical, RefreshCw, Lightbulb, AlertTriangle, Gauge, Plane, RotateCw } from 'lucide-react';
import { useParameterStore } from '../../stores/parameter-store';
import { useSettingsStore } from '../../stores/settings-store';
import { DraggableSlider } from '../ui/DraggableSlider';
import { PresetSelector } from '../ui/PresetSelector';
import { ProfileManager } from '../ui/ProfileManager';
import { InfoCard } from '../ui/InfoCard';
import { PID_PRESETS } from './presets/mavlink-presets';
import { detectPidScheme, buildPresetParams, buildAccelParams, buildPlaneScheme, QUADPLANE_SCHEME, hasDualVtolControllers, hasDualPx4Controllers, PX4_MULTICOPTER_SCHEME, PX4_FIXEDWING_SCHEME, type PidScheme, type AxisParams } from './mavlink-pid-schemes';
import { t } from '../../i18n';

/** Which control-law set a QuadPlane pilot is editing. */
type ControllerSet = 'vtol' | 'fixedwing';

// Storage key for custom profiles
const PID_PROFILES_KEY = 'ardudeck_mavlink_pid_profiles';

const PidTuningTab: React.FC = () => {
  const { parameters, setParameter, fetchParameters, isLoading, downloadState } = useParameterStore();
  const showExplanationCards = useSettingsStore((s) => s.uiVisibility.showExplanationCards);

  // Check if parameters are loaded
  // A full download, not just whatever connect-time batch reads happened to
  // land. Six stray parameters are not a board with an unrecognised PID scheme.
  const hasParameters = downloadState === 'complete' && parameters.size > 0;

  // QuadPlanes run two control-law sets on one autopilot: the VTOL multicopter
  // rate controller (Q_A_RAT_*) and the fixed-wing controller (RLL_RATE_* /
  // RLL2SRV_*). When both are present, let the pilot pick which set to tune.
  const dualController = useMemo(
    () => hasParameters && hasDualVtolControllers(parameters),
    [hasParameters, parameters],
  );
  // PX4 VTOL carries both a multicopter (MC_*) and a fixed-wing (FW_*) rate
  // controller. As with ArduPilot QuadPlanes, expose a toggle so each set is
  // reachable (detectPidScheme always resolves a PX4 VTOL to its MC set).
  const dualPx4Controller = useMemo(
    () => hasParameters && hasDualPx4Controllers(parameters),
    [hasParameters, parameters],
  );
  const [controllerSet, setControllerSet] = useState<ControllerSet>('vtol');

  // Auto-detect PID scheme from loaded parameters. On a dual-controller
  // QuadPlane the toggle overrides detection so the fixed-wing set is reachable
  // (detectPidScheme always resolves a QuadPlane to its VTOL set).
  const scheme = useMemo(() => {
    if (!hasParameters) return null;
    if (dualController) {
      return controllerSet === 'fixedwing'
        ? buildPlaneScheme(parameters)
        : QUADPLANE_SCHEME;
    }
    if (dualPx4Controller) {
      return controllerSet === 'fixedwing'
        ? PX4_FIXEDWING_SCHEME
        : PX4_MULTICOPTER_SCHEME;
    }
    return detectPidScheme(parameters);
  }, [hasParameters, parameters, dualController, dualPx4Controller, controllerSet]);

  const isUnknown = scheme?.id === 'unknown';

  // Aircraft wording unless the scheme names its own controllers, and no third
  // card for a vehicle that has only two.
  const axisInfo = scheme?.axisInfo ?? {
    roll: { title: t('mavlink_config.PidTuningTab.roll'), sub: 'Left/right tilt' },
    pitch: { title: t('mavlink_config.PidTuningTab.pitch'), sub: 'Forward/back tilt' },
    yaw: { title: t('mavlink_config.PidTuningTab.yaw'), sub: 'Rotation' },
  };
  const showYawAxis = scheme ? (!scheme.axisInfo || !!scheme.axisInfo.yaw) : true;

  // Get current PID values from parameters using the detected scheme
  const pidValues = useMemo(() => {
    if (!scheme) return null;
    const get = (name: string, fallback: number) => parameters.get(name)?.value ?? fallback;
    return {
      roll: {
        p: get(scheme.roll.p, scheme.defaults.roll.p),
        i: get(scheme.roll.i, scheme.defaults.roll.i),
        d: get(scheme.roll.d, scheme.defaults.roll.d),
        ff: scheme.roll.ff ? get(scheme.roll.ff, scheme.defaults.roll.ff ?? 0) : 0,
      },
      pitch: {
        p: get(scheme.pitch.p, scheme.defaults.pitch.p),
        i: get(scheme.pitch.i, scheme.defaults.pitch.i),
        d: get(scheme.pitch.d, scheme.defaults.pitch.d),
        ff: scheme.pitch.ff ? get(scheme.pitch.ff, scheme.defaults.pitch.ff ?? 0) : 0,
      },
      yaw: {
        p: get(scheme.yaw.p, scheme.defaults.yaw.p),
        i: get(scheme.yaw.i, scheme.defaults.yaw.i),
        d: get(scheme.yaw.d, scheme.defaults.yaw.d),
        ff: scheme.yaw.ff ? get(scheme.yaw.ff, scheme.defaults.yaw.ff ?? 0) : 0,
      },
    };
  }, [scheme, parameters]);

  // Get current acceleration limit values from parameters
  const accelValues = useMemo(() => {
    if (!scheme?.accel) return null;
    const get = (name: string, fallback: number) => parameters.get(name)?.value ?? fallback;
    const defaults = scheme.accelDefaults ?? { roll: 110000, pitch: 110000, yaw: 27000 };
    return {
      roll: get(scheme.accel.roll, defaults.roll),
      pitch: get(scheme.accel.pitch, defaults.pitch),
      yaw: get(scheme.accel.yaw, defaults.yaw),
    };
  }, [scheme, parameters]);

  // Build profile data as a flat Record for save/load
  const profileData = useMemo(() => {
    if (!scheme || !pidValues) return {};
    const pidParams = buildPresetParams(scheme, pidValues);
    if (accelValues) {
      const accelParams = buildAccelParams(scheme, accelValues);
      return { ...pidParams, ...accelParams };
    }
    return pidParams;
  }, [scheme, pidValues, accelValues]);

  // Apply a preset
  const applyPreset = useCallback(async (presetKey: string) => {
    if (!scheme) return;
    const preset = PID_PRESETS[presetKey];
    if (preset) {
      const params = buildPresetParams(scheme, preset.values);
      for (const [param, value] of Object.entries(params)) {
        await setParameter(param, value);
      }
      // Apply acceleration limits if preset defines them and scheme supports them
      if (preset.accel && scheme.accel) {
        const accelParams = buildAccelParams(scheme, preset.accel);
        for (const [param, value] of Object.entries(accelParams)) {
          await setParameter(param, value);
        }
      }
    }
  }, [scheme, setParameter]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    if (!scheme) return;
    const params = buildPresetParams(scheme, scheme.defaults);
    Object.entries(params).forEach(([param, value]) => {
      setParameter(param, value);
    });
    // Reset acceleration limits if scheme supports them
    if (scheme.accel && scheme.accelDefaults) {
      const accelParams = buildAccelParams(scheme, scheme.accelDefaults);
      Object.entries(accelParams).forEach(([param, value]) => {
        setParameter(param, value);
      });
    }
  }, [scheme, setParameter]);

  // Load profile
  const loadProfile = useCallback((data: Record<string, number>) => {
    Object.entries(data).forEach(([param, value]) => {
      setParameter(param, value);
    });
  }, [setParameter]);

  // Handle individual PID change
  const handlePidChange = useCallback((param: string, value: number) => {
    setParameter(param, value);
  }, [setParameter]);

  // Render PID sliders for one axis
  const renderAxisSliders = (axis: AxisParams, axisScheme: PidScheme, values: { p: number; i: number; d: number; ff: number }) => (
    <div className="space-y-5">
      <DraggableSlider
        label={t('mavlink_config.PidTuningTab.pResponse')}
        value={Math.round(values.p * axisScheme.pScale)}
        onChange={(v) => handlePidChange(axis.p, v / axisScheme.pScale)}
        min={0}
        max={axisScheme.pMax}
        step={1}
        color="#3B82F6"
        hint={t('mavlink_config.PidTuningTab.higherSnappier')}
      />
      <DraggableSlider
        label={t('mavlink_config.PidTuningTab.iStability')}
        value={Math.round(values.i * axisScheme.iScale)}
        onChange={(v) => handlePidChange(axis.i, v / axisScheme.iScale)}
        min={0}
        max={axisScheme.iMax}
        step={1}
        color="#10B981"
        hint={t('mavlink_config.PidTuningTab.higherMoreStable')}
      />
      <DraggableSlider
        label={t('mavlink_config.PidTuningTab.dSmoothness')}
        value={Math.round(values.d * axisScheme.dScale)}
        onChange={(v) => handlePidChange(axis.d, v / axisScheme.dScale)}
        min={0}
        max={axisScheme.dMax}
        step={1}
        color="#8B5CF6"
        hint={t('mavlink_config.PidTuningTab.higherSmoother')}
      />
      {axisScheme.hasFF && axis.ff && (
        <DraggableSlider
          label={t('mavlink_config.PidTuningTab.ffFeedforward')}
          value={Math.round(values.ff * axisScheme.ffScale)}
          onChange={(v) => handlePidChange(axis.ff!, v / axisScheme.ffScale)}
          min={0}
          max={axisScheme.ffMax}
          step={1}
          color="#F59E0B"
          hint={t('mavlink_config.PidTuningTab.anticipatesCommands')}
        />
      )}
    </div>
  );

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
              <p className="text-amber-300 font-medium">
                {downloadState === 'failed' ? t('mavlink_config.PidTuningTab.parameterDownloadFailed') : t('mavlink_config.PidTuningTab.parametersNotLoaded')}
              </p>
              <p className="text-xs text-content-secondary">
                {downloadState === 'failed'
                  ? t('mavlink_config.PidTuningTab.theVehicleDidNotSendA')
                  : t('mavlink_config.PidTuningTab.fetchParametersFromTheFcTo')}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchParameters({ force: true })}
            disabled={isLoading}
            className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? t('mavlink_config.PidTuningTab.loading') : downloadState === 'failed' ? t('mavlink_config.PidTuningTab.retry') : t('mavlink_config.PidTuningTab.fetchParameters')}
          </button>
        </div>
      )}

      {/* Warning: No recognized PID scheme found (suppress while still loading) */}
      {hasParameters && !isLoading && isUnknown && (
        <div className="bg-red-500/10 rounded-xl border-red-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-red-300 font-medium">{t('mavlink_config.PidTuningTab.unrecognizedPidParameters')}</p>
              <p className="text-sm text-content-secondary mt-1">
                {t('mavlink_config.PidTuningTab.couldNotDetectAKnownPid')} <span className="font-mono text-content">{t('mavlink_config.PidTuningTab.atcRat')}</span>,
                <span className="font-mono text-content"> {t('mavlink_config.PidTuningTab.rateRll')}</span>,
                <span className="font-mono text-content"> {t('mavlink_config.PidTuningTab.rllRate')}</span>,
                <span className="font-mono text-content"> {t('mavlink_config.PidTuningTab.rll2srv')}</span>,
                <span className="font-mono text-content"> {t('mavlink_config.PidTuningTab.qARat')}</span>,
                <span className="font-mono text-content"> {t('mavlink_config.PidTuningTab.mcRate')}</span>{t('mavlink_config.PidTuningTab.or')}
                <span className="font-mono text-content"> {t('mavlink_config.PidTuningTab.fwR')}</span> {t('mavlink_config.PidTuningTab.parameters')}
              </p>
              <p className="text-sm text-content-secondary mt-1">
                {t('mavlink_config.PidTuningTab.useThe')} <span className="font-medium text-content">{t('mavlink_config.PidTuningTab.allParameters')}</span> {t('mavlink_config.PidTuningTab.tabToFindAndEditYour')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info card */}
      <InfoCard title={t('mavlink_config.PidTuningTab.whatArePids')} variant="info">
        {t('mavlink_config.PidTuningTab.pidsControlHowYourAircraftResponds')}
      </InfoCard>

      {/* VTOL / Fixed-wing controller switch — only on QuadPlanes that carry
          both control-law sets. Lets VTOL pilots tune each separately. */}
      {(dualController || dualPx4Controller) && (
        <div data-tour="tuning-vtol-toggle" className="bg-surface-raised/40 rounded-xl border border-subtle p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-content">{t('mavlink_config.PidTuningTab.controllerSet')}</p>
            <p className="text-xs text-content-secondary mt-0.5">
              {dualPx4Controller
                ? t('mavlink_config.PidTuningTab.thisVtolRunsSeparateMulticopterAnd')
                : t('mavlink_config.PidTuningTab.thisQuadplaneRunsSeparateVtolAnd')}
              {t('mavlink_config.PidTuningTab.chooseWhichOneToTune')}
              {scheme ? <>{t('mavlink_config.PidTuningTab.editing')} <span className="font-mono text-content">{
                dualPx4Controller
                  ? (controllerSet === 'vtol' ? t('mavlink_config.PidTuningTab.mcRate') : t('mavlink_config.PidTuningTab.fwR'))
                  : (controllerSet === 'vtol' ? t('mavlink_config.PidTuningTab.qARat') : (parameters.has('RLL_RATE_P') ? t('mavlink_config.PidTuningTab.rllRate') : t('mavlink_config.PidTuningTab.rll2srv')))
              }</span></> : null}.
            </p>
          </div>
          <div className="flex items-center rounded-lg overflow-hidden border border-subtle shrink-0">
            <button
              onClick={() => setControllerSet('vtol')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                controllerSet === 'vtol' ? 'bg-indigo-600 text-white' : 'text-content-secondary hover:bg-surface-raised'
              }`}
              data-tip={dualPx4Controller ? t('mavlink_config.PidTuningTab.multicopterRateControllerUsedInVtol') : t('mavlink_config.PidTuningTab.multicopterRateControllerUsedInVtol2')}
            >
              <RotateCw className="w-3.5 h-3.5" /> VTOL
            </button>
            <div className="w-px h-5 bg-subtle" />
            <button
              onClick={() => setControllerSet('fixedwing')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                controllerSet === 'fixedwing' ? 'bg-indigo-600 text-white' : 'text-content-secondary hover:bg-surface-raised'
              }`}
              data-tip={dualPx4Controller ? t('mavlink_config.PidTuningTab.fixedWingControllerUsedInForward') : t('mavlink_config.PidTuningTab.fixedWingControllerUsedInForward2')}
            >
              <Plane className="w-3.5 h-3.5" /> {t('mavlink_config.PidTuningTab.fixedWing')}
            </button>
          </div>
        </div>
      )}

      {/* Quick Presets, Custom Profiles, and PID Sliders - disabled when scheme unknown */}
      <div className={isUnknown || !scheme ? 'opacity-40 pointer-events-none' : ''}>
      <div className="space-y-6">
      <PresetSelector
        presets={PID_PRESETS}
        onApply={applyPreset}
        label={t('mavlink_config.PidTuningTab.quickPresets')}
        hint={t('mavlink_config.PidTuningTab.clickToApplyATuningStyle')}
      />

      <ProfileManager<Record<string, number>>
        storageKey={PID_PROFILES_KEY}
        currentData={profileData}
        onLoad={loadProfile}
        onReset={resetToDefaults}
        label={t('mavlink_config.PidTuningTab.myProfiles')}
      />

      {/* PID sliders: one card per controller this vehicle actually has */}
      {scheme && pidValues && (
      <div className={`grid gap-5 ${showYawAxis ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl border-blue-500/20 p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <MoveHorizontal className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-content">{axisInfo.roll.title}</h3>
              <p className="text-xs text-content-secondary">{axisInfo.roll.sub}</p>
            </div>
          </div>
          {renderAxisSliders(scheme.roll, scheme, pidValues.roll)}
        </div>

        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl border-emerald-500/20 p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <MoveVertical className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-content">{axisInfo.pitch.title}</h3>
              <p className="text-xs text-content-secondary">{axisInfo.pitch.sub}</p>
            </div>
          </div>
          {renderAxisSliders(scheme.pitch, scheme, pidValues.pitch)}
        </div>

        {showYawAxis && (
        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-xl border-orange-500/20 p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-content">{axisInfo.yaw?.title ?? t('mavlink_config.PidTuningTab.yaw')}</h3>
              <p className="text-xs text-content-secondary">{axisInfo.yaw?.sub ?? t('mavlink_config.PidTuningTab.rotation')}</p>
            </div>
          </div>
          {renderAxisSliders(scheme.yaw, scheme, pidValues.yaw)}
        </div>
        )}
      </div>
      )}

      {/* Acceleration Limits - only for copter-type schemes */}
      {scheme?.accel && accelValues && (
      <div className="bg-surface rounded-xl border border-subtle p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
            <Gauge className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-content">{t('mavlink_config.PidTuningTab.accelerationLimits')}</h3>
            <p className="text-xs text-content-secondary">{t('mavlink_config.PidTuningTab.maxRotationalAccelerationPerAxisDeg')}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-5">
          <DraggableSlider
            label={t('mavlink_config.PidTuningTab.roll')}
            value={Math.round(accelValues.roll / 100)}
            onChange={(v) => handlePidChange(scheme.accel!.roll, v * 100)}
            min={0}
            max={1800}
            step={10}
            color="#F43F5E"
            hint="deg/s²"
          />
          <DraggableSlider
            label={t('mavlink_config.PidTuningTab.pitch')}
            value={Math.round(accelValues.pitch / 100)}
            onChange={(v) => handlePidChange(scheme.accel!.pitch, v * 100)}
            min={0}
            max={1800}
            step={10}
            color="#10B981"
            hint="deg/s²"
          />
          <DraggableSlider
            label={t('mavlink_config.PidTuningTab.yaw')}
            value={Math.round(accelValues.yaw / 100)}
            onChange={(v) => handlePidChange(scheme.accel!.yaw, v * 100)}
            min={0}
            max={720}
            step={5}
            color="#F59E0B"
            hint="deg/s²"
          />
        </div>
      </div>
      )}
      </div>
      </div>

      {/* Explanation card */}
      {showExplanationCards && (
        <div className="bg-surface rounded-xl border border-subtle p-5">
          <h4 className="font-medium text-content mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-400" /> {t('mavlink_config.PidTuningTab.whatDoTheseNumbersMean')}
          </h4>
          <div className={`grid ${scheme?.hasFF !== false ? 'grid-cols-4' : 'grid-cols-3'} gap-6 text-sm`}>
            <div>
              <span className="text-blue-400 font-medium">{t('mavlink_config.PidTuningTab.pProportional')}</span>
              <p className="text-content-secondary mt-1">
                {t('mavlink_config.PidTuningTab.howQuicklyYourAircraftReactsTo')}
              </p>
            </div>
            <div>
              <span className="text-emerald-400 font-medium">{t('mavlink_config.PidTuningTab.iIntegral')}</span>
              <p className="text-content-secondary mt-1">
                {t('mavlink_config.PidTuningTab.keepsYourAircraftOnTargetOver')}
              </p>
            </div>
            <div>
              <span className="text-purple-400 font-medium">{t('mavlink_config.PidTuningTab.dDerivative')}</span>
              <p className="text-content-secondary mt-1">
                {t('mavlink_config.PidTuningTab.dampensOvershootingAndOscillationTooHigh')}
              </p>
            </div>
            {scheme?.hasFF !== false && (
            <div>
              <span className="text-amber-400 font-medium">{t('mavlink_config.PidTuningTab.ffFeedforward2')}</span>
              <p className="text-content-secondary mt-1">
                {t('mavlink_config.PidTuningTab.anticipatesStickMovementsForFasterResponse')}
              </p>
            </div>
            )}
          </div>
        </div>
      )}

      {/* AutoTune tip */}
      <InfoCard title={t('mavlink_config.PidTuningTab.useAutotuneForBestResults')} variant="tip">
        {t('mavlink_config.PidTuningTab.forOptimalPerformanceUseArdupilotS')}
      </InfoCard>
    </div>
  );
};

export default PidTuningTab;
