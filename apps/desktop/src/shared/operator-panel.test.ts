import { describe, it, expect } from 'vitest';
import {
  arrangeControls, controlGroup, controlKind, defaultControlOrder, describeSource, formatValue, moveControl, newValue,
  normalizeValue, numericFields, readField, scaledValue, valueLevel, type OperatorValue,
} from './operator-panel';
import { normalizeOperatorConfig, OPERATOR_CONFIG_SCHEMA } from './operator-types';

describe('controls on the bar', () => {
  const all = defaultControlOrder(['low-beam', 'marker'], ['aux9']);

  it('start in a sensible order: driving, outputs and functions, view tools', () => {
    expect(all).toEqual(['joystick', 'reverse', 'cruise', 'relay:low-beam', 'relay:marker', 'fn:aux9', 'record', 'layout', 'reset', 'pin']);
    expect(all.map(controlGroup)).toEqual(['drive', 'drive', 'drive', 'outputs', 'outputs', 'outputs', 'view', 'view', 'view', 'view']);
  });

  it('follow the administrator\'s order and put anything new after it', () => {
    const order = ['fn:aux9', 'relay:marker', 'joystick'];
    expect(arrangeControls(order, all).slice(0, 4)).toEqual(['fn:aux9', 'relay:marker', 'joystick', 'reverse']);
    // A relay added later, never placed: after the placed ones, in the default order.
    const more = defaultControlOrder(['low-beam', 'marker', 'ir'], ['aux9']);
    expect(arrangeControls(order, more).indexOf('relay:ir')).toBeGreaterThan(2);
    // A placed control that no longer exists simply disappears.
    expect(arrangeControls(['relay:gone', 'pin'], ['joystick', 'pin'])).toEqual(['joystick', 'pin']);
    // Something added after the administrator arranged the bar joins before the view tools.
    const arranged = arrangeControls(all, all);
    expect(arranged).toEqual(all);
    const withNew = arrangeControls(all, [...all, 'relay:ir']);
    expect(withNew.indexOf('relay:ir')).toBe(withNew.indexOf('record') - 1);
  });

  it('move one place at a time and not past the ends', () => {
    expect(moveControl(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveControl(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveControl(['a', 'b', 'c'], 'x', 1)).toEqual(['a', 'b', 'c']);
  });

  it('name their kind, and reject anything else', () => {
    expect(controlKind('cruise')).toBe('builtin');
    expect(controlKind('relay:3f2a-11')).toBe('relay');
    expect(controlKind('fn:aux9')).toBe('fn');
    expect(controlKind('fn:bad id')).toBeNull();
    expect(controlKind('selfdestruct')).toBeNull();
  });
});

describe('values from the vehicle', () => {
  const raw = (extra: Record<string, unknown> = {}) => ({
    id: 'v1', label: 'Батарея', source: { kind: 'mavlink', message: 'sys_status', field: 'voltageBattery', index: null }, scale: 0.001, unit: 'V', ...extra,
  });

  it('are cleaned when stored', () => {
    const v = normalizeValue(raw())!;
    expect(v.source).toEqual({ kind: 'mavlink', message: 'SYS_STATUS', field: 'voltageBattery', index: null });
    expect(v).toMatchObject({ scale: 0.001, offset: 0, decimals: 1, unit: 'V', warnBelow: null });
    expect(normalizeValue(raw({ scale: 0 }))!.scale).toBe(1);
    expect(normalizeValue(raw({ decimals: 9 }))!.decimals).toBe(4);
    expect(normalizeValue(raw({ source: { kind: 'mavlink', message: 'X;Y', field: 'a' } }))).toBeNull();
    expect(normalizeValue(raw({ source: { kind: 'param', name: 'cruise_speed' } }))!.source).toEqual({ kind: 'param', name: 'CRUISE_SPEED' });
    expect(normalizeValue(raw({ source: { kind: 'named', name: '' } }))).toBeNull();
    expect(normalizeValue(raw(), new Set(['v1']))).toBeNull();
  });

  it('read numbers out of a decoded message, arrays and bigints included', () => {
    const fields = { voltageBattery: 12600, voltages: [3700, 3710, 65535], timeUsec: 5n, armed: true, name: 'x' };
    expect(readField(fields, 'voltageBattery', null)).toBe(12600);
    expect(readField(fields, 'voltages', 1)).toBe(3710);
    expect(readField(fields, 'voltages', 9)).toBeNull();
    expect(readField(fields, 'timeUsec', null)).toBe(5);
    expect(readField(fields, 'armed', null)).toBe(1);
    expect(readField(fields, 'name', null)).toBeNull();
    expect(readField(undefined, 'x', null)).toBeNull();
    expect(numericFields(fields).map((f) => `${f.field}${f.index ?? ''}`)).toEqual(['voltageBattery', 'voltages0', 'voltages1', 'voltages2', 'timeUsec', 'armed']);
  });

  it('are scaled, coloured by their limits and formatted', () => {
    const v: OperatorValue = { ...normalizeValue(raw())!, decimals: 2, warnBelow: 11.5, dangerBelow: 10.8, dangerAbove: 13 };
    const shown = scaledValue(v, 12600);
    expect(shown).toBeCloseTo(12.6);
    expect(formatValue(v, shown)).toBe('12.60 V');
    expect(valueLevel(v, 12.6)).toBe('ok');
    expect(valueLevel(v, 11.2)).toBe('warn');
    expect(valueLevel(v, 10.5)).toBe('danger');
    expect(valueLevel(v, 13.5)).toBe('danger');
    expect(formatValue(v, null)).toBe('--');
    expect(formatValue({ ...v, unit: '' }, 3)).toBe('3.00');
  });

  it('describe where they come from', () => {
    expect(describeSource({ kind: 'mavlink', message: 'BATTERY_STATUS', field: 'voltages', index: 0 })).toBe('BATTERY_STATUS.voltages[0]');
    expect(describeSource({ kind: 'named', name: 'temp1' })).toBe('temp1');
    expect(describeSource({ kind: 'param', name: 'CRUISE_SPEED' })).toBe('CRUISE_SPEED');
  });

  it('get a free id when added', () => {
    const first = newValue({ kind: 'named', name: 'temp1' }, []);
    const second = newValue({ kind: 'named', name: 'temp2' }, [first]);
    expect(first.id).not.toBe(second.id);
    expect(second.label).toBe('temp2');
  });
});

describe('operator settings, schema 3', () => {
  it('keep own values on the strip only when they exist', () => {
    const c = normalizeOperatorConfig({
      schema: 3,
      statusFields: ['mode', 'v:bat', 'v:gone', 'mode', 'nonsense'],
      values: [{ id: 'bat', label: 'Bat', source: { kind: 'named', name: 'bat' } }],
    });
    expect(c.statusFields).toEqual(['mode', 'v:bat']);
    expect(c.values).toHaveLength(1);
  });

  it('keep the administrator\'s panel order and hidden controls, cleaned', () => {
    const c = normalizeOperatorConfig({ schema: 3, controlOrder: ['fn:aux9', 'joystick', 'joystick', 'x y'], hiddenControls: ['pin', 'relay:abc', 7] });
    expect(c.controlOrder).toEqual(['fn:aux9', 'joystick']);
    expect(c.hiddenControls).toEqual(['pin', 'relay:abc']);
  });

  it('let built-in controls be deleted (and only built-ins: outputs and functions are deleted themselves)', () => {
    const c = normalizeOperatorConfig({ schema: 3, removedControls: ['reverse', 'cruise', 'fn:aux9', 'relay:x', 'bogus'], panelIconsOnly: true });
    expect(c.removedControls).toEqual(['reverse', 'cruise']);
    expect(c.panelIconsOnly).toBe(true);
    expect(normalizeOperatorConfig(null)).toMatchObject({ removedControls: [], panelIconsOnly: false });
  });

  it('move the old "record button" and "layout switch" elements onto the panel list', () => {
    const c = normalizeOperatorConfig({ schema: 2, modeButtons: ['manual'], hiddenElements: ['record', 'layoutSwitch', 'map', 'outputs'] });
    expect(c.schema).toBe(OPERATOR_CONFIG_SCHEMA);
    expect(c.hiddenControls).toEqual(['record', 'layout']);
    expect(c.hiddenElements).toEqual(['map']);
    // A schema 2 file already had the mode list of its administrator's choosing.
    expect(c.modeButtons).toEqual(['manual']);
  });
});
