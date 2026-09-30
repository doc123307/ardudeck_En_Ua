/**
 * OSD Element Registry
 *
 * Central catalog of all OSD elements with metadata, categories,
 * preview info, and default positions. This is the single source
 * of truth for what OSD elements exist and their properties.
 */

import { SYM } from './osd-symbols';
import type { OsdElementCategory } from './element-categories';
import { listModuleOsdElements, getModuleOsdElement } from '../../modules/module-osd-registry';
import { t } from '../../i18n';

/** Size of an OSD element in character units */
export interface ElementSize {
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Element ID type - expanded from the original 16 to 55+
// ---------------------------------------------------------------------------

export type OsdElementId =
  // General
  | 'flymode'
  | 'armed_status'
  | 'craft_name'
  | 'warnings'
  | 'messages'
  // Battery & Power
  | 'battery_voltage'
  | 'battery_cell_voltage'
  | 'battery_percent'
  | 'current_draw'
  | 'mah_drawn'
  | 'power_watts'
  | 'efficiency'
  // Altitude & Vario
  | 'altitude'
  | 'msl_altitude'
  | 'vario'
  // Speed & Distance
  | 'speed'
  | 'airspeed'
  | 'max_speed'
  | 'distance'
  | 'home_direction'
  // GPS
  | 'gps_sats'
  | 'gps_hdop'
  | 'latitude'
  | 'longitude'
  | 'coordinates'
  // Attitude
  | 'crosshairs'
  | 'artificial_horizon'
  | 'horizon_sidebars'
  | 'pitch'
  | 'roll'
  | 'heading'
  | 'heading_graph'
  // Timers
  | 'flight_time'
  | 'on_time'
  | 'rtc_time'
  | 'remaining_flight_time'
  // Radio & Control
  | 'rssi'
  | 'rssi_dbm'
  | 'throttle'
  | 'throttle_gauge'
  // Sensors
  | 'baro_temp'
  | 'imu_temp'
  | 'esc_temp'
  | 'g_force'
  | 'esc_rpm'
  // Mission
  | 'vtx_channel'
  | 'wind_horizontal'
  | 'wind_vertical';

// ---------------------------------------------------------------------------
// Element Definition
// ---------------------------------------------------------------------------

export interface OsdElementDefinition {
  id: OsdElementId;
  name: string;
  category: OsdElementCategory;
  description: string;
  /** Primary symbol character index for inline preview in element browser */
  previewSymbol: number;
  /** Sample text shown in preview (e.g. "11.8V") */
  previewText: string;
  size: ElementSize;
  defaultPosition: { x: number; y: number; enabled: boolean };
  /** Betaflight OSD element index for FC sync */
  betaflightIndex?: number;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const ELEMENT_REGISTRY: OsdElementDefinition[] = [
  // ── General ───────────────────────────────────────────────────────────
  {
    id: 'flymode',
    name: 'Flight Mode',
    category: 'general',
    get description() { return t('utils.element_registry.currentFlightModeNameAngleHorizon'); },
    previewSymbol: SYM.HEADING,
    previewText: 'ANGLE',
    size: { width: 8, height: 1 },
    defaultPosition: { x: 12, y: 12, enabled: false },
    betaflightIndex: 7,
  },
  {
    id: 'armed_status',
    name: 'Armed Status',
    category: 'general',
    get description() { return t('utils.element_registry.showsArmedOrDisarmedState'); },
    previewSymbol: SYM.ALERT,
    previewText: 'ARMED',
    size: { width: 8, height: 1 },
    defaultPosition: { x: 12, y: 13, enabled: false },
    betaflightIndex: 29,
  },
  {
    id: 'craft_name',
    name: 'Craft Name',
    category: 'general',
    get description() { return t('utils.element_registry.userConfiguredAircraftName'); },
    previewSymbol: SYM.HEADING,
    previewText: 'ARDUDECK',
    size: { width: 10, height: 1 },
    defaultPosition: { x: 10, y: 15, enabled: false },
    betaflightIndex: 8,
  },
  {
    id: 'warnings',
    name: 'Warnings',
    category: 'general',
    get description() { return t('utils.element_registry.systemWarningsLowBatteryGpsLost'); },
    previewSymbol: SYM.ALERT,
    previewText: 'LOW BATT',
    size: { width: 12, height: 1 },
    defaultPosition: { x: 9, y: 10, enabled: false },
    betaflightIndex: 21,
  },
  {
    id: 'messages',
    name: 'Messages',
    category: 'general',
    get description() { return t('utils.element_registry.fcStatusMessagesAndNotifications'); },
    previewSymbol: SYM.HEADING,
    previewText: 'MSG',
    size: { width: 12, height: 1 },
    defaultPosition: { x: 9, y: 11, enabled: false },
  },

  // ── Battery & Power ───────────────────────────────────────────────────
  {
    id: 'battery_voltage',
    name: 'Battery Voltage',
    category: 'battery',
    get description() { return t('utils.element_registry.totalBatteryPackVoltage'); },
    previewSymbol: SYM.BATT,
    previewText: '11.8V',
    size: { width: 6, height: 1 },
    defaultPosition: { x: 1, y: 0, enabled: true },
    betaflightIndex: 1,
  },
  {
    id: 'battery_cell_voltage',
    name: 'Cell Voltage',
    category: 'battery',
    get description() { return t('utils.element_registry.averageVoltagePerCell'); },
    previewSymbol: SYM.BATT,
    previewText: '3.95V',
    size: { width: 6, height: 1 },
    defaultPosition: { x: 1, y: 1, enabled: false },
    betaflightIndex: 22,
  },
  {
    id: 'battery_percent',
    name: 'Battery Percent',
    category: 'battery',
    get description() { return t('utils.element_registry.batteryChargeRemainingPercentage'); },
    previewSymbol: SYM.BATT,
    previewText: ' 75%',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 24, y: 0, enabled: true },
    betaflightIndex: 28,
  },
  {
    id: 'current_draw',
    name: 'Current Draw',
    category: 'battery',
    get description() { return t('utils.element_registry.instantaneousCurrentDrawInAmps'); },
    previewSymbol: SYM.AMP,
    previewText: ' 8.5A',
    size: { width: 6, height: 1 },
    defaultPosition: { x: 1, y: 5, enabled: false },
    betaflightIndex: 11,
  },
  {
    id: 'mah_drawn',
    name: 'mAh Drawn',
    category: 'battery',
    get description() { return t('utils.element_registry.totalMilliampHoursConsumed'); },
    previewSymbol: SYM.MAH,
    previewText: ' 850',
    size: { width: 6, height: 1 },
    defaultPosition: { x: 1, y: 6, enabled: false },
    betaflightIndex: 12,
  },
  {
    id: 'power_watts',
    name: 'Power (Watts)',
    category: 'battery',
    get description() { return t('utils.element_registry.instantaneousPowerConsumption'); },
    previewSymbol: SYM.WATT,
    previewText: '100W',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 1, y: 7, enabled: false },
  },
  {
    id: 'efficiency',
    name: 'Efficiency',
    category: 'battery',
    get description() { return t('utils.element_registry.mahPerKmEfficiencyIndicator'); },
    previewSymbol: SYM.MAH_KM_0,
    previewText: '120',
    size: { width: 6, height: 1 },
    defaultPosition: { x: 1, y: 8, enabled: false },
  },

