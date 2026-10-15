import { describe, it, expect } from 'vitest';
import {
  CENTER_HOLD_MS, calibratePad, samePad, stickSetupAfterRest, stickSetupBegin, stickSetupComplete, stickSetupFeed,
  stickSetupProgress, stickSetupResult, stickSetupSkip, stickSetupTakeCenter, type RcPad, type StickSetup,
} from './operator-rc';

// A Radiomaster TX12 as EdgeTX shows it over USB: axis 0 aileron (right stick across), 1 elevator
// (right stick up reads negative), 2 throttle (left stick up/down, no spring), 3 rudder (left
// stick across), 4-7 sliders and switches. Its ends read about ±0.98, not ±1.
const ID = 'Radiomaster TX12 Joystick (Vendor: 1209 Product: 4f54)';
type Axes = { ail?: number; ele?: number; thr?: number; rud?: number };
const tx12 = ({ ail = 0.01, ele = -0.01, thr = 0.02, rud = 0 }: Axes): RcPad =>
  ({ id: ID, axes: [ail, ele, thr, rud, -1, -1, 0, 0], buttons: [] });

/** Feeds the readings one poll apart (50 ms) and returns the set-up after them. */
function feed(s: StickSetup, readings: Axes[], start = 0): { s: StickSetup; t: number } {
  let t = start;
  for (const r of readings) { t += 50; s = stickSetupFeed(s, tx12(r), t); }
  return { s, t };
}
const hold = (r: Axes) => Array.from({ length: Math.ceil(CENTER_HOLD_MS / 50) + 3 }, () => r);

/** One direction's whole cycle: one end, the other end, back to the middle and held. */
function cycle(s: StickSetup, t: number, end: Axes, other: Axes, middle: Axes) {
  return feed(s, [end, end, other, other, ...hold(middle)], t);
}

