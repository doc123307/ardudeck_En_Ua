import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OPERATOR_CONFIG, OPERATOR_CONFIG_SCHEMA, OPERATOR_MODE_BUTTONS, ROVER_MODE_NUMBER, normalizeOperatorConfig,
} from './operator-types';
import {
  DEFAULT_RC_CONFIG, NO_STICKS, detectStickAxis, stickPositions, sticksAtRest, calibrateAxis, calibratePad, calibrationFinish, calibrationGrow, calibrationStart, normalizePadCalibration, pickPad,
  rcAssignmentClashes, rcAssignments, composeChannels, driveChannels, driveCommand, normalizeRcConfig, rcChannelConflicts,
} from './operator-rc';

describe('operator settings', () => {
  it('start with everything on: modes, recording, joystick, cruise, reverse, sample functions', () => {
    const c = normalizeOperatorConfig(null);
    expect(c).toEqual(DEFAULT_OPERATOR_CONFIG);
    expect(c.modeButtons.length).toBeGreaterThan(3);
    expect(c.recordMode).toBe('always');
    expect(c.recordDir).toBe('');
    expect(c.rc.drive.enabled && c.rc.cruise.enabled && c.rc.reverse.enabled).toBe(true);
    expect(c.rc.functions.map((f) => f.kind)).toEqual(['button', 'switch3', 'slider']);
  });

  it('give a file from before mode switching the new list of modes', () => {
    // 0.1.2-0.11 and earlier: no schema field, "Manual" alone by default.
    const old = normalizeOperatorConfig({ modeButtons: ['manual'], allowArm: false, supportContact: '@me' });
    expect(old.modeButtons).toEqual(DEFAULT_OPERATOR_CONFIG.modeButtons);
    expect(old.allowArm).toBe(false);
    expect(old.supportContact).toBe('@me');
    expect(old.schema).toBe(OPERATOR_CONFIG_SCHEMA);
  });

  it('keep the administrator\'s own choice of modes once made', () => {
    const saved = normalizeOperatorConfig({ schema: OPERATOR_CONFIG_SCHEMA, modeButtons: ['rtl', 'manual', 'hold', 'warp'] });
    expect(saved.modeButtons).toEqual(['manual', 'rtl']);
    expect(normalizeOperatorConfig({ schema: OPERATOR_CONFIG_SCHEMA, modeButtons: [] }).modeButtons).toEqual([]);
  });

  it('survive a save of a save', () => {
    const once = normalizeOperatorConfig({ schema: 2, modeButtons: ['manual'], recordMode: 'armed', recordDir: ' D:\\Rec ', recordSegmentMinutes: 999 });
    expect(once).toMatchObject({ modeButtons: ['manual'], recordMode: 'armed', recordDir: 'D:\\Rec', recordSegmentMinutes: 240 });
    expect(normalizeOperatorConfig(once)).toEqual(once);
  });

  it('fall back to recording always on an unknown mode', () => {
    expect(normalizeOperatorConfig({ recordMode: 'sometimes' }).recordMode).toBe('always');
  });

  it('carry the RC settings through, cleaned', () => {
    const c = normalizeOperatorConfig({ rc: { cruise: { enabled: false }, functions: [] } });
    expect(c.rc.cruise.enabled).toBe(false);
    expect(c.rc.functions).toEqual([]);
    expect(c.rc.drive).toEqual(DEFAULT_RC_CONFIG.drive);
  });

  it('know the Rover mode number of every mode on offer', () => {
    expect(new Set(OPERATOR_MODE_BUTTONS.map((m) => ROVER_MODE_NUMBER[m])).size).toBe(OPERATOR_MODE_BUTTONS.length);
    expect(ROVER_MODE_NUMBER).toMatchObject({ manual: 0, acro: 1, steering: 3, hold: 4, loiter: 5, auto: 10, rtl: 11, smartRtl: 12, guided: 15 });
  });
});

