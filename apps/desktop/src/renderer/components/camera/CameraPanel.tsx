/**
 * Camera panel — detachable, theme-aware, single- and multi-vehicle aware.
 *
 * View modes (toggleable in the chrome):
 *  - Follow: shows the active vehicle's live feed and auto-switches when the
 *    fleet selection changes. A lock pin freezes the panel to one vehicle, so
 *    you can pop out several windows and lock each = a video wall.
 *  - Grid: tiles every vehicle that has a configured feed; the active one is
 *    highlighted and clicking a tile makes that vehicle active.
 *
 * The detach/pin/dock-back chrome and theme sync come from the existing
 * detached-window system — this component only fills its container.
 */

import { useEffect, useMemo, useState } from 'react';
import { Camera, Circle, Layers, RotateCw, SlidersHorizontal } from 'lucide-react';
import { useActiveVehicleStore } from '../../stores/active-vehicle-store';
import { useFleetVehicles, type FleetVehicle } from '../../hooks/useFleet';
import { useCameraStore } from '../../stores/camera-store';
import type { OsdLayers, CameraRenderMode, CameraSourceConfig } from '../../../shared/camera-types';
import { CameraView } from './CameraView';
import { CameraControlBar, hasCameraControls } from './CameraControlBar';
import { SyntheticVisionView } from './SyntheticVisionView';
import { CameraSourceMenu } from './CameraSourceMenu';
import { GimbalPad } from './GimbalPad';
import { VisionStreamControl } from './VisionStream';
import { CameraSourceSwitch } from './CameraSourceSwitch';
import { VideoLinkBanner } from './VideoLinkBanner';
import { describePeers } from './webrtc-diag';
import { t as tr } from '../../i18n';

// Partial: the `waypoints` layer intentionally has no OSD toggle — the 3D
// waypoint overlay is toggled from the HUD instruments editor (HudPanel) via the
// `waypoints` HUD widget, so there is one control and no dead duplicate here.
const OSD_LABELS: Partial<Record<keyof OsdLayers, string>> = {
  get cornerTelemetry() { return tr('camera.CameraPanel.osdTelemetry'); },
  get crosshair() { return tr('camera.CameraPanel.osdCrosshair'); },
  get northIndicator() { return tr('camera.CameraPanel.osdCompass'); },
  get frameCenterCoords() { return tr('camera.CameraPanel.centerCoords'); },
  get artificialHorizon() { return tr('camera.CameraPanel.osdHorizon'); },
  get hud() { return tr('camera.CameraPanel.flightHud'); },
};

const ICON_BTN =
  'flex h-6 w-6 items-center justify-center rounded text-content-secondary hover:bg-surface-raised disabled:opacity-40';

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] text-content hover:bg-surface-raised"
    >
      {children}
    </button>
  );
}

