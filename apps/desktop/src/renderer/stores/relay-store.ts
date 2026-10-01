/**
 * Vehicle output buttons (lights, marker lights, IR...) driven through the flight
 * controller's relays: MAV_CMD_DO_SET_RELAY out, RELAY_STATUS back.
 *
 * The state shown is what the flight controller reports, not what was clicked: a
 * light switched from the transmitter lights the button here too, and a click the
 * vehicle never confirmed is shown as such instead of pretending it worked.
 *
 * Persistence: the button set is persisted; relay states are live data only.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { t } from '../i18n';

export type RelayButtonKind = 'toggle' | 'momentary';
export type RelayIcon = 'lightbulb' | 'car' | 'sun' | 'flashlight' | 'eye' | 'siren' | 'zap' | 'power';
export type RelayColor = 'white' | 'amber' | 'red' | 'ir' | 'green' | 'blue';

export interface RelayButton {
  id: string;
  label: string;
  /** ArduPilot relay instance, 0-based (RELAY1 = 0). */
  instance: number;
  kind: RelayButtonKind;
  icon: RelayIcon;
  color: RelayColor;
}

export type RelayButtonState = 'off' | 'on' | 'pending' | 'failed' | 'absent' | 'unknown';

/** How long a click may wait for the vehicle to confirm it. */
export const CONFIRM_TIMEOUT_MS = 3000;
/** RELAY_STATUS older than this is no longer trusted. */
export const STALE_MS = 5000;
/** How long an unconfirmed click stays marked as failed. */
export const FAILED_SHOWN_MS = 10000;

interface VehicleRelays { on: number; present: number; at: number }

interface RelayStoreState {
  buttons: RelayButton[];
  /** Live RELAY_STATUS per vehicle. */
  status: Record<string, VehicleRelays>;
  /** `${vehicleKey}:${instance}` -> requested state and when. */
  pending: Record<string, { want: boolean; since: number }>;
  /** `${vehicleKey}:${instance}` -> the click the vehicle did not confirm. */
  failed: Record<string, { want: boolean; at: number }>;

  addButton: (button?: Partial<RelayButton>) => void;
  updateButton: (id: string, patch: Partial<RelayButton>) => void;
  removeButton: (id: string) => void;
  moveButton: (id: string, delta: -1 | 1) => void;
  recordStatus: (vehicleKey: string, on: number, present: number) => void;
  /** Sends the command; resolves when the vehicle confirmed or the wait ran out. */
  setRelay: (vehicleKey: string, instance: number, on: boolean) => Promise<void>;
}

const slot = (vehicleKey: string, instance: number) => `${vehicleKey}:${instance}`;
const bit = (mask: number, instance: number) => ((mask >> instance) & 1) === 1;

function defaultButtons(): RelayButton[] {
  return [
    { id: 'low-beam', label: t('stores.relay_store.lowBeam'), instance: 0, kind: 'toggle', icon: 'lightbulb', color: 'white' },
    { id: 'marker', label: t('stores.relay_store.markerLights'), instance: 1, kind: 'toggle', icon: 'car', color: 'amber' },
  ];
}

export const useRelayStore = create<RelayStoreState>()(
  persist(
    (set, get) => ({
      buttons: defaultButtons(),
      status: {},
      pending: {},
      failed: {},

      addButton: (button) => set((s) => {
        const used = new Set(s.buttons.map((b) => b.instance));
        let instance = 0;
        while (used.has(instance) && instance < 15) instance += 1;
        return {
          buttons: [...s.buttons, {
            id: crypto.randomUUID(),
            label: t('stores.relay_store.output', { n: instance + 1 }),
            instance,
            kind: 'toggle',
            icon: 'power',
            color: 'green',
            ...button,
          }],
        };
      }),
      updateButton: (id, patch) => set((s) => ({ buttons: s.buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      removeButton: (id) => set((s) => ({ buttons: s.buttons.filter((b) => b.id !== id) })),
      moveButton: (id, delta) => set((s) => {
        const i = s.buttons.findIndex((b) => b.id === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= s.buttons.length) return s;
        const next = [...s.buttons];
        [next[i], next[j]] = [next[j]!, next[i]!];
        return { buttons: next };
      }),

      recordStatus: (vehicleKey, on, present) => set((s) => {
        // Confirmed clicks stop waiting; a state the vehicle now reports clears an old failure.
        const pending = { ...s.pending };
        const failed = { ...s.failed };
        for (const key of Object.keys(pending)) {
          const [veh, inst] = [key.slice(0, key.lastIndexOf(':')), Number(key.slice(key.lastIndexOf(':') + 1))];
          if (veh === vehicleKey && bit(on, inst) === pending[key]!.want) delete pending[key];
        }
        for (const key of Object.keys(failed)) {
          const inst = Number(key.slice(key.lastIndexOf(':') + 1));
          if (key.startsWith(`${vehicleKey}:`) && bit(on, inst) === failed[key]!.want) delete failed[key];
        }
        return { status: { ...s.status, [vehicleKey]: { on, present, at: Date.now() } }, pending, failed };
      }),

      setRelay: async (vehicleKey, instance, on) => {
        const key = slot(vehicleKey, instance);
        const since = Date.now();
        set((s) => {
          const failed = { ...s.failed };
          delete failed[key];
          return { pending: { ...s.pending, [key]: { want: on, since } }, failed };
        });
        const sent = await window.electronAPI.vehicleCommand(vehicleKey, { kind: 'relay', instance, on }).catch(() => false);
        const giveUp = () => set((s) => {
          if (s.pending[key]?.since !== since) return s; // confirmed or superseded meanwhile
          const pending = { ...s.pending };
          delete pending[key];
          return { pending, failed: { ...s.failed, [key]: { want: on, at: Date.now() } } };
        });
        if (!sent) { giveUp(); return; }
        await new Promise((r) => setTimeout(r, CONFIRM_TIMEOUT_MS));
        giveUp();
      },
    }),
    {
      name: 'stohid-relay-buttons',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ buttons: s.buttons }),
    },
  ),
);

/** What a button should show for a vehicle right now. */
export function relayButtonState(
  s: Pick<RelayStoreState, 'status' | 'pending' | 'failed'>, vehicleKey: string | null, instance: number, now = Date.now(),
): RelayButtonState {
  if (!vehicleKey) return 'unknown';
  const key = slot(vehicleKey, instance);
  if (s.pending[key]) return 'pending';
  // A failure stays visible long enough to be noticed, then the reported state takes over.
  const failure = s.failed[key];
  if (failure && now - failure.at < FAILED_SHOWN_MS) return 'failed';
  const st = s.status[vehicleKey];
  if (!st || now - st.at > STALE_MS) return 'unknown';
  if (!bit(st.present, instance)) return 'absent';
  return bit(st.on, instance) ? 'on' : 'off';
}

// One listener for the whole app; the vehicle reports state whoever switched it.
if (typeof window !== 'undefined' && window.electronAPI?.onRelayStatus) {
  window.electronAPI.onRelayStatus(({ vehicleKey, on, present }) => useRelayStore.getState().recordStatus(vehicleKey, on, present));
}
