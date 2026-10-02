import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RC_CONFIG, RC_IGNORE, composeChannels, driveCommand, driveSticks, functionFromPad, functionInitial, functionPwm,
  functionRest, newRcFunction, normalizeRcConfig, rcChannelConflicts, rcReleaseValue, rcUsesJoystick, shapeStick, stickPwm,
  type OperatorRcFunction, type RcButtonFunction, type RcInput, type RcPad, type RcSliderFunction, type RcSwitchFunction,
} from './operator-rc';

const pad = (axes: number[] = [], buttons: boolean[] = []): RcPad => ({ id: 'test pad', axes, buttons });
const common = (input: RcInput) => ({ id: 'f', label: 'F', channel: 9, input, sendOnConnect: false });
const button = (latching: boolean, input: RcInput): RcButtonFunction => ({ ...common(input), kind: 'button', latching, offPwm: 1000, onPwm: 2000 });
const switch3 = (springCenter: boolean, input: RcInput): RcSwitchFunction => ({ ...common(input), kind: 'switch3', springCenter, lowPwm: 1000, midPwm: 1500, highPwm: 2000 });
const slider = (spring: RcSliderFunction['spring'], input: RcInput): RcSliderFunction => ({ ...common(input), kind: 'slider', spring, minPwm: 1000, maxPwm: 2000 });

/** Feeds readings one after another, the way the joystick does, and returns the final position. */
function play(fn: OperatorRcFunction, readings: RcPad[], start = functionInitial(fn), dtMs = 20): number {
  let value = start;
  for (let i = 1; i < readings.length; i++) value = functionFromPad(fn, value, readings[i - 1]!, readings[i]!, dtMs);
  return value;
}

describe('configuration', () => {
  it('gives the defaults for nothing or nonsense', () => {
    expect(normalizeRcConfig(null)).toEqual(DEFAULT_RC_CONFIG);
    expect(normalizeRcConfig('x')).toEqual(DEFAULT_RC_CONFIG);
    expect(normalizeRcConfig({})).toEqual(DEFAULT_RC_CONFIG);
  });

  it('does not hand out the default object itself', () => {
    const a = normalizeRcConfig(null);
    a.functions.pop();
    expect(DEFAULT_RC_CONFIG.functions).toHaveLength(3);
  });

  it('clamps numbers and drops broken functions', () => {
    const c = normalizeRcConfig({
      drive: { steerChannel: 40, throttleLimit: 500, deadband: 2, pwmMin: 100, pwmMax: 900, pwmTrim: 5000 },
      cruise: { stepPercent: 0 },
      functions: [
        { id: 'a', kind: 'button', channel: 99, onPwm: 9000 },
        { id: 'a', kind: 'button', channel: 6 },
        { id: 'bad id!', kind: 'slider' },
        { id: 'b', kind: 'lever' },
        { id: 'c', kind: 'slider', spring: 'sideways', input: { kind: 'axis', index: 2 } },
      ],
    });
    expect(c.drive.steerChannel).toBe(16);
    expect(c.drive.throttleLimit).toBe(100);
    expect(c.drive.deadband).toBe(0.5);
    expect(c.drive.pwmMin).toBe(800);
    expect(c.drive.pwmMax).toBe(900);
    expect(c.drive.pwmTrim).toBe(850);
    expect(c.cruise.stepPercent).toBe(1);
    expect(c.functions.map((f) => f.id)).toEqual(['a', 'c']);
    expect(c.functions[0]).toMatchObject({ channel: 16, onPwm: 2200, label: 'AUX 16' });
    expect(c.functions[1]).toMatchObject({ kind: 'slider', spring: 'none', input: { kind: 'axis', index: 2, reverse: false } });
  });

  it('keeps an empty function list empty', () => {
    expect(normalizeRcConfig({ functions: [] }).functions).toEqual([]);
  });

  it('adds a new function on a free channel with a free id', () => {
    const fn = newRcFunction('switch3', DEFAULT_RC_CONFIG);
    expect(fn.channel).toBe(5);
    expect(DEFAULT_RC_CONFIG.functions.some((f) => f.id === fn.id)).toBe(false);
    expect(fn.kind).toBe('switch3');
  });

  it('reports channels claimed twice', () => {
    const c = normalizeRcConfig({ functions: [{ id: 'a', kind: 'button', channel: 3 }, { id: 'b', kind: 'button', channel: 9 }, { id: 'c', kind: 'slider', channel: 9 }] });
    expect(rcChannelConflicts(c)).toEqual([3, 9]);
    expect(rcChannelConflicts(DEFAULT_RC_CONFIG)).toEqual([]);
  });

  it('knows whether a joystick is needed at all', () => {
    const quiet = normalizeRcConfig({ drive: { enabled: false } });
    expect(rcUsesJoystick(quiet)).toBe(false);
    expect(rcUsesJoystick(DEFAULT_RC_CONFIG)).toBe(true);
    expect(rcUsesJoystick({ ...quiet, cruise: { ...quiet.cruise, toggleButton: 4 } })).toBe(true);
  });
});