export function CameraPanel() {
  const activeVehicleKey = useActiveVehicleStore((s) => s.activeVehicleKey);
  const setActive = useActiveVehicleStore((s) => s.setActive);
  const fleet = useFleetVehicles();

  const store = useCameraStore();
  const { viewMode, renderMode, syntheticFallback, lockedVehicleKey, osd, gridCols } = store;

  const [showSources, setShowSources] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showOsdMenu, setShowOsdMenu] = useState(false);
  const [recordingSourceId, setRecordingSourceId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState<string | null>(null);

  const handleInstallEngine = async () => {
    setInstalling(true);
    const off = window.electronAPI.onCameraEngineInstallLog((line) => setInstallLog(line));
    try {
      const status = await window.electronAPI.cameraEngineInstall();
      store.setEngineStatus(status);
    } finally {
      off();
      setInstalling(false);
      setInstallLog(null);
    }
  };

  // Mirror MAVLink camera/gimbal discovery into the store.
  useEffect(() => {
    const offVid = window.electronAPI.onCameraVideoStreamInfo((i) => store.recordVideoStream(i));
    const offAtt = window.electronAPI.onCameraGimbalAttitude((a) => store.recordGimbalAttitude(a));
    const offInfo = window.electronAPI.onCameraGimbalInfo((i) => store.recordGimbalInfo(i));
    void window.electronAPI.cameraEngineStatus().then((s) => store.setEngineStatus(s));
    return () => { offVid(); offAtt(); offInfo(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transport ids rotate on reconnect, orphaning exact-key lookups.
  const fleetKeys = useMemo(() => fleet.map((v) => v.key).sort().join('|'), [fleet]);
  useEffect(() => {
    if (fleetKeys.length > 0) useCameraStore.getState().adoptLiveVehicles(fleetKeys.split('|'));
  }, [fleetKeys]);

  // The vehicle this panel is bound to (lock wins, else the active selection).
  const targetKey = lockedVehicleKey ?? activeVehicleKey;
  const targetVehicle = useMemo(() => fleet.find((v) => v.key === targetKey) ?? null, [fleet, targetKey]);

  const vehiclesWithFeeds = useMemo(
    () => fleet.filter((v) => store.selectedByVehicle[v.key]),
    [fleet, store.selectedByVehicle],
  );
  // Synthetic vision needs no feed — tile every vehicle instead.
  const gridVehicles = renderMode === 'synthetic' ? fleet : vehiclesWithFeeds;

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const liveSourceId = targetKey ? store.selectedByVehicle[targetKey] : undefined;
  const liveSource = liveSourceId ? store.sources[liveSourceId] : undefined;
  const targetSources = useMemo(
    () => (targetKey ? Object.values(store.sources).filter((s) => s.vehicleKey === targetKey) : []),
    [store.sources, targetKey],
  );
  // The feeds grid only makes sense live and with more than one feed; otherwise fall back to one.
  const feedsMode = viewMode === 'feeds' && renderMode === 'live' && targetSources.length > 1;
  const showFeedControls = renderMode === 'live' && !feedsMode && !!liveSource && hasCameraControls(liveSource);
  const showGimbal = renderMode === 'live' && !!targetVehicle && (store.gimbalByVehicle[targetVehicle.key]?.mode ?? 'auto') !== 'off';

  const handleSnapshot = async () => {
    if (!liveSourceId) return;
    const r = await window.electronAPI.cameraSnapshot(liveSourceId);
    flash(r.ok ? tr('camera.CameraPanel.snapshotSaved') : tr('camera.CameraPanel.snapshotFailed', { v1: r.error ?? '' }));
  };

  const handleRecord = async () => {
    if (!liveSourceId) return;
    const r = await window.electronAPI.cameraRecordToggle(liveSourceId);
    if (!r.ok) { flash(tr('camera.CameraPanel.recordFailed', { v1: r.error ?? '' })); return; }
    if (recordingSourceId === liveSourceId) { setRecordingSourceId(null); flash(tr('camera.CameraPanel.recordingSaved')); }
    else { setRecordingSourceId(liveSourceId); flash(tr('camera.CameraPanel.recordingStarted')); }
  };

  const engine = store.engineStatus;

  return (
    <div className="relative flex h-full flex-col bg-surface">
      {/* Chrome */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-subtle bg-surface px-2 py-1.5">
        <span className="text-xs font-medium text-content">{tr('camera.CameraPanel.vision')}</span>
        {targetVehicle && <span className="text-[11px] text-content-secondary">· {targetVehicle.label}</span>}

        {/* Live feed / Synthetic vision toggle */}
        <div className="ml-1 flex overflow-hidden rounded-md border border-subtle">
          {(['live', 'synthetic'] as const).map((m) => (
            <button
              key={m}
              onClick={() => store.setRenderMode(m)}
              className={`px-2 py-0.5 text-[11px] transition-colors ${renderMode === m ? 'bg-surface-raised text-content' : 'text-content-secondary hover:bg-surface-raised'}`}
              title={m === 'live' ? tr('camera.CameraPanel.liveCameraFeed') : tr('camera.CameraPanel.syntheticVision3dTerrainFromGps')}
            >{m === 'live' ? tr('camera.CameraPanel.live') : tr('camera.CameraPanel.synthetic')}</button>
          ))}
        </div>

        {renderMode === 'live' && viewMode === 'follow' && targetKey && <CameraSourceSwitch vehicleKey={targetKey} />}

        {/* One feed / every feed of this vehicle side by side */}
        {renderMode === 'live' && targetSources.length > 1 && (
          <div className="ml-1 flex overflow-hidden rounded-md border border-subtle">
            {(['follow', 'feeds'] as const).map((m) => (
              <button
                key={m}
                onClick={() => store.setViewMode(m)}
                className={`px-2 py-0.5 text-[11px] transition-colors ${viewMode === m ? 'bg-surface-raised text-content' : 'text-content-secondary hover:bg-surface-raised'}`}
                data-tip={m === 'follow' ? tr('camera.CameraPanel.oneFeedTip') : tr('camera.CameraPanel.allFeedsTip')}
              >{m === 'follow' ? tr('camera.CameraPanel.oneFeed') : tr('camera.CameraPanel.allFeeds')}</button>
            ))}
          </div>
        )}

        {/* Follow / Grid toggle */}
        {fleet.length > 1 && (
          <div className="ml-1 flex overflow-hidden rounded-md border border-subtle">
            {(['follow', 'grid'] as const).map((m) => (
              <button
                key={m}
                onClick={() => store.setViewMode(m)}
                className={`px-2 py-0.5 text-[11px] transition-colors ${viewMode === m ? 'bg-surface-raised text-content' : 'text-content-secondary hover:bg-surface-raised'}`}
              >{m === 'follow' ? tr('camera.CameraPanel.follow') : tr('camera.CameraPanel.vehicleGrid')}</button>
            ))}
          </div>
        )}

        {/* Lock to vehicle (follow mode) */}
        {viewMode === 'follow' && (
          <button
            onClick={() => store.setLockedVehicle(lockedVehicleKey ? null : activeVehicleKey)}
            className={`rounded px-1.5 py-0.5 text-[11px] ${lockedVehicleKey ? 'bg-blue-500/20 text-blue-300' : 'text-content-secondary hover:bg-surface-raised'}`}
            title={lockedVehicleKey ? tr('camera.CameraPanel.lockedToThisVehicleClickTo') : tr('camera.CameraPanel.lockThisPanelToTheCurrent')}
          >{lockedVehicleKey ? tr('camera.CameraPanel.locked') : tr('camera.CameraPanel.follow')}</button>
        )}

        {(viewMode === 'grid' || feedsMode) && (
          <select
            value={gridCols}
            onChange={(e) => store.setGridCols(Number(e.target.value))}
            className="rounded border border-subtle bg-surface-input px-1 py-0.5 text-[11px] text-content"
            title={tr('camera.CameraPanel.gridColumns')}
          >
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}×</option>)}
          </select>
        )}

        <div className="flex-1" />

        {/* Capture — live feed only */}
        {renderMode === 'live' && (
          <>
            <button
              onClick={() => { if (liveSourceId) store.requestReconnect(liveSourceId); }}
              disabled={!liveSourceId}
              className={ICON_BTN}
              data-tip={tr('camera.CameraPanel.reconnectTheFeedNow')}
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            <button onClick={handleSnapshot} disabled={!liveSourceId} className={ICON_BTN} data-tip={tr('camera.CameraPanel.snapshot')}>
              <Camera className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleRecord}
              disabled={!liveSourceId}
              className={`${ICON_BTN} ${recordingSourceId ? 'bg-red-500/20 text-red-300' : ''}`}
              data-tip={recordingSourceId === liveSourceId ? tr('camera.CameraPanel.stopRecording') : tr('camera.CameraPanel.record')}
            >
              <Circle className={`h-3 w-3 ${recordingSourceId === liveSourceId ? 'fill-current' : ''}`} />
            </button>
          </>
        )}

        {renderMode === 'synthetic' && <VisionStreamControl />}

        {/* What is drawn over the feed */}
        <div className="relative flex items-center">
          <button
            onClick={() => setShowOsdMenu((v) => !v)}
            className={`${ICON_BTN} ${store.showStats ? 'text-emerald-300' : ''}`}
            data-tip={tr('camera.CameraPanel.overlaysOsdLayersLinkStatsTerrain')}
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
          {showOsdMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowOsdMenu(false)} />
              <div className="absolute right-0 top-7 z-40 w-52 rounded-lg border border-default bg-surface-solid p-1.5 shadow-xl">
                <div className="px-1.5 pb-1 text-[10px] uppercase tracking-wide text-content-tertiary">{tr('camera.CameraPanel.osdLayers')}</div>
                {(Object.keys(OSD_LABELS) as (keyof OsdLayers)[]).map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] text-content hover:bg-surface-raised">
                    <input type="checkbox" checked={osd[k]} onChange={() => store.toggleOsd(k)} className="accent-blue-500" />
                    {OSD_LABELS[k]}
                  </label>
                ))}

                <div className="mt-1 border-t border-subtle pt-1">
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] text-content hover:bg-surface-raised">
                    <input
                      type="checkbox"
                      checked={store.showStats}
                      onChange={() => store.setShowStats(!store.showStats)}
                      className="accent-blue-500"
                    />
                    {tr('camera.CameraPanel.linkStats')}
                  </label>
                  <div className="px-1.5 pb-1 text-[10px] leading-snug text-content-tertiary">
                    {tr('camera.CameraPanel.bitrateFrameratePacketLossAndDropped')}
                  </div>
                </div>

                {renderMode === 'synthetic' && (
                  <div className="mt-1 border-t border-subtle pt-1">
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] text-content hover:bg-surface-raised">
                      <input
                        type="checkbox"
                        checked={store.svtSatellite}
                        onChange={(e) => store.setSvtSatellite(e.target.checked)}
                        className="accent-blue-500"
                      />
                      {tr('camera.CameraPanel.satelliteImagery')}
                    </label>
                    <div className="px-1.5 pb-1 text-[10px] uppercase tracking-wide text-content-tertiary">{tr('camera.CameraPanel.terrainDetail')}</div>
                    <div className="flex overflow-hidden rounded-md border border-subtle">
                      {(['low', 'medium', 'high'] as const).map((q) => (
                        <button
                          key={q}
                          onClick={() => store.setSvtQuality(q)}
                          className={`flex-1 px-1.5 py-0.5 text-[11px] capitalize transition-colors ${store.svtQuality === q ? 'bg-surface-raised text-content' : 'text-content-secondary hover:bg-surface-raised'}`}
                          title={q === 'low' ? tr('camera.CameraPanel.fewerElevationSamplesLightestOnThe') : q === 'high' ? tr('camera.CameraPanel.mostElevationDetailHeaviestToLoad') : tr('camera.CameraPanel.balanced')}
                        >{q}</button>
                      ))}
                    </div>
                    <div className="px-1.5 pt-1 text-[10px] leading-snug text-content-tertiary">
                      {tr('camera.CameraPanel.theGroundNearestTheAircraftAlways')}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Setup and support */}
        <div className="relative flex items-center">
          <button
            onClick={() => setShowMoreMenu((v) => !v)}
            className={ICON_BTN}
            data-tip={tr('camera.CameraPanel.feedsAndDiagnostics')}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
          {showMoreMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowMoreMenu(false)} />
              <div className="absolute right-0 top-7 z-40 w-48 rounded-lg border border-default bg-surface-solid p-1.5 shadow-xl">
                <MenuItem
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowSources(true);
                  }}
                >
                  {tr('camera.CameraPanel.configureFeeds')}
                </MenuItem>
                <MenuItem
                  onClick={async () => {
                    setShowMoreMenu(false);
                    const text = await window.electronAPI.cameraDiagnostics();
                    await navigator.clipboard.writeText(`${text}\n--- webrtc (this window) ---\n${await describePeers()}`);
                    flash(tr('camera.CameraPanel.videoDiagnosticsCopied'));
                  }}
                >
                  {tr('camera.CameraPanel.copyDiagnostics')}
                </MenuItem>
                <div className="px-1.5 pt-1 text-[10px] leading-snug text-content-tertiary">
                  {tr('camera.CameraPanel.binaryPathsVersionsHubAndFfmpeg')}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {engine && !engine.hubReady && engine.detail && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
          <span className="flex-1">{installing ? (installLog ?? tr('camera.CameraPanel.installingVideoEngine')) : engine.detail}</span>
          <button
            onClick={handleInstallEngine}
            disabled={installing}
            className="shrink-0 rounded bg-amber-500/20 px-2 py-0.5 font-medium text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
          >{installing ? '…' : tr('camera.CameraPanel.install')}</button>
        </div>
      )}

      {/* Body */}
      <div className="relative min-h-0 flex-1">
        {feedsMode ? (
          <FeedsBody
            sources={targetSources}
            selectedId={liveSourceId}
            vehicle={targetVehicle}
            isActiveVehicle={targetKey === activeVehicleKey}
            osd={osd}
            gridCols={gridCols}
            onSelect={(id) => { if (targetKey) store.setSelectedSource(targetKey, id); }}
          />
        ) : viewMode !== 'grid' ? (
          <FollowBody renderMode={renderMode} syntheticFallback={syntheticFallback} targetVehicle={targetVehicle} targetKey={targetKey} activeKey={activeVehicleKey} osd={osd} liveSourceId={liveSourceId} onAddSource={() => setShowSources(true)} />
        ) : (
          <GridBody renderMode={renderMode} syntheticFallback={syntheticFallback} vehicles={gridVehicles} activeKey={activeVehicleKey} osd={osd} gridCols={gridCols} onActivate={(v) => setActive(v.transportId, v.key)} />
        )}

        {showSources && <CameraSourceMenu vehicleKey={targetKey} onClose={() => setShowSources(false)} />}
        {toast && <div className="absolute bottom-14 left-1/2 -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-[11px] text-white">{toast}</div>}
      </div>

      {/* Gimbal footer — live feed only (synthetic vision has no physical mount) */}
      {(showGimbal || showFeedControls) && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-subtle bg-surface px-2 py-1.5">
          {showFeedControls && liveSource && <CameraControlBar source={liveSource} />}
          {showGimbal && <GimbalPad vehicleKey={targetKey} />}
        </div>
      )}
    </div>
  );
}

