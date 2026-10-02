/**
 * A single camera feed: owns the playback lifecycle for one source, draws the
 * OSD over it, and (for the active vehicle) turns a click into a gimbal
 * point-at-target via FOV geolocation.
 *
 * Playback paths:
 *  - uvc        -> getUserMedia(deviceId), played locally (no engine)
 *  - webrtc/*   -> main media engine returns a WHEP url; played over WebRTC
 *  The engine normalizes rtsp/rtp/srt/rubyfpv into WHEP, so the renderer only
 *  ever speaks getUserMedia or WHEP.
 */

import { useEffect, useRef, useCallback } from 'react';
import { flipTransform, panBy, viewToFrame, zoomAround, zoomTransform } from './view-transform';
import type { CameraSourceConfig, OsdLayers } from '../../../shared/camera-types';
import type { FleetVehicle } from '../../hooks/useFleet';
import { useCameraStore } from '../../stores/camera-store';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { CameraOverlays } from './CameraOverlays';
import { StreamHealthReadout } from './StreamHealthReadout';
import { useCameraStream } from './useCameraStream';
import { projectPixelToGround, projectFrameCenter, type CameraPose } from './geolocation';
import { t } from '../../i18n';

interface CameraViewProps {
  source: CameraSourceConfig;
  vehicle: FleetVehicle | null;
  /** True when this view's vehicle is the active selection (enables click-to-point + attitude). */
  isPrimary: boolean;
  osd: OsdLayers;
  /** Grid mode: clicking the tile (not point-to-target) activates the vehicle. */
  onActivate?: () => void;
  /** Fired when the feed fails to start (used to fall back to synthetic vision). */
  onError?: (error: string) => void;
  /** Fired when the first frame is shown (used to leave the synthetic fallback). */
  onLive?: () => void;
  /** Fired when a playing feed stops delivering frames (link dropout). */
  onSignalLost?: () => void;
}

