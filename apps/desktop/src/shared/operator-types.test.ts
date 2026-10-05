import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OPERATOR_CONFIG, OPERATOR_CONFIG_SCHEMA, OPERATOR_MODE_BUTTONS, ROVER_MODE_NUMBER, normalizeOperatorConfig,
} from './operator-types';
import { DEFAULT_RC_CONFIG, pickPad } from './operator-rc';

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
