import { Car } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

/**
 * Differential / skid-steer rover — tank-style, two independent throttles.
 */
export const roverSkid: VehicleTemplate = {
  slug: 'rover-skid',
  name: 'Skid-Steer Rover',
  get description() { return t('lib.rover_skid.differentialDriveTankStyleNoSteering'); },
  icon: Car,
  vehicleType: 'rover',
  category: 'rover',
  defaults: {
    type: 'rover',
    driveType: 'differential',
    wheelbase: 250,
    wheelDiameter: 120,
    weight: 4000,
    maxSpeed: 5,
    batteryCells: 4,
    batteryCapacity: 8000,
  },
  toParams: (p) => [
    { name: 'FRAME_CLASS',     value: 1,  reason: t('lib.rover_skid.roverFrame'),     requiresReboot: true },
    { name: 'FRAME_TYPE',      value: 0,  reason: t('lib.rover_skid.differential'),    requiresReboot: true },
    { name: 'SERVO1_FUNCTION', value: 73, reason: t('lib.rover_skid.throttleLeft'),   requiresReboot: true },
    { name: 'SERVO3_FUNCTION', value: 74, reason: t('lib.rover_skid.throttleRight'),  requiresReboot: true },
    { name: 'WP_SPEED',        value: p.maxSpeed ?? 3, reason: t('lib.rover_skid.waypointSpeedFromMaxspeed') },
    { name: 'CRUISE_SPEED',    value: (p.maxSpeed ?? 3) * 0.6, reason: t('lib.rover_skid.cruiseSpeed60OfMax') },
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => (matches(m, 'SERVO1_FUNCTION', 73) + matches(m, 'SERVO3_FUNCTION', 74)) / 2,
};
