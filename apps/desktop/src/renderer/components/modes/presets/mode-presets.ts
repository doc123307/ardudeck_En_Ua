/**
 * Mode Presets for the Modes Wizard
 *
 * These presets provide quick setup options for different flying styles.
 * Each preset includes sensible mode configurations for beginners.
 */

import type { MSPModeRange } from '@ardudeck/msp-ts';
import type { LucideIcon } from 'lucide-react';
import {
  Power, Square, Sunrise, Wind, ArrowUpFromLine, Home, MapPin, Map, Plane, Compass,
  Rocket, Gamepad2, Volume2, ShieldAlert, Package, Satellite, Joystick, PlaneTakeoff,
  RotateCw, RotateCcw, Waypoints, Navigation, KeyRound, Turtle, HelpCircle, Radio,
  Baby, Sparkles, Trophy, Video
} from 'lucide-react';
import { t } from '../../../i18n';

// iNav permanent box IDs (from fc_msp_box.c)
export const BOX_ID = {
  ARM: 0,
  ANGLE: 1,
  HORIZON: 2,
  NAV_ALTHOLD: 3,
  HEADING_HOLD: 5,
  HEADFREE: 6,
  HEADADJ: 7,
  CAMSTAB: 8,
  NAV_RTH: 10,
  NAV_POSHOLD: 11,
  MANUAL: 12,
  BEEPER: 13,
  LEDS_OFF: 15,
  LIGHTS: 16,
  OSD_OFF: 19,
  TELEMETRY: 20,
  AUTO_TUNE: 21,
  BLACKBOX: 26,
  FAILSAFE: 27,
  NAV_WP: 28,
  AIRMODE: 29,
  HOME_RESET: 30,
  GCS_NAV: 31,
  FPV_ANGLE_MIX: 32,
  SURFACE: 33,
  FLAPERON: 34,
  TURN_ASSIST: 35,
  NAV_LAUNCH: 36,
  SERVO_AUTOTRIM: 37,
  CAMERA_1: 39,
  CAMERA_2: 40,
  CAMERA_3: 41,
  OSD_ALT_1: 42,
  OSD_ALT_2: 43,
  OSD_ALT_3: 44,
  NAV_COURSE_HOLD: 45,
  MC_BRAKING: 46,
  USER1: 47,
  USER2: 48,
  LOITER_CHANGE: 49,
  MSP_RC_OVERRIDE: 50,
  PREARM: 51,
  TURTLE: 52,
  NAV_CRUISE: 53,
  AUTO_LEVEL: 54,
  WP_PLANNER: 55,
  SOARING: 56,
  USER3: 57,
  USER4: 58,
  MISSION_CHANGE: 59,
  BEEPER_MUTE: 60,
  MULTI_FUNC: 61,
  MIXER_PROFILE_2: 62,
  MIXER_TRANSITION: 63,
  ANGLE_HOLD: 64,
  GIMBAL_LEVEL_TILT: 65,
  GIMBAL_LEVEL_ROLL: 66,
  GIMBAL_CENTER: 67,
  GIMBAL_HEADTRACKER: 68,
} as const;

// Mode metadata with beginner-friendly descriptions
export const MODE_INFO: Record<
  number,
  {
    name: string;
    icon: LucideIcon;
    description: string;
    color: string;
    beginner: string;
    essential?: boolean;
    configureTab?: string; // Tab ID to configure this mode's settings
  }