describe('driving', () => {
  it('shapes a stick: dead around the centre, full at the end', () => {
    expect(shapeStick(0.03, 0.05, 0)).toBe(0);
    expect(shapeStick(1, 0.05, 0.5)).toBeCloseTo(1);
    expect(shapeStick(-1, 0.05, 0.5)).toBeCloseTo(-1);
    expect(shapeStick(0.5, 0, 1)).toBeCloseTo(0.125);
  });

  it('reads forward from a stick pushed away', () => {
    const s = driveSticks(DEFAULT_RC_CONFIG.drive, pad([0.5, -1]));
    expect(s.throttle).toBeCloseTo(1);
    expect(s.steer).toBeGreaterThan(0);
    expect(driveSticks(DEFAULT_RC_CONFIG.drive, null)).toEqual({ steer: 0, throttle: 0 });
  });

  it('passes the sticks through in normal driving', () => {
    expect(driveCommand({ steer: 0.3, throttle: 0.6 }, { reverse: false, invertSteering: true, cruiseOn: false, cruiseValue: 0 }))
      .toEqual({ steer: 0.3, throttle: 0.6, cruiseCancelled: false });
  });

  it('drives tail-first in reverse: forward is back, right is left', () => {
    const on = { reverse: true, invertSteering: true, cruiseOn: false, cruiseValue: 0 };
    expect(driveCommand({ steer: 0.3, throttle: 0.6 }, on)).toEqual({ steer: -0.3, throttle: -0.6, cruiseCancelled: false });
    expect(driveCommand({ steer: 0.3, throttle: 0.6 }, { ...on, invertSteering: false }).steer).toBe(0.3);
  });

  it('holds the cruise throttle, lets the stick add, and lets go on braking', () => {
    const cruise = { reverse: false, invertSteering: true, cruiseOn: true, cruiseValue: 0.4 };
    expect(driveCommand({ steer: 0, throttle: 0 }, cruise).throttle).toBe(0.4);
    expect(driveCommand({ steer: 0, throttle: 0.7 }, cruise).throttle).toBe(0.7);
    expect(driveCommand({ steer: 0, throttle: -0.1 }, cruise)).toMatchObject({ throttle: 0.4, cruiseCancelled: false });
    expect(driveCommand({ steer: 0, throttle: -0.5 }, cruise)).toMatchObject({ throttle: -0.5, cruiseCancelled: true });
  });

  it('cruises tail-first in reverse', () => {
    expect(driveCommand({ steer: 0, throttle: 0 }, { reverse: true, invertSteering: true, cruiseOn: true, cruiseValue: 0.4 }).throttle).toBe(-0.4);
  });

  it('turns a stick into microseconds around the trim', () => {
    expect(stickPwm(0, 1000, 1500, 2000)).toBe(1500);
    expect(stickPwm(1, 1000, 1500, 2000)).toBe(2000);
    expect(stickPwm(-1, 1000, 1500, 2000)).toBe(1000);
    expect(stickPwm(-0.5, 1100, 1500, 1900)).toBe(1300);
    expect(stickPwm(5, 1000, 1500, 2000)).toBe(2000);
  });
});

