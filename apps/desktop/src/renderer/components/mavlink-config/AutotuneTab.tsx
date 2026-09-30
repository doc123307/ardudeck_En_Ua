// Refuses edits while armed: AUTOTUNE_AXES is read at mode engage, so a mid-air edit tunes the wrong thing.
import React, { useState } from 'react';
import { Wrench, Zap, Lock, CheckCircle2, Circle, Lightbulb, AlertTriangle } from 'lucide-react';
import { useParameterStore } from '../../stores/parameter-store';
import { useTelemetryStore } from '../../stores/telemetry-store';
import {
  AGGR_CHOICES,
  AXES,
  AXIS_ALL,
  aggrMatches,
  autotuneModeNumber,
  axisNames,
  normalizeAxes,
  toggleAxis,
} from './autotune';
import { t } from '../../i18n';

const AXIS_CHIP: Record<string, { on: string; off: string }> = {
  Roll: {
    on: 'bg-sky-500/15 text-sky-400 border-sky-500/50',
    off: 'bg-surface-raised text-content-secondary border-subtle hover:text-content',
  },
  Pitch: {
    on: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/50',
    off: 'bg-surface-raised text-content-secondary border-subtle hover:text-content',
  },
  Yaw: {
    on: 'bg-violet-500/15 text-violet-400 border-violet-500/50',
    off: 'bg-surface-raised text-content-secondary border-subtle hover:text-content',
  },
};

interface Props {
  vehicleCategory: 'copter' | 'plane' | 'rover';
}

