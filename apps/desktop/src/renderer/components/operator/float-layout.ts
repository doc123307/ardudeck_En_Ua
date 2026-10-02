/**
 * Geometry of the operator screen's movable windows (camera thumbnails, the map) and
 * of the camera grid's adjustable tracks. Pure: no React, no DOM.
 *
 * A window's place is stored as fractions of the camera area, so it keeps its relative
 * spot and size when the app window is resized or moved to another monitor.
 */

/** Left, top, width, height as fractions (0..1) of the area. */
export interface FloatRect { x: number; y: number; w: number; h: number }

export interface Size { width: number; height: number }
export interface PixelRect { left: number; top: number; width: number; height: number }

export const MIN_FLOAT_WIDTH = 160;
export const MIN_FLOAT_HEIGHT = 110;
const MARGIN = 8;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/** Where the window is drawn: never smaller than the minimum, never outside the area. */
export function toPixels(rect: FloatRect, area: Size, minWidth = MIN_FLOAT_WIDTH, minHeight = MIN_FLOAT_HEIGHT): PixelRect {
  const width = clamp(rect.w * area.width, Math.min(minWidth, area.width), area.width);
  const height = clamp(rect.h * area.height, Math.min(minHeight, area.height), area.height);
  return {
    left: clamp(rect.x * area.width, 0, area.width - width),
    top: clamp(rect.y * area.height, 0, area.height - height),
    width,
    height,
  };
}

export function toFractions(px: PixelRect, area: Size): FloatRect {
  if (area.width <= 0 || area.height <= 0) return { x: 0, y: 0, w: 0.25, h: 0.25 };
  const r = (v: number) => Math.round(v * 10000) / 10000;
  return { x: r(px.left / area.width), y: r(px.top / area.height), w: r(px.width / area.width), h: r(px.height / area.height) };
}

/** The window dragged by (dx, dy) pixels, kept inside the area. */
export function movedBy(start: PixelRect, dx: number, dy: number, area: Size): PixelRect {
  return {
    ...start,
    left: clamp(start.left + dx, 0, area.width - start.width),
    top: clamp(start.top + dy, 0, area.height - start.height),
  };
}

/** The window with its bottom-right corner dragged by (dx, dy) pixels. */
export function resizedBy(start: PixelRect, dx: number, dy: number, area: Size, minWidth = MIN_FLOAT_WIDTH, minHeight = MIN_FLOAT_HEIGHT): PixelRect {
  return {
    ...start,
    width: clamp(start.width + dx, Math.min(minWidth, area.width), area.width - start.left),
    height: clamp(start.height + dy, Math.min(minHeight, area.height), area.height - start.top),
  };
}

/** Where the nth camera thumbnail starts out: a 16:9 column down the right edge. */
export function defaultThumbRect(slot: number, area: Size): FloatRect {
  const width = clamp(area.width * 0.2, MIN_FLOAT_WIDTH, 360);
  const height = Math.round((width * 9) / 16) + 24; // + its title strip
  return toFractions({
    left: area.width - width - MARGIN,
    top: MARGIN + slot * (height + MARGIN),
    width,
    height,
  }, area);
}

/** Where the map starts out: bottom-left corner. */
export function defaultMapRect(area: Size): FloatRect {
  const width = clamp(area.width * 0.24, 240, 420);
  const height = clamp(area.height * 0.38, 180, 320);
  return toFractions({ left: MARGIN + 4, top: area.height - height - MARGIN - 4, width, height }, area);
}

// ---- Camera grid --------------------------------------------------------------------

/** How many columns and rows a grid of `count` cameras has. */
export function gridShape(count: number): { cols: number; rows: number } {
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  return { cols, rows: Math.ceil(count / cols) };
}

const MIN_TRACK = 0.1;

/** Stored track sizes when they still fit this grid, equal tracks otherwise. Always sums to 1. */
export function gridTracks(stored: number[] | undefined, count: number): number[] {
  if (stored && stored.length === count && stored.every((v) => Number.isFinite(v) && v >= MIN_TRACK / 2)) {
    const sum = stored.reduce((a, b) => a + b, 0);
    if (sum > 0) return stored.map((v) => v / sum);
  }
  return Array.from({ length: count }, () => 1 / count);
}

/** Tracks after the divider behind track `index` is dragged by `delta` (a fraction of the whole). */
export function dragDivider(tracks: number[], index: number, delta: number): number[] {
  const a = tracks[index];
  const b = tracks[index + 1];
  if (a === undefined || b === undefined) return tracks;
  const move = clamp(delta, MIN_TRACK - a, b - MIN_TRACK);
  const round = (v: number) => Math.round(v * 10000) / 10000;
  const next = [...tracks];
  next[index] = round(a + move);
  next[index + 1] = round(b - move);
  return next;
}

/** Start offsets of each track, as fractions: [0, t0, t0+t1, ...]. */
export function trackOffsets(tracks: number[]): number[] {
  const out = [0];
  for (const t of tracks) out.push(out[out.length - 1]! + t);
  return out;
}
