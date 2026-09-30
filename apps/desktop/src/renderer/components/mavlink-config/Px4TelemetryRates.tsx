/**
 * PX4 does not have per-message stream rates.
 *
 * ArduPilot gives you a slider per message group. PX4 gives each MAVLink
 * instance a named message set (MAV_n_MODE) and a total byte budget
 * (MAV_n_RATE), and the streams inside the set are fixed by the firmware. So
 * this is not the ArduPilot tab with different labels: it is the two knobs PX4
 * actually has, next to what is arriving now.
 */

import { useEffect, useState } from 'react';
import { Gauge, Radio, Zap } from 'lucide-react';
import { useParameterStore } from '../../stores/parameter-store';
import { useInspectorStore, startInspector, getInspectorSnapshot } from '../../stores/inspector-store';
import { t } from '../../i18n';

/** MAV_n_MODE: which set of streams the instance sends. */
const MODES: Record<number, { label: string; detail: string }> = {
  0: { get label() { return t('mavlink_config.Px4TelemetryRates.normal'); }, get detail() { return t('mavlink_config.Px4TelemetryRates.theStandardGroundStationSetWhat'); } },
  1: { get label() { return t('mavlink_config.Px4TelemetryRates.custom'); }, get detail() { return t('mavlink_config.Px4TelemetryRates.nothingIsStreamedUntilSomethingAsks'); } },
  2: { get label() { return t('mavlink_config.Px4TelemetryRates.onboard'); }, get detail() { return t('mavlink_config.Px4TelemetryRates.highRateForACompanionComputer'); } },
  3: { label: 'OSD', get detail() { return t('mavlink_config.Px4TelemetryRates.theHandfulOfMessagesAnOn'); } },
  4: { get label() { return t('mavlink_config.Px4TelemetryRates.magic'); }, get detail() { return t('mavlink_config.Px4TelemetryRates.normalPlusAFewExtrasRarely'); } },
  5: { get label() { return t('mavlink_config.Px4TelemetryRates.config'); }, get detail() { return t('mavlink_config.Px4TelemetryRates.everythingFastForBenchWorkOver'); } },
  7: { get label() { return t('mavlink_config.Px4TelemetryRates.minimal'); }, get detail() { return t('mavlink_config.Px4TelemetryRates.heartbeatAndLittleElseForA'); } },
  8: { get label() { return t('mavlink_config.Px4TelemetryRates.externalVision'); }, get detail() { return t('mavlink_config.Px4TelemetryRates.forAnExternalPositionSource'); } },
  10: { get label() { return t('mavlink_config.Px4TelemetryRates.gimbal'); }, get detail() { return t('mavlink_config.Px4TelemetryRates.gimbalTrafficOnly'); } },
  11: { get label() { return t('mavlink_config.Px4TelemetryRates.onboardLowBandwidth'); }, get detail() { return t('mavlink_config.Px4TelemetryRates.companionComputerOnAConstrainedLink'); } },
  12: { label: 'uAvionix', get detail() { return t('mavlink_config.Px4TelemetryRates.forUavionixAdsBHardware'); } },
  13: { get label() { return t('mavlink_config.Px4TelemetryRates.lowBandwidth'); }, get detail() { return t('mavlink_config.Px4TelemetryRates.trimmedGroundStationSetForA'); } },
};

const INSTANCES = [0, 1, 2] as const;

function modeLabel(value: number | undefined): string {
  if (value === undefined) return t('mavlink_config.Px4TelemetryRates.notSet');
  return MODES[value]?.label ?? `Mode ${value}`;
}

