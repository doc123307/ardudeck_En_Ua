import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OperatorRcEngine, RC_TICK_MS } from './operator-rc-engine';
import { DEFAULT_RC_CONFIG, RC_IGNORE, normalizeRcConfig, type RcEngineState, type RcPad } from '../../shared/operator-rc';

const pad = (axes: number[] = [0, 0], buttons: boolean[] = []): RcPad => ({ id: 'bench stick', axes, buttons });

describe('OperatorRcEngine', () => {
  let frames: number[][];
  let linkUp: boolean;
  let states: RcEngineState[];
  let engine: OperatorRcEngine;

  /** Lets `ms` pass with the joystick held at `reading`, reported every 20 ms as a window would. */
  const hold = (reading: RcPad, ms: number) => {
    for (let t = 0; t < ms; t += 20) {
      engine.gamepad(reading);
      vi.advanceTimersByTime(20);
    }
  };
  const last = () => frames[frames.length - 1]!;
  const steer = () => last()[0];
  const throttle = () => last()[2];

  beforeEach(() => {
    vi.useFakeTimers();
    frames = [];
    states = [];
    linkUp = true;
    engine = new OperatorRcEngine({ linkUp: () => linkUp, send: (f) => { frames.push([...f]); }, onState: (s) => states.push(s) });
    engine.setConfig(structuredClone(DEFAULT_RC_CONFIG));
    engine.attach();
  });
  afterEach(() => {
    engine.dispose();
    vi.useRealTimers();
  });

  it('sends nothing while nothing is in use', () => {
    vi.advanceTimersByTime(1000);
    expect(frames).toHaveLength(0);
  });

  it('sends nothing for a joystick nobody took control with', () => {
    hold(pad([0.8, -0.8]), 500);
    expect(frames).toHaveLength(0);
    expect(engine.state().padLive).toBe(true);
  });

  it('sends a function only once it has been used, then keeps sending it', async () => {
    engine.setFunction('aux9', 1);
    await vi.advanceTimersByTimeAsync(RC_TICK_MS * 4);
    expect(frames.length).toBeGreaterThanOrEqual(3);
    expect(last()[8]).toBe(2000);
    expect(last().filter((v) => v !== RC_IGNORE)).toHaveLength(1);
    expect(engine.state().functions.aux9).toEqual({ value: 1, active: true });
    expect(engine.state().functions.aux10!.active).toBe(false);
  });

  it('sends a "from connection" function without waiting for the operator', () => {
    engine.detach();
    const config = normalizeRcConfig({ functions: [{ id: 'lights', kind: 'button', channel: 7, sendOnConnect: true }] });
    engine.setConfig(config);
    engine.attach();
    vi.advanceTimersByTime(RC_TICK_MS * 2);
    expect(last()[6]).toBe(1000);
  });

  it('refuses joystick control without a joystick or with the stick deflected', () => {
    expect(engine.setDrive(true)).toEqual({ ok: false, reason: 'no-joystick' });
    engine.gamepad(pad([0, -0.9]));
    expect(engine.setDrive(true)).toEqual({ ok: false, reason: 'not-centred' });
    engine.gamepad(pad([0, 0]));
    expect(engine.setDrive(true)).toEqual({ ok: true });
  });

  it('drives: stick forward and right goes out as throttle up and steering right', () => {
    hold(pad(), 60);
    engine.setDrive(true);
    hold(pad([1, -1]), 200);
    expect(steer()).toBe(2000);
    expect(throttle()).toBe(2000);
    expect(engine.state().drive).toMatchObject({ engaged: true, live: true });
    hold(pad([0, 1]), 100);
    expect(throttle()).toBe(1000);
  });

  it('caps the throttle at the administrator\'s limit', () => {
    engine.setConfig(normalizeRcConfig({ drive: { throttleLimit: 50 } }));
    hold(pad(), 60);
    engine.setDrive(true);
    hold(pad([0, -1]), 200);
    expect(throttle()).toBe(1750);
  });

  it('stops and lets go when the joystick goes quiet, and wants the stick centred to resume', () => {
    hold(pad(), 60);
    engine.setDrive(true);
    hold(pad([0, -1]), 200);
    expect(throttle()).toBe(2000);
    frames = [];
    vi.advanceTimersByTime(1500); // no readings: window not in front
    const sent = frames.map((f) => f[2]);
    expect(sent.slice(0, 5).every((v) => v === 1500 || v === 2000)).toBe(true);
    expect(sent).toContain(1500);
    expect(sent[sent.length - 1]).toBe(0); // released back to the receiver
    expect(engine.state().drive).toMatchObject({ engaged: true, live: false });
    const quietAfter = frames.length;
    vi.advanceTimersByTime(500);
    expect(frames).toHaveLength(quietAfter);

    // Readings are back but the stick is still pushed: no control yet.
    hold(pad([0, -1]), 200);
    expect(frames).toHaveLength(quietAfter);
    hold(pad([0, 0]), 100);
    hold(pad([0, -1]), 100);
    expect(throttle()).toBe(2000);
  });

  it('hands the driving channels back when control is dropped', () => {
    hold(pad(), 60);
    engine.setDrive(true);
    hold(pad([0.5, -0.5]), 200);
    engine.setDrive(false);
    frames = [];
    hold(pad([0.5, -0.5]), 1000);
    const throttles = frames.map((f) => f[2]);
    expect(throttles.filter((v) => v === 1500).length).toBe(5);
    expect(throttles.filter((v) => v === 0).length).toBe(3);
    expect(frames.every((f) => f[2] === 1500 || f[2] === 0)).toBe(true);
  });

  it('releases a high channel with 65534 when the screen goes away', () => {
    engine.setFunction('aux9', 1);
    vi.advanceTimersByTime(RC_TICK_MS * 2);
    engine.detach();
    frames = [];
    vi.advanceTimersByTime(1000);
    expect(frames.map((f) => f[8])).toEqual([65534, 65534, 65534]);
    engine.setFunction('aux9', 1);
    vi.advanceTimersByTime(500);
    expect(frames).toHaveLength(3);
  });

  it('reverse: only with the joystick in hand and at rest; then the sticks are mirrored', () => {
    expect(engine.setReverse(true)).toEqual({ ok: false, reason: 'needs-joystick' });
    hold(pad(), 60);
    engine.setDrive(true);
    hold(pad([0, -1]), 100);
    expect(engine.setReverse(true)).toEqual({ ok: false, reason: 'moving' });
    hold(pad(), 100);
    expect(engine.setReverse(true)).toEqual({ ok: true });
    hold(pad([1, -1]), 100);
    expect(throttle()).toBe(1000);
    expect(steer()).toBe(1000);
    expect(engine.setReverse(false)).toEqual({ ok: false, reason: 'moving' });
    hold(pad(), 100);
    expect(engine.setReverse(false)).toEqual({ ok: true });
  });

  it('reverse can leave the steering as it is', () => {
    engine.setConfig(normalizeRcConfig({ reverse: { invertSteering: false } }));
    hold(pad(), 60);
    engine.setDrive(true);
    engine.setReverse(true);
    hold(pad([1, -1]), 100);
    expect(throttle()).toBe(1000);
    expect(steer()).toBe(2000);
  });

  it('cruise takes over the throttle being held, steps with + and -, and lets go on braking', () => {
    hold(pad(), 60);
    engine.setDrive(true);
    hold(pad([0, -0.6]), 100);
    const held = throttle()!;
    expect(engine.setCruise(true)).toEqual({ ok: true });
    hold(pad(), 200);
    expect(throttle()).toBe(held);
    engine.adjustCruise(1);
    hold(pad(), 100);
    expect(throttle()).toBe(held + 25);
    engine.adjustCruise(-1);
    engine.adjustCruise(-1);
    hold(pad(), 100);
    expect(throttle()).toBe(held - 25);
    hold(pad([0, 0.6]), 100); // stick pulled back
    expect(engine.state().cruise.on).toBe(false);
    expect(throttle()).toBeLessThan(1500);
  });

  it('cruise from the screen alone holds the throttle and leaves the steering to the transmitter', () => {
    expect(engine.setCruise(true)).toEqual({ ok: true });
    engine.adjustCruise(1);
    engine.adjustCruise(1);
    vi.advanceTimersByTime(200);
    expect(throttle()).toBe(1550);
    expect(steer()).toBe(RC_IGNORE);
    engine.stop();
    frames = [];
    vi.advanceTimersByTime(500);
    expect(frames.map((f) => f[2])).toEqual([0, 0, 0]);
  });

  it('cruise needs a vehicle and is dropped when the link goes', () => {
    linkUp = false;
    expect(engine.setCruise(true)).toEqual({ ok: false, reason: 'not-connected' });
    linkUp = true;
    engine.setCruise(true);
    engine.adjustCruise(1);
    vi.advanceTimersByTime(100);
    linkUp = false;
    frames = [];
    vi.advanceTimersByTime(300);
    expect(frames).toHaveLength(0);
    expect(engine.state().cruise.on).toBe(false);
    linkUp = true;
    vi.advanceTimersByTime(300);
    expect(frames).toHaveLength(0);
  });

  it('works a function from a joystick button and from the screen alike', () => {
    engine.setConfig(normalizeRcConfig({ functions: [{ id: 'horn', kind: 'button', latching: false, channel: 6, input: { kind: 'button', index: 2 } }] }));
    hold(pad([0, 0], [false, false, false]), 60);
    expect(frames).toHaveLength(0);
    hold(pad([0, 0], [false, false, true]), 100);
    expect(last()[5]).toBe(2000);
    hold(pad([0, 0], [false, false, false]), 100);
    expect(last()[5]).toBe(1000);
    engine.setFunction('horn', 1);
    hold(pad([0, 0], [false, false, false]), 100);
    expect(last()[5]).toBe(2000);
  });

  it('takes joystick buttons for control, cruise and reverse', () => {
    engine.setConfig(normalizeRcConfig({
      drive: { engageButton: 0 }, cruise: { toggleButton: 1, upButton: 2, downButton: 3 }, reverse: { toggleButton: 4 },
    }));
    const b = (...on: number[]) => pad([0, 0], Array.from({ length: 5 }, (_, i) => on.includes(i)));
    hold(b(), 60);
    hold(b(0), 40);
    expect(engine.state().drive.engaged).toBe(true);
    hold(b(), 40);
    hold(b(4), 40);
    expect(engine.state().reverse).toBe(true);
    hold(b(), 40);
    hold(b(1), 40);
    hold(b(), 40);
    hold(b(2), 40);
    expect(engine.state().cruise).toEqual({ on: true, value: 0.05 });
    hold(b(), 40);
    hold(b(3), 40);
    expect(engine.state().cruise.value).toBe(0);
    hold(b(), 40);
    hold(b(0), 40);
    expect(engine.state()).toMatchObject({ drive: { engaged: false }, reverse: false, cruise: { on: false } });
  });

  it('keeps a function\'s position when the settings change, and forgets removed ones', () => {
    engine.setFunction('aux11', 0.4);
    const next = structuredClone(DEFAULT_RC_CONFIG);
    next.functions = next.functions.filter((f) => f.id !== 'aux9');
    next.functions[1]!.label = 'Lift';
    engine.setConfig(next);
    expect(engine.state().functions).toEqual({ aux10: { value: -1, active: false }, aux11: { value: 0.4, active: true } });
  });

  it('tells the screen when something changes, and only then', () => {
    states = [];
    vi.advanceTimersByTime(500);
    expect(states).toHaveLength(0);
    engine.setFunction('aux10', 1);
    expect(states).toHaveLength(1);
    expect(states[0]!.functions.aux10).toEqual({ value: 1, active: true });
  });

  it('sets a servo-output function once per change, never in the RC frame', () => {
    engine.dispose();
    const servos: [number, number][] = [];
    engine = new OperatorRcEngine({ linkUp: () => linkUp, send: (f) => { frames.push([...f]); }, setServo: (s, p) => { servos.push([s, p]); } });
    engine.setConfig(normalizeRcConfig({ functions: [
      { id: 'lamp', kind: 'button', output: 'servo', channel: 9, latching: true },
      { id: 'tilt', kind: 'slider', output: 'servo', channel: 10 },
    ] }));
    engine.attach();
    vi.advanceTimersByTime(500);
    expect(servos).toEqual([]);
    engine.setFunction('lamp', 1);
    vi.advanceTimersByTime(500);
    expect(servos).toEqual([[9, 2000]]);
    expect(frames).toHaveLength(0);
    // A dragged slider: no more than one command per 150 ms, and the last position always lands.
    for (let i = 1; i <= 10; i++) { engine.setFunction('tilt', i / 10); vi.advanceTimersByTime(20); }
    vi.advanceTimersByTime(500);
    const tilt = servos.filter(([s]) => s === 10);
    expect(tilt.length).toBeLessThan(5);
    expect(tilt.at(-1)).toEqual([10, 2000]);
    // After a dropped link the outputs are set again: the vehicle may have rebooted.
    linkUp = false;
    vi.advanceTimersByTime(200);
    linkUp = true;
    servos.length = 0;
    vi.advanceTimersByTime(200);
    expect(servos).toEqual(expect.arrayContaining([[9, 2000], [10, 2000]]));
  });

  it('reports why a frame did not go out', async () => {
    engine.dispose();
    engine = new OperatorRcEngine({ linkUp: () => true, send: () => { throw new Error('port closed'); } });
    engine.attach();
    engine.setFunction('aux9', 1);
    await vi.advanceTimersByTimeAsync(RC_TICK_MS * 2);
    expect(engine.state().error).toBe('port closed');
  });
});
