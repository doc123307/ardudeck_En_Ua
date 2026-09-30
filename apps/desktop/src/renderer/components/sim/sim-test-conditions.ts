import { t } from '../../i18n';
/**
 * Pure config + helpers for the SITL test-condition bench (SimTestPanel).
 *
 * ArduPilot SITL exposes SIM_* parameters that perturb the simulation live; we
 * set them over MAVLink PARAM_SET so real failsafes fire on the real flight code.
 * This module holds the param names, the engine-failure bitmask helper, the
 * one-click scenario presets, and the safe-defaults reset - kept separate from
 * the React panel so the fiddly bits (esp. the bitmask) are unit-testable.
 */

/** MAVLink PARAM type we send everything as. ArduPilot casts to the param's real
    type on receive, so REAL32 is safe for the INT8 SIM_* params too. */
export const PARAM_REAL32 = 9;

/**
 * Bitmask of motors to fail, from 1-indexed motor numbers.
 *
 * On current ArduPilot, SIM_ENGINE_FAIL is a *motor bitmask* (bit 0 = motor 1),
 * NOT an engine index - and the thrust of the masked motors is scaled by
 * SIM_ENGINE_MUL. The old panel set SIM_ENGINE_FAIL=0 (which now selects NO
 * motor) so SIM_ENGINE_MUL=0 had nothing to act on and the failure never fired.
 */
export function engineFailMask(motors: Iterable<number>): number {
  let mask = 0;
  for (const n of motors) if (n >= 1) mask |= 1 << (n - 1);
  return mask;
}

/**
 * The full set of test-condition state. A "patch" (Partial) is what presets and
 * the reset apply; the panel maps each present field to its SIM_* param(s).
 */
export interface SimConditions {
  /** 1-indexed motor numbers currently failed. */
  failedMotors: number[];
  /** Thrust multiplier for failed motors (0 = dead, 1 = full). */
  engineMul: number;
  gpsEnable: boolean;
  gpsJam: boolean;
  /** Horizontal position glitch magnitude in metres (sets GLTCH_X and _Y). */
  gpsGlitch: number;
  /** Reported satellite count (10 = healthy). */
  gpsSats: number;
  baroDisable: boolean;
  mag1Fail: boolean;
  mag2Fail: boolean;
  /** Motor-driven vibration amplitude (SIM_VIB_MOT_MAX, m/s/s). */
  vibe: number;
  rcFail: boolean;
  windSpd: number;
  windDir: number;
  windTurb: number;
}

export type SimPatch = Partial<SimConditions>;

/** Safe defaults - what "Reset all" restores (battery is handled separately,
    keyed off the vehicle's live pack voltage). */
export const SIM_DEFAULTS: SimConditions = {
  failedMotors: [],
  engineMul: 1,
  gpsEnable: true,
  gpsJam: false,
  gpsGlitch: 0,
  gpsSats: 10,
  baroDisable: false,
  mag1Fail: false,
  mag2Fail: false,
  vibe: 0,
  rcFail: false,
  windSpd: 0,
  windDir: 0,
  windTurb: 0,
};

export interface SimPreset {
  id: string;
  label: string;
  tip: string;
  patch: SimPatch;
}

/** One-click failure scenarios. Each is a patch applied over current state. */
export const SIM_PRESETS: SimPreset[] = [
  { id: 'motor-out', get label() { return t('sim.sim_test_conditions.motorOut'); }, get tip() { return t('sim.sim_test_conditions.killMotor1SimEngineFail'); }, patch: { failedMotors: [1], engineMul: 0 } },
  { id: 'gps-denied', get label() { return t('sim.sim_test_conditions.gpsDenied'); }, get tip() { return t('sim.sim_test_conditions.disableGpsToTriggerTheGps'); }, patch: { gpsEnable: false } },
  { id: 'gps-glitch', get label() { return t('sim.sim_test_conditions.gpsGlitch'); }, get tip() { return t('sim.sim_test_conditions.n30MPositionJumpSimGps1'); }, patch: { gpsGlitch: 30 } },
  { id: 'gps-jam', get label() { return t('sim.sim_test_conditions.gpsJam'); }, get tip() { return t('sim.sim_test_conditions.jamGpsReceptionSimGps1Jam'); }, patch: { gpsJam: true } },
  { id: 'low-sats', get label() { return t('sim.sim_test_conditions.satDropout'); }, get tip() { return t('sim.sim_test_conditions.degradeTo4SatellitesSimGps1'); }, patch: { gpsSats: 4 } },
  { id: 'compass-fail', get label() { return t('sim.sim_test_conditions.compassFail'); }, get tip() { return t('sim.sim_test_conditions.failBothCompassesSimMag1Fail'); }, patch: { mag1Fail: true, mag2Fail: true } },
  { id: 'baro-fail', get label() { return t('sim.sim_test_conditions.baroFail'); }, get tip() { return t('sim.sim_test_conditions.disableTheBarometerSimBaroDisable'); }, patch: { baroDisable: true } },
  { id: 'radio-loss', get label() { return t('sim.sim_test_conditions.radioLoss'); }, get tip() { return t('sim.sim_test_conditions.dropRcToTriggerTheRadio'); }, patch: { rcFail: true } },
  { id: 'high-vibe', get label() { return t('sim.sim_test_conditions.highVibe'); }, get tip() { return t('sim.sim_test_conditions.injectMotorVibrationSimVibMot'); }, patch: { vibe: 30 } },
];