  // ── Altitude & Vario ──────────────────────────────────────────────────
  {
    id: 'altitude',
    name: 'Altitude (AGL)',
    category: 'altitude',
    get description() { return t('utils.element_registry.altitudeAboveGroundLevelHome'); },
    previewSymbol: SYM.ALT_M,
    previewText: ' 120m',
    size: { width: 6, height: 1 },
    defaultPosition: { x: 1, y: 2, enabled: true },
    betaflightIndex: 15,
  },
  {
    id: 'msl_altitude',
    name: 'MSL Altitude',
    category: 'altitude',
    get description() { return t('utils.element_registry.altitudeAboveMeanSeaLevel'); },
    previewSymbol: SYM.ALT_M,
    previewText: ' 450m',
    size: { width: 6, height: 1 },
    defaultPosition: { x: 1, y: 3, enabled: false },
  },
  {
    id: 'vario',
    name: 'Variometer',
    category: 'altitude',
    get description() { return t('utils.element_registry.verticalSpeedIndicatorClimbSink'); },
    previewSymbol: SYM.VARIO_UP_2A,
    previewText: '+2.5',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 7, y: 2, enabled: false },
  },

  // ── Speed & Distance ──────────────────────────────────────────────────
  {
    id: 'speed',
    name: 'Ground Speed',
    category: 'speed',
    get description() { return t('utils.element_registry.speedOverGround'); },
    previewSymbol: SYM.KMH,
    previewText: ' 54',
    size: { width: 4, height: 1 },
    defaultPosition: { x: 1, y: 3, enabled: true },
    betaflightIndex: 13,
  },
  {
    id: 'airspeed',
    name: 'Airspeed',
    category: 'speed',
    get description() { return t('utils.element_registry.indicatedAirspeedFromPitotTube'); },
    previewSymbol: SYM.AIR,
    previewText: ' 65',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 1, y: 4, enabled: false },
  },
  {
    id: 'max_speed',
    name: 'Max Speed',
    category: 'speed',
    get description() { return t('utils.element_registry.maximumSpeedAchievedInFlight'); },
    previewSymbol: SYM.MAX,
    previewText: ' 72',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 1, y: 5, enabled: false },
  },
  {
    id: 'distance',
    name: 'Home Distance',
    category: 'speed',
    get description() { return t('utils.element_registry.distanceFromHomePoint'); },
    previewSymbol: SYM.HOME,
    previewText: ' 350m',
    size: { width: 6, height: 1 },
    defaultPosition: { x: 1, y: 4, enabled: true },
    betaflightIndex: 31,
  },
  {
    id: 'home_direction',
    name: 'Home Direction',
    category: 'speed',
    get description() { return t('utils.element_registry.arrowPointingTowardsHome'); },
    previewSymbol: SYM.DIR_TO_HOME,
    previewText: '',
    size: { width: 2, height: 1 },
    defaultPosition: { x: 1, y: 5, enabled: false },
    betaflightIndex: 30,
  },

  // ── GPS ───────────────────────────────────────────────────────────────
  {
    id: 'gps_sats',
    name: 'GPS Satellites',
    category: 'gps',
    get description() { return t('utils.element_registry.numberOfGpsSatellitesInView'); },
    previewSymbol: SYM.GPS_SAT1,
    previewText: '12',
    size: { width: 4, height: 1 },
    defaultPosition: { x: 24, y: 1, enabled: true },
    betaflightIndex: 14,
  },
  {
    id: 'gps_hdop',
    name: 'GPS HDOP',
    category: 'gps',
    get description() { return t('utils.element_registry.horizontalDilutionOfPrecision'); },
    previewSymbol: SYM.GPS_HDP1,
    previewText: '0.9',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 24, y: 2, enabled: false },
  },
  {
    id: 'latitude',
    name: 'Latitude',
    category: 'gps',
    get description() { return t('utils.element_registry.currentLatitudeCoordinate'); },
    previewSymbol: SYM.LAT,
    previewText: '37.7749',
    size: { width: 10, height: 1 },
    defaultPosition: { x: 1, y: 14, enabled: false },
    betaflightIndex: 24,
  },
  {
    id: 'longitude',
    name: 'Longitude',
    category: 'gps',
    get description() { return t('utils.element_registry.currentLongitudeCoordinate'); },
    previewSymbol: SYM.LON,
    previewText: '-122.42',
    size: { width: 10, height: 1 },
    defaultPosition: { x: 1, y: 15, enabled: false },
    betaflightIndex: 23,
  },
  {
    id: 'coordinates',
    name: 'Coordinates',
    category: 'gps',
    get description() { return t('utils.element_registry.latitudeAndLongitudeOnTwoLines'); },
    previewSymbol: SYM.LAT,
    previewText: '37.77/-122.4',
    size: { width: 11, height: 2 },
    defaultPosition: { x: 1, y: 14, enabled: true },
  },

  // ── Attitude ──────────────────────────────────────────────────────────
  {
    id: 'crosshairs',
    name: 'Crosshairs',
    category: 'attitude',
    get description() { return t('utils.element_registry.centerScreenAircraftIndicator'); },
    previewSymbol: SYM.AH_AIRCRAFT2,
    previewText: '',
    size: { width: 3, height: 1 },
    defaultPosition: { x: 14, y: 7, enabled: true },
    betaflightIndex: 2,
  },
  {
    id: 'artificial_horizon',
    name: 'Artificial Horizon',
    category: 'attitude',
    get description() { return t('utils.element_registry.attitudeHorizonLineIndicator'); },
    previewSymbol: SYM.AH_BAR9_0,
    previewText: '',
    size: { width: 9, height: 1 },
    defaultPosition: { x: 14, y: 7, enabled: true },
    betaflightIndex: 3,
  },
  {
    id: 'horizon_sidebars',
    name: 'Horizon Sidebars',
    category: 'attitude',
    get description() { return t('utils.element_registry.sideMarkersForArtificialHorizon'); },
    previewSymbol: SYM.AH_LEFT,
    previewText: '',
    size: { width: 15, height: 7 },
    defaultPosition: { x: 14, y: 7, enabled: false },
    betaflightIndex: 4,
  },
  {
    id: 'pitch',
    name: 'Pitch Angle',
    category: 'attitude',
    get description() { return t('utils.element_registry.aircraftPitchAngleInDegrees'); },
    previewSymbol: SYM.PITCH_UP,
    previewText: '  5',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 24, y: 4, enabled: true },
    betaflightIndex: 26,
  },
  {
    id: 'roll',
    name: 'Roll Angle',
    category: 'attitude',
    get description() { return t('utils.element_registry.aircraftRollBankAngleInDegrees'); },
    previewSymbol: SYM.ROLL_LEVEL,
    previewText: ' -3',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 24, y: 5, enabled: true },
    betaflightIndex: 27,
  },
  {
    id: 'heading',
    name: 'Heading',
    category: 'attitude',
    get description() { return t('utils.element_registry.compassHeadingInDegrees'); },
    previewSymbol: SYM.HEADING,
    previewText: '270',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 14, y: 0, enabled: true },
    betaflightIndex: 32,
  },
  {
    id: 'heading_graph',
    name: 'Heading Graph',
    category: 'attitude',
    get description() { return t('utils.element_registry.graphicalCompassHeadingTape'); },
    previewSymbol: SYM.HEADING_N,
    previewText: 'N--E--S',
    size: { width: 9, height: 1 },
    defaultPosition: { x: 11, y: 1, enabled: false },
  },

  // ── Timers ────────────────────────────────────────────────────────────
  {
    id: 'flight_time',
    name: 'Flight Time',
    category: 'timers',
    get description() { return t('utils.element_registry.timeSinceArming'); },
    previewSymbol: SYM.FLY_M,
    previewText: '03:05',
    size: { width: 6, height: 1 },
    defaultPosition: { x: 24, y: 12, enabled: true },
    betaflightIndex: 5,
  },
  {
    id: 'on_time',
    name: 'On Time',
    category: 'timers',
    get description() { return t('utils.element_registry.timeSincePowerOn'); },
    previewSymbol: SYM.ON_M,
    previewText: '12:30',
    size: { width: 6, height: 1 },
    defaultPosition: { x: 24, y: 13, enabled: false },
    betaflightIndex: 6,
  },
  {
    id: 'rtc_time',
    name: 'RTC Time',
    category: 'timers',
    get description() { return t('utils.element_registry.realTimeClockCurrentTime'); },
    previewSymbol: SYM.CLOCK,
    previewText: '14:23',
    size: { width: 6, height: 1 },
    defaultPosition: { x: 24, y: 14, enabled: false },
  },
  {
    id: 'remaining_flight_time',
    name: 'Remaining Time',
    category: 'timers',
    get description() { return t('utils.element_registry.estimatedRemainingFlightTime'); },
    previewSymbol: SYM.FLIGHT_MINS_REMAINING,
    previewText: '08:15',
    size: { width: 6, height: 1 },
    defaultPosition: { x: 24, y: 15, enabled: false },
  },

  // ── Radio & Control ───────────────────────────────────────────────────
  {
    id: 'rssi',
    name: 'RSSI',
    category: 'radio',
    get description() { return t('utils.element_registry.receivedSignalStrengthIndicator'); },
    previewSymbol: SYM.RSSI,
    previewText: ' 85',
    size: { width: 4, height: 1 },
    defaultPosition: { x: 1, y: 1, enabled: true },
    betaflightIndex: 0,
  },
  {
    id: 'rssi_dbm',
    name: 'RSSI (dBm)',
    category: 'radio',
    get description() { return t('utils.element_registry.signalStrengthInDbmElrsCrossfire'); },
    previewSymbol: SYM.DBM,
    previewText: '-62',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 1, y: 2, enabled: false },
  },
  {
    id: 'throttle',
    name: 'Throttle',
    category: 'radio',
    get description() { return t('utils.element_registry.currentThrottlePositionPercentage'); },
    previewSymbol: SYM.THR,
    previewText: ' 45%',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 1, y: 12, enabled: true },
    betaflightIndex: 9,
  },
  {
    id: 'throttle_gauge',
    name: 'Throttle Gauge',
    category: 'radio',
    get description() { return t('utils.element_registry.visualThrottleBarGauge'); },
    previewSymbol: SYM.THROTTLE_GAUGE_FULL,
    previewText: '',
    size: { width: 1, height: 5 },
    defaultPosition: { x: 0, y: 6, enabled: false },
  },

  // ── Sensors ───────────────────────────────────────────────────────────
  {
    id: 'baro_temp',
    name: 'Baro Temperature',
    category: 'sensors',
    get description() { return t('utils.element_registry.barometerSensorTemperature'); },
    previewSymbol: SYM.BARO_TEMP,
    previewText: '32C',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 24, y: 6, enabled: false },
  },
  {
    id: 'imu_temp',
    name: 'IMU Temperature',
    category: 'sensors',
    get description() { return t('utils.element_registry.imuGyroSensorTemperature'); },
    previewSymbol: SYM.IMU_TEMP,
    previewText: '45C',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 24, y: 7, enabled: false },
  },
  {
    id: 'esc_temp',
    name: 'ESC Temperature',
    category: 'sensors',
    get description() { return t('utils.element_registry.electronicSpeedControllerTemperature'); },
    previewSymbol: SYM.ESC_TEMPERATURE,
    previewText: '55C',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 24, y: 8, enabled: false },
  },
  {
    id: 'g_force',
    name: 'G-Force',
    category: 'sensors',
    get description() { return t('utils.element_registry.currentGForceLoading'); },
    previewSymbol: SYM.GFORCE,
    previewText: '1.2G',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 24, y: 9, enabled: false },
  },
  {
    id: 'esc_rpm',
    name: 'ESC RPM',
    category: 'sensors',
    get description() { return t('utils.element_registry.motorRpmFromEscTelemetry'); },
    previewSymbol: SYM.RPM,
    previewText: '12500',
    size: { width: 7, height: 1 },
    defaultPosition: { x: 23, y: 10, enabled: false },
  },

  // ── Mission ───────────────────────────────────────────────────────────
  {
    id: 'vtx_channel',
    name: 'VTX Channel',
    category: 'mission',
    get description() { return t('utils.element_registry.videoTransmitterBandChannelPower'); },
    previewSymbol: SYM.VTX_POWER,
    previewText: 'R:4:25',
    size: { width: 7, height: 1 },
    defaultPosition: { x: 23, y: 11, enabled: false },
    betaflightIndex: 10,
  },
  {
    id: 'wind_horizontal',
    name: 'Wind (Horizontal)',
    category: 'mission',
    get description() { return t('utils.element_registry.horizontalWindSpeedAndDirection'); },
    previewSymbol: SYM.WIND_SPEED_HORIZONTAL,
    previewText: '12',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 24, y: 3, enabled: false },
  },
  {
    id: 'wind_vertical',
    name: 'Wind (Vertical)',
    category: 'mission',
    get description() { return t('utils.element_registry.verticalWindComponent'); },
    previewSymbol: SYM.WIND_SPEED_VERTICAL,
    previewText: '+2',
    size: { width: 5, height: 1 },
    defaultPosition: { x: 24, y: 4, enabled: false },
  },
];

