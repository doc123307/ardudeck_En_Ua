/**
 * Source configuration popover. Add a feed for the current vehicle from a
 * preset (SIYI / Herelink / RunCam / RubyFPV / RTSP / UVC / …), edit its url /
 * label / FOV, pick which configured source is live, and remove sources.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCameraStore, sourcesForVehicle, offlineVehicleKey } from '../../stores/camera-store';
import { CAMERA_PRESETS, presetById } from './camera-presets';
import { WfbngSetupGuide } from './WfbngSetupGuide';
import { CameraControlBar } from './CameraControlBar';
import { useCameraControlStore } from '../../stores/camera-control-store';
import type { CameraSourceConfig, GimbalControlMode, CameraControlVendor, CameraHttpCommand } from '../../../shared/camera-types';
import { DEFAULT_GIMBAL_CONFIG } from '../../../shared/camera-types';
import { t } from '../../i18n';

interface CameraSourceMenuProps {
  vehicleKey: string | null;
  onClose: () => void;
}

/** The pop-over: the editor in a panel over the screen. */
export function CameraSourceMenu({ vehicleKey, onClose }: CameraSourceMenuProps) {
  return (
    <Shell onClose={onClose}>
      <CameraSourceEditor vehicleKey={vehicleKey} />
    </Shell>
  );
}

/**
 * The feeds of a vehicle: add, edit, choose, remove. It needs no link: with no vehicle
 * connected the feeds are filed under the one set up last (or a stand-in), and they are
 * the connected vehicle's as soon as it appears.
 */
