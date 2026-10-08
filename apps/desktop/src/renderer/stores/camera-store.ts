/**
 * Camera store — per-vehicle source config, OSD layer toggles, view mode, and
 * the live discovery/session state pushed from the main media engine + MAVLink.
 *
 * Persistence: source configs, OSD layers, view mode and grid density are
 * persisted to localStorage so a detached camera window (its own renderer, its
 * own store instance) restores the same setup. Runtime state (sessions,
 * discovery, engine status) is NOT persisted.
 *
 * Vehicle binding model:
 *  - Each source is owned by a `vehicleKey`.
 *  - `viewMode === 'follow'` shows the active vehicle's selected source, unless
 *    `lockedVehicleKey` is set (pin this window to one vehicle).
 *  - `viewMode === 'grid'` tiles every vehicle that has a selected source.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SvtQuality } from '../components/camera/svt/svt-terrain';
import {
  type CameraSourceConfig,
  type CameraStreamSession,
  type CameraViewMode,
  type CameraRenderMode,
  type OsdLayers,
  type VideoStreamInfoIpc,
  type GimbalAttitudeIpc,
  type GimbalInfoIpc,
  type GimbalConfig,
  type MediaEngineStatus,
  DEFAULT_OSD_LAYERS,
  DEFAULT_GIMBAL_CONFIG,
} from '../../shared/camera-types';

interface CameraState {
  /** All configured sources, keyed by source id. */
  sources: Record<string, CameraSourceConfig>;
  /** The chosen source id per vehicle. */
  selectedByVehicle: Record<string, string>;

  viewMode: CameraViewMode;
  /** Live link numbers over the feed (bitrate, fps, loss). */
  showStats: boolean;
  setShowStats: (showStats: boolean) => void;
  /** Live camera feed vs. synthetic-vision world. */
  renderMode: CameraRenderMode;
  /** Auto-show synthetic vision when a live feed fails / has no feed configured. */
  syntheticFallback: boolean;
  /** Drape satellite imagery over the synthetic-vision terrain. */
  svtSatellite: boolean;
  /** Synthetic-vision terrain detail (never the near-field imagery). */
  svtQuality: SvtQuality;
  /** Pin this window to one vehicle, ignoring the active selection. Null = follow. */
  lockedVehicleKey: string | null;
  osd: OsdLayers;
  gridCols: number;
  /** Per-vehicle gimbal setup chosen by the operator. */
  gimbalByVehicle: Record<string, GimbalConfig>;

  // Runtime (not persisted)
  sessions: Record<string, CameraStreamSession>;
  videoStreams: Record<string, VideoStreamInfoIpc>;
  gimbalAttitude: Record<string, GimbalAttitudeIpc>;
  gimbalInfo: Record<string, GimbalInfoIpc>;
  engineStatus: MediaEngineStatus | null;
  /** Bumped by the Reconnect button; the player restarts that feed when its count changes. */
  reconnectRequests: Record<string, number>;
  /** Digital zoom per source: factor and the frame point (0..1) shown at the centre. */
  zoom: Record<string, CameraZoom>;
  /** The one feed whose sound is on; every other stays muted so two cameras never talk over each other. */
  audibleSourceId: string | null;

  // Config actions
  /** Rebind persisted per-vehicle config from stale vehicle keys (transport id rotates on reconnect) to live ones by sysid suffix. */
  adoptLiveVehicles: (liveKeys: string[]) => void;
  addSource: (source: CameraSourceConfig) => void;
  updateSource: (id: string, patch: Partial<CameraSourceConfig>) => void;
  removeSource: (id: string) => void;
  setSelectedSource: (vehicleKey: string, sourceId: string | null) => void;

  setViewMode: (mode: CameraViewMode) => void;
  setRenderMode: (mode: CameraRenderMode) => void;
  setSyntheticFallback: (on: boolean) => void;
  setSvtSatellite: (on: boolean) => void;
  setSvtQuality: (quality: SvtQuality) => void;
  setLockedVehicle: (vehicleKey: string | null) => void;
  toggleOsd: (layer: keyof OsdLayers) => void;
  setGridCols: (cols: number) => void;
  setGimbalConfig: (vehicleKey: string, patch: Partial<GimbalConfig>) => void;

  // Runtime actions
  setSession: (session: CameraStreamSession) => void;
  clearSession: (sourceId: string) => void;
  recordVideoStream: (info: VideoStreamInfoIpc) => void;
  recordGimbalAttitude: (att: GimbalAttitudeIpc) => void;
  recordGimbalInfo: (info: GimbalInfoIpc) => void;
  setEngineStatus: (status: MediaEngineStatus) => void;
  requestReconnect: (sourceId: string) => void;
  setZoom: (sourceId: string, zoom: CameraZoom | null) => void;
  setAudibleSource: (sourceId: string | null) => void;
}