> = {
  [BOX_ID.ARM]: {
    name: 'ARM',
    icon: Power,
    get description() { return t('modes.mode_presets.enableMotors'); },
    color: 'bg-red-500',
    get beginner() { return t('modes.mode_presets.safetySwitchArmsDisarmsYourAircraft'); },
    essential: true,
  },
  [BOX_ID.ANGLE]: {
    name: 'ANGLE',
    icon: Square,
    get description() { return t('modes.mode_presets.selfLevel'); },
    color: 'bg-blue-500',
    get beginner() { return t('modes.mode_presets.beginnerModeYourAircraftWillAutomatically'); },
    essential: true,
  },
  [BOX_ID.HORIZON]: {
    name: 'HORIZON',
    icon: Sunrise,
    get description() { return t('modes.mode_presets.selfLevelAcro'); },
    color: 'bg-purple-500',
    get beginner() { return t('modes.mode_presets.intermediateModeSelfLevelsNearCenter'); },
  },
  [BOX_ID.AIRMODE]: {
    name: 'AIRMODE',
    icon: Wind,
    get description() { return t('modes.mode_presets.fullControlAtZeroThrottle'); },
    color: 'bg-cyan-500',
    get beginner() { return t('modes.mode_presets.advancedKeepsFullStickAuthorityEven'); },
  },
  [BOX_ID.NAV_ALTHOLD]: {
    name: 'NAV ALTHOLD',
    icon: ArrowUpFromLine,
    get description() { return t('modes.mode_presets.holdAltitude'); },
    color: 'bg-teal-500',
    get beginner() { return t('modes.mode_presets.holdsCurrentAltitudeUsingBarometerGps'); },
  },
  [BOX_ID.NAV_RTH]: {
    name: 'NAV RTH',
    icon: Home,
    get description() { return t('modes.mode_presets.returnToHome'); },
    color: 'bg-green-500',
    get beginner() { return t('modes.mode_presets.returnToHomeAircraftWillClimb'); },
    essential: true,
  },
  [BOX_ID.NAV_POSHOLD]: {
    name: 'NAV POSHOLD',
    icon: MapPin,
    get description() { return t('modes.mode_presets.holdPosition'); },
    color: 'bg-cyan-500',
    get beginner() { return t('modes.mode_presets.gpsPositionHoldAircraftWillStay'); },
  },
  [BOX_ID.NAV_WP]: {
    name: 'NAV WP',
    icon: Map,
    get description() { return t('modes.mode_presets.waypointMission'); },
    color: 'bg-indigo-500',
    get beginner() { return t('modes.mode_presets.executeUploadedWaypointMissionAircraftWill'); },
    essential: true,
  },
  [BOX_ID.NAV_COURSE_HOLD]: {
    name: 'NAV COURSE HOLD',
    icon: Compass,
    get description() { return t('modes.mode_presets.holdCourse'); },
    color: 'bg-violet-500',
    get beginner() { return t('modes.mode_presets.maintainsCurrentHeadingWhileAllowingAltitude'); },
  },
  [BOX_ID.NAV_CRUISE]: {
    name: 'NAV CRUISE',
    icon: Plane,
    get description() { return t('modes.mode_presets.cruiseControl'); },
    color: 'bg-sky-500',
    get beginner() { return t('modes.mode_presets.fixedWingCruiseModeMaintainsHeading'); },
  },
  [BOX_ID.NAV_LAUNCH]: {
    name: 'NAV LAUNCH',
    icon: Rocket,
    get description() { return t('modes.mode_presets.autoLaunch'); },
    color: 'bg-orange-500',
    get beginner() { return t('modes.mode_presets.automaticLaunchSequenceForFixedWing'); },
    configureTab: 'auto-launch',
  },
  [BOX_ID.GCS_NAV]: {
    name: 'GCS NAV',
    icon: Gamepad2,
    get description() { return t('modes.mode_presets.groundControl'); },
    color: 'bg-purple-500',
    get beginner() { return t('modes.mode_presets.allowGroundControlStationToSend'); },
  },
  [BOX_ID.BEEPER]: {
    name: 'BEEPER',
    icon: Volume2,
    get description() { return t('modes.mode_presets.findAircraft'); },
    color: 'bg-yellow-500',
    get beginner() { return t('modes.mode_presets.finderMakesYourAircraftBeepLoudly'); },
  },
  [BOX_ID.FAILSAFE]: {
    name: 'FAILSAFE',
    icon: ShieldAlert,
    get description() { return t('modes.mode_presets.emergencyLanding'); },
    color: 'bg-orange-500',
    get beginner() { return t('modes.mode_presets.emergencyTriggersFailsafeBehaviorUsuallyLanding'); },
  },
  [BOX_ID.BLACKBOX]: {
    name: 'BLACKBOX',
    icon: Package,
    get description() { return t('modes.mode_presets.flightLogging'); },
    color: 'bg-gray-500',
    get beginner() { return t('modes.mode_presets.loggingRecordsFlightDataToThe'); },
  },
  [BOX_ID.GIMBAL_LEVEL_TILT]: {
    name: 'GIMBAL LEVEL TILT',
    icon: Satellite,
    get description() { return t('modes.mode_presets.gimbalTiltLeveling'); },
    color: 'bg-indigo-500',
    get beginner() { return t('modes.mode_presets.keepsGimbalTiltAxisLevelRegardless'); },
  },
  [BOX_ID.MANUAL]: {
    name: 'MANUAL',
    icon: Joystick,
    get description() { return t('modes.mode_presets.directControl'); },
    color: 'bg-rose-500',
    get beginner() { return t('modes.mode_presets.directServoMotorControlWithoutStabilization'); },
  },
  [BOX_ID.FLAPERON]: {
    name: 'FLAPERON',
    icon: PlaneTakeoff,
    get description() { return t('modes.mode_presets.flapsMode'); },
    color: 'bg-amber-500',
    get beginner() { return t('modes.mode_presets.activatesFlaperonsForSlowerLandingApproach'); },
  },
  [BOX_ID.TURN_ASSIST]: {
    name: 'TURN ASSIST',
    icon: RotateCw,
    get description() { return t('modes.mode_presets.coordinatedTurns'); },
    color: 'bg-lime-500',
    get beginner() { return t('modes.mode_presets.autoCoordinatesRudderWithAileronsFor'); },
  },
  [BOX_ID.HOME_RESET]: {
    name: 'HOME RESET',
    icon: RotateCcw,
    get description() { return t('modes.mode_presets.resetHomePosition'); },
    color: 'bg-red-400',
    get beginner() { return t('modes.mode_presets.setsCurrentPositionAsNewHome'); },
  },
  [BOX_ID.WP_PLANNER]: {
    name: 'WP PLANNER',
    icon: Waypoints,
    get description() { return t('modes.mode_presets.missionPlanner'); },
    color: 'bg-fuchsia-500',
    get beginner() { return t('modes.mode_presets.enableInFlightWaypointPlanningVia'); },
  },
  [BOX_ID.HEADING_HOLD]: {
    name: 'HEADING HOLD',
    icon: Navigation,
    get description() { return t('modes.mode_presets.holdHeading'); },
    color: 'bg-emerald-500',
    get beginner() { return t('modes.mode_presets.maintainsCurrentMagneticHeadingUsefulFor'); },
  },
  [BOX_ID.PREARM]: {
    name: 'PREARM',
    icon: KeyRound,
    get description() { return t('modes.mode_presets.preArmCheck'); },
    color: 'bg-yellow-600',
    get beginner() { return t('modes.mode_presets.safetySwitchMustBeEnabledBefore'); },
  },
  [BOX_ID.TURTLE]: {
    name: 'TURTLE',
    icon: Turtle,
    get description() { return t('modes.mode_presets.flipOver'); },
    color: 'bg-stone-500',
    get beginner() { return t('modes.mode_presets.flipCrashedAircraftBackOverUsing'); },
  },
};

