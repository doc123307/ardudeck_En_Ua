import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VehiclesStore } from './vehicles-store';
import {
  MAX_VEHICLES, newVehicleId, nextVehicleName, normalizeVehicles, pickPanel, presetCameraMap, type VehiclePreset,
} from '../../shared/vehicle-presets';
import { DEFAULT_OPERATOR_CONFIG, normalizeOperatorConfig } from '../../shared/operator-types';

const link = { type: 'udp' as const, udpMode: 'client' as const, udpRemoteHost: '100.67.0.245', udpRemotePort: 14550, udpClientLocalPort: 14550 };
const camera = (id: string, label: string) => ({ id, label, kind: 'rtsp' as const, vehicleKey: 'abc:1.1', url: `rtsp://100.67.0.245:8554/${id}` });

function preset(id: string, name: string, extra: Partial<VehiclePreset> = {}): VehiclePreset {
  return {
    id, name, connection: link, cameras: [camera('front', 'Передня'), camera('rear', 'Задня')],
    relays: [{ id: 'low-beam', label: 'Світло', instance: 0, kind: 'toggle', icon: 'lightbulb', color: 'white' }],
    panel: pickPanel(DEFAULT_OPERATOR_CONFIG), updatedAt: 0, ...extra,
  };
}

describe('VehiclesStore', () => {
  let dir: string;
  let now: number;
  let store: VehiclesStore;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'stohid-vehicles-'));
    now = 1000;
    store = new VehiclesStore(dir, () => now);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('starts empty and survives a missing or damaged file', () => {
    expect(store.state()).toEqual({ activeId: null, presets: [] });
    writeFileSync(join(dir, 'vehicles.json'), '{not json');
    expect(new VehiclesStore(dir).state()).toEqual({ activeId: null, presets: [] });
  });

  it('adds, replaces and removes vehicles, and keeps them across a restart', () => {
    expect(store.save(preset('a', 'Борт 1'))?.updatedAt).toBe(1000);
    store.save(preset('b', 'Борт 2'));
    now = 2000;
    store.save({ ...preset('a', 'Розвідник'), cameras: [] });
    expect(store.state().presets.map((p) => `${p.id}:${p.name}:${p.cameras.length}`)).toEqual(['a:Розвідник:0', 'b:Борт 2:2']);
    expect(new VehiclesStore(dir).state().presets).toHaveLength(2);
    expect(store.remove('a')).toBe(true);
    expect(store.remove('nope')).toBe(false);
    expect(store.state().presets.map((p) => p.id)).toEqual(['b']);
  });

  it('remembers the vehicle in use, and forgets it when it is deleted', () => {
    store.save(preset('a', 'A'));
    store.save(preset('b', 'B'));
    expect(store.setActive('b')?.name).toBe('B');
    expect(new VehiclesStore(dir).state().activeId).toBe('b');
    expect(store.setActive('ghost')).toBeNull();
    expect(store.state().activeId).toBe('b');
    store.remove('b');
    expect(store.state().activeId).toBeNull();
    expect(store.active()).toBeNull();
  });

  it('writes changes back into the vehicle in use only', () => {
    store.save(preset('a', 'A'));
    store.save(preset('b', 'B'));
    expect(store.updateActive({ cameras: [] })).toBeNull();
    store.setActive('a');
    store.updateActive({ cameras: [camera('nose', 'Ніс')] });
    expect(store.state().presets.find((p) => p.id === 'a')!.cameras.map((c) => c.id)).toEqual(['nose']);
    expect(store.state().presets.find((p) => p.id === 'b')!.cameras).toHaveLength(2);
  });

  it('refuses broken entries and too many vehicles', () => {
    expect(store.save({ id: 'bad id!', name: 'x' } as unknown as VehiclePreset)).toBeNull();
    for (let i = 0; i < MAX_VEHICLES; i++) store.save(preset(`v${i}`, `V${i}`));
    expect(store.save(preset('one-more', 'X'))).toBeNull();
    // Replacing an existing one still works when the list is full.
    expect(store.save(preset('v0', 'Renamed'))?.name).toBe('Renamed');
  });

  it('stores the file as plain JSON', () => {
    store.save(preset('a', 'A'));
    const onDisk = JSON.parse(readFileSync(join(dir, 'vehicles.json'), 'utf8'));
    expect(onDisk.presets[0].connection).toEqual(link);
  });
});

describe('vehicle presets', () => {
  it('are cleaned when read: unknown fields, bad cameras and relays go, the panel is normalized', () => {
    const state = normalizeVehicles({
      activeId: 'gone',
      presets: [
        {
          id: 'a', name: '  Борт 1  ', connection: { type: 'carrier-pigeon' },
          cameras: [camera('front', 'F'), { id: 'x' }, camera('front', 'dup')],
          relays: [{ id: 'r', instance: 99, icon: 'rocket', color: 'pink' }],
          panel: { modeButtons: ['manual', 'warp'], rc: { functions: [{ id: 'f', kind: 'switch3' }] } },
        },
        { id: 'a', name: 'duplicate' },
      ],
    });
    expect(state.activeId).toBeNull();
    expect(state.presets).toHaveLength(1);
    const p = state.presets[0]!;
    expect(p.name).toBe('Борт 1');
    expect(p.connection).toBeNull();
    expect(p.cameras.map((c) => c.label)).toEqual(['F']);
    expect(p.relays[0]).toMatchObject({ instance: 15, icon: 'power', color: 'green', label: 'RELAY16', kind: 'toggle' });
    expect(p.panel.modeButtons).toEqual(['manual']);
    expect(p.panel.rc.functions[0]).toMatchObject({ kind: 'switch3', startCenter: true });
  });

  it('keep exactly the operator settings that belong to a vehicle', () => {
    const config = normalizeOperatorConfig({ allowArm: false, recordMode: 'manual', supportContact: '@x' });
    const panel = pickPanel(config);
    expect(Object.keys(panel).sort()).toEqual(['allowArm', 'controlOrder', 'hiddenControls', 'modeButtons', 'panelIconsOnly', 'rc', 'removedControls', 'statusFields', 'values']);
    expect(panel.allowArm).toBe(false);
    // A copy, not the live object.
    panel.rc.functions.pop();
    expect(config.rc.functions).toHaveLength(3);
  });

  it('get fresh ids and names', () => {
    const a = preset(newVehicleId([], 1), 'Борт 1');
    expect(newVehicleId([a], 1)).not.toBe(a.id);
    expect(nextVehicleName([a], 'Борт')).toBe('Борт 2');
    expect(nextVehicleName([], 'Борт')).toBe('Борт 1');
  });

  it('hand their cameras to the camera store keyed by id', () => {
    expect(Object.keys(presetCameraMap([camera('front', 'F'), camera('rear', 'R')]))).toEqual(['front', 'rear']);
  });
});