export interface CameraZoom { z: number; cx: number; cy: number }

/** Highest digital zoom: past this an IP camera's pixels are just blocks. */
export const MAX_ZOOM = 8;

/** Keeps the view inside the frame: the centre can only move as far as the zoom leaves room. */
export function clampZoom(zoom: CameraZoom): CameraZoom | null {
  const z = Math.min(MAX_ZOOM, Math.max(1, zoom.z));
  if (z <= 1.001) return null;
  const half = 0.5 / z;
  return { z, cx: Math.min(1 - half, Math.max(half, zoom.cx)), cy: Math.min(1 - half, Math.max(half, zoom.cy)) };
}

/**
 * The vehicle key cameras are filed under while no vehicle is connected. Feeds already set
 * up keep their key; with none, a stand-in is used whose "1.1" (system 1, component 1) is
 * what adoptLiveVehicles matches when the vehicle does connect, so the feeds move to it.
 */
export const OFFLINE_VEHICLE_KEY = 'offline:1.1';
export function offlineVehicleKey(sources: Record<string, CameraSourceConfig>, selectedByVehicle: Record<string, string> = {}): string {
  const all = Object.values(sources);
  // The vehicle whose feed is the chosen one first: it is the one last worked with.
  const chosen = all.find((s) => selectedByVehicle[s.vehicleKey] === s.id);
  return (chosen ?? all[0])?.vehicleKey ?? OFFLINE_VEHICLE_KEY;
}