function FollowBody({ renderMode, syntheticFallback, targetVehicle, targetKey, activeKey, osd, liveSourceId, onAddSource }: {
  renderMode: CameraRenderMode;
  syntheticFallback: boolean;
  targetVehicle: FleetVehicle | null;
  targetKey: string | null;
  activeKey: string | null;
  osd: OsdLayers;
  liveSourceId: string | undefined;
  onAddSource: () => void;
}) {
  const source = useCameraStore((s) => (liveSourceId ? s.sources[liveSourceId] : undefined));
  const [erroredId, setErroredId] = useState<string | null>(null);
  const [lostAt, setLostAt] = useState<number | null>(null);
  // Re-arm the live feed whenever the source or the mode changes.
  useEffect(() => { setErroredId(null); setLostAt(null); }, [source?.id, renderMode]);

  if (!targetKey) {
    return <Empty>{tr('camera.CameraPanel.noVehicleSelectedConnectOrSelect')}</Empty>;
  }

  const isPrimary = targetKey === activeKey;

  // Live mode with no configured feed → prompt to add one. Do NOT silently show
  // synthetic here; that only happens in Synthetic mode or when a real feed fails.
  if (renderMode === 'live' && !source) {
    return (
      <Empty>
        {tr('camera.CameraPanel.noFeedConfiguredFor')} {targetVehicle?.label ?? 'this vehicle'}.
        <button onClick={onAddSource} className="ml-1 text-blue-400 hover:underline">{tr('camera.CameraPanel.addAFeed')}</button>
        <span className="mx-1 text-content-tertiary">{tr('camera.CameraPanel.orSwitchTo')}</span>
        <span className="text-content-secondary">{tr('camera.CameraPanel.synthetic')}</span>.
      </Empty>
    );
  }

  // Synthetic mode always; Live mode only falls back to synthetic when the
  // configured feed actually errored AND the vehicle has a position fix -
  // otherwise synthetic just shows a "needs GPS" dead end that hides the real
  // camera error, so keep the CameraView's own error state instead.
  if (renderMode === 'synthetic' || !source) {
    return <SyntheticVisionView vehicle={targetVehicle} isPrimary={isPrimary} osd={osd} />;
  }

  // The feed stays mounted under the fallback so it keeps retrying; its first frame lifts it.
  // A dropout at range shows synthetic vision too: it is what gets the pilot home.
  const feedErrored = erroredId === source.id;
  const showFallback = syntheticFallback && (feedErrored || lostAt !== null) && !!targetVehicle?.position;
  return (
    <div className="relative h-full w-full">
      <CameraView
        source={source}
        vehicle={targetVehicle}
        isPrimary={isPrimary}
        osd={osd}
        onError={() => { if (syntheticFallback) setErroredId(source.id); }}
        onLive={() => { setErroredId(null); setLostAt(null); }}
        onSignalLost={() => setLostAt((t) => t ?? Date.now())}
      />
      {showFallback && (
        <div className="absolute inset-0">
          <SyntheticVisionView vehicle={targetVehicle} isPrimary={isPrimary} osd={osd} />
          <VideoLinkBanner lostAt={lostAt} />
        </div>
      )}
    </div>
  );
}

