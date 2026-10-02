/**
 * Arming with no RC transmitter: ArduPilot wants to see RC input, so one RC override
 * frame is sent just before the arm command as a stand-in.
 *
 * What that frame holds depends on the vehicle. An aircraft wants the throttle LOW
 * (1000). On a ground vehicle or a boat channel 3 at 1000 is not "low", it is FULL
 * REVERSE: the frame would drive it backwards from the moment it arms until the
 * override times out (RC_OVERRIDE_TIME, 3 s by default). There the stand-in is the
 * neutral position, and only on the two channels that drive.
 */

export const RC_OVERRIDE_IGNORE = 65535;

/** MAV_TYPE_GROUND_ROVER (10) and MAV_TYPE_SURFACE_BOAT (11): throttle rests in the middle. */
export function throttleRestsAtCentre(mavType: number | null | undefined): boolean {
  return mavType === 10 || mavType === 11;
}

/** Channels 1-4 of the stand-in frame; everything above them is always "ignore". */
export function armStandInChannels(mavType: number | null | undefined): [number, number, number, number] {
  return throttleRestsAtCentre(mavType)
    ? [1500, RC_OVERRIDE_IGNORE, 1500, RC_OVERRIDE_IGNORE]
    : [1500, 1500, 1000, 1500];
}

/** Throttle of the simulator's stand-in transmitter, -1..1: bottom for aircraft, centre for ground vehicles. */
export function simulatorIdleThrottle(mavType: number | null | undefined): number {
  return throttleRestsAtCentre(mavType) ? 0 : -1;
}