describe('functions', () => {
  it('start where an untouched control sits', () => {
    expect(functionInitial(button(true, { kind: 'none' }))).toBe(0);
    expect(functionInitial(switch3(true, { kind: 'none' }))).toBe(0);
    expect(functionInitial(switch3(false, { kind: 'none' }))).toBe(-1);
    expect(functionInitial(slider('center', { kind: 'none' }))).toBe(0.5);
    expect(functionInitial(slider('max', { kind: 'none' }))).toBe(1);
    expect(functionInitial(slider('none', { kind: 'none' }))).toBe(0);
  });

  it('know where they spring back to', () => {
    expect(functionRest(button(true, { kind: 'none' }))).toBeNull();
    expect(functionRest(button(false, { kind: 'none' }))).toBe(0);
    expect(functionRest(switch3(true, { kind: 'none' }))).toBe(0);
    expect(functionRest(switch3(false, { kind: 'none' }))).toBeNull();
    expect(functionRest(slider('min', { kind: 'none' }))).toBe(0);
    expect(functionRest(slider('none', { kind: 'none' }))).toBeNull();
  });

  it('turn a position into microseconds', () => {
    expect(functionPwm(button(true, { kind: 'none' }), 1)).toBe(2000);
    expect(functionPwm(button(true, { kind: 'none' }), 0)).toBe(1000);
    expect(functionPwm(switch3(false, { kind: 'none' }), -1)).toBe(1000);
    expect(functionPwm(switch3(false, { kind: 'none' }), 0)).toBe(1500);
    expect(functionPwm(switch3(false, { kind: 'none' }), 1)).toBe(2000);
    expect(functionPwm(slider('none', { kind: 'none' }), 0.25)).toBe(1250);
    expect(functionPwm(slider('none', { kind: 'none' }), 7)).toBe(2000);
  });

  it('do not move without a joystick binding or a previous reading', () => {
    expect(functionFromPad(button(true, { kind: 'none' }), 0, pad([], [false]), pad([], [true]), 20)).toBe(0);
    expect(functionFromPad(button(true, { kind: 'button', index: 0 }), 0, null, pad([], [true]), 20)).toBe(0);
  });

  const up = pad([], [true]);
  const off = pad([], [false]);

  it('latching button: each press flips it', () => {
    const fn = button(true, { kind: 'button', index: 0 });
    expect(play(fn, [off, up])).toBe(1);
    expect(play(fn, [off, up, up, off])).toBe(1);
    expect(play(fn, [off, up, off, up])).toBe(0);
  });

  it('momentary button: on while held', () => {
    const fn = button(false, { kind: 'button', index: 0 });
    expect(play(fn, [off, up, up])).toBe(1);
    expect(play(fn, [off, up, off])).toBe(0);
  });

  it('button on two buttons: one is on, the other off', () => {
    const fn = button(true, { kind: 'buttons', down: 0, up: 1 });
    expect(play(fn, [pad([], [false, false]), pad([], [false, true]), pad([], [false, false])])).toBe(1);
    expect(play(fn, [pad([], [false, false]), pad([], [true, false])], 1)).toBe(0);
  });

  it('button on an axis: crossing the half-way point', () => {
    expect(play(button(false, { kind: 'axis', index: 0, reverse: false }), [pad([0]), pad([0.9])])).toBe(1);
    expect(play(button(false, { kind: 'axis', index: 0, reverse: false }), [pad([0]), pad([0.9]), pad([0.1])])).toBe(0);
    expect(play(button(true, { kind: 'axis', index: 0, reverse: false }), [pad([0]), pad([0.9]), pad([0.1])])).toBe(1);
    expect(play(button(false, { kind: 'axis', index: 0, reverse: true }), [pad([0]), pad([-0.9])])).toBe(1);
  });

  const none = pad([], [false, false]);
  const lo = pad([], [true, false]);
  const hi = pad([], [false, true]);

  it('three-position switch that stays: two buttons step it', () => {
    const fn = switch3(false, { kind: 'buttons', down: 0, up: 1 });
    expect(play(fn, [none, hi])).toBe(0);
    expect(play(fn, [none, hi, none, hi])).toBe(1);
    expect(play(fn, [none, hi, none, hi, none, hi])).toBe(1);
    expect(play(fn, [none, lo], 1)).toBe(0);
  });

  it('three-position switch with a spring: follows the buttons, centre when let go', () => {
    const fn = switch3(true, { kind: 'buttons', down: 0, up: 1 });
    expect(play(fn, [none, hi])).toBe(1);
    expect(play(fn, [none, hi, hi])).toBe(1);
    expect(play(fn, [none, hi, none])).toBe(0);
    expect(play(fn, [none, lo])).toBe(-1);
  });

  it('three-position switch on one button: cycles, or high while held', () => {
    expect(play(switch3(false, { kind: 'button', index: 0 }), [off, up])).toBe(0);
    expect(play(switch3(false, { kind: 'button', index: 0 }), [off, up, off, up, off, up])).toBe(-1);
    expect(play(switch3(true, { kind: 'button', index: 0 }), [off, up])).toBe(1);
    expect(play(switch3(true, { kind: 'button', index: 0 }), [off, up, off])).toBe(0);
  });

  it('three-position switch on an axis', () => {
    const axis: RcInput = { kind: 'axis', index: 0, reverse: false };
    expect(play(switch3(true, axis), [pad([0]), pad([0.9])])).toBe(1);
    expect(play(switch3(true, axis), [pad([0]), pad([0.9]), pad([0])])).toBe(0);
    expect(play(switch3(true, axis), [pad([0]), pad([-0.9])])).toBe(-1);
    // One that stays is stepped by each push of a self-centring stick.
    expect(play(switch3(false, axis), [pad([0]), pad([0.9]), pad([0])])).toBe(0);
    expect(play(switch3(false, axis), [pad([0]), pad([0.9]), pad([0]), pad([0.9]), pad([0])])).toBe(1);
  });

  it('slider with a spring follows the stick; the stick centre is its rest', () => {
    const axis: RcInput = { kind: 'axis', index: 0, reverse: false };
    expect(play(slider('center', axis), [pad([0]), pad([1])])).toBe(1);
    expect(play(slider('center', axis), [pad([0]), pad([1]), pad([0])])).toBe(0.5);
    expect(play(slider('min', axis), [pad([0]), pad([0.6])])).toBeCloseTo(0.6);
    expect(play(slider('min', axis), [pad([0]), pad([-0.6])])).toBe(0);
    expect(play(slider('max', axis), [pad([0]), pad([-0.25])])).toBeCloseTo(0.75);
  });

  it('slider without a spring is moved at a steady rate and stays', () => {
    const axis: RcInput = { kind: 'axis', index: 0, reverse: false };
    const fn = slider('none', axis);
    const pushed = Array.from({ length: 16 }, () => pad([1]));
    expect(play(fn, pushed, 0, 100)).toBeCloseTo(1);
    expect(play(fn, [pad([1]), pad([1]), pad([0]), pad([0])], 0, 150)).toBeCloseTo(0.1);
    expect(play(fn, [pad([0.05]), pad([0.05])], 0.3, 150)).toBe(0.3);
  });

  it('slider on two buttons: moves while held, springs back when let go', () => {
    const buttons: RcInput = { kind: 'buttons', down: 0, up: 1 };
    expect(play(slider('none', buttons), [none, hi, hi, none], 0, 150)).toBeCloseTo(0.2);
    expect(play(slider('center', buttons), [none, hi, hi], 0.5, 150)).toBeCloseTo(0.7);
    expect(play(slider('center', buttons), [none, hi, hi, none], 0.5, 150)).toBe(0.5);
  });

  it('slider on one button: jumps to the far end', () => {
    expect(play(slider('min', { kind: 'button', index: 0 }), [off, up])).toBe(1);
    expect(play(slider('min', { kind: 'button', index: 0 }), [off, up, off])).toBe(0);
    expect(play(slider('max', { kind: 'button', index: 0 }), [off, up])).toBe(0);
    expect(play(slider('none', { kind: 'button', index: 0 }), [off, up, off, up], 0)).toBe(0);
  });
});

