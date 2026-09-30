import { Grid2x2 } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

export const copterQuadH: VehicleTemplate = {
  slug: 'copter-quad-h',
  name: 'Quadcopter (H)',
  get description() { return t('lib.copter_quad_h.fourMotorsInHPatternRigid'); },
  icon: Grid2x2,
  vehicleType: 'copter',
  category: 'multirotor',
  defaults: {
    type: 'copter',
    motorCount: 4,
    motorArrangement: 'quad-h',
    frameSize: 330,
    weight: 1800,
    batteryCells: 4,
    batteryCapacity: 5000,
  },
  toParams: (p) => [
    { name: 'FRAME_CLASS', value: 1, reason: t('lib.copter_quad_h.quadcopter'), requiresReboot: true },
    { name: 'FRAME_TYPE',  value: 3, reason: t('lib.copter_quad_h.hArrangement'),   requiresReboot: true },
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => (matches(m, 'FRAME_CLASS', 1) + matches(m, 'FRAME_TYPE', 3)) / 2,
};
