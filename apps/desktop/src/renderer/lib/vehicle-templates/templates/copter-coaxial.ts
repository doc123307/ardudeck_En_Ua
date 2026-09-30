import { Circle } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

/**
 * Coaxial quad — 8 motors stacked as 4 coaxial pairs, classic rigid industrial frame.
 */
export const copterCoaxial: VehicleTemplate = {
  slug: 'copter-coaxial',
  name: 'Coaxial Quad (X8)',
  get description() { return t('lib.copter_coaxial.eightMotorsIn4CoaxialPairs'); },
  icon: Circle,
  vehicleType: 'copter',
  category: 'multirotor',
  defaults: {
    type: 'copter',
    motorCount: 8,
    motorArrangement: 'coaxial',
    frameSize: 600,
    weight: 5000,
    batteryCells: 6,
    batteryCapacity: 12000,
  },
  toParams: (p) => [
    { name: 'FRAME_CLASS', value: 4, reason: t('lib.copter_coaxial.octaquadCoaxialX8'), requiresReboot: true },
    { name: 'FRAME_TYPE',  value: 1, reason: t('lib.copter_coaxial.xArrangement'),           requiresReboot: true },
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => (matches(m, 'FRAME_CLASS', 4) + matches(m, 'FRAME_TYPE', 1)) / 2,
};
