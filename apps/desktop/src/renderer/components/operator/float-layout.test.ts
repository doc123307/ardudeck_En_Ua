import { describe, it, expect } from 'vitest';
import {
  defaultMapRect, defaultThumbRect, dragDivider, gridShape, gridTracks, movedBy, resizedBy, toFractions, toPixels, trackOffsets,
} from './float-layout';

const area = { width: 1000, height: 500 };

describe('window placement', () => {
  it('survives a round trip through fractions', () => {
    const px = { left: 100, top: 50, width: 300, height: 200 };
    expect(toPixels(toFractions(px, area), area)).toEqual(px);
  });

  it('keeps its relative place when the area changes', () => {
    const rect = toFractions({ left: 500, top: 250, width: 250, height: 125 }, area);
    expect(toPixels(rect, { width: 2000, height: 1000 })).toEqual({ left: 1000, top: 500, width: 500, height: 250 });
  });

  it('is pulled back inside an area that became too small, and never shrinks below the minimum', () => {
    const rect = toFractions({ left: 800, top: 400, width: 200, height: 100 }, area);
    const small = toPixels(rect, { width: 400, height: 300 });
    expect(small.width).toBe(160);
    expect(small.height).toBe(110);
    expect(small.left + small.width).toBeLessThanOrEqual(400);
    expect(small.top + small.height).toBeLessThanOrEqual(300);
  });

  it('cannot be dragged out of the area', () => {
    const start = { left: 100, top: 50, width: 300, height: 200 };
    expect(movedBy(start, -500, -500, area)).toMatchObject({ left: 0, top: 0 });
    expect(movedBy(start, 5000, 5000, area)).toMatchObject({ left: 700, top: 300 });
    expect(movedBy(start, 20, 30, area)).toMatchObject({ left: 120, top: 80, width: 300, height: 200 });
  });

  it('resizes from the corner between the minimum and the edge of the area', () => {
    const start = { left: 100, top: 50, width: 300, height: 200 };
    expect(resizedBy(start, 50, -40, area)).toMatchObject({ width: 350, height: 160 });
    expect(resizedBy(start, -1000, -1000, area)).toMatchObject({ width: 160, height: 110 });
    expect(resizedBy(start, 5000, 5000, area)).toMatchObject({ width: 900, height: 450 });
  });

  it('starts thumbnails in a column on the right and the map bottom-left', () => {
    const first = toPixels(defaultThumbRect(0, area), area);
    const second = toPixels(defaultThumbRect(1, area), area);
    expect(first.left + first.width).toBeCloseTo(992, 0);
    expect(second.top).toBeGreaterThan(first.top + first.height);
    const map = toPixels(defaultMapRect(area), area);
    expect(map.left).toBeLessThan(20);
    expect(map.top + map.height).toBeGreaterThan(480);
  });
});

describe('camera grid', () => {
  it('uses two columns up to four cameras, three beyond', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => gridShape(n))).toEqual([
      { cols: 1, rows: 1 }, { cols: 2, rows: 1 }, { cols: 2, rows: 2 }, { cols: 2, rows: 2 }, { cols: 3, rows: 2 }, { cols: 3, rows: 2 },
    ]);
  });

  it('falls back to equal tracks when the stored ones do not fit', () => {
    expect(gridTracks(undefined, 2)).toEqual([0.5, 0.5]);
    expect(gridTracks([0.7, 0.3], 3)).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(gridTracks([0.7, 0.3], 2)).toEqual([0.7, 0.3]);
    // stored values are renormalised
    expect(gridTracks([2, 2], 2)).toEqual([0.5, 0.5]);
  });

  it('moves a divider without squeezing a track below a tenth', () => {
    expect(dragDivider([0.5, 0.5], 0, 0.2)).toEqual([0.7, 0.3]);
    expect(dragDivider([0.5, 0.5], 0, 0.9)[0]).toBeCloseTo(0.9);
    expect(dragDivider([0.5, 0.5], 0, -0.9)[0]).toBeCloseTo(0.1);
    expect(dragDivider([0.2, 0.3, 0.5], 1, -0.1)).toEqual([0.2, 0.2, 0.6]);
  });

  it('gives the start of each track', () => {
    expect(trackOffsets([0.25, 0.75])).toEqual([0, 0.25, 1]);
  });
});