// ---------------------------------------------------------------------------
// Module-contributed elements
// ---------------------------------------------------------------------------

/** Broadened element key: built-in union OR a module-contributed string id. */
export type OsdElementKey = OsdElementId | string;

/**
 * Element definition broadened to also describe module-contributed elements,
 * whose `id`/`category` are free strings. Every built-in `OsdElementDefinition`
 * already satisfies this shape.
 */
export interface AnyOsdElementDef extends Omit<OsdElementDefinition, 'id' | 'category'> {
  id: OsdElementKey;
  category: OsdElementCategory | string;
}

/**
 * Built-in elements plus every module-contributed element, all mapped to the
 * common element-def shape the Designer palette consumes. Module registrations
 * carry fewer fields, so absent ones fall back to palette-safe defaults
 * (previewSymbol 0 -> no inline glyph, disabled default placement).
 */
export function getAllOsdElements(): AnyOsdElementDef[] {
  const moduleDefs: AnyOsdElementDef[] = listModuleOsdElements().map((reg) => ({
    id: reg.id,
    name: reg.name,
    category: reg.category,
    description: reg.description ?? '',
    previewSymbol: 0,
    previewText: reg.previewText ?? '',
    size: { width: reg.size.width, height: reg.size.height },
    defaultPosition: reg.defaultPosition ?? { x: 1, y: 1, enabled: false },
  }));
  return [...ELEMENT_REGISTRY, ...moduleDefs];
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const _registryMap = new Map<OsdElementId, OsdElementDefinition>();
for (const def of ELEMENT_REGISTRY) {
  _registryMap.set(def.id, def);
}

/** Get element definition by ID */
export function getElementDef(id: OsdElementId): OsdElementDefinition | undefined {
  return _registryMap.get(id);
}

/** Get all element IDs */
export function getAllElementIds(): OsdElementId[] {
  return ELEMENT_REGISTRY.map((d) => d.id);
}

/** Get elements grouped by category */
export function getElementsByCategory(): Map<OsdElementCategory, OsdElementDefinition[]> {
  const map = new Map<OsdElementCategory, OsdElementDefinition[]>();
  for (const def of ELEMENT_REGISTRY) {
    const list = map.get(def.category) || [];
    list.push(def);
    map.set(def.category, list);
  }
  return map;
}

/** Build default positions record from registry */
export function buildDefaultPositions(): Record<OsdElementId, { x: number; y: number; enabled: boolean }> {
  const positions = {} as Record<OsdElementId, { x: number; y: number; enabled: boolean }>;
  for (const def of ELEMENT_REGISTRY) {
    positions[def.id] = { ...def.defaultPosition };
  }
  return positions;
}

/** Build Betaflight index map from registry */
export function buildBfIndexMap(): Record<number, OsdElementId> {
  const map: Record<number, OsdElementId> = {};
  for (const def of ELEMENT_REGISTRY) {
    if (def.betaflightIndex !== undefined) {
      map[def.betaflightIndex] = def.id;
    }
  }
  return map;
}

/** Get element size from registry with fallback (built-in or module element) */
export function getElementSizeFromRegistry(id: OsdElementKey): ElementSize {
  const def = _registryMap.get(id as OsdElementId);
  if (def) return def.size;
  const mod = getModuleOsdElement(id);
  if (mod) return { width: mod.size.width, height: mod.size.height };
  return { width: 4, height: 1 };
}
