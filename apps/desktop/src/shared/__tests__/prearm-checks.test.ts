import { describe, it, expect } from 'vitest';
import { isPreArmMessage, extractPreArmReason, matchPreArmError } from '../prearm-checks.js';

describe('isPreArmMessage', () => {
  it('detects ArduPilot pre-arm messages by default', () => {
    expect(isPreArmMessage('PreArm: Motors: Check frame class')).toBe(true);
    expect(isPreArmMessage('Arm: Motors: Check frame class')).toBe(true);
    expect(isPreArmMessage('EKF2 IMU0 is using GPS')).toBe(false);
  });

  it('does not treat PX4 wording as a pre-arm message under ArduPilot default', () => {
    expect(isPreArmMessage('Arming denied: GPS not ready')).toBe(false);
    expect(isPreArmMessage('Preflight Fail: Compass not calibrated')).toBe(false);
  });

  it('detects PX4 pre-arm messages when firmware is px4', () => {
    expect(isPreArmMessage('Arming denied: GPS not ready', 'px4')).toBe(true);
    expect(isPreArmMessage('Preflight Fail: Compass not calibrated', 'px4')).toBe(true);
    expect(isPreArmMessage('Preflight: high vibration', 'px4')).toBe(true);
    expect(isPreArmMessage('PreArm: Motors: Check frame class', 'px4')).toBe(false);
  });
});

describe('extractPreArmReason', () => {
  it('extracts the ArduPilot reason', () => {
    expect(extractPreArmReason('PreArm: Motors: Check frame class')).toBe('Motors: Check frame class');
  });

  it('extracts the PX4 reason', () => {
    expect(extractPreArmReason('Arming denied: GPS not ready', 'px4')).toBe('GPS not ready');
    expect(extractPreArmReason('Preflight Fail: Compass not calibrated', 'px4')).toBe('Compass not calibrated');
  });
});

describe('matchPreArmError ArduPilot (default)', () => {
  it('matches the ArduPilot frame-class pattern', () => {
    const result = matchPreArmError('PreArm: Motors: Check frame class');
    expect(result).not.toBeNull();
    expect(result!.pattern.category).toBe('motors');
    expect(result!.pattern.fix.params).toContain('FRAME_CLASS');
  });

  it('sends a missing compass calibration to the compass calibration', () => {
    const result = matchPreArmError('PreArm: Compass not calibrated');
    expect(result!.pattern.fix.links?.[0]?.to).toEqual({ kind: 'view', view: 'calibration', target: 'compass' });
  });

  it('sends RC calibration to the receiver tab', () => {
    const result = matchPreArmError('PreArm: RC not calibrated');
    expect(result!.pattern.fix.links?.[0]?.to).toEqual({ kind: 'view', view: 'parameters', target: 'tab:receiver' });
  });

  it('points unknown ArduPilot reasons at the reference, not at ARMING_CHECK', () => {
    const result = matchPreArmError('PreArm: Some brand new check');
    expect(result!.pattern.fix.params ?? []).toHaveLength(0);
    expect(result!.pattern.fix.links?.[0]?.to.kind).toBe('external');
  });

  it('returns null for non-pre-arm text', () => {
    expect(matchPreArmError('EKF2 IMU0 is using GPS')).toBeNull();
  });

  it('does not match a PX4 message under ArduPilot default', () => {
    expect(matchPreArmError('Arming denied: GPS not ready')).toBeNull();
  });
});

describe('matchPreArmError PX4', () => {
  it('matches GPS / position estimate', () => {
    const result = matchPreArmError('Arming denied: GPS not ready', 'px4');
    expect(result).not.toBeNull();
    expect(result!.pattern.category).toBe('gps');
    expect(result!.pattern.fix.params ?? []).not.toContain('COM_ARM_WO_GPS');
  });

  it('matches compass calibration', () => {
    const result = matchPreArmError('Preflight Fail: Compass not calibrated', 'px4');
    expect(result!.pattern.category).toBe('sensors');
    expect(result!.pattern.fix.links?.[0]?.to).toEqual({ kind: 'view', view: 'calibration', target: 'compass' });
  });

  it('matches accelerometer calibration', () => {
    const result = matchPreArmError('Preflight Fail: Accel not calibrated', 'px4');
    expect(result!.pattern.fix.links?.[0]?.to).toEqual({ kind: 'view', view: 'calibration', target: 'accel-6point' });
  });

  it('matches RC not configured', () => {
    const result = matchPreArmError('Arming denied: RC not calibrated', 'px4');
    expect(result!.pattern.category).toBe('rc');
    expect(result!.pattern.fix.links?.[0]?.to).toEqual({ kind: 'view', view: 'parameters', target: 'tab:receiver' });
  });

  it('matches battery low', () => {
    const result = matchPreArmError('Preflight Fail: Battery low', 'px4');
    expect(result!.pattern.category).toBe('battery');
    expect(result!.pattern.fix.links?.[0]?.to).toEqual({ kind: 'view', view: 'parameters', target: 'tab:battery' });
  });

  it('matches geofence', () => {
    const result = matchPreArmError('Arming denied: Geofence violation', 'px4');
    expect(result!.pattern.category).toBe('mission');
    expect(result!.pattern.fix.links?.[0]?.to).toEqual({ kind: 'view', view: 'mission' });
  });

  it('matches kill switch', () => {
    const result = matchPreArmError('Arming denied: Kill switch engaged', 'px4');
    expect(result!.pattern.category).toBe('system');
  });

  it('falls back to PX4 generic for unknown PX4 reasons', () => {
    const result = matchPreArmError('Arming denied: some unrecognized condition', 'px4');
    expect(result).not.toBeNull();
    expect(result!.pattern.fix.params ?? []).toHaveLength(0);
    expect(result!.pattern.fix.links?.[0]?.to.kind).toBe('external');
  });

  it('does not match an ArduPilot message under PX4 firmware', () => {
    expect(matchPreArmError('PreArm: Motors: Check frame class', 'px4')).toBeNull();
  });
});

describe('quick fixes never bypass a check', () => {
  // Arming past a failing check is how a careless pilot crashes: no fix may turn one off or loosen it.
  const BYPASS = /^(ARMING_CHECK|ARMING_VOLT_MIN|COM_ARM_|CBRK_|COM_RC_IN_MODE|FENCE_ENABLE|BRD_SAFETY|GF_ACTION|BAT_(LOW|CRIT)_THR|EKF2_AID_MASK|COMPASS_USE|COMPASS_ENABLE)/;
  const samples: Array<[string, 'px4' | undefined]> = [
    ['PreArm: Compass not calibrated', undefined], ['PreArm: Compass not healthy', undefined],
    ['PreArm: Battery 1 below minimum arming voltage', undefined], ['PreArm: Fence requires position', undefined],
    ['PreArm: Hardware safety switch', undefined], ['PreArm: GPS 1: Bad fix', undefined],
    ['PreArm: Throttle below failsafe', undefined], ['PreArm: Something unknown', undefined],
    ['Arming denied: GPS not ready', 'px4'], ['Preflight Fail: Compass not calibrated', 'px4'],
    ['Preflight Fail: Battery low', 'px4'], ['Arming denied: Geofence violation', 'px4'],
    ['Arming denied: RC not calibrated', 'px4'], ['Arming denied: something else', 'px4'],
  ];
  it.each(samples)('%s', (text, fw) => {
    const fix = matchPreArmError(text, fw)!.pattern.fix;
    for (const p of fix.params ?? []) expect(p).not.toMatch(BYPASS);
    expect(fix.hint).not.toMatch(/disable|allow arming without/i);
  });
});