export function CameraView({ source, vehicle, isPrimary, osd, onActivate, onError, onLive, onSignalLost }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const { status, error, health } = useCameraStream(source, videoRef, onError, onLive, onSignalLost);
  const zoom = useCameraStore((s) => s.zoom[source.id] ?? null);
  const setZoom = useCameraStore((s) => s.setZoom);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  // Wheel zooms toward the cursor. Native listener: React's wheel handler is passive and
  // cannot stop the page behind from scrolling.
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const current = useCameraStore.getState().zoom[source.id] ?? null;
      setZoom(source.id, zoomAround(current, px, py, e.deltaY < 0 ? 1.25 : 0.8));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [source.id, setZoom]);

  // Drag pans while zoomed; a drag must not also count as a click-to-point.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!zoom || e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = viewRef.current;
    if (!d || !zoom || !el || !e.buttons) return;
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - d.x) / rect.width;
    const dy = (e.clientY - d.y) / rect.height;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
    d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setZoom(source.id, panBy(zoom, dx, dy));
  };
  const onPointerUp = () => {
    suppressClick.current = !!drag.current?.moved;
    drag.current = null;
  };
  const showStats = useCameraStore((s) => s.showStats);
  const gimbal = useCameraStore((s) => s.gimbalAttitude[source.vehicleKey]);
  const gimbalCfg = useCameraStore((s) => s.gimbalByVehicle[source.vehicleKey]);
  const attitude = useTelemetryStore((s) => s.attitude);
  const gps = useTelemetryStore((s) => s.gps);
  const position = useTelemetryStore((s) => s.position);

  // ---- Pose for geolocation ----------------------------------------------
  const buildPose = useCallback((): CameraPose | null => {
    if (!vehicle || !vehicle.position) return null;
    const hfov = source.hfovDeg ?? 60;
    const vfov = source.vfovDeg ?? hfov * 0.5625; // assume 16:9 if unset
    // Camera bearing = vehicle heading + gimbal yaw; depression = -gimbal pitch.
    const bearingDeg = vehicle.heading + (gimbal?.yawDeg ?? 0);
    const pitchDownDeg = gimbal ? -gimbal.pitchDeg : 30; // 30° default when gimbal attitude unknown
    return {
      lat: vehicle.position[0],
      lon: vehicle.position[1],
      altMslM: vehicle.altitudeAgl, // flat-earth: treat AGL as height above ground
      bearingDeg,
      pitchDownDeg,
      hfovDeg: hfov,
      vfovDeg: vfov,
    };
  }, [vehicle, gimbal, source.hfovDeg, source.vfovDeg]);

  // Frame-center ground coordinate for the OSD readout.
  const frameCenter = osd.frameCenterCoords ? (() => {
    const pose = buildPose();
    if (!pose) return null;
    const p = projectFrameCenter(pose);
    return p ? { lat: p.lat, lon: p.lon } : null;
  })() : null;

  // ---- Click to point gimbal at target -----------------------------------
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    // Grid tiles activate their vehicle on click; only the primary view points.
    if (!isPrimary) { onActivate?.(); return; }
    // Don't fire ROI when there's no commandable gimbal (RC-driven or off).
    if (gimbalCfg && (gimbalCfg.mode === 'rc' || gimbalCfg.mode === 'off')) return;
    const pose = buildPose();
    if (!pose || !vehicle) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // What is under the cursor in the camera's own image, through zoom and mirror.
    const frame = viewToFrame((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, zoom, source);
    const u = frame.x * 2 - 1;
    const v = frame.y * 2 - 1;
    // Ground AMSL under the vehicle = its AMSL minus AGL.
    const groundAmsl = gps.alt - position.relativeAlt;
    const hit = projectPixelToGround(pose, u, v, 0);
    if (!hit) return;
    void window.electronAPI.cameraGimbalCommand(vehicle.key, {
      kind: 'point-roi', lat: hit.lat, lon: hit.lon, alt: groundAmsl, deviceId: gimbalCfg?.deviceId ?? 0,
    });
  }, [isPrimary, onActivate, buildPose, vehicle, gps.alt, position.relativeAlt, gimbalCfg, zoom, source]);

  return (
    <div
      ref={viewRef}
      className={`group relative h-full w-full overflow-hidden bg-black ${zoom ? 'cursor-grab active:cursor-grabbing' : ''}`}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      // A hint only where a click does something: a view that is neither primary nor selectable has none.
      title={isPrimary ? t('camera.CameraView.clickToPointGimbalAtTarget') : onActivate ? t('camera.CameraView.clickToMakeActive') : undefined}
    >
      <div className="h-full w-full" style={{ transform: zoomTransform(zoom), transformOrigin: 'center' }}>
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          style={{ transform: flipTransform(source) }}
          muted
          playsInline
          autoPlay
        />
      </div>

      {/* Digital zoom: wheel or these buttons; only blows pixels up, so HD gives the most to zoom into.
          Bottom centre: the four corners belong to the OSD readouts. */}
      <div
        className={`absolute bottom-1 left-1/2 -translate-x-1/2 z-10 flex items-center whitespace-nowrap gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white transition-opacity ${zoom ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button className="px-1 hover:text-blue-300" data-tip={t('camera.CameraView.zoomOut')}
          onClick={() => setZoom(source.id, zoomAround(zoom, 0.5, 0.5, 0.8))}>−</button>
        <span className="min-w-[2.5rem] text-center tabular-nums">×{(zoom?.z ?? 1).toFixed(1)}</span>
        <button className="px-1 hover:text-blue-300" data-tip={t('camera.CameraView.zoomIn')}
          onClick={() => setZoom(source.id, zoomAround(zoom, 0.5, 0.5, 1.25))}>+</button>
        {zoom && (
          <button className="ml-0.5 px-1 hover:text-blue-300" data-tip={t('camera.CameraView.zoomReset')}
            onClick={() => setZoom(source.id, null)}>1:1</button>
        )}
      </div>

      <CameraOverlays
        vehicle={vehicle}
        isPrimary={isPrimary}
        osd={osd}
        attitude={{ roll: attitude.roll, pitch: attitude.pitch }}
        frameCenter={frameCenter}
      />

      {showStats && health && status === 'live' && (
        <StreamHealthReadout health={health} />
      )}

      {status !== 'live' && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-center ${
            status === 'stalled' ? 'bg-black/75 backdrop-blur-sm' : 'bg-black/60'
          }`}
        >
          {status === 'starting' ? (
            <>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white/90" />
              <div className="text-xs text-white/70">{t('camera.CameraView.connectingTo')} {source.label}…</div>
            </>
          ) : status === 'stalled' ? (
            <>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400" />
              <div className="text-sm font-semibold text-amber-300">{t('camera.CameraView.videoStalledReconnecting')}</div>
              <div className="max-w-[80%] text-[11px] text-white/60">
                {t('camera.CameraView.theFeedStoppedDeliveringFramesRetrying')}
              </div>
              <ReconnectButton sourceId={source.id} />
            </>
          ) : (
            <>
              <div className="text-sm text-red-300">{t('camera.CameraView.noVideo')}</div>
              <ReconnectButton sourceId={source.id} />
              {/* The reason is the only diagnostic a field user can report, and
                  they report it by screenshot. Small grey text did not survive
                  that trip, so it is readable and selectable here. */}
              {error && (
                <div className="max-w-[90%] select-text rounded-md bg-black/60 px-3 py-2 text-center text-xs leading-snug text-white/90">
                  {error}
                </div>
              )}
              <div className="max-w-[80%] text-[11px] text-white/45">
                {source.kind === 'rtsp' || source.kind === 'mavlink'
                  ? `${source.url ?? t('camera.CameraView.noUrl')} · ${source.rtspTransport ?? 'automatic'}`
                  : source.kind}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ReconnectButton({ sourceId }: { sourceId: string }) {
  const requestReconnect = useCameraStore((s) => s.requestReconnect);
  return (
    <button
      onClick={() => requestReconnect(sourceId)}
      className="rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20"
    >
      {t('camera.CameraView.reconnectNow')}
    </button>
  );
}
