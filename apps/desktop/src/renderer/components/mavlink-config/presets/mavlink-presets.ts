/**
 * MAVLink/ArduPilot Configuration Presets
 *
 * Provides one-click configurations for:
 * - Skill levels (Beginner, Intermediate, Expert)
 * - Mission types (Mapping, Surveillance, Sport, Cinema)
 * - Flight mode templates
 * - Safety configurations
 */

import { Egg, Drama, Zap, Film, type LucideIcon } from 'lucide-react';
import { t } from '../../../i18n';

// =============================================================================
// Flight Mode Presets
// =============================================================================

export interface FlightModePreset {
  name: string;
  description: string;
  modes: number[]; // FLTMODE1-6 values
}

export const FLIGHT_MODE_PRESETS: Record<string, FlightModePreset> = {
  beginner: {
    name: 'Beginner Safe',
    get description() { return t('mavlink_config.mavlink_presets.safeModesOnlyStabilizeAltholdLoiter'); },
    modes: [0, 2, 5, 6, 9, 6], // Stabilize, AltHold, Loiter, RTL, Land, RTL
  },
  intermediate: {
    name: 'Intermediate',
    get description() { return t('mavlink_config.mavlink_presets.addAutoAndPosholdForMissions'); },
    modes: [0, 2, 5, 3, 16, 6], // Stabilize, AltHold, Loiter, Auto, PosHold, RTL
  },
  advanced: {
    name: 'Advanced',
    get description() { return t('mavlink_config.mavlink_presets.fullControlWithAcroAndSport'); },
    modes: [0, 1, 13, 5, 3, 6], // Stabilize, Acro, Sport, Loiter, Auto, RTL
  },
  mapping: {
    name: 'Mapping/Survey',
    get description() { return t('mavlink_config.mavlink_presets.optimizedForAerialMappingMissions'); },
    modes: [5, 3, 24, 6, 9, 21], // Loiter, Auto, ZigZag, RTL, Land, SmartRTL
  },
};

export const PLANE_FLIGHT_MODE_PRESETS: Record<string, FlightModePreset> = {
  beginner: {
    name: 'Beginner Safe',
    get description() { return t('mavlink_config.mavlink_presets.safeModesFbwaLoiterRtl'); },
    modes: [5, 5, 12, 12, 11, 11], // FBWA, FBWA, Loiter, Loiter, RTL, RTL
  },
  intermediate: {
    name: 'Intermediate',
    get description() { return t('mavlink_config.mavlink_presets.addAutoAndCruiseForMissions'); },
    modes: [5, 7, 12, 10, 11, 11], // FBWA, Cruise, Loiter, Auto, RTL, RTL
  },
  advanced: {
    name: 'Advanced',
    get description() { return t('mavlink_config.mavlink_presets.fullControlWithManualAndAcro'); },
    modes: [0, 4, 5, 12, 10, 11], // Manual, Acro, FBWA, Loiter, Auto, RTL
  },
  vtol: {
    name: 'VTOL QuadPlane',
    get description() { return t('mavlink_config.mavlink_presets.qloiterFbwaQrtlForVtolAircraft'); },
    modes: [19, 19, 5, 5, 21, 21], // QLoiter, QLoiter, FBWA, FBWA, QRTL, QRTL
  },
};

// =============================================================================
// Skill Level Presets (Tuning)
// =============================================================================

export interface SkillPreset {
  name: string;
  description: string;
  params: Record<string, number>;
}

