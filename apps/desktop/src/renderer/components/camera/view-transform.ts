/**
 * Digital zoom, mirror and 180° rotation of a camera view, and the inverse mapping a
 * click needs: the gimbal must point at what the operator sees under the cursor, not at
 * the spot that would be there without zoom or mirror.
 *
 * Coordinates: `p` is the click within the view (0..1 from top-left); the frame point
 * is in the camera's own image (0..1), before mirroring.
 */

import type { CameraZoom } from '../../stores/camera-store';

export interface ViewFlags { mirror?: boolean; rotate180?: boolean }

/** Frame point under view point `p` (0..1). */
export function viewToFrame(px: number, py: number, zoom: CameraZoom | null, flags: ViewFlags): { x: number; y: number } {
  const z = zoom?.z ?? 1;
  // Zoom acts on the picture as shown (after mirror/rotation), so undo it first...
  let x = (zoom?.cx ?? 0.5) + (px - 0.5) / z;
  let y = (zoom?.cy ?? 0.5) + (py - 0.5) / z;
  // ...then the flips, which map the shown picture back onto the camera's image.
  if (flags.mirror) x = 1 - x;
  if (flags.rotate180) { x = 1 - x; y = 1 - y; }
  return { x, y };
}

/** Zoom by `factor` keeping the point under the cursor (`px`, `py`, 0..1) where it is. */
export function zoomAround(zoom: CameraZoom | null, px: number, py: number, factor: number): CameraZoom {
  const z = zoom?.z ?? 1;
  const cx = zoom?.cx ?? 0.5;
  const cy = zoom?.cy ?? 0.5;
  const nz = z * factor;
  // Shown-picture point under the cursor stays put: c + (p-0.5)/z == c' + (p-0.5)/z'
  return {
    z: nz,
    cx: cx + (px - 0.5) / z - (px - 0.5) / nz,
    cy: cy + (py - 0.5) / z - (py - 0.5) / nz,
  };
}

/** Pan by a drag of `dx`, `dy` view fractions. */
export function panBy(zoom: CameraZoom, dx: number, dy: number): CameraZoom {
  return { z: zoom.z, cx: zoom.cx - dx / zoom.z, cy: zoom.cy - dy / zoom.z };
}

/** CSS transform for the wrapper that zooms the shown picture. */
export function zoomTransform(zoom: CameraZoom | null): string | undefined {
  if (!zoom) return undefined;
  return `scale(${zoom.z}) translate(${(0.5 - zoom.cx) * 100}%, ${(0.5 - zoom.cy) * 100}%)`;
}

/** CSS transform for the video element itself: mirror and rotation. */
export function flipTransform(flags: ViewFlags): string | undefined {
  const sx = (flags.mirror ? -1 : 1) * (flags.rotate180 ? -1 : 1);
  const sy = flags.rotate180 ? -1 : 1;
  return sx === 1 && sy === 1 ? undefined : `scale(${sx}, ${sy})`;
}