describe('the frame', () => {
  it('leaves every channel alone when nothing is in use', () => {
    const frame = composeChannels(DEFAULT_RC_CONFIG, new Map(), {});
    expect(frame).toHaveLength(18);
    expect(frame.every((v) => v === RC_IGNORE)).toBe(true);
  });

  it('carries only the functions in use and the driving channels', () => {
    const frame = composeChannels(
      DEFAULT_RC_CONFIG,
      new Map([['aux9', { value: 1, active: true }], ['aux10', { value: 1, active: false }], ['aux11', { value: 0.5, active: true }]]),
      { steerPwm: 1600, throttlePwm: 1400 },
    );
    expect(frame[0]).toBe(1600);
    expect(frame[2]).toBe(1400);
    expect(frame[8]).toBe(2000);
    expect(frame[9]).toBe(RC_IGNORE);
    expect(frame[10]).toBe(1500);
    expect(frame.filter((v) => v !== RC_IGNORE)).toHaveLength(4);
  });

  it('lets driving win a channel a function also claims', () => {
    const config = normalizeRcConfig({ functions: [{ id: 'a', kind: 'button', channel: 3 }] });
    expect(composeChannels(config, new Map([['a', { value: 1, active: true }]]), { throttlePwm: 1500 })[2]).toBe(1500);
  });

  it('releases low channels with 0 and high ones with 65534', () => {
    expect(rcReleaseValue(0)).toBe(0);
    expect(rcReleaseValue(7)).toBe(0);
    expect(rcReleaseValue(8)).toBe(65534);
    expect(rcReleaseValue(17)).toBe(65534);
  });
});