export function CameraSourceEditor({ vehicleKey: liveKey }: { vehicleKey: string | null }) {
  const store = useCameraStore();
  const vehicleKey = liveKey ?? offlineVehicleKey(store.sources, store.selectedByVehicle);
  const sources = sourcesForVehicle(store, vehicleKey);
  const selectedId = store.selectedByVehicle[vehicleKey];
  const [presetId, setPresetId] = useState(CAMERA_PRESETS[0]?.id ?? 'mavlink');
  const [uvcDevices, setUvcDevices] = useState<MediaDeviceInfo[]>([]);

  const preset = presetById(presetId);

  useEffect(() => {
    if (preset?.kind !== 'uvc') return;
    void navigator.mediaDevices.enumerateDevices().then((d) =>
      setUvcDevices(d.filter((x) => x.kind === 'videoinput')),
    );
  }, [preset?.kind]);

  const addFromPreset = (deviceId?: string) => {
    if (!preset) return;
    const source: CameraSourceConfig = {
      id: crypto.randomUUID(),
      vehicleKey,
      kind: preset.kind,
      label: preset.label,
      preset: preset.id,
      ...(preset.url ? { url: preset.url } : {}),
      ...(preset.hfovDeg ? { hfovDeg: preset.hfovDeg } : {}),
      ...(deviceId ? { deviceId } : {}),
      lowLatency: true,
    };
    store.addSource(source);
  };

  return (
    <>
      {!liveKey && <p className="mb-3 rounded border border-subtle bg-surface-raised px-2 py-1.5 text-[11px] leading-snug text-content-secondary">{t('camera.CameraSourceMenu.offlineNote')}</p>}
      {/* Add new */}
      <div className="mb-3">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-content-secondary">{t('camera.CameraSourceMenu.addAFeed')}</div>
        <div className="flex gap-1.5">
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="min-w-0 flex-1 rounded border border-default bg-surface-input px-2 py-1 text-xs text-content"
          >
            {CAMERA_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {preset?.kind !== 'uvc' && (
            <button onClick={() => addFromPreset()} className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500">{t('camera.CameraSourceMenu.add')}</button>
          )}
        </div>
        {preset?.note && <p className="mt-1 text-[10px] leading-tight text-content-tertiary">{preset.note}</p>}
        {preset?.kind === 'wfbng' && <WfbngSetupGuide port={5600} />}
        {preset?.kind === 'uvc' && (
          <div className="mt-1.5 flex flex-col gap-1">
            {uvcDevices.length === 0 && <span className="text-[10px] text-content-tertiary">{t('camera.CameraSourceMenu.noCaptureDevicesDetected')}</span>}
            {uvcDevices.map((d) => (
              <button
                key={d.deviceId}
                onClick={() => addFromPreset(d.deviceId)}
                className="rounded bg-surface-raised px-2 py-1 text-left text-[11px] text-content hover:bg-surface-raised"
              >{d.label || t('camera.CameraSourceMenu.camera', { v1: d.deviceId.slice(0, 6) })}</button>
            ))}
          </div>
        )}
      </div>

      {/* Configured sources */}
      <div className="text-[10px] font-medium uppercase tracking-wider text-content-secondary">{t('camera.CameraSourceMenu.feedsForThisVehicle')}</div>
      {sources.length === 0 && <p className="mt-1 text-xs text-content-tertiary">{t('camera.CameraSourceMenu.noneYet')}</p>}
      <div className="mt-1 flex flex-col gap-2">
        {sources.map((s) => (
          <SourceRow
            key={s.id}
            source={s}
            selected={s.id === selectedId}
            onSelect={() => store.setSelectedSource(vehicleKey, s.id)}
            onChange={(patch) => store.updateSource(s.id, patch)}
            onRemove={() => store.removeSource(s.id)}
          />
        ))}
      </div>

      <GimbalSection vehicleKey={vehicleKey} />
    </>
  );
}

function GimbalSection({ vehicleKey }: { vehicleKey: string }) {
  const store = useCameraStore();
  const cfg = store.gimbalByVehicle[vehicleKey] ?? DEFAULT_GIMBAL_CONFIG;
  const info = store.gimbalInfo[vehicleKey];

  return (
    <div className="mt-3 border-t border-subtle pt-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-content-secondary">{t('camera.CameraSourceMenu.gimbal')}</div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-content">
        <label className="flex flex-1 items-center gap-1" title={t('camera.CameraSourceMenu.howTheGcsCommandsTheMount')}>
          {t('camera.CameraSourceMenu.control')}
          <select
            value={cfg.mode}
            onChange={(e) => store.setGimbalConfig(vehicleKey, { mode: e.target.value as GimbalControlMode })}
            className="min-w-0 flex-1 rounded bg-surface-input px-1 py-0.5 text-content"
          >
            <option value="auto">{t('camera.CameraSourceMenu.autoMavlink')}</option>
            <option value="manager">{t('camera.CameraSourceMenu.mavlinkManager')}</option>
            <option value="mount">{t('camera.CameraSourceMenu.mountControlLegacy')}</option>
            <option value="rc">{t('camera.CameraSourceMenu.rcDrivenDisplayOnly')}</option>
            <option value="off">{t('camera.CameraSourceMenu.offNoGimbal')}</option>
          </select>
        </label>
        <label className="flex items-center gap-1" title={t('camera.CameraSourceMenu.whichMountInstanceToCommand0')}>
          {t('camera.CameraSourceMenu.mount')}
          <select
            value={cfg.deviceId}
            onChange={(e) => store.setGimbalConfig(vehicleKey, { deviceId: Number(e.target.value) })}
            className="rounded bg-surface-input px-1 py-0.5 text-content"
          >
            <option value={0}>{t('camera.CameraSourceMenu.all')}</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
      </div>
      {info && (
        <p className="mt-1 text-[10px] text-content-tertiary">
          {t('camera.CameraSourceMenu.detectedManagerPitch')} {info.pitchMinDeg.toFixed(0)}…{info.pitchMaxDeg.toFixed(0)}{t('camera.CameraSourceMenu.yaw')} {info.yawMinDeg.toFixed(0)}…{info.yawMaxDeg.toFixed(0)}°
        </p>
      )}
    </div>
  );
}

function SourceRow({ source, selected, onSelect, onChange, onRemove }: {
  source: CameraSourceConfig;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<CameraSourceConfig>) => void;
  onRemove: () => void;
}) {
  return (
    <div className={`rounded-lg border p-2 ${selected ? 'border-blue-500/60 bg-blue-500/5' : 'border-subtle bg-surface'}`}>
      <div className="flex items-center gap-2">
        <input
          type="radio"
          checked={selected}
          onChange={onSelect}
          className="accent-blue-500"
          title={t('camera.CameraSourceMenu.makeThisTheLiveFeed')}
        />
        <input
          value={source.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="min-w-0 flex-1 rounded bg-surface-input px-1.5 py-0.5 text-xs text-content"
        />
        <button onClick={onRemove} className="text-content-tertiary hover:text-red-400" title={t('camera.CameraSourceMenu.removeFeed')}>✕</button>
      </div>
      {source.kind !== 'uvc' && source.kind !== 'mavlink' && (
        <input
          value={source.url ?? ''}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="rtsp://…"
          className="mt-1 w-full rounded bg-surface-input px-1.5 py-0.5 font-mono text-[11px] text-content"
        />
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-content-secondary">
        <span className="uppercase">{source.kind}</span>
        <label className="flex items-center gap-1">
          HFOV
          <input
            type="number"
            value={source.hfovDeg ?? ''}
            onChange={(e) => onChange({ hfovDeg: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="°"
            className="w-12 rounded bg-surface-input px-1 py-0.5 text-content"
            title={t('camera.CameraSourceMenu.horizontalFieldOfViewNeededFor')}
          />
        </label>
        {source.kind === 'wfbng' && (
          <>
            <label className="flex items-center gap-1" title={t('camera.CameraSourceMenu.dongleArdudeckReceivesDirectlyWithThe')}>
              {t('camera.CameraSourceMenu.via')}
              <select
                value={source.wfbMode ?? 'dongle'}
                onChange={(e) => onChange({ wfbMode: e.target.value as 'dongle' | 'network' })}
                className="rounded bg-surface-input px-1 py-0.5 text-content"
              >
                <option value="dongle">{t('camera.CameraSourceMenu.dongle')}</option>
                <option value="network">{t('camera.CameraSourceMenu.network')}</option>
              </select>
            </label>
            <label className="flex items-center gap-1" title={t('camera.CameraSourceMenu.codecTheCameraSendsWifilink2')}>
              {t('camera.CameraSourceMenu.codec')}
              <select
                value={source.wfbCodec ?? 'h265'}
                onChange={(e) => onChange({ wfbCodec: e.target.value as 'h265' | 'h264' })}
                className="rounded bg-surface-input px-1 py-0.5 text-content"
              >
                <option value="h265">H.265</option>
                <option value="h264">H.264</option>
              </select>
            </label>
            <label className="flex items-center gap-1" title={t('camera.CameraSourceMenu.convertToH264SoThe')}>
              <input
                type="checkbox"
                checked={source.wfbTranscode ?? (source.wfbCodec ?? 'h265') === 'h265'}
                onChange={(e) => onChange({ wfbTranscode: e.target.checked })}
                className="accent-blue-500"
              />
              {t('camera.CameraSourceMenu.convert')}
            </label>
          </>
        )}
        {(source.kind === 'rtsp' || source.kind === 'mavlink') && (
          <label className="flex items-center gap-1" title={t('camera.CameraSourceMenu.rtspTransportAutoNegotiatesUdpThen')}>
            RTSP
            <select
              value={source.rtspTransport ?? 'automatic'}
              onChange={(e) => onChange({ rtspTransport: e.target.value as 'automatic' | 'tcp' | 'udp' })}
              className="rounded bg-surface-input px-1 py-0.5 text-content"
            >
              <option value="automatic">{t('camera.CameraSourceMenu.auto')}</option>
              <option value="udp">UDP</option>
              <option value="tcp">TCP</option>
            </select>
          </label>
        )}
        <label className="ml-auto flex items-center gap-1" title={t('camera.CameraSourceMenu.lowLatencySmallJitterBufferDrop')}>
          <input type="checkbox" checked={source.lowLatency ?? false} onChange={(e) => onChange({ lowLatency: e.target.checked })} className="accent-blue-500" />
          {t('camera.CameraSourceMenu.lowLatency')}
        </label>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-content-secondary">
        <label className="flex items-center gap-1" title={t('camera.CameraSourceMenu.mirrorTip')}>
          <input type="checkbox" checked={source.mirror ?? false} onChange={(e) => onChange({ mirror: e.target.checked || undefined })} className="accent-blue-500" />
          {t('camera.CameraSourceMenu.mirror')}
        </label>
        <label className="flex items-center gap-1" title={t('camera.CameraSourceMenu.rotate180Tip')}>
          <input type="checkbox" checked={source.rotate180 ?? false} onChange={(e) => onChange({ rotate180: e.target.checked || undefined })} className="accent-blue-500" />
          {t('camera.CameraSourceMenu.rotate180')}
        </label>
      </div>
      {source.kind === 'rtsp' && <ControlSettings source={source} onChange={onChange} />}
    </div>
  );
}

/**
 * IP-camera image controls: which API, where it is and which account (defaults from the RTSP url).
 *
 * The fields edit a draft; the camera is only contacted on "Save and check". Logging in on
 * every keystroke sent half-typed passwords, and cameras lock the account after a few of those.
 */
/**
 * What the installer picks in "Camera control". Several makes share one protocol
 * (ONVIF); the make is kept so the list shows what was picked.
 */
const CONTROL_CHOICES: Array<{ value: string; vendor: CameraControlVendor; brand?: string; label: string }> = [
  { value: 'hikvision', vendor: 'hikvision', label: 'Hikvision (ISAPI)' },
  { value: 'dahua', vendor: 'dahua', label: 'Dahua (HTTP API)' },
  { value: 'onvif', vendor: 'onvif', label: 'ONVIF' },
  { value: 'onvif:unv', vendor: 'onvif', brand: 'unv', label: 'Uniview / UNV (ONVIF)' },
  { value: 'onvif:bitrek', vendor: 'onvif', brand: 'bitrek', label: 'Bitrek (ONVIF)' },
  { value: 'onvif:ajax', vendor: 'onvif', brand: 'ajax', label: 'Ajax (ONVIF)' },
  { value: 'http', vendor: 'http', get label() { return t('camera.CameraSourceMenu.controlHttp'); } },
];

function controlChoice(control: CameraSourceConfig['control']): string {
  if (!control) return 'none';
  const withBrand = `${control.vendor}:${control.brand ?? ''}`;
  return CONTROL_CHOICES.some((c) => c.value === withBrand) ? withBrand : control.vendor;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT'] as const;

function ControlSettings({ source, onChange }: {
  source: CameraSourceConfig;
  onChange: (patch: Partial<CameraSourceConfig>) => void;
}) {
  type Control = NonNullable<CameraSourceConfig['control']>;
  const saved = source.control;
  const [draft, setDraft] = useState<Control | undefined>(saved);
  const refresh = useCameraControlStore((s) => s.refresh);
  // A different feed, or settings changed elsewhere: start from what is saved.
  useEffect(() => { setDraft(saved); }, [source.id, saved]);

  let rtspHost = '';
  try { rtspHost = source.url ? new URL(source.url).hostname : ''; } catch { /* half-typed url */ }
  const patch = (p: Partial<Control>) => setDraft((d) => ({ vendor: 'hikvision', ...d, ...p }));
  const dirty = JSON.stringify(draft ?? null) !== JSON.stringify(saved ?? null);
  const save = () => {
    onChange({ control: draft });
    if (draft) void refresh({ ...source, control: draft });
  };
  const field = 'min-w-0 rounded bg-surface-input px-1.5 py-1 text-[11px] text-content';
  const isHttp = draft?.vendor === 'http';
  const commands = draft?.commands ?? [];
  const setCommand = (id: string, p: Partial<CameraHttpCommand>) =>
    patch({ commands: commands.map((c) => (c.id === id ? { ...c, ...p } : c)) });

  return (
    <div className="mt-1.5 border-t border-subtle pt-1.5 text-[10px] text-content-secondary">
      <label className="flex items-center gap-1" title={t('camera.CameraSourceMenu.cameraControlTip')}>
        {t('camera.CameraSourceMenu.cameraControl')}
        <select
          value={controlChoice(draft)}
          onChange={(e) => {
            const choice = CONTROL_CHOICES.find((c) => c.value === e.target.value);
            if (!choice) {
              setDraft(undefined);
              onChange({ control: undefined }); // switching control off needs no check
              return;
            }
            // Address and account carry over between protocols; the make and the buttons do not.
            setDraft((d) => ({
              host: d?.host, port: d?.port, https: d?.https, username: d?.username, password: d?.password, channel: d?.channel,
              vendor: choice.vendor,
              ...(choice.brand ? { brand: choice.brand } : {}),
              ...(choice.vendor === 'http' ? { commands: d?.commands ?? [] } : {}),
            }));
          }}
          className={field}
        >
          <option value="none">{t('camera.CameraSourceMenu.cameraControlNone')}</option>
          {CONTROL_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
      {draft?.vendor === 'onvif' && <p className="mt-1 leading-snug text-content-tertiary">{t('camera.CameraSourceMenu.onvifHint')}</p>}
      {draft?.vendor === 'dahua' && <p className="mt-1 leading-snug text-content-tertiary">{t('camera.CameraSourceMenu.dahuaHint')}</p>}
      {isHttp && <p className="mt-1 leading-snug text-content-tertiary">{t('camera.CameraSourceMenu.httpHint')}</p>}
      {draft && (
        <>
          <div className="mt-1 grid grid-cols-[1fr_4.5rem_3.5rem] gap-1">
            <input
              value={draft.host ?? ''}
              onChange={(e) => patch({ host: e.target.value || undefined })}
              placeholder={rtspHost || t('camera.CameraSourceMenu.cameraHost')}
              title={t('camera.CameraSourceMenu.cameraHostTip')}
              className={`${field} font-mono`}
            />
            <input
              type="number"
              value={draft.port ?? ''}
              onChange={(e) => patch({ port: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="80"
              title={t('camera.CameraSourceMenu.httpPort')}
              className={field}
            />
            {isHttp ? <span /> : (
              <input
                type="number"
                min={1}
                value={draft.channel ?? ''}
                onChange={(e) => patch({ channel: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="1"
                title={t('camera.CameraSourceMenu.cameraChannel')}
                className={field}
              />
            )}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <input
              value={draft.username ?? ''}
              onChange={(e) => patch({ username: e.target.value || undefined })}
              placeholder={t('camera.CameraSourceMenu.userFromRtsp')}
              className={field}
              autoComplete="off"
            />
            <input
              type="password"
              value={draft.password ?? ''}
              onChange={(e) => patch({ password: e.target.value || undefined })}
              onKeyDown={(e) => { if (e.key === 'Enter' && dirty) save(); }}
              placeholder={t('camera.CameraSourceMenu.passwordFromRtsp')}
              className={field}
              autoComplete="new-password"
            />
          </div>

          {isHttp && (
            <div className="mt-1.5 flex flex-col gap-1">
              {commands.map((c) => (
                <div key={c.id} className="rounded border border-subtle p-1">
                  <div className="grid grid-cols-[1fr_4rem_1.25rem] items-center gap-1">
                    <input value={c.label} onChange={(e) => setCommand(c.id, { label: e.target.value })}
                      placeholder={t('camera.CameraSourceMenu.commandLabel')} className={field} />
                    <select value={c.method} onChange={(e) => setCommand(c.id, { method: e.target.value as CameraHttpCommand['method'] })} className={field}>
                      {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button onClick={() => patch({ commands: commands.filter((x) => x.id !== c.id) })}
                      className="text-content-tertiary hover:text-red-400" aria-label={t('camera.CameraSourceMenu.commandRemove')}>✕</button>
                  </div>
                  <input value={c.url} onChange={(e) => setCommand(c.id, { url: e.target.value })}
                    placeholder={t('camera.CameraSourceMenu.commandUrl')} className={`${field} mt-1 w-full font-mono`} />
                  {c.method !== 'GET' && (
                    <input value={c.body ?? ''} onChange={(e) => setCommand(c.id, { body: e.target.value || undefined })}
                      placeholder={t('camera.CameraSourceMenu.commandBody')} className={`${field} mt-1 w-full font-mono`} />
                  )}
                </div>
              ))}
              <button
                onClick={() => patch({ commands: [...commands, { id: crypto.randomUUID(), label: '', method: 'POST', url: '' }] })}
                className="self-start rounded border border-subtle px-2 py-0.5 text-[11px] text-content-secondary hover:text-content"
              >{t('camera.CameraSourceMenu.commandAdd')}</button>
            </div>
          )}

          <div className="mt-1.5 flex items-center gap-2">
            <button
              onClick={save}
              disabled={!dirty}
              className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-40"
            >{isHttp ? t('camera.CameraSourceMenu.save') : t('camera.CameraSourceMenu.saveAndCheck')}</button>
            {dirty && <span className="text-amber-400">{t('camera.CameraSourceMenu.notSavedYet')}</span>}
          </div>
          {saved && !dirty && (
            <div className="mt-1.5">
              <CameraControlBar source={source} editable />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The menu is drawn over the whole window, not inside the video panel: inside it, a short
 * or narrow panel cut the lower feeds off with no way to scroll to them.
 */
function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] bg-black/30" onClick={onClose} />
      <div className="fixed right-3 top-14 z-[61] flex max-h-[calc(100vh-4.5rem)] w-[28rem] max-w-[calc(100vw-1.5rem)] flex-col rounded-xl border border-default bg-surface-solid shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-subtle px-3 py-2">
          <span className="text-xs font-medium text-content">{t('camera.CameraSourceMenu.title')}</span>
          <button onClick={onClose} className="text-content-tertiary hover:text-content" aria-label={t('camera.CameraSourceMenu.close')}>✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">{children}</div>
      </div>
    </>,
    document.body,
  );
}
