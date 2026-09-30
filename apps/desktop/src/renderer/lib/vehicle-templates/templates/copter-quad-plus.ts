import { Plus } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

export const copterQuadPlus: VehicleTemplate = {
  slug: 'copter-quad-plus',
  name: 'Quadcopter (+)',
  get description() { return t('lib.copter_quad_plus.fourMotorsInPatternMotor1'); },
  icon: Plus,
  vehicleType: 'copter',
  category: 'multirotor',
  defaults: {
    type: 'copter',
    motorCount: 4,
    motorArrangement: 'quad-plus',
    frameSize: 254,
    weight: 1200,
    batteryCells: 4,
    batteryCapacity: 3000,
  },
  toParams: (p) => [
    { name: 'FRAME_CLASS', value: 1, reason: t('lib.copter_quad_plus.quadcopter'), requiresReboot: true },
    { name: 'FRAME_TYPE',  value: 0, reason: '+ arrangement',  requiresReboot: true },
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => (matches(m, 'FRAME_CLASS', 1) + matches(m, 'FRAME_TYPE', 0)) / 2,
};
