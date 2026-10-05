/**
 * The vehicle list in the renderer. The list itself lives in the main process
 * (main/operator/vehicles-store.ts); this store mirrors it and does the renderer's part of
 * switching vehicles: cameras and vehicle outputs are the renderer's stores, and the link
 * is opened from here.
 */

import { create } from 'zustand';
import {
  newVehicleId, nextVehicleName, pickPanel, presetCameraMap,
  type VehiclePreset, type VehiclesResult, type VehiclesState,
} from '../../shared/vehicle-presets';
import type { ConnectOptions } from '../../shared/ipc-channels';
import type { CameraSourceConfig } from '../../shared/camera-types';
import { useCameraStore } from './camera-store';
import { useRelayStore, type RelayButton } from './relay-store';
import { useOperatorStore } from './operator-store';
import { useOperatorUiStore } from './operator-ui-store';
import { useConnectionStore } from './connection-store';
import { useSettingsStore } from './settings-store';
import { connectOptionsFromMemory } from '../components/operator/operator-logic';

/** While a vehicle is being put in place, the live stores change on purpose: no write-back. */
let switching = false;

interface VehiclesStore {
  ready: boolean;
  state: VehiclesState;
  load: () => Promise<VehiclesState>;
  /** Puts a vehicle's settings in place and connects to it. */
  activate: (id: string) => Promise<VehiclesResult>;
  save: (preset: VehiclePreset) => Promise<VehiclesResult>;
  remove: (id: string) => Promise<VehiclesResult>;
  /** A new vehicle made of everything set up now: link, cameras, outputs, panel. */
  fromCurrent: (name: string) => VehiclePreset;
}

/** The link in use now: the operator's pinned one, else the last one used. */
export function currentConnection(): ConnectOptions | null {
  return useOperatorStore.getState().config.connection ?? connectOptionsFromMemory(useSettingsStore.getState().connectionMemory);
}

function adopt(set: (s: Partial<VehiclesStore>) => void, result: VehiclesResult): VehiclesResult {
  set({ state: result.vehicles });
  const op = result.operator;
  useOperatorStore.setState({ ready: true, mode: op.mode, hasPassword: op.hasPassword, config: op.config });
  return result;
}

/** The cameras and outputs of a vehicle take the place of the ones on screen. */
function applyLiveParts(preset: VehiclePreset): void {
  const sources = presetCameraMap(preset.cameras);
  const selectedByVehicle: Record<string, string> = {};
  for (const camera of preset.cameras) selectedByVehicle[camera.vehicleKey] ??= camera.id;
  useCameraStore.setState({ sources, selectedByVehicle });
  useRelayStore.setState({ buttons: preset.relays as RelayButton[] });
  // The new vehicle's first camera is the big one; the old pick belongs to another vehicle.
  useOperatorUiStore.setState({ mainSourceId: preset.cameras[0]?.id ?? null });
}

export const useVehiclesStore = create<VehiclesStore>((set, get) => ({
  ready: false,
  state: { activeId: null, presets: [] },

  load: async () => {
    const state = await window.electronAPI.vehiclesState();
    set({ ready: true, state });
    return state;
  },

  activate: async (id) => {
    switching = true;
    try {
      const result = adopt(set, await window.electronAPI.vehiclesActivate(id));
      const preset = result.vehicles.presets.find((p) => p.id === id);
      if (!result.ok || !preset) return result;
      applyLiveParts(preset);
      const connection = useConnectionStore.getState();
      if (connection.connectionState.isConnected || connection.isConnecting) await connection.disconnect();
      if (preset.connection) void useConnectionStore.getState().connect(preset.connection);
      return result;
    } finally {
      // The camera and output stores notify asynchronously; let them settle first.
      setTimeout(() => { switching = false; }, 1500);
    }
  },

  save: async (preset) => {
    const before = get().state.presets.find((p) => p.id === preset.id);
    const result = adopt(set, await window.electronAPI.vehiclesSave(preset));
    const saved = result.vehicles.presets.find((p) => p.id === preset.id);
    // The vehicle in use was changed: its cameras and outputs show at once, a new link is opened.
    if (result.ok && saved && result.vehicles.activeId === saved.id) {
      switching = true;
      applyLiveParts(saved);
      setTimeout(() => { switching = false; }, 1500);
      if (JSON.stringify(before?.connection) !== JSON.stringify(saved.connection) && saved.connection) {
        const connection = useConnectionStore.getState();
        if (connection.connectionState.isConnected || connection.isConnecting) await connection.disconnect();
        void useConnectionStore.getState().connect(saved.connection);
      }
    }
    return result;
  },
  remove: async (id) => adopt(set, await window.electronAPI.vehiclesDelete(id)),

  fromCurrent: (name) => {
    const cameras = Object.values(useCameraStore.getState().sources);
    return {
      id: newVehicleId(get().state.presets),
      name,
      connection: currentConnection(),
      cameras: structuredClone(cameras),
      relays: structuredClone(useRelayStore.getState().buttons),
      panel: pickPanel(useOperatorStore.getState().config),
      updatedAt: Date.now(),
    };
  },
}));

const SEEDED_KEY = 'stohid-vehicles-seeded';
const SYNC_DELAY_MS = 800;

/**
 * Once per window that owns the settings (the main window): load the list, make the first
 * vehicle out of the current setup on the first run, reconnect to the vehicle used last,
 * and keep the vehicle in use up to date with camera and output changes.
 */
export async function startVehicles(options: { defaultName: string; connectAtStart: boolean }): Promise<() => void> {
  const store = useVehiclesStore.getState();
  let state = await store.load();

  let seeded = false;
  try { seeded = localStorage.getItem(SEEDED_KEY) === '1'; } catch { /* treat as not seeded */ }
  if (state.presets.length === 0 && !seeded) {
    const first = store.fromCurrent(nextVehicleName([], options.defaultName));
    const saved = await window.electronAPI.vehiclesSave(first);
    if (saved.ok) {
      const activated = await window.electronAPI.vehiclesActivate(first.id);
      state = activated.vehicles;
      useVehiclesStore.setState({ state });
    }
  }
  try { localStorage.setItem(SEEDED_KEY, '1'); } catch { /* nothing to remember it in */ }

  // The vehicle chosen last comes back by itself. The operator screen connects on its own;
  // the full UI is asked to here.
  const active = state.presets.find((p) => p.id === state.activeId);
  if (options.connectAtStart && active?.connection && !useConnectionStore.getState().connectionState.isConnected) {
    void useConnectionStore.getState().connect(active.connection);
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const push = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (switching || !useVehiclesStore.getState().state.activeId) return;
      const cameras: CameraSourceConfig[] = Object.values(useCameraStore.getState().sources);
      void window.electronAPI.vehiclesSync({ cameras, relays: useRelayStore.getState().buttons })
        .then((next) => useVehiclesStore.setState({ state: next }))
        .catch(() => {});
    }, SYNC_DELAY_MS);
  };
  const offCameras = useCameraStore.subscribe((s, prev) => { if (s.sources !== prev.sources) push(); });
  const offRelays = useRelayStore.subscribe((s, prev) => { if (s.buttons !== prev.buttons) push(); });
  return () => {
    offCameras();
    offRelays();
    if (timer) clearTimeout(timer);
  };
}
