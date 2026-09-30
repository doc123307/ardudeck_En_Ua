/**
 * TrafficSettingsCard — provider configuration for the ADS-B + glider overlays.
 *
 * Non-secret config (enable flags, URLs, hosts, preset, proximity thresholds) is
 * persisted via setTrafficConfig; API keys / OpenSky credentials go through the
 * existing encrypted secret store (getApiKey/setApiKey). Enabling a source here
 * only configures it — the map overlay toggles ('Traffic' / 'Gliders') start and
 * stop the live feed.
 */

import { useEffect, useState } from 'react';
import { DraftNumberInput } from '../../hooks/useNumericDraft';
import {
  ADSB_API_PRESETS,
  DEFAULT_TRAFFIC_CONFIG,
  TRAFFIC_SECRET_SERVICES,
  type AdsbApiPreset,
  type AlertZone,
  type RemoteIdShape,
  type TrafficConfig,
} from '../../../shared/traffic-types';
import { useTrafficStore } from '../../stores/traffic-store';
import { t } from '../../i18n';

const inputCls =
  'px-3 py-1.5 bg-surface-input border border-border rounded-lg text-sm text-content placeholder-content-tertiary focus:outline-none focus:border-blue-500';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${on ? 'bg-blue-600' : 'bg-surface-inset'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white border border-strong shadow-sm absolute top-0.5 transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-content-secondary mb-1">{label}</span>
      {children}
    </label>
  );
}

