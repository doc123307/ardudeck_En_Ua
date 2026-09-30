import { Triangle } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

/**
 * Tricopter — 3 motors + tail-servo yaw. Uncommon but supported.
 */
export const copterTri: VehicleTemplate = {
  slug: 'copter-tri',
  name: 'Tricopter',
  get description() { return t('lib.copter_tri.threeMotorsYawServoEfficientAnd'); },
  icon: Triangle,
  vehicleType: 'copter',
  category: 'multirotor',
  defaults: {
    type: 'copter',
    motorCount: 3,
    motorArrangement: 'tri',
    frameSize: 450,
    weight: 1000,
    batteryCells: 4,
    batteryCapacity: 3300,
  },
  toParams: (p) => [
    { name: 'FRAME_CLASS', value: 7, reason: t('lib.copter_tri.tricopter'), requiresReboot: true },
    { name: 'FRAME_TYPE',  value: 1, reason: t('lib.copter_tri.yArrangement'),   requiresReboot: true },
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => matches(m, 'FRAME_CLASS', 7),
};
