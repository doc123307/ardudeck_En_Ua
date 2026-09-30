/**
 * The compasses this board has, where each one lives, and which is in charge.
 *
 * Answers the question a hex device id cannot: is there a magnetometer on the
 * autopilot, did the GPS bring one, and is the vehicle actually using it.
 */

import { useMemo, useState } from 'react';
import { Compass, AlertTriangle, ArrowUp, Navigation } from 'lucide-react';
import { useParameterStore } from '../../stores/parameter-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { useConnectionStore } from '../../stores/connection-store';
import { getVehicleClass } from '../../../shared/telemetry-types';
import { readCompassSlots, summariseCompasses, type CompassSlot } from './compass-inventory';
import { Px4CompassCard } from './Px4CompassCard';
import { t } from '../../i18n';

function place(slot: CompassSlot): string {
  if (slot.bus === 'DroneCAN') return t('mavlink_config.CompassCard.dronecanNodeExternalGpsOrCan');
  if (slot.bus === 'I2C') {
    return slot.external
      ? t('mavlink_config.CompassCard.i2cBusAddress0xExternalUsually', { busNumber: slot.busNumber, v2: slot.address.toString(16) })
      : t('mavlink_config.CompassCard.i2cBusAddress0xOnThe', { busNumber: slot.busNumber, v2: slot.address.toString(16) });
  }
  if (slot.bus === 'SPI') return t('mavlink_config.CompassCard.spiOnTheAutopilot');
  return `${slot.bus} bus`;
}

export function CompassCard(): JSX.Element {
  const firmware = useConnectionStore((s) => s.connectionState.firmware);
  if (firmware === 'px4') return <Px4CompassCard />;
  return <ArduPilotCompassCard />;
}

