import { describe, it, expect } from 'vitest';
import { flipTransform, panBy, viewToFrame, zoomAround, zoomTransform } from './view-transform';

describe('camera view transform', () => {
  it('maps a click straight through with no zoom or flip', () => {
    expect(viewToFrame(0.25, 0.75, null, {})).toEqual({ x: 0.25, y: 0.75 });
  });

  it('mirrors left and right for a rear-view camera', () => {
    expect(viewToFrame(0.2, 0.3, null, { mirror: true })).toEqual({ x: 0.8, y: 0.3 });
    expect(flipTransform({ mirror: true })).toBe('scale(-1, 1)');
  });

  it('turns an inverted camera the right way up', () => {
    const p = viewToFrame(0.2, 0.3, null, { rotate180: true });
    expect(p.x).toBeCloseTo(0.8);
    expect(p.y).toBeCloseTo(0.7);
    expect(flipTransform({ rotate180: true })).toBe('scale(-1, -1)');
    expect(flipTransform({ mirror: true, rotate180: true })).toBe('scale(1, -1)');
    expect(flipTransform({})).toBeUndefined();
  });

  it('keeps the point under the cursor when zooming', () => {
    const before = viewToFrame(0.8, 0.2, null, {});
    const zoom = zoomAround(null, 0.8, 0.2, 2);
    const after = viewToFrame(0.8, 0.2, zoom, {});
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    // the view centre now shows a quarter of the frame around that point
    expect(viewToFrame(0.5, 0.5, zoom, {}).x).toBeCloseTo(0.65);
  });

  it('applies zoom before the mirror, as the operator sees it', () => {
    const zoom = { z: 2, cx: 0.25, cy: 0.5 };
    // the shown picture's centre is shown point 0.25, which is camera point 0.75 when mirrored
    expect(viewToFrame(0.5, 0.5, zoom, { mirror: true }).x).toBeCloseTo(0.75);
  });

  it('pans opposite to the drag, slower when zoomed in', () => {
    expect(panBy({ z: 4, cx: 0.5, cy: 0.5 }, 0.2, 0)).toEqual({ z: 4, cx: 0.45, cy: 0.5 });
    expect(zoomTransform({ z: 2, cx: 0.25, cy: 0.5 })).toBe('scale(2) translate(25%, 0%)');
    expect(zoomTransform(null)).toBeUndefined();
  });
});