export const AutotuneTab: React.FC<Props> = ({ vehicleCategory }) => {
  const parameters = useParameterStore((s) => s.parameters);
  const downloadState = useParameterStore((s) => s.downloadState);
  const isLoading = useParameterStore((s) => s.isLoading);
  const fetchParameters = useParameterStore((s) => s.fetchParameters);
  const setParameter = useParameterStore((s) => s.setParameter);
  const armed = useTelemetryStore((s) => s.flight.armed);

  const [pending, setPending] = useState<Map<string, number>>(new Map());
  const [applying, setApplying] = useState(false);

  const hasParameters = downloadState === 'complete' && parameters.size > 0;
  const hasAutotune = parameters.has('AUTOTUNE_AXES');
  const hasAggr = parameters.has('AUTOTUNE_AGGR');

  const value = (id: string): number | undefined => pending.get(id) ?? parameters.get(id)?.value;

  const stage = (id: string, to: number) => {
    const current = parameters.get(id)?.value;
    if (current === undefined) return;
    setPending((prev) => {
      const next = new Map(prev);
      const same = id === 'AUTOTUNE_AGGR' ? aggrMatches(current, to) : Math.round(current) === Math.round(to);
      if (same) next.delete(id);
      else next.set(id, to);
      return next;
    });
  };

  const apply = async () => {
    setApplying(true);
    try {
      for (const [id, v] of pending) await setParameter(id, v);
      setPending(new Map());
    } finally {
      setApplying(false);
    }
  };

  const axes = normalizeAxes(value('AUTOTUNE_AXES'));
  const aggr = value('AUTOTUNE_AGGR');
  const axesStaged = pending.has('AUTOTUNE_AXES');
  const aggrStaged = pending.has('AUTOTUNE_AGGR');
  const modeNum = autotuneModeNumber(vehicleCategory);

  if (hasParameters && !hasAutotune) {
    return (
      <div className="p-6">
        <div className="bg-surface rounded-xl border border-subtle p-8 text-center">
          <Wrench className="w-8 h-8 mx-auto mb-3 text-content-secondary" />
          <p className="text-content font-medium">{t('mavlink_config.AutotuneTab.thisVehicleHasNoAutotune')}</p>
          <p className="text-sm text-content-secondary mt-1">
            {t('mavlink_config.AutotuneTab.autotuneAxesIsNotInIts')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {!hasParameters && (
        <div className="bg-amber-500/10 rounded-xl border border-amber-500/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-amber-300 font-medium">
                {downloadState === 'failed' ? t('mavlink_config.AutotuneTab.parameterDownloadFailed') : t('mavlink_config.AutotuneTab.parametersNotLoaded')}
              </p>
              <p className="text-xs text-content-secondary">
                {downloadState === 'failed'
                  ? t('mavlink_config.AutotuneTab.theVehicleDidNotSendA')
                  : t('mavlink_config.AutotuneTab.autotuneSettingsAreReadFromThe')}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchParameters({ force: true })}
            disabled={isLoading}
            className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? t('mavlink_config.AutotuneTab.loading') : downloadState === 'failed' ? t('mavlink_config.AutotuneTab.retry') : t('mavlink_config.AutotuneTab.fetchParameters')}
          </button>
        </div>
      )}

      {hasParameters && armed && (
        <div className="bg-surface rounded-xl border border-subtle p-8 text-center">
          <Lock className="w-8 h-8 mx-auto mb-3 text-amber-400" />
          <p className="text-content font-medium">{t('mavlink_config.AutotuneTab.disarmToSetUpAutotune')}</p>
          <p className="text-sm text-content-secondary mt-1 max-w-md mx-auto">
            {t('mavlink_config.AutotuneTab.theAxesAreReadTheMoment')}
          </p>
        </div>
      )}

      {hasParameters && !armed && hasAutotune && (
        <>
          <div className="bg-surface rounded-xl border border-subtle p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-content">{t('mavlink_config.AutotuneTab.axesToTune')}</h3>
                <p className="text-sm text-content-secondary">
                  {t('mavlink_config.AutotuneTab.oneAxisAtATimeTakes')}
                </p>
              </div>
            </div>

            <div
              className={`mt-4 flex gap-2 rounded-lg ${axesStaged ? 'ring-1 ring-amber-500/60 p-2 -m-2' : ''}`}
            >
              {AXES.map(({ bit, name }) => {
                const on = (axes & bit) !== 0;
                const c = AXIS_CHIP[name]!;
                return (
                  <button
                    key={name}
                    onClick={() => stage('AUTOTUNE_AXES', toggleAxis(axes, bit))}
                    data-tip={on ? t('mavlink_config.AutotuneTab.skipThisTune', { v1: name.toLowerCase() }) : t('mavlink_config.AutotuneTab.tune', { v1: name.toLowerCase() })}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${on ? c.on : c.off}`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-content-secondary">{t('mavlink_config.AutotuneTab.tuning')} {axisNames(axes)}.</p>
              {axes !== AXIS_ALL && (
                <button
                  onClick={() => stage('AUTOTUNE_AXES', AXIS_ALL)}
                  className="text-sm text-teal-400 hover:underline"
                >
                  {t('mavlink_config.AutotuneTab.selectAllThree')}
                </button>
              )}
            </div>
          </div>

          {hasAggr && (
            <div className="bg-surface rounded-xl border border-subtle p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-content">{t('mavlink_config.AutotuneTab.howHard')}</h3>
                  <p className="text-sm text-content-secondary">
                    {t('mavlink_config.AutotuneTab.howAggressivelyTheTuneChasesA')}
                  </p>
                </div>
              </div>

              <div className={`space-y-2 rounded-lg ${aggrStaged ? 'ring-1 ring-amber-500/60 p-2 -m-2' : ''}`}>
                {AGGR_CHOICES.map((choice) => {
                  const selected = aggrMatches(aggr, choice.value);
                  return (
                    <button
                      key={choice.title}
                      onClick={() => stage('AUTOTUNE_AGGR', choice.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                        selected
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-surface-raised border-subtle hover:border-strong'
                      }`}
                    >
                      {selected ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4 shrink-0 text-content-secondary" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-content">{choice.title}</p>
                        <p className="text-xs text-content-secondary">{choice.blurb}</p>
                      </div>
                      <span className="ml-auto text-xs tabular-nums text-content-secondary">
                        {choice.value}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-surface rounded-xl border border-subtle p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-content">{t('mavlink_config.AutotuneTab.howToStartIt')}</h3>
                <p className="text-sm text-content-secondary">
                  {modeNum === null
                    ? t('mavlink_config.AutotuneTab.switchTheAircraftIntoAutotuneOnce')
                    : t('mavlink_config.AutotuneTab.switchIntoAutotuneModeOnceYou', { modeNum })}
                </p>
              </div>
            </div>
            <p className="text-sm text-content-secondary">
              {t('mavlink_config.AutotuneTab.toPutItOnASwitch')}
            </p>
            <div className="mt-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-300">
                {t('mavlink_config.AutotuneTab.flyItInCalmAirWith')}
              </p>
            </div>
          </div>

          {pending.size > 0 && (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="flex-1 text-sm text-amber-300">
                {pending.size} {t('mavlink_config.AutotuneTab.change')}{pending.size === 1 ? '' : 's'} {t('mavlink_config.AutotuneTab.stagedNothingIsWrittenToThe')}
              </span>
              <button
                onClick={() => setPending(new Map())}
                className="px-3 py-1.5 rounded-lg text-sm text-content-secondary hover:text-content transition-colors"
              >
                {t('mavlink_config.AutotuneTab.discard')}
              </button>
              <button
                onClick={apply}
                disabled={applying}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
              >
                {applying ? t('mavlink_config.AutotuneTab.writing') : t('mavlink_config.AutotuneTab.apply')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AutotuneTab;