describe('choosing the joystick', () => {
  const axes = (n: number) => new Array<number>(n).fill(0);
  const pads = [null, { id: 'Xbox Controller', axes: axes(4) }, { id: 'Thrustmaster T.16000M', axes: axes(4) }];

  it('takes the first real controller unless the administrator named one', () => {
    expect(pickPad(pads, '')?.id).toBe('Xbox Controller');
    expect(pickPad(pads, 'thrustmaster')?.id).toBe('Thrustmaster T.16000M');
  });

  it('never takes a headset for the joystick, and prefers a transmitter', () => {
    // What Chromium listed on the user's PC: the headset first, the transmitter second.
    const seen = [
      { id: 'USB Audio2.0 (Vendor: 10d6 Product: b011)', axes: axes(0) },
      { id: 'Radiomaster TX12 Joystick (Vendor: 1209 Product: 4f54)', axes: axes(8) },
    ];
    expect(pickPad(seen, '')?.id).toContain('Radiomaster TX12');
    expect(pickPad([{ id: 'Generic USB pad', axes: axes(6) }, { id: 'EdgeTX Radio', axes: axes(4) }], '')?.id).toBe('EdgeTX Radio');
    expect(pickPad([{ id: 'USB Audio2.0', axes: axes(0) }], '')).toBeNull();
    expect(pickPad([{ id: 'Logitech Headset with 2 axes', axes: axes(2) }], '')).toBeNull();
  });

  it('does not swap a named joystick that is unplugged for another one', () => {
    expect(pickPad(pads, 'Logitech')).toBeNull();
    expect(pickPad([], '')).toBeNull();
  });
});

describe('transmitter calibration', () => {
  const pad = (axes: number[], id = 'Radiomaster TX12 Joystick') => ({ id, axes, buttons: [] as boolean[] });

  it('stretches the real travel to -1..1 around the rest position', () => {
    const c = { min: -0.8, center: 0.1, max: 0.9 };
    expect(calibrateAxis(0.1, c)).toBe(0);
    expect(calibrateAxis(0.9, c)).toBe(1);
    expect(calibrateAxis(-0.8, c)).toBe(-1);
    expect(calibrateAxis(0.5, c)).toBeCloseTo(0.5);
    expect(calibrateAxis(-0.35, c)).toBeCloseTo(-0.5);
    // Past the calibrated end is still the end; no calibration is the raw reading.
    expect(calibrateAxis(1, c)).toBe(1);
    expect(calibrateAxis(0.42, null)).toBe(0.42);
    // A stick that rests at its lower end has no travel below it.
    expect(calibrateAxis(-1, { min: -1, center: -1, max: 1 })).toBe(0);
  });

  it('is gathered in two steps and leaves untouched axes alone', () => {
    let draft = calibrationStart(pad([0.05, -0.02, 0]));
    for (const axes of [[0.9, -0.02, 0], [-0.85, 0.7, 0.05], [0.05, -0.75, 0]]) draft = calibrationGrow(draft, pad(axes));
    const done = calibrationFinish(draft)!;
    expect(done.pad).toBe('Radiomaster TX12 Joystick');
    expect(done.axes[0]).toEqual({ min: -0.85, center: 0.05, max: 0.9 });
    expect(done.axes[1]).toEqual({ min: -0.75, center: -0.02, max: 0.7 });
    expect(done.axes[2]).toBeNull();
    // Nothing was moved: there is no calibration to keep.
    expect(calibrationFinish(calibrationStart(pad([0, 0])))).toBeNull();
  });

  it('applies only to the device it was made on', () => {
    const calibration = { pad: 'Radiomaster TX12 Joystick', axes: [{ min: -0.5, center: 0, max: 0.5 }, null], sticks: NO_STICKS };
    expect(calibratePad(pad([0.25, 0.25]), calibration).axes).toEqual([0.5, 0.25]);
    expect(calibratePad(pad([0.25, 0.25], 'Xbox Controller'), calibration).axes).toEqual([0.25, 0.25]);
    expect(calibratePad(pad([0.25]), null).axes).toEqual([0.25]);
  });

  it('is cleaned when stored, and survives in the operator settings', () => {
    expect(normalizePadCalibration({ pad: 'X', axes: [{ min: -1, center: 0, max: 1 }, { min: 0.4, center: 0.45, max: 0.5 }, 'junk', { min: 1, center: 0, max: -1 }] }))
      .toEqual({ pad: 'X', axes: [{ min: -1, center: 0, max: 1 }, null, null, null], sticks: NO_STICKS });
    expect(normalizePadCalibration({ pad: '', axes: [{ min: -1, center: 0, max: 1 }] })).toBeNull();
    expect(normalizePadCalibration({ pad: 'X', axes: [null] })).toBeNull();
    expect(normalizeOperatorConfig({ padCalibration: { pad: 'X', axes: [{ min: -1, center: 0, max: 1 }] } }).padCalibration?.pad).toBe('X');
    expect(normalizeOperatorConfig({}).padCalibration).toBeNull();
  });
});

