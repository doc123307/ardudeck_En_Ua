import { describe, it, expect } from 'vitest';
import { STALE_MS, _injectForTest, messageCatalog, namedCatalog, readSource } from './operator-values';

describe('live values for the status strip', () => {
  const now = 1_000_000;

  it('reads a field of a message the vehicle sent, and says when it is old', () => {
    _injectForTest('message', 'SYS_STATUS', { voltageBattery: 12400, load: 230 }, now - 100);
    expect(readSource({ kind: 'mavlink', message: 'SYS_STATUS', field: 'voltageBattery', index: null }, now)).toEqual({ raw: 12400, stale: false });
    expect(readSource({ kind: 'mavlink', message: 'SYS_STATUS', field: 'voltageBattery', index: null }, now + STALE_MS + 1).stale).toBe(true);
    expect(readSource({ kind: 'mavlink', message: 'SYS_STATUS', field: 'missing', index: null }, now).raw).toBeNull();
    expect(readSource({ kind: 'mavlink', message: 'NEVER_SENT', field: 'x', index: null }, now)).toEqual({ raw: null, stale: true });
  });

  it('reads an element of an array field', () => {
    _injectForTest('message', 'BATTERY_STATUS', { voltages: [3800, 3790, 3810] }, now);
    expect(readSource({ kind: 'mavlink', message: 'BATTERY_STATUS', field: 'voltages', index: 2 }, now).raw).toBe(3810);
  });

  it('reads named values and parameters', () => {
    _injectForTest('named', 'temp1', 41.5, now);
    _injectForTest('param', 'CRUISE_SPEED', 2.5, now);
    expect(readSource({ kind: 'named', name: 'temp1' }, now)).toEqual({ raw: 41.5, stale: false });
    expect(readSource({ kind: 'param', name: 'CRUISE_SPEED' }, now)).toEqual({ raw: 2.5, stale: false });
    expect(readSource({ kind: 'param', name: 'NOT_READ' }, now)).toEqual({ raw: null, stale: true });
  });

  it('lists what was seen recently, for the administrator to pick from', () => {
    expect(messageCatalog(now).map((m) => m.message)).toEqual(expect.arrayContaining(['BATTERY_STATUS', 'SYS_STATUS']));
    expect(messageCatalog(now).find((m) => m.message === 'SYS_STATUS')!.fields.map((f) => f.field)).toEqual(['voltageBattery', 'load']);
    expect(namedCatalog(now)).toEqual([{ name: 'temp1', value: 41.5 }]);
    expect(messageCatalog(now + STALE_MS * 3)).toEqual([]);
  });
});
