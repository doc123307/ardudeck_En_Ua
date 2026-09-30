import { Zap } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

/**
 * ArduPilot FRAME_CLASS=1 (quad), FRAME_TYPE=1 (X).
 * The most common beginner/expert multirotor frame.
 */
export const copterQuadX: VehicleTemplate = {
  slug: 'copter-quad-x',
  name: 'Quadcopter (X)',
  get description() { return t('lib.copter_quad_x.fourMotorsInAnXPattern'); },
  icon: Zap,
  vehicleType: 'copter',
  category: 'multirotor',
  defaults: {
    type: 'copter',
    motorCount: 4,
    motorArrangement: 'quad-x',
    frameSize: 254,
    weight: 1200,
    batteryCells: 4,
    batteryCapacity: 3000,
  },
  toParams: (p) => [
    { name: 'FRAME_CLASS', value: 1, reason: t('lib.copter_quad_x.quadcopter'), requiresReboot: true },
    { name: 'FRAME_TYPE',  value: 1, reason: t('lib.copter_quad_x.xArrangement'),   requiresReboot: true },
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => (matches(m, 'FRAME_CLASS', 1) + matches(m, 'FRAME_TYPE', 1)) / 2,
};
