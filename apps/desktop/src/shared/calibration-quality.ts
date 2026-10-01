/**
 * Did the calibration actually work, and is it still there?
 *
 * A flight controller reporting "success" is not the same as a good
 * calibration, and a calibration that was accepted is not the same as one that
 * survived the reboot. Both gaps have put aircraft in the ground: the wizard
 * said done, the FC rebooted, and the operator assumed it was fine.
 *
 * This module answers both questions from numbers, so the UI never has to say
 * "probably".
 */

import { st } from './i18n-shim';
export type CalibrationVerdict = 'good' | 'marginal' | 'bad' | 'unknown';

/**
 * A calibration as stored per board: what it wrote, how good it was, and
 * whether it was still there after the reboot.
 */
export interface CalibrationRecordIpc {
  type: string;
  written: Record<string, number>;
  verdict: CalibrationVerdict | string;
  summary: string;
  completedAt: number;
  persistence: null | {
    state: CalibrationPersistence | string;
    summary: string;
    mismatched: string[];
    checkedAt: number;
  };
}

export interface CalibrationAssessment {
  verdict: CalibrationVerdict;
  /** One line stating the measured value and what it means. */
  summary: string;
  /** What to do about it, when it is not good. */
  advice?: string;
}

// ── Compass ──────────────────────────────────────────────────────────────────

/**
 * Compass fitness is the RMS residual of the sphere fit, in milligauss.
 *
 * Two different numbers matter and they are easy to confuse:
 *   - what a GOOD calibration looks like in practice: under about 3.5
 *   - what ArduPilot will ACCEPT: COMPASS_CAL_FIT, default 16 (its own scale
 *     is 4 very strict, 8 strict, 16 default, 32 relaxed)
 *
 * Everything between the two is the dangerous band: the flight controller
 * reports SUCCESS, the wizard goes green, and the heading still drifts in the
 * air. That band is called out rather than passed.
 */
export const COMPASS_FITNESS_GOOD = 3.5;
export const COMPASS_FITNESS_DEFAULT_LIMIT = 16;

export function assessCompassFitness(
  fitness: number,
  calFitThreshold: number = COMPASS_FITNESS_DEFAULT_LIMIT,
): CalibrationAssessment {
  if (!Number.isFinite(fitness) || fitness < 0) {
    return { verdict: 'unknown', get summary() { return st('shared.calibration_quality.noFitnessReportedByTheFlight', 'No fitness reported by the flight controller.'); } };
  }
  const value = `fitness ${fitness.toFixed(1)} mGauss`;

  if (fitness > calFitThreshold) {
    return {
      verdict: 'bad',
      summary: `Rejected: ${value}, past the ${calFitThreshold.toFixed(0)} limit.`,
      advice: 'Move away from metal, batteries and wiring, then calibrate again.',
    };
  }
  if (fitness > COMPASS_FITNESS_GOOD) {
    return {
      verdict: 'marginal',
      summary: `Accepted but weak: ${value}.`,
      advice: `The flight controller accepted this, but heading drift is likely. Recalibrate away from metal and power wiring, and rotate through every axis, for a fit under ${COMPASS_FITNESS_GOOD}.`,
    };
  }
  return { verdict: 'good', summary: `Good: ${value}.` };
}

// ── Accelerometer ────────────────────────────────────────────────────────────

/**
 * ArduPilot refuses to arm when an accel offset vector exceeds 3.5 m/s/s or a
 * scale factor falls outside 0.8..1.2. Warning only at those limits is too
 * late, so a tighter band flags a calibration that passed but is drifting.
 */
export const ACCEL_OFFSET_ARM_LIMIT = 3.5;
export const ACCEL_OFFSET_GOOD = 1.5;
export const ACCEL_SCALE_ARM_MARGIN = 0.2;
export const ACCEL_SCALE_GOOD_MARGIN = 0.05;

export interface AccelCalibrationValues {
  /** INS_ACCOFFS_X/Y/Z in m/s/s. */
  offsets?: { x: number; y: number; z: number };
  /** INS_ACCSCAL_X/Y/Z, nominally 1.0. */
  scales?: { x: number; y: number; z: number };
}

