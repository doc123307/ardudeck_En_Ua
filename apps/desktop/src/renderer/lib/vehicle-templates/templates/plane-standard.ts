import { Plane } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, airspeedParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

export const planeStandard: VehicleTemplate = {
  slug: 'plane-standard',
  name: 'Standard Plane',
  get description() { return t('lib.plane_standard.traditionalFuselageWithSeparateElevatorRudder'); },
  icon: Plane,
  vehicleType: 'plane',
  category: 'fixed-wing',
  defaults: {
    type: 'plane',
    wingShape: 'standard',
    motorArrangement: 'twin-tractor',
    wingspan: 1800,
    stallSpeed: 9,
    weight: 1800,
    batteryCells: 4,
    batteryCapacity: 5000,
  },
  toParams: (p) => [
    { name: 'SERVO1_FUNCTION', value: 4,  reason: t('lib.plane_standard.aileron'),  requiresReboot: true },
    { name: 'SERVO2_FUNCTION', value: 19, reason: t('lib.plane_standard.elevator'), requiresReboot: true },
    { name: 'SERVO3_FUNCTION', value: 70, reason: t('lib.plane_standard.throttle'), requiresReboot: true },
    { name: 'SERVO4_FUNCTION', value: 21, reason: t('lib.plane_standard.rudder'),   requiresReboot: true },
    ...airspeedParams(p),
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => (matches(m, 'SERVO1_FUNCTION', 4) + matches(m, 'SERVO2_FUNCTION', 19)) / 2,
};