export const SKILL_PRESETS: Record<string, SkillPreset> = {
  beginner: {
    name: 'Beginner',
    get description() { return t('mavlink_config.mavlink_presets.softForgivingResponseGreatForLearning'); },
    params: {
      // Slower rates
      'ACRO_RP_RATE': 90,
      'ACRO_Y_RATE': 67.5,
      // Lower angle limits
      'ANGLE_MAX': 3000, // 30 degrees
      // Position controller - slower
      'PSC_VELXY_P': 3.0,
      'PSC_POSXY_P': 0.8,
      // Loiter speed limits
      'LOIT_SPEED': 500, // 5 m/s max
      'LOIT_ACC_MAX': 200,
    },
  },
  intermediate: {
    name: 'Intermediate',
    get description() { return t('mavlink_config.mavlink_presets.balancedResponseForGeneralFlying'); },
    params: {
      'ACRO_RP_RATE': 180,
      'ACRO_Y_RATE': 90,
      'ANGLE_MAX': 4500, // 45 degrees
      'PSC_VELXY_P': 4.0,
      'PSC_POSXY_P': 1.0,
      'LOIT_SPEED': 1000, // 10 m/s
      'LOIT_ACC_MAX': 400,
    },
  },
  expert: {
    name: 'Expert',
    get description() { return t('mavlink_config.mavlink_presets.aggressiveResponseForExperiencedPilots'); },
    params: {
      'ACRO_RP_RATE': 360,
      'ACRO_Y_RATE': 180,
      'ANGLE_MAX': 6000, // 60 degrees
      'PSC_VELXY_P': 5.0,
      'PSC_POSXY_P': 1.2,
      'LOIT_SPEED': 1500, // 15 m/s
      'LOIT_ACC_MAX': 600,
    },
  },
};

// =============================================================================
// Mission Type Presets
// =============================================================================

export interface MissionPreset {
  name: string;
  description: string;
  params: Record<string, number>;
}

export const MISSION_PRESETS: Record<string, MissionPreset> = {
  mapping: {
    name: 'Mapping/Survey',
    get description() { return t('mavlink_config.mavlink_presets.slowStableFlightForAerialMapping'); },
    params: {
      'WPNAV_SPEED': 500, // 5 m/s - slow for photos
      'WPNAV_ACCEL': 100,
      'WPNAV_RADIUS': 200, // 2m waypoint radius
      'LOIT_SPEED': 500,
      'ANGLE_MAX': 2000, // 20 degrees - keep level for camera
    },
  },
  surveillance: {
    name: 'Surveillance',
    get description() { return t('mavlink_config.mavlink_presets.moderateSpeedGoodStabilityForVideo'); },
    params: {
      'WPNAV_SPEED': 800, // 8 m/s
      'WPNAV_ACCEL': 150,
      'WPNAV_RADIUS': 300,
      'LOIT_SPEED': 800,
      'ANGLE_MAX': 3000, // 30 degrees
    },
  },
  sport: {
    name: 'Sport',
    get description() { return t('mavlink_config.mavlink_presets.fastResponsiveFlightForFunFlying'); },
    params: {
      'WPNAV_SPEED': 1500, // 15 m/s
      'WPNAV_ACCEL': 400,
      'WPNAV_RADIUS': 500,
      'LOIT_SPEED': 1500,
      'ANGLE_MAX': 5500, // 55 degrees
    },
  },
  cinema: {
    name: 'Cinematic',
    get description() { return t('mavlink_config.mavlink_presets.ultraSmoothMovementsForProfessionalVideo'); },
    params: {
      'WPNAV_SPEED': 300, // 3 m/s - very slow
      'WPNAV_ACCEL': 50, // Very gentle acceleration
      'WPNAV_RADIUS': 150,
      'LOIT_SPEED': 300,
      'LOIT_ACC_MAX': 100, // Gentle loiter
      'ANGLE_MAX': 1500, // 15 degrees - minimal tilt
    },
  },
};

// =============================================================================
// Safety Presets
// =============================================================================

export interface SafetyPreset {
  name: string;
  description: string;
  params: Record<string, number>;
}

