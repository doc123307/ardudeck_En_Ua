import { Car } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

export const roverAckermann: VehicleTemplate = {
  slug: 'rover-ackermann',
  name: 'Ackermann Rover',
  get description() { return t('lib.rover_ackermann.carStyleSingleThrottleSteeringServo'); },
  icon: Car,
  vehicleType: 'rover',
  category: 'rover',
  defaults: {
    type: 'rover',
    driveType: 'ackermann',
    wheelbase: 300,
    wheelDiameter: 100,
    weight: 3000,
    maxSpeed: 10,
    batteryCells: 3,
    batteryCapacity: 5000,
  },
  toParams: (p) => [
    { name: 'FRAME_CLASS',     value: 1,  reason: t('lib.rover_ackermann.roverFrame'),       requiresReboot: true },
    { name: 'FRAME_TYPE',      value: 0,  reason: t('lib.rover_ackermann.undefinedAckermannUsesSteering'), requiresReboot: true },
    { name: 'SERVO1_FUNCTION', value: 26, reason: t('lib.rover_ackermann.groundSteering'),   requiresReboot: true },
    { name: 'SERVO3_FUNCTION', value: 70, reason: t('lib.rover_ackermann.throttle'),          requiresReboot: true },
    { name: 'WP_SPEED',        value: p.maxSpeed ?? 5, reason: t('lib.rover_ackermann.waypointSpeedFromMaxspeed') },
    { name: 'CRUISE_SPEED',    value: (p.maxSpeed ?? 5) * 0.6, reason: t('lib.rover_ackermann.cruiseSpeed60OfMax') },
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => matches(m, 'SERVO1_FUNCTION', 26),
};
