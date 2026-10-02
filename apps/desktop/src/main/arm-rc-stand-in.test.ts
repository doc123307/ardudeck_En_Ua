import { describe, it, expect } from 'vitest';
import { RC_OVERRIDE_IGNORE, armStandInChannels, simulatorIdleThrottle, throttleRestsAtCentre } from './arm-rc-stand-in';

describe('the RC stand-in sent when arming without a transmitter', () => {
  it('holds an aircraft\'s throttle low', () => {
    expect(armStandInChannels(2)).toEqual([1500, 1500, 1000, 1500]); // quadrotor
    expect(armStandInChannels(1)).toEqual([1500, 1500, 1000, 1500]); // fixed wing
    expect(armStandInChannels(undefined)).toEqual([1500, 1500, 1000, 1500]);
  });

  it('never tells a ground vehicle or a boat "full reverse"', () => {
    for (const mavType of [10, 11]) {
      const [steer, ch2, throttle, ch4] = armStandInChannels(mavType);
      expect(steer).toBe(1500);
      expect(throttle).toBe(1500);
      // Channels 2 and 4 are not sticks on a rover; they are left alone.
      expect(ch2).toBe(RC_OVERRIDE_IGNORE);
      expect(ch4).toBe(RC_OVERRIDE_IGNORE);
    }
  });

  it('idles the simulator\'s transmitter the same way', () => {
    expect(simulatorIdleThrottle(10)).toBe(0);
    expect(simulatorIdleThrottle(11)).toBe(0);
    expect(simulatorIdleThrottle(2)).toBe(-1);
    expect(simulatorIdleThrottle(null)).toBe(-1);
  });

  it('knows which vehicles rest at the centre', () => {
    expect(throttleRestsAtCentre(10)).toBe(true);
    expect(throttleRestsAtCentre(11)).toBe(true);
    expect(throttleRestsAtCentre(2)).toBe(false);
    expect(throttleRestsAtCentre(12)).toBe(false); // submarine: not assumed
  });
});