export const SAFETY_PRESETS: Record<string, SafetyPreset> = {
  maximum: {
    name: 'Maximum Safety',
    get description() { return t('mavlink_config.mavlink_presets.allSafetyFeaturesEnabledRecommendedFor'); },
    params: {
      'FS_THR_ENABLE': 1, // RTL on throttle failsafe
      'FS_GCS_ENABLE': 1, // RTL on GCS failsafe
      'BATT_FS_LOW_ACT': 2, // Land on battery failsafe
      'BATT_FS_CRT_ACT': 1, // Land immediately on critical battery
      'FENCE_ENABLE': 1,
      'FENCE_TYPE': 7, // All fence types
      'ARMING_CHECK': 1, // All arming checks
    },
  },
  balanced: {
    name: 'Balanced',
    get description() { return t('mavlink_config.mavlink_presets.essentialSafetyFeaturesWithoutBeingRestrictive'); },
    params: {
      'FS_THR_ENABLE': 1,
      'FS_GCS_ENABLE': 0, // No GCS failsafe
      'BATT_FS_LOW_ACT': 1, // RTL on battery failsafe
      'BATT_FS_CRT_ACT': 1, // Land immediately on critical battery
      'FENCE_ENABLE': 1,
      'FENCE_TYPE': 3, // Altitude + circle only
      'ARMING_CHECK': 1,
    },
  },
  minimal: {
    name: 'Minimal',
    get description() { return t('mavlink_config.mavlink_presets.onlyCriticalSafetyFeaturesForExperienced'); },
    params: {
      'FS_THR_ENABLE': 1, // Keep throttle failsafe
      'FS_GCS_ENABLE': 0,
      'BATT_FS_LOW_ACT': 0,
      'BATT_FS_CRT_ACT': 0, // No critical battery action
      'FENCE_ENABLE': 0,
      'ARMING_CHECK': 0, // Bypass arming checks (dangerous!)
    },
  },
};

// =============================================================================
// Failsafe Actions
// =============================================================================

export const FAILSAFE_ACTIONS: Record<number, { name: string; description: string; safe: boolean }> = {
  0: { name: 'Disabled', get description() { return t('mavlink_config.mavlink_presets.noActionTaken'); }, safe: false },
  1: { name: 'RTL', get description() { return t('mavlink_config.mavlink_presets.returnToLaunchPoint'); }, safe: true },
  2: { name: 'Land', get description() { return t('mavlink_config.mavlink_presets.landImmediately'); }, safe: true },
  3: { name: 'SmartRTL', get description() { return t('mavlink_config.mavlink_presets.returnViaOriginalPath'); }, safe: true },
  4: { name: 'Brake', get description() { return t('mavlink_config.mavlink_presets.stopAndHover'); }, safe: true },
  5: { name: 'Land', get description() { return t('mavlink_config.mavlink_presets.landAtCurrentPosition'); }, safe: true },
};

// =============================================================================
// Arming Check Flags
// =============================================================================

export const ARMING_CHECKS: Record<number, { name: string; description: string }> = {
  1: { name: 'All', get description() { return t('mavlink_config.mavlink_presets.enableAllArmingChecks'); } },
  2: { name: 'Barometer', get description() { return t('mavlink_config.mavlink_presets.checkBarometerHealth'); } },
  4: { name: 'Compass', get description() { return t('mavlink_config.mavlink_presets.checkCompassHealthAndCalibration'); } },
  8: { name: 'GPS Lock', get description() { return t('mavlink_config.mavlink_presets.requireGpsLockBeforeArming'); } },
  16: { name: 'INS', get description() { return t('mavlink_config.mavlink_presets.checkAccelerometerGyroHealth'); } },
  32: { name: 'Parameters', get description() { return t('mavlink_config.mavlink_presets.checkForInvalidParameters'); } },
  64: { name: 'RC Channels', get description() { return t('mavlink_config.mavlink_presets.checkRcReceiverIsWorking'); } },
  128: { name: 'Board Voltage', get description() { return t('mavlink_config.mavlink_presets.checkBoardVoltageIsStable'); } },
  256: { name: 'Battery Level', get description() { return t('mavlink_config.mavlink_presets.checkBatteryHasSufficientCharge'); } },
  512: { name: 'Airspeed', get description() { return t('mavlink_config.mavlink_presets.checkAirspeedSensorPlanes'); } },
  1024: { name: 'Logging', get description() { return t('mavlink_config.mavlink_presets.checkLoggingIsWorking'); } },
  2048: { name: 'Safety Switch', get description() { return t('mavlink_config.mavlink_presets.checkSafetySwitchIsDisengaged'); } },
  4096: { name: 'GPS Config', get description() { return t('mavlink_config.mavlink_presets.checkGpsConfiguration'); } },
  8192: { name: 'System', get description() { return t('mavlink_config.mavlink_presets.checkSystemHealth'); } },
  16384: { name: 'Mission', get description() { return t('mavlink_config.mavlink_presets.checkMissionIsValid'); } },
  32768: { name: 'Rangefinder', get description() { return t('mavlink_config.mavlink_presets.checkRangefinderHealth'); } },
};

