import { Waves } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

/**
 * Vectored 6-thruster sub — the BlueROV2 reference frame. 4 vectored thrusters
 * for horizontal motion + 2 vertical thrusters for depth.
 */
export const subVectored6: VehicleTemplate = {
  slug: 'sub-vectored-6',
  name: 'Vectored 6-Thruster',
  get description() { return t('lib.sub_vectored_6.bluerov2Style4Vectored2Vertical'); },
  icon: Waves,
  vehicleType: 'sub',
  category: 'sub',
  defaults: {
    type: 'sub',
    thrusterCount: 6,
    maxDepth: 100,
    buoyancy: 'neutral',
    weight: 11000,
    batteryCells: 4,
    batteryCapacity: 18000,
  },
  toParams: (p) => [
    { name: 'FRAME_CONFIG',    value: 1,  reason: t('lib.sub_vectored_6.vectored6Frame'),     requiresReboot: true },
    { name: 'SERVO1_FUNCTION', value: 33, reason: t('lib.sub_vectored_6.motor1ForwardRightVec'), requiresReboot: true },
    { name: 'SERVO2_FUNCTION', value: 34, reason: t('lib.sub_vectored_6.motor2ForwardLeftVec'),  requiresReboot: true },
    { name: 'SERVO3_FUNCTION', value: 35, reason: t('lib.sub_vectored_6.motor3RearRightVec'),    requiresReboot: true },
    { name: 'SERVO4_FUNCTION', value: 36, reason: t('lib.sub_vectored_6.motor4RearLeftVec'),     requiresReboot: true },
    { name: 'SERVO5_FUNCTION', value: 37, reason: t('lib.sub_vectored_6.motor5VerticalRight'),    requiresReboot: true },
    { name: 'SERVO6_FUNCTION', value: 38, reason: t('lib.sub_vectored_6.motor6VerticalLeft'),     requiresReboot: true },
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => matches(m, 'FRAME_CONFIG', 1),
};