export const useCameraStore = create<CameraState>()(
  persist(
    (set, get) => ({
      sources: {},
      selectedByVehicle: {},
      viewMode: 'follow',
      showStats: false,
      setShowStats: (showStats) => set({ showStats }),
      renderMode: 'live',
      syntheticFallback: true,
      svtSatellite: false,
      svtQuality: 'medium',
      lockedVehicleKey: null,
      osd: { ...DEFAULT_OSD_LAYERS },
      gridCols: 2,
      gimbalByVehicle: {},

      sessions: {},
      videoStreams: {},
      reconnectRequests: {},
      zoom: {},
      audibleSourceId: null,
      gimbalAttitude: {},
      gimbalInfo: {},
      engineStatus: null,

      adoptLiveVehicles: (liveKeys) =>
        set((s) => {
          const suffix = (k: string) => k.slice(k.indexOf(':'));
          const live = new Set(liveKeys);
          const staleKeys = new Set(
            [
              ...Object.values(s.sources).map((src) => src.vehicleKey),
              ...Object.keys(s.selectedByVehicle),
              ...Object.keys(s.gimbalByVehicle),
              ...(s.lockedVehicleKey ? [s.lockedVehicleKey] : []),
            ].filter((k) => !live.has(k)),
          );
          // Rebind only unambiguous sysid matches.
          const rebind = new Map<string, string>();
          for (const stale of staleKeys) {
            const matches = liveKeys.filter((lk) => suffix(lk) === suffix(stale));
            if (matches.length === 1) rebind.set(stale, matches[0]!);
            // Feeds set up with no vehicle connected belong to the only vehicle there is, whatever its system id.
            else if (stale === OFFLINE_VEHICLE_KEY && matches.length === 0 && liveKeys.length === 1) rebind.set(stale, liveKeys[0]!);
          }
          if (rebind.size === 0) return {};
          const mapKey = (k: string) => rebind.get(k) ?? k;
          return {
            sources: Object.fromEntries(
              Object.entries(s.sources).map(([id, src]) => [id, { ...src, vehicleKey: mapKey(src.vehicleKey) }]),
            ),
            selectedByVehicle: Object.fromEntries(
              Object.entries(s.selectedByVehicle).map(([k, v]) => [mapKey(k), v]),
            ),
            gimbalByVehicle: Object.fromEntries(
              Object.entries(s.gimbalByVehicle).map(([k, v]) => [mapKey(k), v]),
            ),
            lockedVehicleKey: s.lockedVehicleKey ? mapKey(s.lockedVehicleKey) : s.lockedVehicleKey,
          };
        }),

      addSource: (source) =>
        set((s) => ({
          sources: { ...s.sources, [source.id]: source },
          // First source for a vehicle becomes its selection automatically.
          selectedByVehicle: s.selectedByVehicle[source.vehicleKey]
            ? s.selectedByVehicle
            : { ...s.selectedByVehicle, [source.vehicleKey]: source.id },
        })),

      updateSource: (id, patch) =>
        set((s) => {
          const existing = s.sources[id];
          if (!existing) return s;
          return { sources: { ...s.sources, [id]: { ...existing, ...patch } } };
        }),

      removeSource: (id) =>
        set((s) => {
          const next = { ...s.sources };
          const removed = next[id];
          delete next[id];
          const selected = { ...s.selectedByVehicle };
          if (removed && selected[removed.vehicleKey] === id) {
            // Fall back to any other source owned by the same vehicle.
            const fallback = Object.values(next).find((x) => x.vehicleKey === removed.vehicleKey);
            if (fallback) selected[removed.vehicleKey] = fallback.id;
            else delete selected[removed.vehicleKey];
          }
          return { sources: next, selectedByVehicle: selected };
        }),

      setSelectedSource: (vehicleKey, sourceId) =>
        set((s) => {
          const selected = { ...s.selectedByVehicle };
          if (sourceId) selected[vehicleKey] = sourceId;
          else delete selected[vehicleKey];
          return { selectedByVehicle: selected };
        }),

      setViewMode: (viewMode) => set({ viewMode }),
      setRenderMode: (renderMode) => set({ renderMode }),
      setSyntheticFallback: (syntheticFallback) => set({ syntheticFallback }),
      setSvtSatellite: (svtSatellite) => set({ svtSatellite }),
      setSvtQuality: (svtQuality) => set({ svtQuality }),
      setLockedVehicle: (lockedVehicleKey) => set({ lockedVehicleKey }),
      toggleOsd: (layer) => set((s) => ({ osd: { ...s.osd, [layer]: !s.osd[layer] } })),
      setGridCols: (gridCols) => set({ gridCols: Math.max(1, Math.min(4, gridCols)) }),

      setGimbalConfig: (vehicleKey, patch) =>
        set((s) => ({
          gimbalByVehicle: {
            ...s.gimbalByVehicle,
            [vehicleKey]: { ...DEFAULT_GIMBAL_CONFIG, ...s.gimbalByVehicle[vehicleKey], ...patch },
          },
        })),

      setSession: (session) =>
        set((s) => ({ sessions: { ...s.sessions, [session.sourceId]: session } })),
      clearSession: (sourceId) =>
        set((s) => {
          const next = { ...s.sessions };
          delete next[sourceId];
          return { sessions: next };
        }),

      recordVideoStream: (info) =>
        set((s) => ({ videoStreams: { ...s.videoStreams, [info.vehicleKey]: info } })),
      requestReconnect: (sourceId) =>
        set((s) => ({ reconnectRequests: { ...s.reconnectRequests, [sourceId]: (s.reconnectRequests[sourceId] ?? 0) + 1 } })),
      setAudibleSource: (audibleSourceId) => set({ audibleSourceId }),
      setZoom: (sourceId, zoom) =>
        set((s) => {
          const next = { ...s.zoom };
          const clamped = zoom ? clampZoom(zoom) : null;
          if (clamped) next[sourceId] = clamped; else delete next[sourceId];
          return { zoom: next };
        }),
      recordGimbalAttitude: (att) =>
        set((s) => ({ gimbalAttitude: { ...s.gimbalAttitude, [att.vehicleKey]: att } })),
      recordGimbalInfo: (info) =>
        set((s) => ({ gimbalInfo: { ...s.gimbalInfo, [info.vehicleKey]: info } })),
      setEngineStatus: (engineStatus) => set({ engineStatus }),
    }),
    {
      name: 'ardudeck-camera',
      storage: createJSONStorage(() => localStorage),
      // Persist config only — never the volatile runtime maps.
      partialize: (s) => ({
        sources: s.sources,
        selectedByVehicle: s.selectedByVehicle,
        viewMode: s.viewMode,
        showStats: s.showStats,
        renderMode: s.renderMode,
        syntheticFallback: s.syntheticFallback,
        svtSatellite: s.svtSatellite,
        svtQuality: s.svtQuality,
        osd: s.osd,
        gridCols: s.gridCols,
        gimbalByVehicle: s.gimbalByVehicle,
      }),
    },
  ),
);

/** Sources owned by a given vehicle. */
export function sourcesForVehicle(state: CameraState, vehicleKey: string): CameraSourceConfig[] {
  return Object.values(state.sources).filter((s) => s.vehicleKey === vehicleKey);
}

/**
 * The configured live source to show behind the OSD preview for a target
 * vehicle, or null when nothing is set up. Shares the exact same config the
 * telemetry camera panel uses (same `selectedByVehicle` map).
 */
export function osdBackdropSource(
  state: Pick<CameraState, 'sources' | 'selectedByVehicle'>,
  targetKey: string | null,
): CameraSourceConfig | null {
  if (!targetKey) return null;
  const id = state.selectedByVehicle[targetKey];
  if (!id) return null;
  return state.sources[id] ?? null;
}

// Every window (main, pop-outs) has its own copy of this store over one shared
// localStorage entry. Without this a change made in one window - a feed switched to SD
// in a pop-out - would be overwritten by the next write from another. The browser
// tells the OTHER windows when the entry changes; they reload it.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'ardudeck-camera') void useCameraStore.persist.rehydrate();
  });
}
