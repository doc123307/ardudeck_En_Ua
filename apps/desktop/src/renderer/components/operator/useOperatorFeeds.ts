/**
 * The cameras of the operator screen and their recording.
 *
 * Video does not depend on the telemetry link, so the feeds are shown even while the
 * vehicle is not connected: with no active vehicle every configured feed is offered.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveVehicleStore } from '../../stores/active-vehicle-store';
import { useCameraStore } from '../../stores/camera-store';
import { useFleetVehicles, type FleetVehicle } from '../../hooks/useFleet';
import { useOperatorStore } from '../../stores/operator-store';
import { useOperatorUiStore } from '../../stores/operator-ui-store';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { useConnectionStore } from '../../stores/connection-store';
import type { CameraRecordStatus, CameraSourceConfig } from '../../../shared/camera-types';
import type { OperatorRecordMode } from '../../../shared/operator-types';

export interface OperatorFeeds {
  sources: CameraSourceConfig[];
  main: CameraSourceConfig | null;
  vehicle: FleetVehicle | null;
  selectMain: (id: string) => void;
}

/** Picks the feeds to show: the active vehicle's, or all of them when it has none (or there is no vehicle). */
export function feedsFor(all: CameraSourceConfig[], activeKey: string | null): CameraSourceConfig[] {
  const mine = activeKey ? all.filter((s) => s.vehicleKey === activeKey) : [];
  return mine.length > 0 ? mine : all;
}

/** The full-size feed: the operator's pick, else the one selected in the full UI, else the first. */
export function mainFeed(sources: CameraSourceConfig[], picked: string | null, selected: string | undefined): CameraSourceConfig | null {
  return sources.find((s) => s.id === picked) ?? sources.find((s) => s.id === selected) ?? sources[0] ?? null;
}

export function useOperatorFeeds(): OperatorFeeds {
  const activeKey = useActiveVehicleStore((s) => s.activeVehicleKey);
  const fleet = useFleetVehicles();
  const sourceMap = useCameraStore((s) => s.sources);
  const selectedByVehicle = useCameraStore((s) => s.selectedByVehicle);
  const setSelectedSource = useCameraStore((s) => s.setSelectedSource);
  const picked = useOperatorUiStore((s) => s.mainSourceId);
  const setMainSource = useOperatorUiStore((s) => s.setMainSource);

  // Transport ids rotate on reconnect; re-home the saved feeds onto the live vehicle.
  const fleetKeys = useMemo(() => fleet.map((v) => v.key).sort().join('|'), [fleet]);
  useEffect(() => {
    if (fleetKeys.length > 0) useCameraStore.getState().adoptLiveVehicles(fleetKeys.split('|'));
  }, [fleetKeys]);

  const sources = useMemo(() => feedsFor(Object.values(sourceMap), activeKey), [sourceMap, activeKey]);
  const main = mainFeed(sources, picked, activeKey ? selectedByVehicle[activeKey] : undefined);
  const vehicle = useMemo(() => fleet.find((v) => v.key === activeKey) ?? null, [fleet, activeKey]);

  const selectMain = useCallback((id: string) => {
    setMainSource(id);
    // Keep the full UI's "live feed" in step, so snapshots and the camera panel agree.
    const source = useCameraStore.getState().sources[id];
    if (source) setSelectedSource(source.vehicleKey, id);
  }, [setMainSource, setSelectedSource]);

  return { sources, main, vehicle, selectMain };
}

export interface OperatorRecording {
  mode: OperatorRecordMode;
  /** Cameras that are to be recorded right now, and how many of them are being written. */
  wanted: number;
  writing: number;
  /** Since when something is actually being written; null while nothing is. */
  writingSince: number | null;
  /** Why nothing is written although it should be: the disk is full, ffmpeg is missing. */
  blocked: 'no-space' | 'no-ffmpeg' | null;
  /** The folder the files go to. */
  dir: string;
  /** "By button" mode: the button's state and the button itself. */
  on: boolean;
  toggle: () => void;
}

/** The cameras to record: every one, or just the main one. */
export function recordTargets(sources: CameraSourceConfig[], main: CameraSourceConfig | null, recordAll: boolean): CameraSourceConfig[] {
  return recordAll ? sources : main ? [main] : [];
}

/** Whether recording should be running, by the administrator's rule. */
export function recordingWanted(mode: OperatorRecordMode, state: { armed: boolean; buttonOn: boolean }): boolean {
  return mode === 'always' || (mode === 'armed' && state.armed) || (mode === 'manual' && state.buttonOn);
}

const POLL_MS = 1000;

/**
 * Recording as the administrator set it: all the time, while armed, or by the button.
 * This hook only says WHICH cameras are to be recorded; the main process keeps them
 * recording, waiting for a camera that has no picture and resuming after a dropout.
 */
export function useOperatorRecording(sources: CameraSourceConfig[], main: CameraSourceConfig | null): OperatorRecording {
  const mode = useOperatorStore((s) => s.config.recordMode);
  const recordAll = useOperatorStore((s) => s.config.recordAllCameras);
  const armed = useTelemetryStore((s) => s.flight.armed);
  const connected = useConnectionStore((s) => s.connectionState.isConnected);
  const [buttonOn, setButtonOn] = useState(false);
  const [status, setStatus] = useState<CameraRecordStatus | null>(null);
  const [writingSince, setWritingSince] = useState<number | null>(null);

  const targets = recordingWanted(mode, { armed: connected && armed, buttonOn }) ? recordTargets(sources, main, recordAll) : [];
  // Ids and names as one string: the effect below must not re-run on every render.
  const key = JSON.stringify(targets.map((s) => [s.id, s.label ?? '']));

  useEffect(() => {
    const list = (JSON.parse(key) as [string, string][]).map(([id, label]) => ({ id, ...(label ? { label } : {}) }));
    let alive = true;
    const adopt = (next: CameraRecordStatus) => { if (alive) setStatus(next); };
    void window.electronAPI.cameraRecordWanted(list).then(adopt).catch(() => {});
    if (list.length === 0) return () => { alive = false; };
    const timer = setInterval(() => { void window.electronAPI.cameraRecordStatus().then(adopt).catch(() => {}); }, POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [key]);
  // Leaving the operator screen ends its recordings (the files are closed properly).
  useEffect(() => () => { void window.electronAPI.cameraRecordWanted([]).catch(() => {}); }, []);

  const states = targets.map((s) => status?.sources[s.id]?.state);
  const writing = states.filter((s) => s === 'recording').length;
  const blocked = states.includes('no-space') ? 'no-space' : states.includes('no-ffmpeg') ? 'no-ffmpeg' : null;
  useEffect(() => {
    setWritingSince((since) => (writing > 0 ? since ?? Date.now() : null));
  }, [writing]);

  const toggle = useCallback(() => setButtonOn((on) => !on), []);
  return { mode, wanted: targets.length, writing, writingSince, blocked, dir: status?.dir ?? '', on: buttonOn, toggle };
}