// Preset configurations
export interface ModePreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  tip: string;
  gradient: string;
  modes: MSPModeRange[];
  // Which modes to configure in the wizard (in order)
  wizardModes: number[];
}

export const PRESETS: Record<string, ModePreset> = {
  beginner: {
    id: 'beginner',
    name: 'Beginner',
    icon: 'baby',
    get description() { return t('modes.mode_presets.safeSimpleGreatForLearning'); },
    get tip() { return t('modes.mode_presets.yourAircraftWillAlwaysStayLevel'); },
    gradient: 'from-green-500/20 to-emerald-500/10 border-green-500/30',
    modes: [
      // ARM on AUX1 high (1800-2100)
      { boxId: BOX_ID.ARM, auxChannel: 0, rangeStart: 1800, rangeEnd: 2100 },
      // ANGLE always on (entire range)
      { boxId: BOX_ID.ANGLE, auxChannel: 0, rangeStart: 900, rangeEnd: 2100 },
    ],
    wizardModes: [BOX_ID.ARM, BOX_ID.ANGLE],
  },

  freestyle: {
    id: 'freestyle',
    name: 'Freestyle',
    icon: 'sparkles',
    get description() { return t('modes.mode_presets.balancedForTricksFlow'); },
    get tip() { return t('modes.mode_presets.threePositionSwitchOnAux2Gives'); },
    gradient: 'from-purple-500/20 to-violet-500/10 border-purple-500/30',
    modes: [
      // ARM on AUX1 high
      { boxId: BOX_ID.ARM, auxChannel: 0, rangeStart: 1800, rangeEnd: 2100 },
      // ANGLE on AUX2 low (for recovery)
      { boxId: BOX_ID.ANGLE, auxChannel: 1, rangeStart: 900, rangeEnd: 1300 },
      // HORIZON on AUX2 mid
      { boxId: BOX_ID.HORIZON, auxChannel: 1, rangeStart: 1300, rangeEnd: 1700 },
      // AIRMODE always on
      { boxId: BOX_ID.AIRMODE, auxChannel: 0, rangeStart: 900, rangeEnd: 2100 },
    ],
    wizardModes: [BOX_ID.ARM, BOX_ID.ANGLE, BOX_ID.HORIZON, BOX_ID.AIRMODE],
  },

  racing: {
    id: 'racing',
    name: 'Racing',
    icon: 'trophy',
    get description() { return t('modes.mode_presets.fastResponsiveForSpeed'); },
    get tip() { return t('modes.mode_presets.pureAcroModeForMaximumControl'); },
    gradient: 'from-red-500/20 to-orange-500/10 border-red-500/30',
    modes: [
      // ARM on AUX1 high
      { boxId: BOX_ID.ARM, auxChannel: 0, rangeStart: 1800, rangeEnd: 2100 },
      // AIRMODE always on
      { boxId: BOX_ID.AIRMODE, auxChannel: 0, rangeStart: 900, rangeEnd: 2100 },
      // BEEPER on AUX3 high
      { boxId: BOX_ID.BEEPER, auxChannel: 2, rangeStart: 1800, rangeEnd: 2100 },
    ],
    wizardModes: [BOX_ID.ARM, BOX_ID.AIRMODE, BOX_ID.BEEPER],
  },

  cinematic: {
    id: 'cinematic',
    name: 'Cinematic',
    icon: 'video',
    get description() { return t('modes.mode_presets.ultraSmoothForFilming'); },
    get tip() { return t('modes.mode_presets.navRthBringsYourAircraftHome'); },
    gradient: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
    modes: [
      // ARM on AUX1 high
      { boxId: BOX_ID.ARM, auxChannel: 0, rangeStart: 1800, rangeEnd: 2100 },
      // ANGLE always on (smooth, stable shots)
      { boxId: BOX_ID.ANGLE, auxChannel: 0, rangeStart: 900, rangeEnd: 2100 },
      // NAV RTH on AUX2 high
      { boxId: BOX_ID.NAV_RTH, auxChannel: 1, rangeStart: 1800, rangeEnd: 2100 },
    ],
    wizardModes: [BOX_ID.ARM, BOX_ID.ANGLE, BOX_ID.NAV_RTH],
  },

  fixedWing: {
    id: 'fixedWing',
    name: 'Fixed Wing',
    icon: 'plane',
    get description() { return t('modes.mode_presets.forAirplanesWithNavigation'); },
    get tip() { return t('modes.mode_presets.completeSetupForFixedWingWith'); },
    gradient: 'from-sky-500/20 to-blue-500/10 border-sky-500/30',
    modes: [
      // ARM on AUX1 high
      { boxId: BOX_ID.ARM, auxChannel: 0, rangeStart: 1800, rangeEnd: 2100 },
      // NAV LAUNCH on AUX2 low (for auto-launch)
      { boxId: BOX_ID.NAV_LAUNCH, auxChannel: 1, rangeStart: 900, rangeEnd: 1300 },
      // NAV RTH on AUX2 mid
      { boxId: BOX_ID.NAV_RTH, auxChannel: 1, rangeStart: 1300, rangeEnd: 1700 },
      // NAV WP on AUX2 high (waypoint mission)
      { boxId: BOX_ID.NAV_WP, auxChannel: 1, rangeStart: 1700, rangeEnd: 2100 },
    ],
    wizardModes: [BOX_ID.ARM, BOX_ID.NAV_LAUNCH, BOX_ID.NAV_RTH, BOX_ID.NAV_WP],
  },
};

