/**
 * What each IP camera reported about its image controls, shared by every place that
 * shows the same camera (tile, footer, source menu).
 *
 * One login per camera, not one per widget: cameras lock an account after a handful of
 * failed logins, so three widgets retrying a wrong password would lock it three times
 * as fast. For the same reason a rejected account is never retried on its own - only
 * when the settings change or the operator asks.
 */

import { create } from 'zustand';
import type { CameraControlAction, CameraControlState, CameraSourceConfig } from '../../shared/camera-types';

interface Entry {
  /** The address and account this state was read with. */
  key: string;
  state: CameraControlState | null;
  busy: boolean;
}

interface CameraControlStore {
  entries: Record<string, Entry>;
  /** Read the camera once for its current settings; no-op when already read or in progress. */
  ensure: (source: CameraSourceConfig) => void;
  /** Read again on request (Retry, or saved settings). */
  refresh: (source: CameraSourceConfig) => Promise<void>;
  apply: (source: CameraSourceConfig, action: CameraControlAction) => Promise<void>;
}

/** Changes when the camera to talk to changes: its control settings or the RTSP host it defaults to. */
export function controlKey(source: CameraSourceConfig): string {
  let host = '';
  try { host = source.url ? new URL(source.url).host : ''; } catch { /* half-typed url */ }
  return JSON.stringify([source.control ?? null, source.control?.host ? '' : host]);
}

export const useCameraControlStore = create<CameraControlStore>((set, get) => {
  const read = async (source: CameraSourceConfig, request: () => Promise<CameraControlState>) => {
    const key = controlKey(source);
    set((s) => ({ entries: { ...s.entries, [source.id]: { key, state: s.entries[source.id]?.state ?? null, busy: true } } }));
    let state: CameraControlState;
    try {
      state = await request();
    } catch (err) {
      state = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    // The settings may have changed while the camera was answering; that answer is stale.
    if (get().entries[source.id]?.key !== key) return;
    set((s) => ({ entries: { ...s.entries, [source.id]: { key, state, busy: false } } }));
  };

  return {
    entries: {},
    ensure: (source) => {
      if (source.control?.vendor !== 'hikvision') return;
      if (get().entries[source.id]?.key === controlKey(source)) return;
      void read(source, () => window.electronAPI.cameraControlState(source));
    },
    refresh: (source) => read(source, () => window.electronAPI.cameraControlState(source)),
    apply: (source, action) => read(source, () => window.electronAPI.cameraControlSet(source, action)),
  };
});
