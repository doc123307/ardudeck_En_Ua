import { Anchor } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

export const boatCatamaran: VehicleTemplate = {
  slug: 'boat-catamaran',
  name: 'Catamaran',
  get description() { return t('lib.boat_catamaran.twinHullTwinPropStablePlatform'); },
  icon: Anchor,
  vehicleType: 'boat',
  category: 'boat',
  defaults: {
    type: 'boat',
    hullType: 'catamaran',
    hullLength: 2000,
    propellerType: 'prop',
    weight: 15000,
    maxSpeed: 8,
    batteryCells: 8,
    batteryCapacity: 30000,
  },
  toParams: (p) => [
    { name: 'FRAME_CLASS',     value: 1,  reason: t('lib.boat_catamaran.boatRoverFrameClass'), requiresReboot: true },
    { name: 'FRAME_TYPE',      value: 2,  reason: t('lib.boat_catamaran.boat'),                     requiresReboot: true },
    { name: 'SERVO1_FUNCTION', value: 73, reason: t('lib.boat_catamaran.throttleLeftHull'),       requiresReboot: true },
    { name: 'SERVO3_FUNCTION', value: 74, reason: t('lib.boat_catamaran.throttleRightHull'),      requiresReboot: true },
    { name: 'WP_SPEED',        value: p.maxSpeed ?? 4, reason: t('lib.boat_catamaran.waypointSpeed') },
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => (matches(m, 'FRAME_TYPE', 2) + matches(m, 'SERVO1_FUNCTION', 73)) / 2,
};
