/**
 * Live survey progress on the flight (telemetry) map.
 *
 * While a mission with survey groups is being flown, tints the flown portion
 * of each group's path green and - when the group's generatorResult carries
 * TOPAS-style cells - colours each cell by state (untouched / in progress /
 * completed). SurveyProgressCard is the matching compact readout ("Survey 1:
 * 62% - cell 4/10 - ETA 12 min") for the map's overlay chrome.
 *
 * Everything is self-subscribed and memoized so full-rate telemetry ticks
 * don't rebuild the layers: recompute happens on currentSeq changes and on a
 * throttled (1 Hz) vehicle position sample.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Polygon, Polyline } from 'react-leaflet';
import { useMissionStore } from '../../stores/mission-store';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { useConnectionStore } from '../../stores/connection-store';
import { isSurveyGroup } from '../../../shared/mission-group-types';
import { commandHasLocation, hasValidCoordinates } from '../../../shared/mission-types';
import type { LatLng } from './survey-types';
import {
  computeGroupProgress,
  computeCellStates,
  extractProgressCells,
  summarizeCells,
  type CellProgress,
  type GroupProgress,
  type ProgressWaypoint,
} from './survey-progress';
import { t } from '../../i18n';

const POSITION_SAMPLE_MS = 1000;

/** GPS position sampled at most once per second (null without a 2D+ fix). */
function useThrottledVehiclePos(): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(null);

  useEffect(() => {
    let last = 0;
    const sample = () => {
      const { gps } = useTelemetryStore.getState();
      const valid = gps.fixType >= 2 && gps.lat !== 0 && gps.lon !== 0;
      setPos((prev) => {
        if (!valid) return prev === null ? prev : null;
        if (prev && prev.lat === gps.lat && prev.lng === gps.lon) return prev;
        return { lat: gps.lat, lng: gps.lon };
      });
    };
    sample();
    const unsub = useTelemetryStore.subscribe(() => {
      const now = Date.now();
      if (now - last < POSITION_SAMPLE_MS) return;
      last = now;
      sample();
    });
    return unsub;
  }, []);

  return pos;
}

interface SurveyProgressEntry {
  groupId: string;
  name: string;
  color: string;
  progress: GroupProgress;
  cellStates: CellProgress[];
}

function useSurveyProgressEntries(): SurveyProgressEntry[] {
  const isConnected = useConnectionStore((s) => s.connectionState.isConnected);
  const missionItems = useMissionStore((s) => s.missionItems);
  const groups = useMissionStore((s) => s.groups);
  const currentSeq = useMissionStore((s) => s.currentSeq);
  const vehiclePos = useThrottledVehiclePos();

  return useMemo(() => {
    if (!isConnected || currentSeq === null) return [];
    // Non-reactive read: refreshed by the 1 Hz position sample above, which
    // is plenty for an ETA readout.
    const groundspeed = useTelemetryStore.getState().vfrHud.groundspeed;

    const entries: SurveyProgressEntry[] = [];
    for (const g of groups) {
      if (!isSurveyGroup(g) || !g.visible) continue;
      const items: ProgressWaypoint[] = missionItems
        .filter(
          (it) =>
            it.groupId === g.id &&
            commandHasLocation(it.command) &&
            hasValidCoordinates(it.latitude, it.longitude),
        )
        .map((it) => ({ seq: it.seq, lat: it.latitude, lng: it.longitude }));
      if (items.length === 0) continue;

      const progress = computeGroupProgress(items, currentSeq, vehiclePos, groundspeed);
      if (!progress.started) continue;

      const cells = extractProgressCells(g.generatorResult);
      entries.push({
        groupId: g.id,
        name: g.name,
        color: g.color,
        progress,
        cellStates: cells.length > 0 ? computeCellStates(cells, items, currentSeq) : [],
      });
    }
    return entries;
  }, [isConnected, missionItems, groups, currentSeq, vehiclePos]);
}

const COMPLETED_COLOR = '#22c55e';
const IN_PROGRESS_COLOR = '#f59e0b';

const CELL_PATH_OPTIONS = {
  untouched: {
    weight: 1,
    opacity: 0.55,
    dashArray: '4, 4',
    fillOpacity: 0.04,
  },
  inProgress: {
    color: IN_PROGRESS_COLOR,
    weight: 1.5,
    opacity: 0.8,
    fillColor: IN_PROGRESS_COLOR,
    fillOpacity: 0.15,
  },
  completed: {
    color: COMPLETED_COLOR,
    weight: 1,
    opacity: 0.7,
    fillColor: COMPLETED_COLOR,
    fillOpacity: 0.28,
  },
} as const;

export const SurveyProgressOverlay = React.memo(function SurveyProgressOverlay() {
  const entries = useSurveyProgressEntries();
  if (entries.length === 0) return null;

  return (
    <>
      {entries.map((e) => (
        <React.Fragment key={e.groupId}>
          {e.cellStates.map(({ cell, state }, ci) => (
            <Polygon
              // cellId comes from an untrusted blob and may not be unique;
              // the index disambiguates without destabilising typical keys.
              key={`cell-${e.groupId}-${cell.cellId}-${ci}`}
              positions={cell.polygon.map((p) => [p.lat, p.lng] as [number, number])}
              interactive={false}
              pathOptions={
                state === 'untouched'
                  ? { ...CELL_PATH_OPTIONS.untouched, color: e.color, fillColor: e.color }
                  : CELL_PATH_OPTIONS[state]
              }
            />
          ))}
          {e.progress.completedPath.length > 1 && (
            <Polyline
              positions={e.progress.completedPath.map((p) => [p.lat, p.lng] as [number, number])}
              interactive={false}
              pathOptions={{ color: COMPLETED_COLOR, weight: 3, opacity: 0.95 }}
            />
          )}
        </React.Fragment>
      ))}
    </>
  );
});

function formatEta(seconds: number): string {
  if (seconds < 60) return 'ETA <1 min';
  return t('survey.SurveyProgressOverlay.etaMin', { v1: Math.round(seconds / 60) });
}

function formatRemaining(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m remaining`;
  return `${(meters / 1000).toFixed(1)} km remaining`;
}

/**
 * Compact per-group progress readout for the map's overlay chrome. Renders
 * nothing until a survey group has actual progress. `className` positions it
 * (the parent owns the layout of its overlay corners).
 */
export const SurveyProgressCard = React.memo(function SurveyProgressCard({
  className = '',
}: {
  className?: string;
}) {
  const entries = useSurveyProgressEntries();
  if (entries.length === 0) return null;

  return (
    <div
      className={`absolute z-[1000] bg-surface-overlay backdrop-blur-sm rounded px-3 py-2 text-xs text-content space-y-1.5 min-w-[170px] border border-subtle shadow-lg ${className}`}
    >
      {entries.map((e) => {
        const pct = Math.round(e.progress.completedFraction * 100);
        const cellSummary = summarizeCells(e.cellStates);
        const parts = [`${pct}%`];
        if (cellSummary) parts.push(`cell ${cellSummary.activeNumber}/${cellSummary.total}`);
        if (e.progress.finished) parts.push('done');
        else if (e.progress.etaSeconds !== null) parts.push(formatEta(e.progress.etaSeconds));
        return (
          <div key={e.groupId} data-tip={formatRemaining(e.progress.remainingMeters)}>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: e.color }}
              />
              <span className="truncate max-w-[110px]">{e.name}</span>
              <span className="font-mono text-content-secondary whitespace-nowrap ml-auto">
                {parts.join(' - ')}
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-gray-700/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, backgroundColor: COMPLETED_COLOR }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});
