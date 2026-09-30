import { Hexagon } from 'lucide-react';
import type { VehicleTemplate } from '../types.js';
import { batteryParams, commonSafetyParams, simPhysicsParams, matches } from '../param-helpers.js';
import { t } from '../../../i18n';

export const copterHexPlus: VehicleTemplate = {
  slug: 'copter-hex-plus',
  name: 'Hexacopter (+)',
  get description() { return t('lib.copter_hex_plus.sixMotorsInClassicHeavyLift'); },
  icon: Hexagon,
  vehicleType: 'copter',
  category: 'multirotor',
  defaults: {
    type: 'copter',
    motorCount: 6,
    motorArrangement: 'hex-plus',
    frameSize: 550,
    weight: 2400,
    batteryCells: 6,
    batteryCapacity: 6000,
  },
  toParams: (p) => [
    { name: 'FRAME_CLASS', value: 2, reason: t('lib.copter_hex_plus.hexacopter'), requiresReboot: true },
    { name: 'FRAME_TYPE',  value: 0, reason: '+ arrangement',    requiresReboot: true },
    ...batteryParams(p),
    ...commonSafetyParams(),
  ],
  toSimParams: (p) => simPhysicsParams(p),
  inferFrom: (m) => (matches(m, 'FRAME_CLASS', 2) + matches(m, 'FRAME_TYPE', 0)) / 2,
};