function ArduPilotCompassCard(): JSX.Element {
  const { parameters, setParameter } = useParameterStore();
  const setView = useNavigationStore((s) => s.setView);
  const mavType = useConnectionStore((s) => s.connectionState.mavType);
  const [busy, setBusy] = useState(false);

  const isGround = getVehicleClass(mavType) === 'rover';
  const known = parameters.has('COMPASS_DEV_ID');
  const slots = useMemo(
    () => readCompassSlots((name) => parameters.get(name)?.value as number | undefined),
    [parameters],
  );
  const summary = useMemo(() => summariseCompasses(slots, known), [slots, known]);

  if (!known) return <></>;

  const write = async (param: string, value: number) => {
    setBusy(true);
    try {
      await setParameter(param, value);
    } finally {
      setBusy(false);
    }
  };

  const usingCompass = summary.present.some((s) => s.used);

  const setHeadingSource = async (source: 'compass' | 'gps') => {
    setBusy(true);
    try {
      for (const slot of summary.present) {
        await setParameter(slot.index === 1 ? 'COMPASS_USE' : `COMPASS_USE${slot.index}`, source === 'compass' ? 1 : 0);
      }
      if (parameters.has('EK3_SRC1_YAW')) {
        await setParameter('EK3_SRC1_YAW', source === 'compass' ? 1 : 8);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-subtle p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Compass className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-content">{t('mavlink_config.CompassCard.compasses')}</h3>
          <p className="text-xs text-content-secondary">
            {summary.present.length === 0
              ? t('mavlink_config.CompassCard.nothingDetectedOnThisBoard')
              : `${summary.present.length} detected${summary.present.some((s) => s.external) ? ', including an external one' : ''}`}
          </p>
        </div>
      </div>

      {summary.none && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 w-4 h-4 shrink-0 text-amber-400" />
            <div>
              <p className="text-amber-300">{t('mavlink_config.CompassCard.thisBoardHasNoCompassOf')}</p>
              <p className="mt-1">
                {t('mavlink_config.CompassCard.mostGpsModulesCarryOneConnect')}
              </p>
            </div>
          </div>
        </div>
      )}

      {summary.allDisabled && !isGround && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {t('mavlink_config.CompassCard.aCompassIsFittedButEvery')}
        </div>
      )}

      {isGround && summary.present.length > 0 && (
        <div className="mb-4 rounded-lg border border-subtle bg-surface-raised p-3">
          <div className="mb-2 flex items-center gap-2">
            <Navigation className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-sm text-content">{t('mavlink_config.CompassCard.whereHeadingComesFrom')}</span>
          </div>
          <div className="flex gap-2">
            {([
              { key: 'compass', label: t('mavlink_config.CompassCard.compass') },
              { key: 'gps', label: t('mavlink_config.CompassCard.gpsMotion') },
            ] as const).map((opt) => {
              const active = opt.key === 'compass' ? usingCompass : !usingCompass;
              return (
                <button
                  key={opt.key}
                  onClick={() => setHeadingSource(opt.key)}
                  disabled={busy}
                  className={`flex-1 rounded-md px-3 py-2 text-xs transition-colors disabled:opacity-40 ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                      : 'bg-surface-overlay text-content-secondary hover:text-content'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-content-tertiary">
            {usingCompass
              ? t('mavlink_config.CompassCard.theMagnetometerGivesHeadingStandingStill')
              : t('mavlink_config.CompassCard.headingComesFromWhichWayThe')}
          </p>
        </div>
      )}

      <div className="mb-3 rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-[11px] text-content-tertiary">
        {t('mavlink_config.CompassCard.slotNumbersAreAssignedInThe')}
      </div>

      <div className="space-y-2">
        {summary.present.map((slot) => (
          <div key={slot.index} className="rounded-lg border border-subtle bg-surface-raised p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-content">
                    {slot.external ? t('mavlink_config.CompassCard.externalCompass') : t('mavlink_config.CompassCard.onboardCompass')}
                  </span>
                  <span className="rounded bg-surface-overlay px-1.5 py-0.5 font-mono text-[10px] text-content-tertiary">
                    id {slot.devId}
                  </span>
                  {slot.firstUsable && (
                    <span className="flex items-center gap-1 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-700 dark:text-cyan-300">
                      <ArrowUp className="w-2.5 h-2.5" /> {t('mavlink_config.CompassCard.usedForHeading')}
                    </span>
                  )}
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                    slot.external ? 'bg-emerald-500/15 text-emerald-300' : 'bg-surface-overlay text-content-tertiary'
                  }`}>
                    {slot.external ? t('mavlink_config.CompassCard.external') : t('mavlink_config.CompassCard.onboard')}
                  </span>
                  {!slot.calibrated && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                      {t('mavlink_config.CompassCard.notCalibrated')}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-content-tertiary">
                  {place(slot)} {t('mavlink_config.CompassCard.slot')} {slot.index}
                  {slot.priority !== null && ` · priority ${slot.priority}`}
                </div>
              </div>
              <button
                onClick={() => write(slot.index === 1 ? 'COMPASS_USE' : `COMPASS_USE${slot.index}`, slot.used ? 0 : 1)}
                disabled={busy}
                data-tip={slot.used
                  ? t('mavlink_config.CompassCard.stopUsingThisCompassForHeading')
                  : t('mavlink_config.CompassCard.useThisCompassForHeading')}
                className={`shrink-0 rounded-md px-3 py-1.5 text-[11px] transition-colors disabled:opacity-40 ${
                  slot.used
                    ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                    : 'bg-surface-overlay text-content-secondary hover:text-content'
                }`}
              >
                {slot.used ? t('mavlink_config.CompassCard.inUse') : t('mavlink_config.CompassCard.notUsed')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {summary.uncalibrated.length > 0 && (
        <button
          onClick={() => setView('calibration')}
          className="mt-3 text-[11px] text-cyan-400 hover:text-cyan-300"
        >
          {t('mavlink_config.CompassCard.calibrateTheCompass')}
        </button>
      )}
    </div>
  );
}