describe('showing the program which stick is which', () => {
  const rest = [0.02, -0.01, 0, 0.03, -1];

  it('finds the axis that was pushed and which way the device counts it', () => {
    expect(detectStickAxis(rest, [0.02, -0.01, 0, 0.95, -1], [])).toEqual({ axis: 3, invert: false });
    // "Up" reads negative on most devices.
    expect(detectStickAxis(rest, [0.02, -0.9, 0, 0.03, -1], [])).toEqual({ axis: 1, invert: true });
    // Not far enough, or an axis that already belongs to another stick: nothing yet.
    expect(detectStickAxis(rest, [0.4, -0.01, 0, 0.03, -1], [])).toBeNull();
    expect(detectStickAxis(rest, [0.02, -0.9, 0, 0.03, -1], [1])).toBeNull();
    // The one moved furthest wins when a neighbour was nudged too.
    expect(detectStickAxis(rest, [0.7, -0.9, 0, 0.03, -1], [])).toEqual({ axis: 1, invert: true });
  });

  it('waits for the sticks to come back before the next question', () => {
    expect(sticksAtRest(rest, [0.1, -0.1, 0, 0.03, -1])).toBe(true);
    expect(sticksAtRest(rest, [0.5, -0.01, 0, 0.03, -1])).toBe(false);
  });

  it('draws the sticks from the layout, right and up positive', () => {
    const sticks = { lx: { axis: 3, invert: false }, ly: { axis: 2, invert: true }, rx: { axis: 0, invert: false }, ry: null };
    expect(stickPositions([0.5, 0, -1, -0.25], sticks)).toEqual({ left: { x: -0.25, y: 1 }, right: { x: 0.5, y: 0 } });
    expect(stickPositions([1, 1], NO_STICKS)).toEqual({ left: null, right: null });
  });

  it('is kept with the calibration, one axis per direction', () => {
    const kept = normalizePadCalibration({ pad: 'X', axes: [], sticks: { lx: { axis: 3, invert: false }, ly: { axis: 3, invert: true }, rx: { axis: 99 }, ry: { axis: 1, invert: true } } });
    expect(kept).toEqual({ pad: 'X', axes: [], sticks: { lx: { axis: 3, invert: false }, ly: null, rx: null, ry: { axis: 1, invert: true } } });
  });
});

describe('what the joystick controls are assigned to', () => {
  it('lists every use and finds a control given to two of them', () => {
    const rc = structuredClone(DEFAULT_RC_CONFIG);
    rc.drive.engageButton = 4;
    rc.cruise.toggleButton = 4;
    rc.functions[0]!.input = { kind: 'axis', index: 0, reverse: false };
    const roles = rcAssignments(rc).map((a) => `${a.role}=${a.control}${a.index}`);
    expect(roles).toEqual(['steer=axis0', 'throttle=axis1', 'engage=button4', 'cruiseToggle=button4', 'fn:aux9=axis0']);
    const clashes = rcAssignmentClashes(rc).map((g) => g.map((a) => a.role));
    expect(clashes).toEqual([['steer', 'fn:aux9'], ['engage', 'cruiseToggle']]);
    // Features that are switched off take nothing.
    rc.cruise.enabled = false;
    expect(rcAssignmentClashes(rc).map((g) => g.map((a) => a.role))).toEqual([['steer', 'fn:aux9']]);
    expect(rcAssignmentClashes(DEFAULT_RC_CONFIG)).toEqual([]);
  });
});

