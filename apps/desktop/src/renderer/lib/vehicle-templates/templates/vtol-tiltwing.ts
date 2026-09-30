import { RotateCw } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, airspeedParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

/**
 * Tiltwing — the whole wing pivots instead of just the motors.
 * Q_TILT_TYPE=1 = bicopter tiltwing mode.
 */
export const vtolTiltwing: VehicleTemplate = {
  slug: 'vtol-tiltwing',
  name: 'Tiltwing',
  get description() { return t('lib.vtol_tiltwing.entireWingPivotsFromHoverTo'); },
  icon: RotateCw,
  vehicleType: 'vtol',
  category: 'vtol',
  defaults: {
    type: 'vtol',
    wingShape: 'standard',
    vtolStyle: 'tiltwing',
    motorArrangement: 'quad-x',
    vtolMotorCount: 4,
    wingspan: 2200,
    stallSpeed: 11,
    transitionSpeed: 16,
    weight: 4000,
    batteryCells: 6,
    batteryCapacity: 12000,
  },
  toParams: (p) => [
    { name: 'Q_ENABLE',        value: 1, reason: t('lib.vtol_tiltwing.enableVtol'),          requiresReboot: true },
    { name: 'Q_TILT_ENABLE',   value: 1, reason: t('lib.vtol_tiltwing.enableTiltServos'),   requiresReboot: true },
    { name: 'Q_TILT_TYPE',     value: 1, reason: t('lib.vtol_tiltwing.tiltwingWholeWingTilts'), requiresReboot: true },
    { name: 'Q_TILT_MASK',     value: 15, reason: t('lib.vtol_tiltwing.all4MotorsTiltWithWing'), requiresReboot: true },
    { name: 'Q_FRAME_CLASS',   value: 1, reason: t('lib.vtol_tiltwing.quadcopterLiftFrame'), requiresReboot: true },
    { name: 'Q_FRAME_TYPE',    value: 1, reason: t('lib.vtol_tiltwing.xArrangement'),          requiresReboot: true },
    { name: 'SERVO1_FUNCTION', value: 4,  reason: t('lib.vtol_tiltwing.aileron'),      requiresReboot: true },
    { name: 'SERVO2_FUNCTION', value: 19, reason: t('lib.vtol_tiltwing.elevator'),     requiresReboot: true },
    { name: 'SERVO5_FUNCTION', value: 33, reason: t('lib.vtol_tiltwing.motor1'), requiresReboot: true },
    { name: 'SERVO6_FUNCTION', value: 34, reason: t('lib.vtol_tiltwing.motor2'), requiresReboot: true },
    { name: 'SERVO7_FUNCTION', value: 35, reason: t('lib.vtol_tiltwing.motor3'), requiresReboot: true },
    { name: 'SERVO8_FUNCTION', value: 36, reason: t('lib.vtol_tiltwing.motor4'), requiresReboot: true },
    { name: 'SERVO9_FUNCTION', value: 41, reason: t('lib.vtol_tiltwing.tiltServoSharedWingTilt'), requiresReboot: true },
    ...airspeedParams(p),
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => (matches(m, 'Q_TILT_ENABLE', 1) + matches(m, 'Q_TILT_TYPE', 1)) / 2,
};