// Preset icon mapping (string key -> Lucide component)
export const PRESET_ICONS: Record<string, LucideIcon> = {
  baby: Baby,
  sparkles: Sparkles,
  trophy: Trophy,
  video: Video,
  plane: Plane,
};

// All available modes for advanced editor
export const ALL_MODES = Object.entries(MODE_INFO).map(([boxId, info]) => ({
  boxId: Number(boxId),
  ...info,
}));

// Essential modes that should always be visible
export const ESSENTIAL_MODES = ALL_MODES.filter((m) => m.essential);

// AUX channel names (iNav/Betaflight support up to 12 AUX channels)
export const AUX_CHANNELS = [
  { index: 0, name: 'AUX 1', get description() { return t('modes.mode_presets.usuallyA2PositionSwitch'); } },
  { index: 1, name: 'AUX 2', get description() { return t('modes.mode_presets.oftenA3PositionSwitch'); } },
  { index: 2, name: 'AUX 3', get description() { return t('modes.mode_presets.additionalSwitch'); } },
  { index: 3, name: 'AUX 4', get description() { return t('modes.mode_presets.additionalSwitch'); } },
  { index: 4, name: 'AUX 5', get description() { return t('modes.mode_presets.additionalChannelKnobSlider'); } },
  { index: 5, name: 'AUX 6', get description() { return t('modes.mode_presets.additionalChannelKnobSlider'); } },
  { index: 6, name: 'AUX 7', get description() { return t('modes.mode_presets.additionalChannel'); } },
  { index: 7, name: 'AUX 8', get description() { return t('modes.mode_presets.additionalChannel'); } },
  { index: 8, name: 'AUX 9', get description() { return t('modes.mode_presets.additionalChannel'); } },
  { index: 9, name: 'AUX 10', get description() { return t('modes.mode_presets.additionalChannel'); } },
  { index: 10, name: 'AUX 11', get description() { return t('modes.mode_presets.additionalChannel'); } },
  { index: 11, name: 'AUX 12', get description() { return t('modes.mode_presets.additionalChannel'); } },
] as const;

// PWM range constants
export const PWM = {
  MIN: 900,
  MAX: 2100,
  CENTER: 1500,
  // Common ranges for switches
  LOW: { start: 900, end: 1300 },
  MID: { start: 1300, end: 1700 },
  HIGH: { start: 1700, end: 2100 },
  // Full range (always on)
  ALWAYS: { start: 900, end: 2100 },
} as const;

// Convert PWM to step (for MSP protocol)
export function pwmToStep(pwm: number): number {
  return Math.round((pwm - 900) / 25);
}

// Convert step to PWM
export function stepToPwm(step: number): number {
  return 900 + step * 25;
}