export function TrafficSettingsCard() {
  const [cfg, setCfg] = useState<TrafficConfig>(DEFAULT_TRAFFIC_CONFIG);
  const [adsbxKey, setAdsbxKey] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [openSkyCreds, setOpenSkyCreds] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void window.electronAPI?.getTrafficConfig().then((c) => c && setCfg(c));
    void window.electronAPI?.getApiKey(TRAFFIC_SECRET_SERVICES.adsbexchange).then((r) => r?.hasKey && setAdsbxKey(r.key));
    void window.electronAPI?.getApiKey(TRAFFIC_SECRET_SERVICES.custom).then((r) => r?.hasKey && setCustomKey(r.key));
    void window.electronAPI?.getApiKey(TRAFFIC_SECRET_SERVICES.openSky).then((r) => r?.hasKey && setOpenSkyCreds(r.key));
  }, []);

  const patch = (p: Partial<TrafficConfig>): void => setCfg((c) => ({ ...c, ...p }));

  const save = async (): Promise<void> => {
    await window.electronAPI?.setTrafficConfig(cfg);
    await window.electronAPI?.setApiKey(TRAFFIC_SECRET_SERVICES.adsbexchange, adsbxKey.trim());
    await window.electronAPI?.setApiKey(TRAFFIC_SECRET_SERVICES.custom, customKey.trim());
    await window.electronAPI?.setApiKey(TRAFFIC_SECRET_SERVICES.openSky, openSkyCreds.trim());
    // Apply view-affecting settings to the live map immediately.
    useTrafficStore.getState().setProximity(cfg.proximity);
    useTrafficStore.getState().setAltitudeBand(cfg.altitudeFilter);
    useTrafficStore.getState().setIconScale(cfg.iconScale);
    useTrafficStore.getState().setAlertZones(cfg.alertZones);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const preset = ADSB_API_PRESETS[cfg.adsbApi.preset];

  return (
    <div className="bg-surface rounded-xl border border-subtle p-5 mt-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V9m0 0l8 5V7.5a.75.75 0 00-1.1-.66L12 9zm0 0L5.1 6.84A.75.75 0 004 7.5V14l8-5z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-medium text-content">{t('settings.TrafficSettingsCard.trafficGliders')}</h3>
          <p className="text-xs text-content-secondary">{t('settings.TrafficSettingsCard.adsBAndOgnSourcesToggle')}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Local ADS-B receiver */}
        <div className="bg-surface-input rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-content font-medium">{t('settings.TrafficSettingsCard.localAdsBReceiver')}</div>
            <Toggle on={cfg.localAdsb.enabled} onChange={(v) => patch({ localAdsb: { ...cfg.localAdsb, enabled: v } })} />
          </div>
          <Field label={t('settings.TrafficSettingsCard.aircraftJsonUrlDump1090ReadsbTar1090')}>
            <input
              className={`${inputCls} w-full`}
              value={cfg.localAdsb.url}
              onChange={(e) => patch({ localAdsb: { ...cfg.localAdsb, url: e.target.value } })}
              placeholder="http://localhost:8080/data/aircraft.json"
            />
          </Field>
        </div>

        {/* Hosted ADS-B API */}
        <div className="bg-surface-input rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-content font-medium">{t('settings.TrafficSettingsCard.hostedAdsBApi')}</div>
            <Toggle on={cfg.adsbApi.enabled} onChange={(v) => patch({ adsbApi: { ...cfg.adsbApi, enabled: v } })} />
          </div>
          <Field label={t('settings.TrafficSettingsCard.provider')}>
            <select
              className={`${inputCls} w-full`}
              value={cfg.adsbApi.preset}
              onChange={(e) => patch({ adsbApi: { ...cfg.adsbApi, preset: e.target.value as AdsbApiPreset } })}
            >
              {Object.values(ADSB_API_PRESETS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          {cfg.adsbApi.preset === 'custom' && (
            <>
              <Field label="Endpoint URL ({lat} {lon} {radiusNm} substituted)">
                <input
                  className={`${inputCls} w-full`}
                  value={cfg.adsbApi.customUrl}
                  onChange={(e) => patch({ adsbApi: { ...cfg.adsbApi, customUrl: e.target.value } })}
                  placeholder="https://example.com/api/lat/{lat}/lon/{lon}/dist/{radiusNm}"
                />
              </Field>
              <Field label={t('settings.TrafficSettingsCard.apiKeyHeaderNameOptional')}>
                <input
                  className={`${inputCls} w-full`}
                  value={cfg.adsbApi.customKeyHeader}
                  onChange={(e) => patch({ adsbApi: { ...cfg.adsbApi, customKeyHeader: e.target.value } })}
                  placeholder={t('settings.TrafficSettingsCard.xApiKey')}
                />
              </Field>
              <Field label={t('settings.TrafficSettingsCard.apiKeyOptional')}>
                <input type="password" className={`${inputCls} w-full`} value={customKey} onChange={(e) => setCustomKey(e.target.value)} placeholder={t('settings.TrafficSettingsCard.pasteKey')} />
              </Field>
            </>
          )}
          {cfg.adsbApi.preset === 'adsbexchange' && (
            <Field label={t('settings.TrafficSettingsCard.rapidapiKey')}>
              <input type="password" className={`${inputCls} w-full`} value={adsbxKey} onChange={(e) => setAdsbxKey(e.target.value)} placeholder={t('settings.TrafficSettingsCard.pasteRapidapiKey')} />
            </Field>
          )}
          {!preset.needsKey && cfg.adsbApi.preset !== 'custom' && (
            <p className="text-xs text-content-tertiary">{t('settings.TrafficSettingsCard.noKeyRequired')}</p>
          )}
        </div>

        {/* OpenSky */}
        <div className="bg-surface-input rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-content font-medium">{t('settings.TrafficSettingsCard.openskyNetwork')}</div>
            <Toggle on={cfg.openSky.enabled} onChange={(v) => patch({ openSky: { ...cfg.openSky, enabled: v } })} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-content-secondary">{t('settings.TrafficSettingsCard.useAccountHigherRateLimit')}</span>
            <Toggle on={cfg.openSky.useAuth} onChange={(v) => patch({ openSky: { ...cfg.openSky, useAuth: v } })} />
          </div>
          {cfg.openSky.useAuth && (
            <Field label={t('settings.TrafficSettingsCard.credentialsUsernamePassword')}>
              <input type="password" className={`${inputCls} w-full`} value={openSkyCreds} onChange={(e) => setOpenSkyCreds(e.target.value)} placeholder="user:pass" />
            </Field>
          )}
        </div>

        {/* OGN gliders */}
        <div className="bg-surface-input rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-content font-medium">{t('settings.TrafficSettingsCard.glidersOgnAprsIs')}</div>
            <Toggle on={cfg.ogn.enabled} onChange={(v) => patch({ ogn: { ...cfg.ogn, enabled: v } })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field label={t('settings.TrafficSettingsCard.aprsIsHostPublicOrLocal')}>
                <input className={`${inputCls} w-full`} value={cfg.ogn.host} onChange={(e) => patch({ ogn: { ...cfg.ogn, host: e.target.value } })} placeholder="aprs.glidernet.org" />
              </Field>
            </div>
            <Field label={t('settings.TrafficSettingsCard.port')}>
              <DraftNumberInput
                className={`${inputCls} w-full`}
                value={cfg.ogn.port}
                min={1}
                max={65535}
                integer
                onCommit={(v) => patch({ ogn: { ...cfg.ogn, port: v } })}
              />
            </Field>
          </div>
        </div>

        {/* Remote ID receiver */}
        <div className="bg-surface-input rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-content font-medium">{t('settings.TrafficSettingsCard.remoteIdReceiver')}</div>
            <Toggle on={cfg.remoteId.enabled} onChange={(v) => patch({ remoteId: { ...cfg.remoteId, enabled: v } })} />
          </div>
          <p className="text-xs text-content-secondary">
            {t('settings.TrafficSettingsCard.ingestBroadcastDroneRemoteIdFaa')}
          </p>
          <Field label={t('settings.TrafficSettingsCard.receiverJsonUrl')}>
            <input
              className={`${inputCls} w-full`}
              value={cfg.remoteId.url}
              onChange={(e) => patch({ remoteId: { ...cfg.remoteId, url: e.target.value } })}
              placeholder="http://localhost:9090/api/remoteid"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('settings.TrafficSettingsCard.jsonFormat')}>
              <select
                className={`${inputCls} w-full`}
                value={cfg.remoteId.shape}
                onChange={(e) => patch({ remoteId: { ...cfg.remoteId, shape: e.target.value as RemoteIdShape } })}
              >
                <option value="ardudeck">{t('settings.TrafficSettingsCard.normalisedArdudeck')}</option>
                <option value="opendroneid">{t('settings.TrafficSettingsCard.opendroneidReceiver')}</option>
              </select>
            </Field>
            <Field label={t('settings.TrafficSettingsCard.pollMs')}>
              <DraftNumberInput
                className={`${inputCls} w-full`}
                value={cfg.remoteId.pollMs}
                min={250}
                integer
                onCommit={(v) => patch({ remoteId: { ...cfg.remoteId, pollMs: v } })}
              />
            </Field>
          </div>
        </div>

        {/* Perimeter alert zones */}
        <AlertZonesSection
          zones={cfg.alertZones}
          onChange={(alertZones) => patch({ alertZones })}
        />

        {/* Altitude relevance band */}
        <div className="bg-surface-input rounded-lg p-3 space-y-2">
          <div className="text-sm text-content font-medium">{t('settings.TrafficSettingsCard.altitudeFilter')}</div>
          <p className="text-xs text-content-secondary">
            {t('settings.TrafficSettingsCard.yourOperatingBandMslUsedAs')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('settings.TrafficSettingsCard.floorM')}>
              <DraftNumberInput
                className={`${inputCls} w-full`}
                value={cfg.altitudeFilter.floorMeters}
                integer
                onCommit={(v) => patch({ altitudeFilter: { ...cfg.altitudeFilter, floorMeters: v } })}
              />
            </Field>
            <Field label={t('settings.TrafficSettingsCard.ceilingM')}>
              <DraftNumberInput
                className={`${inputCls} w-full`}
                value={cfg.altitudeFilter.ceilingMeters}
                integer
                onCommit={(v) => patch({ altitudeFilter: { ...cfg.altitudeFilter, ceilingMeters: v } })}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-content-secondary">{t('settings.TrafficSettingsCard.hideTrafficAboveCeilingInsteadOf')}</span>
            <Toggle on={cfg.altitudeFilter.hardCeiling} onChange={(v) => patch({ altitudeFilter: { ...cfg.altitudeFilter, hardCeiling: v } })} />
          </div>
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-content-secondary">{t('settings.TrafficSettingsCard.iconSize')}</span>
              <span className="text-xs text-content tabular-nums">{Math.round(cfg.iconScale * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.6}
              max={2}
              step={0.1}
              value={cfg.iconScale}
              onChange={(e) => patch({ iconScale: Number(e.target.value) })}
              className="w-full accent-sky-500"
            />
          </div>
        </div>

        {/* Proximity thresholds */}
        <div className="bg-surface-input rounded-lg p-3 space-y-2">
          <div className="text-sm text-content font-medium">{t('settings.TrafficSettingsCard.proximityWarning')}</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('settings.TrafficSettingsCard.rangeM')}>
              <DraftNumberInput
                className={`${inputCls} w-full`}
                value={cfg.proximity.rangeMeters}
                min={0}
                integer
                onCommit={(v) => patch({ proximity: { ...cfg.proximity, rangeMeters: v } })}
              />
            </Field>
            <Field label={t('settings.TrafficSettingsCard.verticalSeparationM')}>
              <DraftNumberInput
                className={`${inputCls} w-full`}
                value={cfg.proximity.verticalMeters}
                min={0}
                integer
                onCommit={(v) => patch({ proximity: { ...cfg.proximity, verticalMeters: v } })}
              />
            </Field>
          </div>
        </div>

        <button onClick={() => void save()} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
          {saved ? t('settings.TrafficSettingsCard.saved') : t('settings.TrafficSettingsCard.saveTrafficSettings')}
        </button>
      </div>
    </div>
  );
}

/**
 * Perimeter alert zones: circular zones seeded from the current map centre, with
 * an optional altitude band. A cooperative contact entering an enabled zone
 * raises an alert (detect + alert only). Zones persist in the traffic config and
 * push to the live store on Save.
 */
function AlertZonesSection({ zones, onChange }: { zones: AlertZone[]; onChange: (z: AlertZone[]) => void }) {
  const viewportCenter = useTrafficStore((s) => s.viewportCenter);

  const addZone = (): void => {
    const center = viewportCenter ?? { lat: 0, lon: 0 };
    const zone: AlertZone = {
      id: (globalThis.crypto?.randomUUID?.() ?? `zone-${Date.now()}`),
      name: `Zone ${zones.length + 1}`,
      enabled: true,
      shape: 'circle',
      center: { lat: Number(center.lat.toFixed(6)), lon: Number(center.lon.toFixed(6)) },
      radiusMeters: 1000,
    };
    onChange([...zones, zone]);
  };

  const update = (id: string, patch: Partial<AlertZone>): void =>
    onChange(zones.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  const remove = (id: string): void => onChange(zones.filter((z) => z.id !== id));

  return (
    <div className="bg-surface-input rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm text-content font-medium">{t('settings.TrafficSettingsCard.perimeterAlertZones')}</div>
        <button
          onClick={addZone}
          className="px-2 py-1 text-[11px] bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors"
        >
          {t('settings.TrafficSettingsCard.addZoneHere')}
        </button>
      </div>
      <p className="text-xs text-content-secondary">
        {t('settings.TrafficSettingsCard.alertWhenAnyContactAdsB')}
      </p>
      {zones.length === 0 ? (
        <p className="text-[11px] text-content-tertiary">{t('settings.TrafficSettingsCard.noZonesPanTheMapTo')}</p>
      ) : (
        <div className="space-y-2">
          {zones.map((z) => (
            <div key={z.id} className="rounded-md border border-subtle p-2 space-y-2">
              <div className="flex items-center gap-2">
                <Toggle on={z.enabled} onChange={(v) => update(z.id, { enabled: v })} />
                <input
                  className={`${inputCls} flex-1 !py-1`}
                  value={z.name}
                  onChange={(e) => update(z.id, { name: e.target.value })}
                />
                <button onClick={() => remove(z.id)} className="text-content-tertiary hover:text-red-400 text-xs px-1" title={t('settings.TrafficSettingsCard.deleteZone')}>
                  {t('settings.TrafficSettingsCard.remove')}
                </button>
              </div>
              {z.shape === 'circle' && (
                <div className="grid grid-cols-3 gap-2">
                  <Field label={t('settings.TrafficSettingsCard.lat')}>
                    <input
                      type="number"
                      className={`${inputCls} w-full !py-1`}
                      value={z.center?.lat ?? 0}
                      onChange={(e) => update(z.id, { center: { lat: Number(e.target.value) || 0, lon: z.center?.lon ?? 0 } })}
                    />
                  </Field>
                  <Field label={t('settings.TrafficSettingsCard.lon')}>
                    <input
                      type="number"
                      className={`${inputCls} w-full !py-1`}
                      value={z.center?.lon ?? 0}
                      onChange={(e) => update(z.id, { center: { lat: z.center?.lat ?? 0, lon: Number(e.target.value) || 0 } })}
                    />
                  </Field>
                  <Field label={t('settings.TrafficSettingsCard.radiusM')}>
                    <input
                      type="number"
                      className={`${inputCls} w-full !py-1`}
                      value={z.radiusMeters ?? 1000}
                      onChange={(e) => update(z.id, { radiusMeters: Math.max(10, Number(e.target.value) || 1000) })}
                    />
                  </Field>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label={t('settings.TrafficSettingsCard.minAltMOptional')}>
                  <input
                    type="number"
                    className={`${inputCls} w-full !py-1`}
                    value={z.minAltMeters ?? ''}
                    onChange={(e) => update(z.id, { minAltMeters: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </Field>
                <Field label={t('settings.TrafficSettingsCard.maxAltMOptional')}>
                  <input
                    type="number"
                    className={`${inputCls} w-full !py-1`}
                    value={z.maxAltMeters ?? ''}
                    onChange={(e) => update(z.id, { maxAltMeters: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
