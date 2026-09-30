import { Octagon } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

export const copterOctoPlus: VehicleTemplate = {
  slug: 'copter-octo-plus',
  name: 'Octocopter (+)',
  get description() { return t('lib.copter_octo_plus.eightMotorsInSymmetricalHeavyLift'); },
  icon: Octagon,
  vehicleType: 'copter',
  category: 'multirotor',
  defaults: {
    type: 'copter',
    motorCount: 8,
    motorArrangement: 'octo-plus',
    frameSize: 900,
    weight: 6000,
    batteryCells: 6,
    batteryCapacity: 16000,
  },
  toParams: (p) => [
    { name: 'FRAME_CLASS', value: 3, reason: t('lib.copter_octo_plus.octocopter'), requiresReboot: true },
    { name: 'FRAME_TYPE',  value: 0, reason: '+ arrangement',    requiresReboot: true },
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => (matches(m, 'FRAME_CLASS', 3) + matches(m, 'FRAME_TYPE', 0)) / 2,
};