// =============================================================================
// Fence Types
// =============================================================================

export const FENCE_TYPES: Record<number, { name: string; description: string }> = {
  0: { name: 'Disabled', get description() { return t('mavlink_config.mavlink_presets.noGeofenceActive'); } },
  1: { name: 'Altitude', get description() { return t('mavlink_config.mavlink_presets.maximumAltitudeLimit'); } },
  2: { name: 'Circle', get description() { return t('mavlink_config.mavlink_presets.circularBoundaryAroundHome'); } },
  3: { name: 'Altitude + Circle', get description() { return t('mavlink_config.mavlink_presets.bothAltitudeAndCircularLimits'); } },
  4: { name: 'Polygon', get description() { return t('mavlink_config.mavlink_presets.customPolygonBoundary'); } },
  7: { name: 'All', get description() { return t('mavlink_config.mavlink_presets.altitudeCircleAndPolygon'); } },
};

// =============================================================================
// Battery Monitor Types
// =============================================================================

export const BATTERY_MONITORS: Record<number, { name: string; description: string }> = {
  0: { name: 'Disabled', get description() { return t('mavlink_config.mavlink_presets.noBatteryMonitoring'); } },
  3: { name: 'Analog Voltage Only', get description() { return t('mavlink_config.mavlink_presets.basicVoltageMonitoring'); } },
  4: { name: 'Analog Voltage + Current', get description() { return t('mavlink_config.mavlink_presets.fullPowerMonitoring'); } },
  5: { name: 'Solo', get description() { return t('mavlink_config.mavlink_presets.n3drSoloBattery'); } },
  6: { name: 'Bebop', get description() { return t('mavlink_config.mavlink_presets.parrotBebopBattery'); } },
  7: { name: 'SMBus-Maxell', get description() { return t('mavlink_config.mavlink_presets.maxellSmartBattery'); } },
  8: { name: 'UAVCAN', get description() { return t('mavlink_config.mavlink_presets.uavcanBattery'); } },
  9: { name: 'BLHeli ESC', get description() { return t('mavlink_config.mavlink_presets.blheliTelemetry'); } },
  10: { name: 'Sum of Selected', get description() { return t('mavlink_config.mavlink_presets.sumMultipleMonitors'); } },
  11: { name: 'FuelFlow', get description() { return t('mavlink_config.mavlink_presets.fuelFlowSensor'); } },
  12: { name: 'FuelLevel PWM', get description() { return t('mavlink_config.mavlink_presets.fuelLevelPwmSensor'); } },
};

// =============================================================================
// Battery Chemistry Types
// =============================================================================

export type BatteryChemistry = 'lipo' | 'lihv' | 'lion' | 'life';

