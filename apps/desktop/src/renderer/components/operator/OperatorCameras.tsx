/**
 * The camera area of the operator screen.
 *
 * - `pip`: one camera fills the area, the rest are thumbnails; a click on a thumbnail
 *   makes it the main camera.
 * - `grid`: every camera side by side.
 *
 * Every feed keeps its own element whatever the arrangement - only its place on screen
 * changes - so swapping cameras or layouts never restarts a video stream.
 *
 * Image controls (day/night, light, HD/SD) stay out of the way: they appear when the
 * pointer is over a feed, or stay on screen once pinned.
 */

import type { CSSProperties } from 'react';
import { VideoOff } from 'lucide-react';
import { CameraView } from '../camera/CameraView';
import { CameraControlBar, hasCameraControls } from '../camera/CameraControlBar';
import { useCameraStore } from '../../stores/camera-store';
import { useOperatorUiStore, type OperatorCameraLayout, type OperatorThumbSize } from '../../stores/operator-ui-store';
import type { CameraSourceConfig, OsdLayers } from '../../../shared/camera-types';
import type { OperatorFeeds } from './useOperatorFeeds';
import { t } from '../../i18n';

/** Thumbnail width in px; the height follows from 16:9. */
export const THUMB_WIDTH: Record<OperatorThumbSize, number> = { s: 160, m: 240, l: 320 };
const THUMB_GAP = 8;

/** Where one feed sits inside the camera area. */
export function feedPlace(
  index: number,
  count: number,
  mainIndex: number,
  layout: OperatorCameraLayout,
  thumbSize: OperatorThumbSize,
): CSSProperties {
  if (layout === 'grid' && count > 1) {
    const cols = count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    return {
      left: `${((index % cols) * 100) / cols}%`,
      top: `${(Math.floor(index / cols) * 100) / rows}%`,
      width: `${100 / cols}%`,
      height: `${100 / rows}%`,
      padding: 2,
    };
  }
  if (index === mainIndex) return { inset: 0 };
  const slot = index < mainIndex ? index : index - 1;
  const width = THUMB_WIDTH[thumbSize];
  const height = Math.round((width * 9) / 16);
  return { right: THUMB_GAP, top: THUMB_GAP + slot * (height + THUMB_GAP), width, height, zIndex: 10 };
}

/** The status bar and the corner blocks already show these; drawn again on the video they collide. */
function operatorOsd(osd: OsdLayers): OsdLayers {
  return { ...osd, cornerTelemetry: false, northIndicator: false };
}

function FeedControls({ source, pinned }: { source: CameraSourceConfig; pinned: boolean }) {
  if (!hasCameraControls(source)) return null;
  return (
    <div
      className={`absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-lg bg-black/70 px-2 py-1 transition-opacity ${
        pinned ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover/feed:pointer-events-auto group-hover/feed:opacity-100'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <CameraControlBar source={source} compact />
    </div>
  );
}

export function OperatorCameras({ feeds }: { feeds: OperatorFeeds }) {
  const { sources, main, vehicle, selectMain } = feeds;
  const osd = useCameraStore((s) => s.osd);
  const layout = useOperatorUiStore((s) => s.layout);
  const thumbSize = useOperatorUiStore((s) => s.thumbSize);
  const pinned = useOperatorUiStore((s) => s.controlsPinned);

  if (!main) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black p-6 text-center text-content-secondary">
        <VideoOff className="h-10 w-10 text-content-tertiary" />
        <p className="text-sm">{t('operator.OperatorCameras.noCameras')}</p>
      </div>
    );
  }

  const view = operatorOsd(osd);
  const plain: OsdLayers = { ...view, hud: false, artificialHorizon: false, crosshair: false, frameCenterCoords: false };
  const grid = layout === 'grid' && sources.length > 1;
  const mainIndex = sources.findIndex((s) => s.id === main.id);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {sources.map((s, i) => {
        const isMain = i === mainIndex;
        const thumb = !grid && !isMain;
        return (
          <div
            key={s.id}
            style={feedPlace(i, sources.length, mainIndex, layout, thumbSize)}
            data-tip={thumb ? t('operator.OperatorCameras.makeMain', { name: s.label }) : undefined}
            className="group/feed absolute"
          >
            <div className={`relative h-full w-full overflow-hidden ${
              thumb ? 'rounded-lg border border-white/25 shadow-lg hover:border-blue-400' : grid ? `rounded ${isMain ? 'ring-2 ring-blue-500' : 'ring-1 ring-white/10'}` : ''
            }`}>
              {/* isPrimary stays false: a click on the operator screen never steers a gimbal. */}
              <CameraView
                source={s}
                vehicle={vehicle}
                isPrimary={false}
                osd={isMain ? view : plain}
                onActivate={isMain ? undefined : () => selectMain(s.id)}
              />
              <span className={`pointer-events-none absolute left-2 rounded bg-black/60 px-1.5 py-0.5 font-medium text-white ${
                thumb ? 'bottom-1 text-[11px]' : 'top-2 text-sm'
              }`}>{s.label}</span>
              {!thumb && <FeedControls source={s} pinned={pinned} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
