import { t } from '../../../i18n';
/**
 * Curated catalog of common PX4 airframes for the airframe picker.
 *
 * PX4 selects an airframe with a single integer parameter, SYS_AUTOSTART (the
 * "auto-start script index"), then requires a reboot. PX4's full airframe DB is
 * large and version-dependent; this is a deliberately small, hand-checked
 * subset of well-known generic ids rather than an import of the whole DB.
 *
 * The ids below are the standard PX4 generic SYS_AUTOSTART values. They should
 * be confirmed against the PX4 airframe reference for a given firmware version:
 * https://docs.px4.io/main/en/airframes/airframe_reference.html
 */

export type Px4AirframeCategory = 'multirotor' | 'fixed-wing' | 'vtol' | 'rover';

export interface Px4Airframe {
  /** SYS_AUTOSTART id. */
  id: number;
  name: string;
  category: Px4AirframeCategory;
  description: string;
}

export const PX4_AIRFRAME_CATEGORIES: Array<{ id: Px4AirframeCategory; label: string }> = [
  { id: 'multirotor', get label() { return t('settings.px4_airframes.multirotor'); } },
  { id: 'fixed-wing', get label() { return t('settings.px4_airframes.fixedWing'); } },
  { id: 'vtol', label: 'VTOL' },
  { id: 'rover', get label() { return t('settings.px4_airframes.rover'); } },
];

export const PX4_AIRFRAMES: Px4Airframe[] = [
  // Multirotor (well-known generic ids)
  { id: 4001, name: 'Generic Quadcopter (X)', category: 'multirotor', get description() { return t('settings.px4_airframes.standardQuadInXLayout'); } },
  { id: 4002, name: 'Generic Quadcopter (+)', category: 'multirotor', get description() { return t('settings.px4_airframes.standardQuadInLayout'); } },
  { id: 4008, name: 'Generic Quadcopter (Wide)', category: 'multirotor', get description() { return t('settings.px4_airframes.quadXWithWidenedArmGeometry'); } },
  { id: 6001, name: 'Generic Hexarotor (X)', category: 'multirotor', get description() { return t('settings.px4_airframes.standardHexaInXLayout'); } },
  { id: 6002, name: 'Generic Hexarotor (+)', category: 'multirotor', get description() { return t('settings.px4_airframes.standardHexaInLayout'); } },
  { id: 8001, name: 'Generic Octorotor (X)', category: 'multirotor', get description() { return t('settings.px4_airframes.standardOctoInXLayout'); } },
  { id: 8002, name: 'Generic Octorotor (+)', category: 'multirotor', get description() { return t('settings.px4_airframes.standardOctoInLayout'); } },

  // Fixed wing
  { id: 2100, name: 'Generic Standard Plane', category: 'fixed-wing', get description() { return t('settings.px4_airframes.conventionalFixedWingAircraft'); } },
  { id: 3000, name: 'Generic Flying Wing', category: 'fixed-wing', get description() { return t('settings.px4_airframes.taillessFlyingWingDelta'); } },

  // VTOL (use generic ids; confirm against the PX4 reference)
  { id: 13000, name: 'Generic Standard VTOL', category: 'vtol', get description() { return t('settings.px4_airframes.quadPusherStandardVtol'); } },
  { id: 13200, name: 'Generic Quad Tailsitter VTOL', category: 'vtol', get description() { return t('settings.px4_airframes.quadMotorTailsitterVtol'); } },
  { id: 14001, name: 'Generic Tiltrotor VTOL', category: 'vtol', get description() { return t('settings.px4_airframes.tiltrotorVtol'); } },

  // Rover
  { id: 50000, name: 'Generic Ground Vehicle', category: 'rover', get description() { return t('settings.px4_airframes.differentialAckermannGroundRover'); } },
];
