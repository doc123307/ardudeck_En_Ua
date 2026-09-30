import { t } from '../../i18n';
/**
 * OSD Element Categories
 *
 * Defines the category groupings for OSD elements.
 * Used by the element browser for accordion organization.
 */

export type OsdElementCategory =
  | 'general'
  | 'battery'
  | 'altitude'
  | 'speed'
  | 'gps'
  | 'attitude'
  | 'timers'
  | 'radio'
  | 'sensors'
  | 'mission';

export interface CategoryDefinition {
  id: OsdElementCategory;
  name: string;
  description: string;
}

export const ELEMENT_CATEGORIES: CategoryDefinition[] = [
  { id: 'general', name: 'General', get description() { return t('utils.element_categories.flightModeWarningsCraftInfo'); } },
  { id: 'battery', name: 'Battery & Power', get description() { return t('utils.element_categories.voltageCurrentCapacityEfficiency'); } },
  { id: 'altitude', name: 'Altitude & Vario', get description() { return t('utils.element_categories.altitudeMslVariometer'); } },
  { id: 'speed', name: 'Speed & Distance', get description() { return t('utils.element_categories.groundSpeedAirspeedDistance'); } },
  { id: 'gps', name: 'GPS', get description() { return t('utils.element_categories.satellitesHdopCoordinates'); } },
  { id: 'attitude', name: 'Attitude', get description() { return t('utils.element_categories.crosshairsHorizonPitchRollHeading'); } },
  { id: 'timers', name: 'Timers', get description() { return t('utils.element_categories.flightTimeOnTimeRemaining'); } },
  { id: 'radio', name: 'Radio & Control', get description() { return t('utils.element_categories.rssiThrottlePosition'); } },
  { id: 'sensors', name: 'Sensors', get description() { return t('utils.element_categories.temperatureGForceEscData'); } },
  { id: 'mission', name: 'Mission', get description() { return t('utils.element_categories.vtxWindIndicators'); } },
];

export const CATEGORY_MAP = new Map<OsdElementCategory, CategoryDefinition>(
  ELEMENT_CATEGORIES.map((c) => [c.id, c])
);
