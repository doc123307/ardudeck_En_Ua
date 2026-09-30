import { Anchor } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

export const boatTwinProp: VehicleTemplate = {
  slug: 'boat-twin-prop',
  name: 'Twin-Prop Boat',
  get description() { return t('lib.boat_twin_prop.twoMotorsDifferentialThrustSteeringNo'); },
  icon: Anchor,
  vehicleType: 'boat',
  category: 'boat',
  defaults: {
    type: 'boat',
    hullType: 'displacement',
    hullLength: 1500,
    propellerType: 'prop',
    weight: 12000,
    maxSpeed: 6,
    batteryCells: 6,
    batteryCapacity: 20000,
  },
  toParams: (p) => [
    { name: 'FRAME_CLASS',     value: 1,  reason: t('lib.boat_twin_prop.boatRoverFrameClass'), requiresReboot: true },
    { name: 'FRAME_TYPE',      value: 2,  reason: t('lib.boat_twin_prop.boat'),                     requiresReboot: true },
    { name: 'SERVO1_FUNCTION', value: 73, reason: t('lib.boat_twin_prop.throttleLeft'),            requiresReboot: true },
    { name: 'SERVO3_FUNCTION', value: 74, reason: t('lib.boat_twin_prop.throttleRight'),           requiresReboot: true },
    { name: 'WP_SPEED',        value: p.maxSpeed ?? 3, reason: t('lib.boat_twin_prop.waypointSpeed') },
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => (matches(m, 'FRAME_TYPE', 2) + matches(m, 'SERVO1_FUNCTION', 73)) / 2,
};
