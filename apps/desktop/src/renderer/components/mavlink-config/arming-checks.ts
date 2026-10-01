import { t } from '../../i18n';
/**
 * Arming checks across firmware generations.
 *
 * Up to ArduPilot 4.6 the parameter was ARMING_CHECK, a mask of checks to RUN,
 * with bit 0 meaning "all". From 4.7 it is ARMING_SKIPCHK, a mask of checks to
 * SKIP, where 0 means everything runs and -1 skips every non-mandatory one.
 * Same bit positions, opposite meaning, so a UI written against one silently
 * inverts on the other: showing every check as disabled, or worse, turning them
 * off while claiming to turn them on.
 */

export type ArmingParam = 'ARMING_CHECK' | 'ARMING_SKIPCHK';

export interface ArmingModel {
  param: ArmingParam;
  /** 'run' = bits are checks that run; 'skip' = bits are checks that are skipped. */
  sense: 'run' | 'skip';
}

export interface ArmingCheckBit {
  /** Bit index, identical in both parameters. */
  bit: number;
  name: string;
  description: string;
  /** Plane-only check, hidden elsewhere. */
  planeOnly?: boolean;
}

/** Bit list from AP_Arming's own documentation. Bit 0 was "all" on the old
 * parameter and has no equivalent on the new one. */
export const ARMING_CHECK_BITS: ArmingCheckBit[] = [
  { bit: 1, get name() { return t('mavlink_config.arming_checks.barometer'); }, get description() { return t('mavlink_config.arming_checks.barometerHealth'); } },
  { bit: 2, get name() { return t('mavlink_config.arming_checks.compass'); }, get description() { return t('mavlink_config.arming_checks.compassHealthAndCalibration'); } },
  { bit: 3, get name() { return t('mavlink_config.arming_checks.gpsLock'); }, get description() { return t('mavlink_config.arming_checks.positionFixBeforeArming'); } },
  { bit: 4, name: 'INS', get description() { return t('mavlink_config.arming_checks.accelerometerAndGyroHealth'); } },
  { bit: 5, get name() { return t('mavlink_config.arming_checks.parameters'); }, get description() { return t('mavlink_config.arming_checks.parameterSanity'); } },
  { bit: 6, get name() { return t('mavlink_config.arming_checks.rcChannels'); }, get description() { return t('mavlink_config.arming_checks.receiverCalibratedAndPresent'); } },
  { bit: 7, get name() { return t('mavlink_config.arming_checks.boardVoltage'); }, get description() { return t('mavlink_config.arming_checks.autopilotSupplyWithinRange'); } },
  { bit: 8, get name() { return t('mavlink_config.arming_checks.batteryLevel'); }, get description() { return t('mavlink_config.arming_checks.packAboveTheArmingThreshold'); } },
  { bit: 9, get name() { return t('mavlink_config.arming_checks.airspeed'); }, get description() { return t('mavlink_config.arming_checks.airspeedSensorHealth'); }, planeOnly: true },
  { bit: 10, get name() { return t('mavlink_config.arming_checks.logging'); }, get description() { return t('mavlink_config.arming_checks.loggingIsRunningNeedsACard'); } },
  { bit: 11, get name() { return t('mavlink_config.arming_checks.safetySwitch'); }, get description() { return t('mavlink_config.arming_checks.hardwareSafetySwitchReleased'); } },
  { bit: 12, get name() { return t('mavlink_config.arming_checks.gpsConfiguration'); }, get description() { return t('mavlink_config.arming_checks.receiverConfiguredAsExpected'); } },
  { bit: 13, get name() { return t('mavlink_config.arming_checks.system'); }, get description() { return t('mavlink_config.arming_checks.overallSystemHealth'); } },
  { bit: 14, get name() { return t('mavlink_config.arming_checks.mission'); }, get description() { return t('mavlink_config.arming_checks.loadedMissionIsValid'); } },
  { bit: 15, get name() { return t('mavlink_config.arming_checks.rangefinder'); }, get description() { return t('mavlink_config.arming_checks.rangefinderHealth'); } },
  { bit: 16, get name() { return t('mavlink_config.arming_checks.camera'); }, get description() { return t('mavlink_config.arming_checks.cameraAndGimbalHealth'); } },
  { bit: 17, name: 'AuxAuth', get description() { return t('mavlink_config.arming_checks.authorisationFromACompanionComputer'); } },
  { bit: 18, get name() { return t('mavlink_config.arming_checks.visualOdometry'); }, get description() { return t('mavlink_config.arming_checks.visualOdometryHealth'); } },
  { bit: 19, name: 'FFT', get description() { return t('mavlink_config.arming_checks.inFlightFftHealth'); } },
];

/** Which parameter this board speaks. SKIPCHK wins when both are present, as
 * that is the one 4.7 acts on. */
export function detectArmingModel(has: (param: string) => boolean): ArmingModel | null {
  if (has('ARMING_SKIPCHK')) return { param: 'ARMING_SKIPCHK', sense: 'skip' };
  if (has('ARMING_CHECK')) return { param: 'ARMING_CHECK', sense: 'run' };
  return null;
}

/** Value meaning "every check runs". */
export function allChecksValue(model: ArmingModel): number {
  return model.sense === 'skip' ? 0 : 1;
}

/** Value meaning "skip everything that may be skipped". */
export function noChecksValue(model: ArmingModel): number {
  return model.sense === 'skip' ? -1 : 0;
}

export function isAllChecks(model: ArmingModel, value: number): boolean {
  return value === allChecksValue(model);
}

export function isNoChecks(model: ArmingModel, value: number): boolean {
  return value === noChecksValue(model);
}

/** True when this check runs, whichever way the parameter is written. */
export function isCheckEnabled(model: ArmingModel, value: number, bit: number): boolean {
  if (model.sense === 'skip') {
    if (value === -1) return false;
    return (value & (1 << bit)) === 0;
  }
  if (value === 1) return true;
  return (value & (1 << bit)) !== 0;
}

/**
 * The value that flips one check, expanding the shorthand first: "all" on the
 * old parameter and -1 on the new one carry no per-bit detail, so turning one
 * check off from either would otherwise change every other check too.
 */
export function toggleCheck(
  model: ArmingModel,
  value: number,
  bit: number,
  bits: ArmingCheckBit[] = ARMING_CHECK_BITS,
): number {
  const mask = bits.reduce((acc, b) => acc | (1 << b.bit), 0);
  if (model.sense === 'skip') {
    const base = value === -1 ? mask : value;
    return base ^ (1 << bit);
  }
  const base = value === 1 ? mask : value;
  return base ^ (1 << bit);
}

/** The value with one check forced off, used where a card offers to silence a
 * specific refusal (logging with no SD card, say). */
export function withCheckDisabled(
  model: ArmingModel,
  value: number,
  bit: number,
  bits: ArmingCheckBit[] = ARMING_CHECK_BITS,
): number {
  if (!isCheckEnabled(model, value, bit)) return value;
  return toggleCheck(model, value, bit, bits);
}
