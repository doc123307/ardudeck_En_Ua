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
import type { CameraSourceConfig } from '../../../shared/camera-types';

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
  /** When the current recording started; null when not recording. */
  since: number | null;
  busy: boolean;
  toggle: () => Promise<{ started: number; failed: number; stopped: number; error?: string }>;
}

/** One button records the main camera or, when the administrator set it so, every camera. */
export function useOperatorRecording(sources: CameraSourceConfig[], main: CameraSourceConfig | null): OperatorRecording {
  const recordAll = useOperatorStore((s) => s.config.recordAllCameras);
  const [recordingIds, setRecordingIds] = useState<string[]>([]);
  const [since, setSince] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    setBusy(true);
    try {
      if (recordingIds.length > 0) {
        await Promise.all(recordingIds.map((id) => window.electronAPI.cameraRecordToggle(id, false)));
        const stopped = recordingIds.length;
        setRecordingIds([]);
        setSince(null);
        return { started: 0, failed: 0, stopped };
      }
      const targets = recordAll ? sources : main ? [main] : [];
      const results = await Promise.all(targets.map(async (s) => ({ id: s.id, r: await window.electronAPI.cameraRecordToggle(s.id, true) })));
      const started = results.filter((x) => x.r.ok).map((x) => x.id);
      const error = results.find((x) => !x.r.ok)?.r.error;
      setRecordingIds(started);
      setSince(started.length > 0 ? Date.now() : null);
      return { started: started.length, failed: results.length - started.length, stopped: 0, error };
    } finally {
      setBusy(false);
    }
  }, [recordingIds, recordAll, sources, main]);

  return { since, busy, toggle };
}
