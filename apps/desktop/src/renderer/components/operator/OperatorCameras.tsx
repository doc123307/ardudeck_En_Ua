/**
 * The camera area of the operator screen.
 *
 * - `pip`: one camera fills the area; every other camera is a window the operator can
 *   drag, resize and pop out to another monitor. A click on its picture makes it the
 *   main camera.
 * - `grid`: every camera side by side, with dividers that can be dragged.
 *
 * Every feed keeps its own element whatever the arrangement - only its place on screen
 * changes - so swapping cameras or layouts never restarts a video stream.
 *
 * Image controls (day/night, light, HD/SD, PTZ) stay out of the way: they appear when
 * the pointer is over a feed, or stay on screen once pinned.
 */

import { useRef, type CSSProperties } from 'react';
import { ExternalLink, VideoOff } from 'lucide-react';
import { CameraView } from '../camera/CameraView';
import { CameraControlBar, hasCameraControls } from '../camera/CameraControlBar';
import { useCameraStore } from '../../stores/camera-store';
import { cameraFloatKey, useOperatorUiStore } from '../../stores/operator-ui-store';
import { useWorkspaceStore } from '../../stores/workspace-store';
import type { CameraSourceConfig, OsdLayers } from '../../../shared/camera-types';
import type { OperatorFeeds } from './useOperatorFeeds';
import { FloatingWindow } from './FloatingWindow';
import { defaultThumbRect, dragDivider, gridShape, gridTracks, trackOffsets, type Size } from './float-layout';
import { t } from '../../i18n';

/** Component id of a camera popped out into its own window (see detached/component-registry). */
export const OPERATOR_CAMERA_WINDOW = 'operator-camera';

/** The status bar and the corner blocks already show these; drawn again on the video they collide. */
export function operatorOsd(osd: OsdLayers): OsdLayers {
  return { ...osd, cornerTelemetry: false, northIndicator: false };
}

/** Thumbnails and grid tiles carry no flight overlay: that belongs to the main picture. */
export function plainOsd(osd: OsdLayers): OsdLayers {
  return { ...operatorOsd(osd), hud: false, artificialHorizon: false, crosshair: false, frameCenterCoords: false };
}

