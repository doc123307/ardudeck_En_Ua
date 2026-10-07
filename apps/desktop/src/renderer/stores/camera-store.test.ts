import { describe, it, expect } from 'vitest';
import { osdBackdropSource } from './camera-store';
import type { CameraSourceConfig } from '../../shared/camera-types';

function src(id: string, vehicleKey: string): CameraSourceConfig {
  return { id, vehicleKey, kind: 'rtsp', label: id, url: `rtsp://x/${id}` };
}

/** Minimal state slice the selector reads. */
function state(sources: CameraSourceConfig[], selected: Record<string, string>) {
  return {
    sources: Object.fromEntries(sources.map((s) => [s.id, s])),
    selectedByVehicle: selected,
  } as Parameters<typeof osdBackdropSource>[0];
}

describe('osdBackdropSource', () => {
  it('returns null when no vehicle is targeted', () => {
    expect(osdBackdropSource(state([], {}), null)).toBeNull();
  });

  it('returns null when the vehicle has no selected source', () => {
    const s = state([src('a', 'veh1')], {});
    expect(osdBackdropSource(s, 'veh1')).toBeNull();
  });

  it('returns null when the selected source id is dangling', () => {
    const s = state([src('a', 'veh1')], { veh1: 'missing' });
    expect(osdBackdropSource(s, 'veh1')).toBeNull();
  });

  it('returns the selected source for the target vehicle', () => {
    const a = src('a', 'veh1');
    const s = state([a], { veh1: 'a' });
    expect(osdBackdropSource(s, 'veh1')).toEqual(a);
  });
});

import { OFFLINE_VEHICLE_KEY, offlineVehicleKey, useCameraStore } from './camera-store';

describe('adoptLiveVehicles', () => {
  it('rebinds sources, selection, gimbal, and lock from stale transport keys', () => {
    const stale = 'old-transport:5.1';
    const live = 'new-transport:5.1';
    useCameraStore.setState({
      sources: { cam: src('cam', stale) },
      selectedByVehicle: { [stale]: 'cam' },
      gimbalByVehicle: { [stale]: { kind: 'mavlink' } as never },
      lockedVehicleKey: stale,
    });
    useCameraStore.getState().adoptLiveVehicles([live, 'new-transport:6.1']);
    const s = useCameraStore.getState();
    expect(s.sources['cam']!.vehicleKey).toBe(live);
    expect(s.selectedByVehicle[live]).toBe('cam');
    expect(s.selectedByVehicle[stale]).toBeUndefined();
    expect(s.gimbalByVehicle[live]).toBeTruthy();
    expect(s.lockedVehicleKey).toBe(live);
  });

  it('leaves ambiguous sysid matches alone', () => {
    const stale = 'old:5.1';
    useCameraStore.setState({
      sources: { cam: src('cam', stale) },
      selectedByVehicle: { [stale]: 'cam' },
      gimbalByVehicle: {},
      lockedVehicleKey: null,
    });
    useCameraStore.getState().adoptLiveVehicles(['a:5.1', 'b:5.1']);
    expect(useCameraStore.getState().sources['cam']!.vehicleKey).toBe(stale);
  });

  it('does not touch keys that are already live', () => {
    const live = 't:5.1';
    useCameraStore.setState({
      sources: { cam: src('cam', live) },
      selectedByVehicle: { [live]: 'cam' },
      gimbalByVehicle: {},
      lockedVehicleKey: null,
    });
    useCameraStore.getState().adoptLiveVehicles([live]);
    expect(useCameraStore.getState().sources['cam']!.vehicleKey).toBe(live);
  });
});

describe('cameras set up without a vehicle', () => {
  it('are filed under the vehicle worked with last, or a stand-in when there is none', () => {
    expect(offlineVehicleKey({})).toBe(OFFLINE_VEHICLE_KEY);
    expect(offlineVehicleKey({ a: src('a', 'old:5.1'), b: src('b', 'other:7.1') })).toBe('old:5.1');
    // The vehicle whose feed is the chosen one wins over the order of the list.
    expect(offlineVehicleKey({ a: src('a', 'old:5.1'), b: src('b', 'other:7.1') }, { 'other:7.1': 'b' })).toBe('other:7.1');
  });

  it('go to the vehicle that connects: by system id, or to the only vehicle there is', () => {
    const set = () => useCameraStore.setState({
      sources: { cam: src('cam', OFFLINE_VEHICLE_KEY) }, selectedByVehicle: { [OFFLINE_VEHICLE_KEY]: 'cam' }, gimbalByVehicle: {}, lockedVehicleKey: null,
    });
    set();
    useCameraStore.getState().adoptLiveVehicles(['udp-1:1.1']);
    expect(useCameraStore.getState().sources['cam']!.vehicleKey).toBe('udp-1:1.1');
    expect(useCameraStore.getState().selectedByVehicle['udp-1:1.1']).toBe('cam');
    // A vehicle whose system id is not 1 still gets them when it is the only one.
    set();
    useCameraStore.getState().adoptLiveVehicles(['udp-1:42.1']);
    expect(useCameraStore.getState().sources['cam']!.vehicleKey).toBe('udp-1:42.1');
    // With several vehicles and no match they are left for the user to place.
    set();
    useCameraStore.getState().adoptLiveVehicles(['a:5.1', 'b:6.1']);
    expect(useCameraStore.getState().sources['cam']!.vehicleKey).toBe(OFFLINE_VEHICLE_KEY);
  });
});
