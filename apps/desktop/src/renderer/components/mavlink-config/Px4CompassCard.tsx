/**
 * The compasses a PX4 board found, and which one it trusts.
 *
 * PX4 keeps no COMPASS_USE flag. A magnetometer is used when its priority is
 * above zero, and CAL_MAGn_ROT says whether it is on the board or out on a
 * mast, so "in use" and "external" both have to be read off the priority and
 * the rotation rather than asked for directly.
 */

import { useMemo, useState } from 'react';
import { Compass, AlertTriangle, ArrowUp } from 'lucide-react';
import { useParameterStore } from '../../stores/parameter-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { t } from '../../i18n';

const MAX_MAGS = 4;

/** CAL_MAGn_PRIO. -1 is "never set up", 0 is off, higher wins. */
const PRIORITIES: { value: number; label: string }[] = [
  { value: 0, get label() { return t('mavlink_config.Px4CompassCard.off'); } },
  { value: 25, get label() { return t('mavlink_config.Px4CompassCard.low'); } },
  { value: 50, get label() { return t('mavlink_config.Px4CompassCard.medium'); } },
  { value: 75, get label() { return t('mavlink_config.Px4CompassCard.high'); } },
  { value: 100, get label() { return t('mavlink_config.Px4CompassCard.max'); } },
];

interface Px4Mag {
  index: number;
  devId: number;
  priority: number;
  rotation: number;
  external: boolean;
  used: boolean;
}

function readMags(get: (name: string) => number | undefined): Px4Mag[] {
  const out: Px4Mag[] = [];
  for (let i = 0; i < MAX_MAGS; i++) {
    const devId = get(`CAL_MAG${i}_ID`);
    if (devId === undefined || devId === 0) continue;
    const priority = get(`CAL_MAG${i}_PRIO`) ?? -1;
    const rotation = get(`CAL_MAG${i}_ROT`) ?? -1;
    out.push({
      index: i,
      devId,
      priority,
      rotation,
      external: rotation >= 0,
      used: priority > 0,
    });
  }
  return out;
}

export function Px4CompassCard(): JSX.Element {
  const { parameters, setParameter } = useParameterStore();
  const setView = useNavigationStore((s) => s.setView);
  const [busy, setBusy] = useState(false);

  const get = (name: string): number | undefined => {
    const p = parameters.get(name);
    return typeof p?.value === 'number' ? p.value : undefined;
  };

  const known = parameters.has('CAL_MAG0_ID');
  const mags = useMemo(
    () => readMags((name) => {
      const p = parameters.get(name);
      return typeof p?.value === 'number' ? p.value : undefined;
    }),
    [parameters],
  );

  if (!known) return <></>;

  const write = async (name: string, value: number) => {
    setBusy(true);
    try {
      await setParameter(name, value);
    } finally {
      setBusy(false);
    }
  };

  const best = mags.filter((m) => m.used).sort((a, b) => b.priority - a.priority)[0];
  const uncalibrated = mags.filter((m) => m.priority === -1);
  const magFusion = get('EKF2_MAG_TYPE');

  return (
    <div className="rounded-xl border border-subtle bg-surface p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20">
          <Compass className="h-5 w-5 text-cyan-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-content">{t('mavlink_config.Px4CompassCard.compasses')}</h3>
          <p className="text-xs text-content-secondary">
            {mags.length === 0
              ? t('mavlink_config.Px4CompassCard.nothingDetectedOnThisBoard')
              : `${mags.length} detected${mags.some((m) => m.external) ? ', including an external one' : ''}`}
          </p>
        </div>
      </div>

      {mags.length === 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p>
              {t('mavlink_config.Px4CompassCard.noMagnetometerHasBeenCalibratedPx4')}
            </p>
          </div>
        </div>
      )}

      {magFusion === 5 && mags.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {t('mavlink_config.Px4CompassCard.aCompassIsFittedButThe')}
        </div>
      )}

      <div className="mb-3 rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-[11px] text-content-tertiary">
        {t('mavlink_config.Px4CompassCard.px4PicksTheCompassWithThe')}
      </div>

      <div className="space-y-2">
        {mags.map((mag) => (
          <div key={mag.devId} className="rounded-lg border border-subtle bg-surface-raised p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-content">
                    {mag.external ? t('mavlink_config.Px4CompassCard.externalCompass') : t('mavlink_config.Px4CompassCard.onboardCompass')}
                  </span>
                  <span className="rounded bg-surface-overlay px-1.5 py-0.5 font-mono text-[10px] text-content-tertiary">
                    id {mag.devId}
                  </span>
                  {best?.devId === mag.devId && (
                    <span className="flex items-center gap-1 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-700 dark:text-cyan-300">
                      <ArrowUp className="h-2.5 w-2.5" /> {t('mavlink_config.Px4CompassCard.usedForHeading')}
                    </span>
                  )}
                  {mag.priority === -1 && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                      {t('mavlink_config.Px4CompassCard.notCalibrated')}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-content-tertiary">
                  {t('mavlink_config.Px4CompassCard.slot')} {mag.index} · {mag.external ? `rotation ${mag.rotation}` : t('mavlink_config.Px4CompassCard.mountedOnTheAutopilot')}
                </div>
              </div>

              <select
                value={mag.priority < 0 ? '' : mag.priority}
                disabled={busy}
                onChange={(e) => write(`CAL_MAG${mag.index}_PRIO`, Number(e.target.value))}
                className="select shrink-0 text-[11px]"
                data-tip={t('mavlink_config.Px4CompassCard.higherPriorityCompassesArePreferredBy')}
              >
                {mag.priority < 0 && <option value="">{t('mavlink_config.Px4CompassCard.notSet')}</option>}
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {uncalibrated.length > 0 && (
        <button
          onClick={() => setView('calibration')}
          className="mt-3 text-[11px] text-cyan-400 hover:text-cyan-300"
        >
          {t('mavlink_config.Px4CompassCard.calibrateTheCompass')}
        </button>
      )}
    </div>
  );
}
