import { Plane } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, airspeedParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

/**
 * Classic quadplane — fixed-wing plane + 4 vertical lift motors.
 * Forward propulsion is a separate motor (usually SERVO3 throttle).
 * Lift motors on channels 5-8 (Q_M_ outputs).
 */
export const vtolQuadplaneQuad: VehicleTemplate = {
  slug: 'vtol-quadplane-quad',
  name: 'Classic Quadplane (Quad lift)',
  get description() { return t('lib.vtol_quadplane_quad.fixedWingPlaneWith4Vertical'); },
  icon: Plane,
  vehicleType: 'vtol',
  category: 'vtol',
  defaults: {
    type: 'vtol',
    wingShape: 'standard',
    vtolStyle: 'quadplane',
    motorArrangement: 'quad-x',
    vtolMotorCount: 4,
    wingspan: 2000,
    stallSpeed: 12,
    transitionSpeed: 15,
    weight: 3500,
    batteryCells: 6,
    batteryCapacity: 10000,
  },
  toParams: (p) => [
    { name: 'Q_ENABLE',        value: 1, reason: t('lib.vtol_quadplane_quad.enableVtolQuadplane'), requiresReboot: true },
    { name: 'Q_FRAME_CLASS',   value: 1, reason: t('lib.vtol_quadplane_quad.quadcopterLiftFrame'),   requiresReboot: true },
    { name: 'Q_FRAME_TYPE',    value: 1, reason: t('lib.vtol_quadplane_quad.xArrangement'),            requiresReboot: true },
    { name: 'Q_TAILSIT_ENABLE',value: 0, reason: t('lib.vtol_quadplane_quad.notATailsitter'),         requiresReboot: true },
    { name: 'Q_TILT_ENABLE',   value: 0, reason: t('lib.vtol_quadplane_quad.notATiltrotor'),          requiresReboot: true },
    { name: 'SERVO1_FUNCTION', value: 4,  reason: t('lib.vtol_quadplane_quad.aileron'),          requiresReboot: true },
    { name: 'SERVO2_FUNCTION', value: 19, reason: t('lib.vtol_quadplane_quad.elevator'),         requiresReboot: true },
    { name: 'SERVO3_FUNCTION', value: 70, reason: t('lib.vtol_quadplane_quad.forwardThrottle'), requiresReboot: true },
    { name: 'SERVO4_FUNCTION', value: 21, reason: t('lib.vtol_quadplane_quad.rudder'),           requiresReboot: true },
    { name: 'SERVO5_FUNCTION', value: 33, reason: t('lib.vtol_quadplane_quad.motor1Lift'),    requiresReboot: true },
    { name: 'SERVO6_FUNCTION', value: 34, reason: t('lib.vtol_quadplane_quad.motor2Lift'),    requiresReboot: true },
    { name: 'SERVO7_FUNCTION', value: 35, reason: t('lib.vtol_quadplane_quad.motor3Lift'),    requiresReboot: true },
    { name: 'SERVO8_FUNCTION', value: 36, reason: t('lib.vtol_quadplane_quad.motor4Lift'),    requiresReboot: true },
    { name: 'Q_ASSIST_SPEED',  value: Math.max((p.stallSpeed ?? 10) * 0.8, 3), reason: t('lib.vtol_quadplane_quad.belowThisVtolMotorsAssistFixed') },
    { name: 'Q_RTL_MODE',      value: 1, reason: t('lib.vtol_quadplane_quad.useVtolForRtlLanding') },
    ...airspeedParams(p),
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) =>
    (matches(m, 'Q_ENABLE', 1) + matches(m, 'Q_FRAME_CLASS', 1) + matches(m, 'Q_TAILSIT_ENABLE', 0)) / 3,
};
