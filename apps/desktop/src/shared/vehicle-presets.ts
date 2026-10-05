/**
 * Vehicles ("борти"): each is a preset that holds everything that differs from one vehicle
 * to the next - the link, the cameras, the vehicle outputs and the operator's panel (RC
 * functions, joystick mapping, values, modes). Choosing a vehicle puts all of it in place
 * and connects; the last one chosen comes back by itself at the next start.
 *
 * This replaces the upstream multi-vehicle orchestrator, which this fork does not ship.
 */

import type { ConnectOptions } from './ipc-channels';
import type { CameraSourceConfig } from './camera-types';
import { normalizeOperatorConfig, type OperatorConfig, type OperatorState } from './operator-types';
import { isOperatorColor, isOperatorIcon, type OperatorColor, type OperatorIcon } from './operator-panel';

/** The operator settings that belong to a vehicle rather than to the computer. */
export const VEHICLE_PANEL_FIELDS = [
  'rc', 'controlOrder', 'hiddenControls', 'removedControls', 'panelIconsOnly', 'values', 'statusFields', 'modeButtons', 'allowArm',
] as const;
export type VehiclePanelField = (typeof VEHICLE_PANEL_FIELDS)[number];
export type VehiclePanel = Pick<OperatorConfig, VehiclePanelField>;

/** A vehicle output button as a preset keeps it (the renderer's relay-store shape). */
export interface PresetRelay {
  id: string;
  label: string;
  instance: number;
  kind: 'toggle' | 'momentary';
  icon: OperatorIcon;
  color: OperatorColor;
}

export interface VehiclePreset {
  id: string;
  name: string;
  /** The link to the vehicle; null = not set yet. */
  connection: ConnectOptions | null;
  cameras: CameraSourceConfig[];
  relays: PresetRelay[];
  panel: VehiclePanel;
  updatedAt: number;
}

export interface VehiclesState {
  /** The vehicle in use: chosen last, put back in place at the next start. */
  activeId: string | null;
  presets: VehiclePreset[];
}

export const MAX_VEHICLES = 50;

/** What a change to the vehicle list answers: the list, and the operator settings now in force. */
export interface VehiclesResult {
  ok: boolean;
  error?: 'not-allowed' | 'not-found' | 'storage';
  vehicles: VehiclesState;
  operator: OperatorState;
}
export const EMPTY_VEHICLES: VehiclesState = { activeId: null, presets: [] };

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const validId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);

export function pickPanel(config: OperatorConfig): VehiclePanel {
  return Object.fromEntries(VEHICLE_PANEL_FIELDS.map((f) => [f, structuredClone(config[f])])) as VehiclePanel;
}

/** A panel as stored, cleaned with the same rules as the operator settings themselves. */
export function normalizePanel(raw: unknown): VehiclePanel {
  const config = normalizeOperatorConfig({ ...(isObject(raw) ? raw : {}), schema: 3 });
  return pickPanel(config);
}

function normalizeConnection(raw: unknown): ConnectOptions | null {
  return isObject(raw) && ['serial', 'tcp', 'udp'].includes(raw.type as string) ? (raw as unknown as ConnectOptions) : null;
}

function normalizeCameras(raw: unknown): CameraSourceConfig[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.filter((c): c is CameraSourceConfig => isObject(c) && validId(c.id) && typeof c.kind === 'string' && typeof c.vehicleKey === 'string')
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .slice(0, 16);
}

function normalizeRelays(raw: unknown): PresetRelay[] {
  if (!Array.isArray(raw)) return [];
  const out: PresetRelay[] = [];
  for (const r of raw) {
    if (!isObject(r) || !validId(r.id) || out.some((x) => x.id === r.id)) continue;
    const instance = typeof r.instance === 'number' && Number.isInteger(r.instance) ? Math.min(15, Math.max(0, r.instance)) : 0;
    out.push({
      id: r.id,
      label: text(r.label, 32) || `RELAY${instance + 1}`,
      instance,
      kind: r.kind === 'momentary' ? 'momentary' : 'toggle',
      icon: isOperatorIcon(r.icon) ? r.icon : 'power',
      color: isOperatorColor(r.color) ? r.color : 'green',
    });
  }
  return out.slice(0, 16);
}

export function normalizePreset(raw: unknown, takenIds: Set<string> = new Set()): VehiclePreset | null {
  if (!isObject(raw) || !validId(raw.id) || takenIds.has(raw.id)) return null;
  return {
    id: raw.id,
    name: text(raw.name, 40) || raw.id,
    connection: normalizeConnection(raw.connection),
    cameras: normalizeCameras(raw.cameras),
    relays: normalizeRelays(raw.relays),
    panel: normalizePanel(raw.panel),
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
  };
}

export function normalizeVehicles(raw: unknown): VehiclesState {
  if (!isObject(raw)) return { ...EMPTY_VEHICLES, presets: [] };
  const ids = new Set<string>();
  const presets: VehiclePreset[] = [];
  for (const item of Array.isArray(raw.presets) ? raw.presets : []) {
    if (presets.length >= MAX_VEHICLES) break;
    const preset = normalizePreset(item, ids);
    if (preset) { ids.add(preset.id); presets.push(preset); }
  }
  const activeId = typeof raw.activeId === 'string' && ids.has(raw.activeId) ? raw.activeId : null;
  return { activeId, presets };
}

/** A fresh id for a new vehicle. */
export function newVehicleId(existing: VehiclePreset[], now = Date.now()): string {
  let id = `v${now.toString(36)}`;
  for (let n = 2; existing.some((p) => p.id === id); n++) id = `v${now.toString(36)}-${n}`;
  return id;
}

/** A name not used yet: "Борт 1", "Борт 2"... (the prefix is the caller's, in its language). */
export function nextVehicleName(existing: VehiclePreset[], prefix: string): string {
  let n = existing.length + 1;
  while (existing.some((p) => p.name === `${prefix} ${n}`)) n++;
  return `${prefix} ${n}`;
}

/**
 * Cameras of a preset as the camera store will hold them. Their vehicle key is kept: the
 * store already re-homes a key onto the live vehicle with the same system id when it connects.
 */
export function presetCameraMap(cameras: CameraSourceConfig[]): Record<string, CameraSourceConfig> {
  return Object.fromEntries(cameras.map((c) => [c.id, c]));
}

/** Did the settings a preset holds change? Cheap structural comparison for the write-back. */
export function samePresetPart(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