export function FeedControls({ source, pinned, low = false }: { source: CameraSourceConfig; pinned: boolean; low?: boolean }) {
  if (!hasCameraControls(source)) return null;
  return (
    <div
      className={`absolute left-1/2 z-10 max-w-[calc(100%-0.5rem)] -translate-x-1/2 rounded-lg bg-black/70 px-2 py-1 transition-opacity ${low ? 'bottom-7' : 'top-2'} ${
        pinned ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover/feed:pointer-events-auto group-hover/feed:opacity-100'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <CameraControlBar source={source} compact />
    </div>
  );
}

/** Box of grid cell `index`, from the track sizes the dividers left. */
function gridCell(index: number, cols: number[], rows: number[]): CSSProperties {
  const x = trackOffsets(cols);
  const y = trackOffsets(rows);
  const c = index % cols.length;
  const r = Math.floor(index / cols.length);
  return { left: `${x[c]! * 100}%`, top: `${y[r]! * 100}%`, width: `${cols[c]! * 100}%`, height: `${(rows[r] ?? 1) * 100}%`, padding: 2 };
}

function popOut(source: CameraSourceConfig) {
  void window.electronAPI.openDetachedWindow({
    componentId: OPERATOR_CAMERA_WINDOW,
    instance: source.id,
    title: source.label,
    props: { sourceId: source.id },
    initialBounds: { width: 960, height: 600 },
  });
}

const HEADER_BTN = 'flex h-5 w-5 items-center justify-center rounded text-content-secondary hover:bg-surface-raised hover:text-content';

interface OperatorCamerasProps {
  feeds: OperatorFeeds;
  area: Size;
  /** The administrator may take away the pop-out buttons and the image controls. */
  allowPopOut?: boolean;
  controls?: boolean;
}

export function OperatorCameras({ feeds, area, allowPopOut = true, controls = true }: OperatorCamerasProps) {
  const { main, vehicle, selectMain } = feeds;
  const osd = useCameraStore((s) => s.osd);
  const layout = useOperatorUiStore((s) => s.layout);
  const pinned = useOperatorUiStore((s) => s.controlsPinned);
  const floats = useOperatorUiStore((s) => s.floats);
  const front = useOperatorUiStore((s) => s.front);
  const setFloat = useOperatorUiStore((s) => s.setFloat);
  const bringToFront = useOperatorUiStore((s) => s.bringToFront);
  const storedCols = useOperatorUiStore((s) => s.gridCols);
  const storedRows = useOperatorUiStore((s) => s.gridRows);
  const setGridTracks = useOperatorUiStore((s) => s.setGridTracks);
  const windows = useWorkspaceStore((s) => s.windows);
  const drag = useRef<{ axis: 'cols' | 'rows'; index: number; at: number; tracks: number[] } | null>(null);

  // A camera shown in its own window leaves this one, and comes back when that window closes.
  const sources = feeds.sources.filter((s) => windows[`${OPERATOR_CAMERA_WINDOW}:${s.id}`] === undefined);
  const shownMain = sources.find((s) => s.id === main?.id) ?? sources[0] ?? null;

  if (!shownMain) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black p-6 text-center text-content-secondary">
        <VideoOff className="h-10 w-10 text-content-tertiary" />
        <p className="text-sm">{feeds.sources.length > 0 ? t('operator.OperatorCameras.allPoppedOut') : t('operator.OperatorCameras.noCameras')}</p>
      </div>
    );
  }

  const view = operatorOsd(osd);
  const plain = plainOsd(osd);
  const grid = layout === 'grid' && sources.length > 1;
  const shape = gridShape(sources.length);
  const cols = gridTracks(storedCols, shape.cols);
  const rows = gridTracks(storedRows, shape.rows);
  let slot = 0;

  const dividerHandlers = (axis: 'cols' | 'rows', index: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      // Capture keeps the drag alive when the pointer outruns the handle; without it the drag still works over the handle.
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      drag.current = { axis, index, at: axis === 'cols' ? e.clientX : e.clientY, tracks: axis === 'cols' ? cols : rows };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || d.axis !== axis || d.index !== index) return;
      const total = axis === 'cols' ? area.width : area.height;
      if (total <= 0) return;
      setGridTracks(axis, dragDivider(d.tracks, index, ((axis === 'cols' ? e.clientX : e.clientY) - d.at) / total));
    },
    onPointerUp: () => { drag.current = null; },
    onPointerCancel: () => { drag.current = null; },
  });

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {sources.map((s, i) => {
        const isMain = s.id === shownMain.id;
        const thumb = !grid && !isMain;
        const key = cameraFloatKey(s.id);
        const docked: CSSProperties | undefined = grid ? gridCell(i, cols, rows) : isMain ? { inset: 0 } : undefined;
        const fallback = defaultThumbRect(thumb ? slot++ : 0, area);
        return (
          <FloatingWindow
            key={s.id}
            area={area}
            rect={floats[key]}
            fallback={fallback}
            onChange={(rect) => setFloat(key, rect)}
            onFocus={() => bringToFront(key)}
            front={front === key}
            docked={docked}
            title={s.label}
            tip={t('operator.OperatorCameras.dragTip')}
            actions={allowPopOut && (
              <button onClick={() => popOut(s)} className={HEADER_BTN} data-tip={t('operator.OperatorCameras.popOut')}>
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          >
            <div className={`relative h-full w-full overflow-hidden ${grid ? `rounded ${isMain ? 'ring-2 ring-blue-500' : 'ring-1 ring-white/10'}` : ''}`}>
              {/* isPrimary stays false: a click on the operator screen never steers a gimbal. */}
              <CameraView
                source={s}
                vehicle={vehicle}
                isPrimary={false}
                osd={isMain ? view : plain}
                onActivate={isMain ? undefined : () => selectMain(s.id)}
              />
              {!thumb && (
                <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-sm font-medium text-white">{s.label}</span>
              )}
              {grid && allowPopOut && (
                <button
                  onClick={(e) => { e.stopPropagation(); popOut(s); }}
                  className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover/feed:opacity-100"
                  data-tip={t('operator.OperatorCameras.popOut')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
              {controls && <FeedControls source={s} pinned={pinned} low={thumb} />}
            </div>
          </FloatingWindow>
        );
      })}

      {grid && trackOffsets(cols).slice(1, -1).map((x, i) => (
        <div
          key={`c${i}`}
          {...dividerHandlers('cols', i)}
          style={{ left: `calc(${x * 100}% - 4px)` }}
          className="absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-blue-500/60"
        />
      ))}
      {grid && trackOffsets(rows).slice(1, -1).map((y, i) => (
        <div
          key={`r${i}`}
          {...dividerHandlers('rows', i)}
          style={{ top: `calc(${y * 100}% - 4px)` }}
          className="absolute inset-x-0 z-20 h-2 cursor-row-resize touch-none bg-transparent transition-colors hover:bg-blue-500/60"
        />
      ))}
    </div>
  );
}
