import { Plane } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, airspeedParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

export const vtolQuadplaneHex: VehicleTemplate = {
  slug: 'vtol-quadplane-hex',
  name: 'Hexplane (6 lift)',
  get description() { return t('lib.vtol_quadplane_hex.fixedWingPlaneWith6Vertical'); },
  icon: Plane,
  vehicleType: 'vtol',
  category: 'vtol',
  defaults: {
    type: 'vtol',
    wingShape: 'standard',
    vtolStyle: 'quadplane',
    motorArrangement: 'hex-x',
    vtolMotorCount: 6,
    wingspan: 2600,
    stallSpeed: 13,
    transitionSpeed: 17,
    weight: 6000,
    batteryCells: 12,
    batteryCapacity: 22000,
  },
  toParams: (p) => [
    { name: 'Q_ENABLE',        value: 1, reason: t('lib.vtol_quadplane_hex.enableVtolQuadplaneHex'), requiresReboot: true },
    { name: 'Q_FRAME_CLASS',   value: 2, reason: t('lib.vtol_quadplane_hex.hexacopterLiftFrame'),        requiresReboot: true },
    { name: 'Q_FRAME_TYPE',    value: 1, reason: t('lib.vtol_quadplane_hex.xArrangement'),                 requiresReboot: true },
    { name: 'Q_TAILSIT_ENABLE',value: 0, reason: t('lib.vtol_quadplane_hex.notATailsitter'),              requiresReboot: true },
    { name: 'Q_TILT_ENABLE',   value: 0, reason: t('lib.vtol_quadplane_hex.notATiltrotor'),               requiresReboot: true },
    { name: 'SERVO1_FUNCTION', value: 4,  reason: t('lib.vtol_quadplane_hex.aileron'),           requiresReboot: true },
    { name: 'SERVO2_FUNCTION', value: 19, reason: t('lib.vtol_quadplane_hex.elevator'),          requiresReboot: true },
    { name: 'SERVO3_FUNCTION', value: 70, reason: t('lib.vtol_quadplane_hex.forwardThrottle'),  requiresReboot: true },
    { name: 'SERVO4_FUNCTION', value: 21, reason: t('lib.vtol_quadplane_hex.rudder'),            requiresReboot: true },
    { name: 'SERVO5_FUNCTION', value: 33, reason: t('lib.vtol_quadplane_hex.motor1Lift'), requiresReboot: true },
    { name: 'SERVO6_FUNCTION', value: 34, reason: t('lib.vtol_quadplane_hex.motor2Lift'), requiresReboot: true },
    { name: 'SERVO7_FUNCTION', value: 35, reason: t('lib.vtol_quadplane_hex.motor3Lift'), requiresReboot: true },
    { name: 'SERVO8_FUNCTION', value: 36, reason: t('lib.vtol_quadplane_hex.motor4Lift'), requiresReboot: true },
    { name: 'SERVO9_FUNCTION', value: 37, reason: t('lib.vtol_quadplane_hex.motor5Lift'), requiresReboot: true },
    { name: 'SERVO10_FUNCTION',value: 38, reason: t('lib.vtol_quadplane_hex.motor6Lift'), requiresReboot: true },
    { name: 'Q_ASSIST_SPEED',  value: Math.max((p.stallSpeed ?? 12) * 0.8, 4), reason: t('lib.vtol_quadplane_hex.vtolAssistBelowThisSpeed') },
    ...airspeedParams(p),
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) =>
    (matches(m, 'Q_ENABLE', 1) + matches(m, 'Q_FRAME_CLASS', 2)) / 2,
};