export interface BatteryChemistryInfo {
  name: string;
  description: string;
  /** Per-cell voltages */
  cellFull: number;
  cellNominal: number;
  cellStorage: number;
  /** ArduPilot-safe thresholds - enough margin for RTL */
  cellLow: number;
  cellCritical: number;
  cellMin: number;
}

export const BATTERY_CHEMISTRIES: Record<BatteryChemistry, BatteryChemistryInfo> = {
  lipo: {
    name: 'LiPo',
    get description() { return t('mavlink_config.mavlink_presets.standardLithiumPolymerMostCommonFor'); },
    cellFull: 4.2,
    cellNominal: 3.7,
    cellStorage: 3.8,
    cellLow: 3.6,
    cellCritical: 3.5,
    cellMin: 3.0,
  },
  lihv: {
    name: 'LiHV',
    get description() { return t('mavlink_config.mavlink_presets.highVoltageLipo435vFull'); },
    cellFull: 4.35,
    cellNominal: 3.8,
    cellStorage: 3.9,
    cellLow: 3.7,
    cellCritical: 3.6,
    cellMin: 3.1,
  },
  lion: {
    name: 'Li-Ion',
    get description() { return t('mavlink_config.mavlink_presets.lithiumIonHigherEnergyDensityLower'); },
    cellFull: 4.2,
    cellNominal: 3.6,
    cellStorage: 3.7,
    cellLow: 3.2,
    cellCritical: 3.0,
    cellMin: 2.5,
  },
  life: {
    name: 'LiFePO4',
    get description() { return t('mavlink_config.mavlink_presets.lithiumIronPhosphateVeryStableLong'); },
    cellFull: 3.6,
    cellNominal: 3.3,
    cellStorage: 3.3,
    cellLow: 3.1,
    cellCritical: 3.0,
    cellMin: 2.5,
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate cell voltages for any chemistry and cell count.
 * Thresholds are set conservatively for ArduPilot - enough margin for RTL.
 */
export function getCellVoltages(cells: number, chemistry: BatteryChemistry = 'lipo') {
  const chem = BATTERY_CHEMISTRIES[chemistry];
  return {
    nominal: cells * chem.cellNominal,
    full: cells * chem.cellFull,
    storage: cells * chem.cellStorage,
    low: cells * chem.cellLow,
    critical: cells * chem.cellCritical,
    min: cells * chem.cellMin,
  };
}

/**
 * Calculate LiPo cell voltages (legacy wrapper)
 */
export function getLiPoVoltages(cells: number) {
  return getCellVoltages(cells, 'lipo');
}

// =============================================================================
// PID Tuning Presets (ArduPilot)
// =============================================================================

/** Abstract PID values per axis (scheme-agnostic) */
export interface PidAxisValues {
  p: number;
  i: number;
  d: number;
  ff?: number;
}

export interface PidPreset {
  name: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  color: string;
  /** Abstract PID values - mapped to actual param names via PidScheme at apply time */
  values: {
    roll: PidAxisValues;
    pitch: PidAxisValues;
    yaw: PidAxisValues;
  };
  /** Optional acceleration limit values in cdeg/s² (applied when scheme supports accel) */
  accel?: { roll: number; pitch: number; yaw: number };
}

export const PID_PRESETS: Record<string, PidPreset> = {
  beginner: {
    name: 'Beginner',
    get description() { return t('mavlink_config.mavlink_presets.smoothForgivingGreatForLearning'); },
    icon: Egg,
    iconColor: 'text-green-400',
    color: 'from-green-500/20 to-emerald-500/10 border-green-500/30',
    values: {
      roll:  { p: 0.08, i: 0.08, d: 0.003, ff: 0 },
      pitch: { p: 0.08, i: 0.08, d: 0.003, ff: 0 },
      yaw:   { p: 0.15, i: 0.015, d: 0, ff: 0 },
    },
    accel: { roll: 80000, pitch: 80000, yaw: 20000 },
  },
  freestyle: {
    name: 'Freestyle',
    get description() { return t('mavlink_config.mavlink_presets.responsiveSmoothForTricks'); },
    icon: Drama,
    iconColor: 'text-purple-400',
    color: 'from-purple-500/20 to-violet-500/10 border-purple-500/30',
    values: {
      roll:  { p: 0.135, i: 0.135, d: 0.0036, ff: 0 },
      pitch: { p: 0.135, i: 0.135, d: 0.0036, ff: 0 },
      yaw:   { p: 0.2, i: 0.02, d: 0, ff: 0 },
    },
    accel: { roll: 110000, pitch: 110000, yaw: 27000 },
  },
  racing: {
    name: 'Racing',
    get description() { return t('mavlink_config.mavlink_presets.snappyPreciseForSpeed'); },
    icon: Zap,
    iconColor: 'text-red-400',
    color: 'from-red-500/20 to-orange-500/10 border-red-500/30',
    values: {
      roll:  { p: 0.18, i: 0.18, d: 0.004, ff: 0 },
      pitch: { p: 0.18, i: 0.18, d: 0.004, ff: 0 },
      yaw:   { p: 0.25, i: 0.025, d: 0, ff: 0 },
    },
    accel: { roll: 160000, pitch: 160000, yaw: 40000 },
  },
  cinematic: {
    name: 'Cinematic',
    get description() { return t('mavlink_config.mavlink_presets.ultraSmoothForVideo'); },
    icon: Film,
    iconColor: 'text-blue-400',
    color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
    values: {
      roll:  { p: 0.06, i: 0.06, d: 0.002, ff: 0 },
      pitch: { p: 0.06, i: 0.06, d: 0.002, ff: 0 },
      yaw:   { p: 0.12, i: 0.012, d: 0, ff: 0 },
    },
    accel: { roll: 55000, pitch: 55000, yaw: 14000 },
  },
};

// =============================================================================
// Rate Presets (ArduPilot)
// =============================================================================

/** Abstract rate values (scheme-agnostic) */
export interface RateValues {
  rpRate: number;
  yawRate: number;
  rpExpo: number;
  yawExpo: number;
}

export interface RatePreset {
  name: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  color: string;
  /** Abstract rate values - mapped to actual param names via RateScheme at apply time */
  values: RateValues;
}

export const RATE_PRESETS: Record<string, RatePreset> = {
  beginner: {
    name: 'Beginner',
    get description() { return t('mavlink_config.mavlink_presets.slowPredictableGreatForLearning'); },
    icon: Egg,
    iconColor: 'text-green-400',
    color: 'from-green-500/20 to-emerald-500/10 border-green-500/30',
    values: { rpRate: 90, yawRate: 45, rpExpo: 0.3, yawExpo: 0.2 },
  },
  freestyle: {
    name: 'Freestyle',
    get description() { return t('mavlink_config.mavlink_presets.balancedForTricksFlow'); },
    icon: Drama,
    iconColor: 'text-purple-400',
    color: 'from-purple-500/20 to-violet-500/10 border-purple-500/30',
    values: { rpRate: 180, yawRate: 90, rpExpo: 0.2, yawExpo: 0.15 },
  },
  racing: {
    name: 'Racing',
    get description() { return t('mavlink_config.mavlink_presets.fastResponsiveForSpeed'); },
    icon: Zap,
    iconColor: 'text-red-400',
    color: 'from-red-500/20 to-orange-500/10 border-red-500/30',
    values: { rpRate: 360, yawRate: 180, rpExpo: 0.1, yawExpo: 0.1 },
  },
  cinematic: {
    name: 'Cinematic',
    get description() { return t('mavlink_config.mavlink_presets.ultraSmoothForFilming'); },
    icon: Film,
    iconColor: 'text-blue-400',
    color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
    values: { rpRate: 60, yawRate: 30, rpExpo: 0.4, yawExpo: 0.3 },
  },
};
