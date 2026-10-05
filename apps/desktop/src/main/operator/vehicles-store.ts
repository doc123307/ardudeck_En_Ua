/**
 * The vehicle list on disk (`vehicles.json` in the app's data folder): every vehicle's
 * preset and which one is in use. Shared by the full UI and the operator screen.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  MAX_VEHICLES, normalizePreset, normalizeVehicles,
  type VehiclePreset, type VehiclesState,
} from '../../shared/vehicle-presets.js';

export class VehiclesStore {
  private readonly path: string;
  private current: VehiclesState;

  constructor(dir: string, private readonly now: () => number = Date.now) {
    this.path = join(dir, 'vehicles.json');
    let raw: unknown = null;
    try {
      raw = existsSync(this.path) ? JSON.parse(readFileSync(this.path, 'utf8')) : null;
    } catch {
      raw = null;
    }
    this.current = normalizeVehicles(raw);
  }

  state(): VehiclesState {
    return this.current;
  }

  active(): VehiclePreset | null {
    return this.current.presets.find((p) => p.id === this.current.activeId) ?? null;
  }

  private write(next: VehiclesState): boolean {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      writeFileSync(this.path, JSON.stringify(next, null, 2), 'utf8');
    } catch {
      return false;
    }
    this.current = next;
    return true;
  }

  /** Adds a vehicle or replaces the one with the same id. Null when it cannot be stored. */
  save(raw: unknown): VehiclePreset | null {
    const others = this.current.presets.filter((p) => p.id !== (raw as { id?: unknown } | null)?.id);
    const preset = normalizePreset({ ...(raw as object), updatedAt: this.now() }, new Set(others.map((p) => p.id)));
    if (!preset) return null;
    const exists = others.length < this.current.presets.length;
    if (!exists && this.current.presets.length >= MAX_VEHICLES) return null;
    const presets = exists
      ? this.current.presets.map((p) => (p.id === preset.id ? preset : p))
      : [...this.current.presets, preset];
    return this.write({ ...this.current, presets }) ? preset : null;
  }

  remove(id: string): boolean {
    if (!this.current.presets.some((p) => p.id === id)) return false;
    return this.write({
      activeId: this.current.activeId === id ? null : this.current.activeId,
      presets: this.current.presets.filter((p) => p.id !== id),
    });
  }

  setActive(id: string | null): VehiclePreset | null {
    const preset = id === null ? null : this.current.presets.find((p) => p.id === id) ?? null;
    if (id !== null && !preset) return null;
    this.write({ ...this.current, activeId: preset?.id ?? null });
    return preset;
  }

  /** Writes what changed in the live settings back into the vehicle in use. */
  updateActive(patch: Partial<Pick<VehiclePreset, 'connection' | 'cameras' | 'relays' | 'panel'>>): VehiclePreset | null {
    const active = this.active();
    if (!active) return null;
    return this.save({ ...active, ...patch });
  }
}