describe('driving in reverse', () => {
  const rc = () => structuredClone(DEFAULT_RC_CONFIG);
  const sticks = { steer: 0.5, throttle: 1 };

  it('swaps forward and back and mirrors the steering unless told not to', () => {
    expect(driveCommand(sticks, { reverse: true, invertSteering: true, cruiseOn: false, cruiseValue: 0 })).toMatchObject({ steer: -0.5, throttle: -1 });
    expect(driveCommand(sticks, { reverse: true, invertSteering: false, invertThrottle: false, cruiseOn: false, cruiseValue: 0 })).toMatchObject({ steer: 0.5, throttle: 1 });
    expect(driveCommand(sticks, { reverse: false, invertSteering: true, invertThrottle: true, cruiseOn: false, cruiseValue: 0 })).toMatchObject({ steer: 0.5, throttle: 1 });
  });

  it('goes out on its own channels when they are set', () => {
    const config = rc();
    expect(driveChannels(config, true)).toEqual({ steer: 1, throttle: 3 });
    config.reverse.steerChannel = 5;
    config.reverse.throttleChannel = 6;
    expect(driveChannels(config, false)).toEqual({ steer: 1, throttle: 3 });
    expect(driveChannels(config, true)).toEqual({ steer: 5, throttle: 6 });
    const forward = composeChannels(config, new Map(), { steerPwm: 1600, throttlePwm: 1700 });
    const reverse = composeChannels(config, new Map(), { steerPwm: 1600, throttlePwm: 1700 }, true);
    expect([forward[0], forward[2], forward[4], forward[5]]).toEqual([1600, 1700, 65535, 65535]);
    expect([reverse[0], reverse[2], reverse[4], reverse[5]]).toEqual([65535, 65535, 1600, 1700]);
  });

  it('is checked for channels shared with a function, and cleaned when stored', () => {
    const config = rc();
    config.reverse.throttleChannel = 9;
    expect(rcChannelConflicts(config)).toEqual([9]);
    config.reverse.enabled = false;
    expect(rcChannelConflicts(config)).toEqual([]);
    const stored = normalizeRcConfig({ reverse: { steerChannel: 99, throttleChannel: 7, invertThrottle: false } });
    expect(stored.reverse).toMatchObject({ steerChannel: null, throttleChannel: 7, invertThrottle: false, invertSteering: true });
    expect(normalizeRcConfig({}).reverse).toMatchObject({ steerChannel: null, throttleChannel: null, invertThrottle: true });
  });
});

describe('supplier contacts', () => {
  it('start with the site and are kept trimmed', () => {
    expect(normalizeOperatorConfig({})).toMatchObject({ supportSite: 'https://www.stohid.com/', supportPhone: '', supportEmail: '', supportNote: '' });
    expect(normalizeOperatorConfig({ supportSite: ' example.org ', supportPhone: ' +380 00 000 00 00 ', supportEmail: 5 }))
      .toMatchObject({ supportSite: 'example.org', supportPhone: '+380 00 000 00 00', supportEmail: '' });
  });
});

describe('deleted functions', () => {
  it('are kept whole to be put back, without clashing ids, and send nothing', () => {
    const fn = DEFAULT_RC_CONFIG.functions[0]!;
    const stored = normalizeRcConfig({ functions: DEFAULT_RC_CONFIG.functions.slice(1), removedFunctions: [fn, fn, { ...DEFAULT_RC_CONFIG.functions[1]!, label: 'copy' }, 'junk'] });
    expect(stored.functions.map((f) => f.id)).toEqual(['aux10', 'aux11']);
    // The duplicate and the one whose id is in use are dropped.
    expect(stored.removedFunctions).toEqual([fn]);
    const runtime = new Map([[fn.id, { value: 1, active: true }]]);
    expect(composeChannels(stored, runtime as never, {})[fn.channel - 1]).toBe(65535);
    expect(normalizeRcConfig({}).removedFunctions).toEqual([]);
  });
});