function GridBody({ renderMode, syntheticFallback, vehicles, activeKey, osd, gridCols, onActivate }: {
  renderMode: CameraRenderMode;
  syntheticFallback: boolean;
  vehicles: FleetVehicle[];
  activeKey: string | null;
  osd: OsdLayers;
  gridCols: number;
  onActivate: (v: FleetVehicle) => void;
}) {
  if (vehicles.length === 0) {
    return (
      <Empty>
        {renderMode === 'synthetic'
          ? tr('camera.CameraPanel.noVehiclesToShow')
          : tr('camera.CameraPanel.noFeedsConfiguredOpenSourcesTo')}
      </Empty>
    );
  }
  return (
    <div className="grid h-full w-full gap-1 p-1" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
      {vehicles.map((v) => (
        <GridTile key={v.key} renderMode={renderMode} syntheticFallback={syntheticFallback} vehicle={v} isActive={v.key === activeKey} osd={osd} onActivate={() => onActivate(v)} />
      ))}
    </div>
  );
}

function GridTile({ renderMode, syntheticFallback, vehicle, isActive, osd, onActivate }: {
  renderMode: CameraRenderMode;
  syntheticFallback: boolean;
  vehicle: FleetVehicle;
  isActive: boolean;
  osd: OsdLayers;
  onActivate: () => void;
}) {
  const sourceId = useCameraStore((s) => s.selectedByVehicle[vehicle.key]);
  const source = useCameraStore((s) => (sourceId ? s.sources[sourceId] : undefined));
  const [errored, setErrored] = useState(false);
  const [lostAt, setLostAt] = useState<number | null>(null);
  useEffect(() => { setErrored(false); setLostAt(null); }, [source?.id, renderMode]);

  // Live tile with no feed: render nothing rather than silently swapping to synthetic.
  if (renderMode === 'live' && !source) return null;

  // Same GPS-fix guard as the follow view: don't swap a failed feed for a
  // GPS-less synthetic tile.
  const showFallback = syntheticFallback && (errored || lostAt !== null) && !!vehicle.position;
  return (
    <div className={`relative overflow-hidden rounded ${isActive ? 'ring-2 ring-blue-500' : 'ring-1 ring-white/10'}`}>
      {renderMode === 'synthetic' || !source ? (
        <SyntheticVisionView vehicle={vehicle} isPrimary={isActive} osd={osd} onActivate={onActivate} />
      ) : (
        <>
          <CameraView
            source={source}
            vehicle={vehicle}
            isPrimary={isActive}
            osd={osd}
            onActivate={onActivate}
            onError={() => { if (syntheticFallback) setErrored(true); }}
            onLive={() => { setErrored(false); setLostAt(null); }}
            onSignalLost={() => setLostAt((t) => t ?? Date.now())}
          />
          {showFallback && (
            <div className="absolute inset-0">
              <SyntheticVisionView vehicle={vehicle} isPrimary={isActive} osd={osd} onActivate={onActivate} />
              <VideoLinkBanner lostAt={lostAt} compact />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Every feed of one vehicle at once; the selected one is the live feed (snapshot, record, click-to-point). */
function FeedsBody({ sources, selectedId, vehicle, isActiveVehicle, osd, gridCols, onSelect }: {
  sources: CameraSourceConfig[];
  selectedId: string | undefined;
  vehicle: FleetVehicle | null;
  isActiveVehicle: boolean;
  osd: OsdLayers;
  gridCols: number;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid h-full w-full auto-rows-fr gap-1 p-1" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
      {sources.map((s) => {
        const selected = s.id === selectedId;
        // Name and controls get their own strips: overlaid, they covered the OSD corners.
        return (
          <div key={s.id} className={`flex min-h-0 flex-col overflow-hidden rounded ${selected ? 'ring-2 ring-blue-500' : 'ring-1 ring-white/10'}`}>
            <button
              onClick={() => onSelect(s.id)}
              className={`shrink-0 truncate px-1.5 py-0.5 text-left text-[10px] font-medium ${selected ? 'bg-blue-600/80 text-white' : 'bg-surface-raised text-content-secondary hover:text-content'}`}
            >
              {s.label}{selected ? ` · ${tr('camera.CameraPanel.liveFeedBadge')}` : ''}
            </button>
            <div className="relative min-h-0 flex-1">
              <CameraView
                source={s}
                vehicle={vehicle}
                isPrimary={selected && isActiveVehicle}
                osd={selected ? osd : { ...osd, hud: false, artificialHorizon: false }}
                onActivate={() => onSelect(s.id)}
              />
            </div>
            {hasCameraControls(s) && (
              <div className="shrink-0 bg-surface px-1 py-0.5">
                <CameraControlBar source={s} compact />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs text-content-secondary">
      <div>{children}</div>
    </div>
  );
}