describe('stick set-up, one axis at a time', () => {
  it('takes every direction through its whole travel and keeps what it learned', () => {
    let s = stickSetupAfterRest(tx12({}));
    expect(s.step).toBe('lx:first');
    let t = 0;
    ({ s, t } = cycle(s, t, { rud: 0.98 }, { rud: -0.97 }, { rud: 0.01 }));
    expect(s.step).toBe('ly:first');
    // Throttle has no spring: it is left up after the first push and is put back in the middle by hand.
    ({ s, t } = cycle(s, t, { thr: 0.98 }, { thr: -0.98 }, { thr: 0.04 }));
    expect(s.step).toBe('rx:first');
    ({ s, t } = cycle(s, t, { ail: 0.97 }, { ail: -0.98 }, { ail: 0 }));
    ({ s, t } = cycle(s, t, { ele: -0.98 }, { ele: 0.98 }, { ele: -0.02 }));
    expect(s.step).toBe('check');
    expect(stickSetupComplete(s)).toEqual(['lx', 'ly', 'rx', 'ry']);

    const result = stickSetupResult(s)!;
    expect(result.sticks).toEqual({ lx: { axis: 3, invert: false }, ly: { axis: 2, invert: false }, rx: { axis: 0, invert: false }, ry: { axis: 1, invert: true } });
    // Throttle centre is where it was put, not where it rested.
    expect(result.axes[2]).toEqual({ min: -0.98, center: 0.04, max: 0.98 });
    // Full stroke reads full, the centre reads zero.
    const read = (r: Axes) => calibratePad(tx12(r), result).axes;
    expect(read({ thr: 0.98 })[2]).toBe(1);
    expect(read({ thr: -0.98 })[2]).toBe(-1);
    expect(read({ thr: 0.04 })[2]).toBe(0);
    expect(read({ ele: 0.98 })[1]).toBe(1);
    expect(read({ ail: 0.97 })[0]).toBe(1);
  });

  it('never waits for the other sticks to come back: a throttle left up does not hold it', () => {
    let s = stickSetupAfterRest(tx12({}));
    let t = 0;
    ({ s, t } = cycle(s, t, { rud: 0.98 }, { rud: -0.98 }, { rud: 0 }));
    ({ s, t } = cycle(s, t, { thr: 0.98 }, { thr: -0.98 }, { thr: 0 }));
    // The throttle is now left at the top while the right stick is shown.
    ({ s, t } = feed(s, [{ thr: 0.9, ail: 0.98 }], t));
    expect(s.step).toBe('rx:second');
  });

  it('still goes through when the throttle was left at the bottom instead of the middle', () => {
    let s = stickSetupAfterRest(tx12({ thr: -0.98 }));
    let t = 0;
    ({ s, t } = cycle(s, t, { thr: -0.98, rud: 0.98 }, { thr: -0.98, rud: -0.98 }, { thr: -0.98, rud: 0 }));
    ({ s, t } = cycle(s, t, { thr: 0.98 }, { thr: -0.98 }, { thr: 0.03 }));
    expect(s.step).toBe('rx:first');
    expect(s.axes[2]!.center).toBe(0.03);
  });

  it('does not move on from half a stroke', () => {
    let s = stickSetupAfterRest(tx12({}));
    let t = 0;
    ({ s, t } = feed(s, [{ rud: 0.98 }, { rud: -0.3 }, ...hold({ rud: 0 })], t));
    expect(s.step).toBe('lx:second');
    ({ s, t } = feed(s, [{ rud: -0.97 }], t));
    expect(s.step).toBe('lx:center');
  });

  it('takes the centre only once the stick is held still near the middle', () => {
    let s = stickSetupAfterRest(tx12({}));
    let t = 0;
    ({ s, t } = feed(s, [{ rud: 0.98 }, { rud: -0.98 }], t));
    expect(s.step).toBe('lx:center');
    // Still near the end: not the centre.
    ({ s, t } = feed(s, hold({ rud: -0.8 }), t));
    expect(s.step).toBe('lx:center');
    // Wobbling in the middle: the hold starts again each time.
    ({ s, t } = feed(s, [0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1].map((rud) => ({ rud })), t));
    expect(s.step).toBe('lx:center');
    ({ s, t } = feed(s, hold({ rud: 0.02 }), t));
    expect(s.step).toBe('ly:first');
    expect(s.axes[3]!.center).toBe(0.02);
  });

  it('lets the user say "this is the centre", and skip a stick that is not there', () => {
    let s = stickSetupAfterRest(tx12({}));
    ({ s } = feed(s, [{ rud: 0.98 }, { rud: -0.98 }]));
    s = stickSetupTakeCenter(s, tx12({ rud: 0.05 }));
    expect(s.step).toBe('ly:first');
    expect(s.axes[3]!.center).toBe(0.05);
    s = stickSetupSkip(s);
    expect(s.step).toBe('rx:first');
    s = stickSetupSkip(stickSetupSkip(s));
    expect(s.step).toBe('check');
    const result = stickSetupResult(s)!;
    expect(stickSetupComplete(s)).toEqual(['lx']);
    expect(result.axes[3]).toEqual({ min: -0.98, center: 0.05, max: 0.98 });
    // The throttle was never shown: left raw.
    expect(result.axes[2]).toBeNull();
  });

  it('a direction found but not finished keeps no half-learned calibration', () => {
    let s = stickSetupAfterRest(tx12({}));
    ({ s } = feed(s, [{ rud: 0.98 }]));
    s = stickSetupSkip(s);
    expect(stickSetupResult(s)?.axes[3] ?? null).toBeNull();
  });

  it('counts the steps for "step n of N"', () => {
    expect(stickSetupProgress('rest')).toEqual({ n: 1, total: 14 });
    expect(stickSetupProgress('lx:first')).toEqual({ n: 2, total: 14 });
    expect(stickSetupProgress('check')).toEqual({ n: 14, total: 14 });
  });

  it('ignores another device and starts from where the sticks rest', () => {
    const s = stickSetupBegin(tx12({ thr: -0.98 }));
    expect(s.step).toBe('rest');
    const other = stickSetupFeed(stickSetupAfterRest(tx12({})), { id: 'Other pad', axes: [1, 1, 1, 1], buttons: [] }, 50);
    expect(other.step).toBe('lx:first');
  });
});

describe('the same transmitter under a slightly different name', () => {
  it('matches by the USB ids', () => {
    expect(samePad(ID, ID)).toBe(true);
    expect(samePad(ID, 'TX12 Joystick (STANDARD GAMEPAD Vendor: 1209 Product: 4f54)')).toBe(true);
    expect(samePad(ID, 'Radiomaster TX16S Joystick (Vendor: 1209 Product: 4f55)')).toBe(false);
    expect(samePad('Radiomaster TX12 Joystick', 'Radiomaster TX12 Joystick')).toBe(true);
    expect(samePad('Radiomaster TX12 Joystick', 'Some Joystick')).toBe(false);
  });
});