export function assessAccelCalibration(values: AccelCalibrationValues): CalibrationAssessment {
  const { offsets, scales } = values;
  if (!offsets && !scales) {
    return { verdict: 'unknown', get summary() { return st('shared.calibration_quality.calibrationValuesNotReadFromThe', 'Calibration values not read from the vehicle.'); } };
  }

  // An untouched board reads exactly zero offsets and exactly 1.0 scales. That
  // is the signature of "never calibrated", not of a perfect calibration.
  const allZero = offsets && offsets.x === 0 && offsets.y === 0 && offsets.z === 0;
  const allUnity = scales && scales.x === 1 && scales.y === 1 && scales.z === 1;
  if (allZero && allUnity) {
    return {
      verdict: 'bad',
      get summary() { return st('shared.calibration_quality.factoryDefaultsThisAccelerometerHasNever', 'Factory defaults: this accelerometer has never been calibrated.'); },
      advice: 'Run the six-point accelerometer calibration before flying.',
    };
  }

  const offsetLength = offsets
    ? Math.hypot(offsets.x, offsets.y, offsets.z)
    : null;
  const scaleError = scales
    ? Math.max(Math.abs(scales.x - 1), Math.abs(scales.y - 1), Math.abs(scales.z - 1))
    : null;

  if (offsetLength !== null && offsetLength >= ACCEL_OFFSET_ARM_LIMIT) {
    return {
      verdict: 'bad',
      summary: `Offsets ${offsetLength.toFixed(2)} m/s/s, past the ${ACCEL_OFFSET_ARM_LIMIT} arming limit.`,
      advice: 'The vehicle will refuse to arm. Recalibrate on a genuinely level surface.',
    };
  }
  if (scaleError !== null && scaleError > ACCEL_SCALE_ARM_MARGIN) {
    return {
      verdict: 'bad',
      summary: `Scale off by ${(scaleError * 100).toFixed(0)}%, past the arming limit.`,
      advice: 'The vehicle will refuse to arm. Recalibrate, holding each position still.',
    };
  }
  if (
    (offsetLength !== null && offsetLength > ACCEL_OFFSET_GOOD) ||
    (scaleError !== null && scaleError > ACCEL_SCALE_GOOD_MARGIN)
  ) {
    return {
      verdict: 'marginal',
      summary: offsetLength !== null && offsetLength > ACCEL_OFFSET_GOOD
        ? `Accepted but high: offsets ${offsetLength.toFixed(2)} m/s/s.`
        : `Accepted but high: scale off by ${((scaleError ?? 0) * 100).toFixed(0)}%.`,
      advice: 'Within arming limits but drifting. Recalibrate on a level surface, holding each position steady.',
    };
  }

  return {
    verdict: 'good',
    summary: offsetLength !== null
      ? `Good: offsets ${offsetLength.toFixed(2)} m/s/s.`
      : 'Good.',
  };
}

// ── Did it survive the reboot? ───────────────────────────────────────────────

export type CalibrationPersistence = 'verified' | 'not-persisted' | 'changed' | 'unverified';

export interface PersistenceResult {
  state: CalibrationPersistence;
  summary: string;
  /** Parameters that did not come back as written. */
  mismatched: string[];
}

/**
 * Compare the calibration parameters read back AFTER a reboot against what the
 * calibration wrote. This is the check whose absence lets an operator assume a
 * rebooted flight controller kept a calibration it actually discarded.
 *
 * Values are compared with a relative tolerance because the FC round-trips them
 * through float32 and its own parameter storage.
 */
export function verifyCalibrationPersisted(
  written: Record<string, number>,
  readBack: Record<string, number | undefined>,
  tolerance = 1e-3,
): PersistenceResult {
  const names = Object.keys(written);
  if (names.length === 0) {
    return { state: 'unverified', get summary() { return st('shared.calibration_quality.nothingToVerify', 'Nothing to verify.'); }, mismatched: [] };
  }

  const missing: string[] = [];
  const mismatched: string[] = [];

  for (const name of names) {
    const after = readBack[name];
    if (after === undefined) {
      missing.push(name);
      continue;
    }
    const before = written[name]!;
    const scale = Math.max(1, Math.abs(before));
    if (Math.abs(after - before) > tolerance * scale) mismatched.push(name);
  }

  if (missing.length === names.length) {
    return {
      state: 'unverified',
      get summary() { return st('shared.calibration_quality.couldNotReadTheCalibrationBack', 'Could not read the calibration back from the vehicle.'); },
      mismatched: missing,
    };
  }
  if (mismatched.length > 0 || missing.length > 0) {
    const lost = [...mismatched, ...missing];
    return {
      state: 'not-persisted',
      summary: `${lost.length} calibration value${lost.length === 1 ? '' : 's'} did not survive the reboot.`,
      mismatched: lost,
    };
  }

  return { state: 'verified', get summary() { return st('shared.calibration_quality.calibrationConfirmedOnTheVehicleAfter', 'Calibration confirmed on the vehicle after reboot.'); }, mismatched: [] };
}