export default function Px4TelemetryRates(): JSX.Element {
  const { parameters, setParameter } = useParameterStore();
  // Subscribing to the tick is what re-renders this card as packets arrive.
  useInspectorStore((s) => s.tick);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { startInspector(); }, []);

  const num = (name: string): number | undefined => {
    const p = parameters.get(name);
    return typeof p?.value === 'number' ? p.value : undefined;
  };

  /** Only instances the firmware actually exposes. A board with one telemetry
   *  port has no MAV_2_*, and inventing a card for it is a lie. */
  const present = INSTANCES.filter((i) => parameters.has(`MAV_${i}_MODE`));

  // Recomputed every render, which the store's tick already drives. Memoising
  // on `tick` would only restate that, and the sum is a walk over a short list.
  let totalHz = 0;
  for (const stat of getInspectorSnapshot().flat) totalHz += stat.hz;

  const write = async (name: string, value: number) => {
    setBusy(name);
    try {
      await setParameter(name, value);
    } finally {
      setBusy(null);
    }
  };

  if (present.length === 0) {
    return (
      <div className="rounded-xl border border-subtle bg-surface p-5 text-sm text-content-secondary">
        {t('mavlink_config.Px4TelemetryRates.noMavlinkInstanceParametersHaveBeen')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-subtle bg-surface p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20">
            <Gauge className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-content">{t('mavlink_config.Px4TelemetryRates.telemetryRates')}</h3>
            <p className="text-xs text-content-secondary">
              {t('mavlink_config.Px4TelemetryRates.px4SetsAMessageSetAnd')}
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg text-content">{totalHz.toFixed(1)}</div>
            <div className="text-[10px] uppercase tracking-wide text-content-tertiary">{t('mavlink_config.Px4TelemetryRates.msgSArriving')}</div>
          </div>
        </div>

        <div className="space-y-3">
          {present.map((i) => {
            const mode = num(`MAV_${i}_MODE`);
            const rate = num(`MAV_${i}_RATE`);
            const forward = num(`MAV_${i}_FORWARD`);
            return (
              <div key={i} className="rounded-lg border border-subtle bg-surface-raised p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Radio className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-sm text-content">{t('mavlink_config.Px4TelemetryRates.mavlinkInstance')} {i}</span>
                  <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] text-content-tertiary">
                    {modeLabel(mode)}
                  </span>
                </div>

                <label className="mb-1 block text-[11px] text-content-secondary">{t('mavlink_config.Px4TelemetryRates.whatThisLinkStreams')}</label>
                <select
                  value={mode ?? ''}
                  disabled={busy === `MAV_${i}_MODE` || mode === undefined}
                  onChange={(e) => write(`MAV_${i}_MODE`, Number(e.target.value))}
                  className="select w-full text-sm"
                >
                  {Object.entries(MODES).map(([value, m]) => (
                    <option key={value} value={value}>{m.label}</option>
                  ))}
                </select>
                {mode !== undefined && MODES[mode] && (
                  <p className="mt-1 text-[11px] text-content-tertiary">{MODES[mode]!.detail}</p>
                )}

                <label className="mt-3 mb-1 block text-[11px] text-content-secondary">
                  {t('mavlink_config.Px4TelemetryRates.budget')} {rate === undefined ? t('mavlink_config.Px4TelemetryRates.notSet') : rate === 0 ? 'unlimited' : `${rate} B/s`}
                </label>
                <input
                  type="range"
                  min={0}
                  max={20000}
                  step={100}
                  value={rate ?? 0}
                  disabled={busy === `MAV_${i}_RATE` || rate === undefined}
                  onChange={(e) => write(`MAV_${i}_RATE`, Number(e.target.value))}
                  className="w-full"
                />
                <p className="mt-1 text-[11px] text-content-tertiary">
                  {t('mavlink_config.Px4TelemetryRates.px4ThinsItsStreamsToStay')}
                </p>

                {forward !== undefined && (
                  <button
                    onClick={() => write(`MAV_${i}_FORWARD`, forward ? 0 : 1)}
                    disabled={busy === `MAV_${i}_FORWARD`}
                    className={`mt-3 rounded-md px-3 py-1.5 text-[11px] transition-colors disabled:opacity-40 ${
                      forward
                        ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                        : 'bg-surface-overlay text-content-secondary hover:text-content'
                    }`}
                  >
                    {forward ? t('mavlink_config.Px4TelemetryRates.forwardingMessagesBetweenLinks') : t('mavlink_config.Px4TelemetryRates.notForwardingBetweenLinks')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-subtle bg-surface-raised p-4 text-[11px] text-content-tertiary">
        <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
        <span>
          {t('mavlink_config.Px4TelemetryRates.changingTheModeOfTheLink')}
        </span>
      </div>
    </div>
  );
}
