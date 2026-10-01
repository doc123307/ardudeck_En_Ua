/**
 * Pre-Arm Error Pattern Matcher
 *
 * Maps known ArduPilot pre-arm STATUSTEXT error patterns to the parameters
 * that can fix them. Used by MessagesPanel (inline fixes) and PreflightCheckCard.
 *
 * Sources: MissionPlanner PrearmStatus.cs, ParameterMetaDataBackup.xml, ArduPilot firmware
 */

import { st } from './i18n-shim';
import type { FirmwareSource } from './firmware-types';

export type PreArmCategory = 'motors' | 'sensors' | 'gps' | 'rc' | 'battery' | 'system' | 'mission';

/** Where a quick fix sends the pilot: an app view (with its deep-link target) or a doc page. */
export type PreArmLinkTarget =
  | { kind: 'view'; view: string; target?: string }
  | { kind: 'external'; url: string };

export interface PreArmLink {
  label: string;
  to: PreArmLinkTarget;
}

/**
 * A fix points at the place the cause is fixed. It never disables or loosens a check:
 * a pilot who arms past a failing check is one bad decision from a crash.
 */
export interface PreArmFix {
  hint: string;
  links?: PreArmLink[];
  /** Configuration parameters to review, never check bypasses (ARMING_CHECK, COM_ARM_*, CBRK_*). */
  params?: string[];
}

const calibrate = (type: string, label: string): PreArmLink => ({ label, to: { kind: 'view', view: 'calibration', target: type } });
const configTab = (tab: string, label: string): PreArmLink => ({ label, to: { kind: 'view', view: 'parameters', target: `tab:${tab}` } });
const openView = (view: string, label: string): PreArmLink => ({ label, to: { kind: 'view', view } });
const docs = (url: string, label: string): PreArmLink => ({ label, to: { kind: 'external', url } });

const ARDUPILOT_PREARM_DOCS = 'https://ardupilot.org/copter/docs/common-prearm-safety-checks.html';
const PX4_PREARM_DOCS = 'https://docs.px4.io/main/en/flying/pre_flight_checks.html';

export interface PreArmPattern {
  pattern: RegExp;
  category: PreArmCategory;
  fix: PreArmFix;
}

export const PREARM_CATEGORIES: { id: PreArmCategory; label: string }[] = [
  { id: 'motors', get label() { return st('shared.prearm_checks.motors', 'Motors'); } },
  { id: 'sensors', get label() { return st('shared.prearm_checks.sensors', 'Sensors'); } },
  { id: 'gps', label: 'GPS' },
  { id: 'rc', label: 'RC' },
  { id: 'battery', get label() { return st('shared.prearm_checks.battery', 'Battery'); } },
  { id: 'system', get label() { return st('shared.prearm_checks.system', 'System'); } },
  { id: 'mission', get label() { return st('shared.prearm_checks.mission', 'Mission'); } },
];

const PREARM_PATTERNS: PreArmPattern[] = [
  // Motors
  {
    pattern: /Motors:.*frame class|Check firmware or FRAME/i,
    category: 'motors',
    fix: { get hint() { return st('shared.prearm_checks.theFrameLayoutIsNotSet', 'The frame layout is not set for this vehicle. Set the frame class and type to match how the motors are arranged.'); }, params: ['FRAME_CLASS', 'FRAME_TYPE'] },
  },
  {
    pattern: /Throttle.*(too high|not low)|throttle.*(above|high)/i,
    category: 'rc',
    fix: { get hint() { return st('shared.prearm_checks.throttleIsNotAtMinimumPull', 'Throttle is not at minimum. Pull the throttle stick fully down, and check its trim on the transmitter.'); }, links: [configTab('receiver', 'Check RC inputs')] },
  },
  // Sensors
  {
    pattern: /Compass.*(not calibrated|offsets)|Compass.*calibration/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theCompassHasNotBeenCalibrated', 'The compass has not been calibrated, or its calibration no longer fits.'); }, links: [calibrate('compass', 'Calibrate compass')] },
  },
  {
    pattern: /Compasses inconsistent|Check mag field|mag field/i,
    category: 'sensors',
    fix: {
      get hint() { return st('shared.prearm_checks.theCompassReadingsDisagreeOrThe', 'The compass readings disagree or the magnetic field looks wrong. Move away from metal and power cables, check each compass orientation, then recalibrate.'); },
      links: [calibrate('compass', 'Calibrate compass'), configTab('sensor-config', 'Compass setup')],
    },
  },
  {
    pattern: /Compass not healthy/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.aCompassIsNotRespondingCheck', 'A compass is not responding. Check its wiring and that it is detected.'); }, links: [configTab('sensor-config', 'Compass setup')] },
  },
  {
    pattern: /Gyros? (inconsistent|not calibrated|not healthy)/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theGyrosDisagreeOrAreNot', 'The gyros disagree or are not calibrated. Keep the vehicle completely still and reboot, or run a gyro calibration.'); }, links: [calibrate('gyro', 'Calibrate gyro')] },
  },
  {
    pattern: /Accels? (inconsistent|not calibrated|not healthy|calibration needed)|Accel.*(not calibrated|calibration needed)/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theAccelerometersNeedCalibration', 'The accelerometers need calibration.'); }, links: [calibrate('accel-6point', 'Calibrate accelerometer')] },
  },
  {
    pattern: /Baro.*not healthy/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theBarometerIsNotRespondingCheck', 'The barometer is not responding. Check the flight controller hardware and reboot.'); } },
  },
  {
    pattern: /Airspeed.*not healthy|Airspeed.*(fail|not)/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theAirspeedSensorIsNotResponding', 'The airspeed sensor is not responding. Check its wiring and the pitot tube.'); }, links: [configTab('sensor-config', 'Sensor setup')] },
  },
  {
    pattern: /AHRS.*not healthy/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theAttitudeEstimateIsNotReady', 'The attitude estimate is not ready. Keep the vehicle still and give it a minute, or fix the sensor errors shown above.'); } },
  },
  {
    pattern: /Rangefinder.*not healthy/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theRangefinderIsNotRespondingCheck', 'The rangefinder is not responding. Check its wiring. If none is fitted, its type must be set to none.'); }, params: ['RNGFND1_TYPE'] },
  },
  // EKF / Estimation
  {
    pattern: /EKF.*attitude.*bad/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theEkfCannotConvergeKeepThe', 'The EKF cannot converge. Keep the vehicle still. In SITL, restart with \"Wipe EEPROM\" and wait 60-90 s after boot.'); }, links: [openView('sitl', 'Open SITL')] },
  },
  {
    pattern: /AHRS.*inconsistent/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theImuCoresDisagreeUsuallyStale', 'The IMU cores disagree, usually stale calibration. Recalibrate the accelerometers. In SITL, restart with \"Wipe EEPROM\".'); }, links: [calibrate('accel-6point', 'Calibrate accelerometer')] },
  },
  {
    pattern: /Need Position Estimate/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theEkfNeedsAValidPosition', 'The EKF needs a valid position. Wait for a GPS lock and 60-90 s after boot for it to converge.'); } },
  },
  {
    pattern: /Need Alt Estimate/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theEkfNeedsAnAltitudeEstimate', 'The EKF needs an altitude estimate. This follows from other sensor errors, fix those first.'); } },
  },
  {
    pattern: /Wait or rebo/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theFlightControllerAsksYouTo', 'The flight controller asks you to wait for the sensors to settle, or to reboot it.'); } },
  },
  // GPS
  {
    pattern: /Need 3D Fix/i,
    category: 'gps',
    fix: { get hint() { return st('shared.prearm_checks.waitingForAGps3dFix', 'Waiting for a GPS 3D fix. Move to open sky and wait.'); } },
  },
  {
    pattern: /GPS.*(not ready|Bad|not healthy)/i,
    category: 'gps',
    fix: { get hint() { return st('shared.prearm_checks.theGpsHasNoUsableFix', 'The GPS has no usable fix yet, or is not detected. Wait under open sky; if it persists, check the GPS setup.'); }, links: [configTab('sensor-config', 'GPS setup')] },
  },
  // RC
  {
    pattern: /RC not calibrated/i,
    category: 'rc',
    fix: { get hint() { return st('shared.prearm_checks.theRadioChannelsHaveNotBeen', 'The radio channels have not been calibrated.'); }, links: [configTab('receiver', 'Calibrate radio')] },
  },
  {
    pattern: /Radio failsafe|RC failsafe|Throttle.*below failsafe/i,
    category: 'rc',
    fix: {
      get hint() { return st('shared.prearm_checks.theFlightControllerIsInRadio', 'The flight controller is in radio failsafe. Switch the transmitter on and check it is bound, and that its throttle range sits above the failsafe value.'); },
      links: [configTab('receiver', 'Check RC inputs'), configTab('safety', 'Failsafe settings')],
    },
  },
  // Battery
  {
    pattern: /Battery.*(not healthy|too low|failsafe|below)/i,
    category: 'battery',
    fix: { get hint() { return st('shared.prearm_checks.theBatteryIsLowOrNot', 'The battery is low or not reported correctly. Charge or replace it, and check the battery monitor if the reading looks wrong.'); }, links: [configTab('battery', 'Battery setup')] },
  },
  // System
  {
    pattern: /Logging.*(not available|failed)|No SD card|SD card/i,
    category: 'system',
    fix: { get hint() { return st('shared.prearm_checks.loggingIsNotAvailableTheSd', 'Logging is not available: the SD card is missing, full or failed. Insert or replace the card.'); }, links: [configTab('logging', 'Logging setup')] },
  },
  {
    pattern: /Hardware safety switch/i,
    category: 'system',
    fix: { get hint() { return st('shared.prearm_checks.pressAndHoldTheSafetySwitch', 'Press and hold the safety switch on the vehicle until its light goes solid.'); } },
  },
  {
    pattern: /Check board type/i,
    category: 'system',
    fix: { get hint() { return st('shared.prearm_checks.theConfiguredBoardTypeDoesNot', 'The configured board type does not match this flight controller.'); }, params: ['BRD_TYPE'] },
  },
  // Mission
  {
    pattern: /Fence.*(requires position|breach)/i,
    category: 'mission',
    fix: { get hint() { return st('shared.prearm_checks.theFenceNeedsAPositionOr', 'The fence needs a position, or the vehicle is outside it. Wait for a GPS lock, or move the vehicle inside the fence.'); }, links: [openView('mission', 'Open fence')] },
  },
  {
    pattern: /Mission.*(not valid|no first item)|missing takeoff/i,
    category: 'mission',
    fix: { get hint() { return st('shared.prearm_checks.theMissionCannotStartAsIt', 'The mission cannot start as it is. Check it in the mission planner.'); }, links: [openView('mission', 'Open mission')] },
  },
];

// Any ArduPilot pre-arm message without a known fix.
const GENERIC_FALLBACK: PreArmPattern = {
  pattern: /.*/,
  category: 'system',
  fix: {
    get hint() { return st('shared.prearm_checks.noAutomaticFixIsKnownFor', 'No automatic fix is known for this check. The message comes straight from the flight controller; the pre-arm reference explains each one.'); },
    links: [docs(ARDUPILOT_PREARM_DOCS, 'ArduPilot pre-arm reference')],
  },
};

/**
 * ArduPilot re-broadcasts every failing pre-arm check roughly every 30 s while
 * disarmed (PREARM_DISPLAY_PERIOD). A pre-arm message older than this window
 * means the FC has stopped reporting it - the failure is resolved (e.g. a
 * fresh battery was plugged in). One broadcast period plus margin.
 */
export const PREARM_STALE_MS = 40_000;

/**
 * PX4 arming / preflight failure patterns. PX4 emits different STATUSTEXT
 * wording than ArduPilot ("Arming denied:", "Preflight Fail:", "Preflight: ")
 * and uses COM_/EKF2_/BAT_/GF_ parameter names. Kept separate from the
 * ArduPilot array so a PX4 connection never matches an ArduPilot-only hint
 * (and vice versa).
 *
 * Sources: PX4 commander/preflight check messages, PX4 parameter reference.
 */
const PX4_PREARM_PATTERNS: PreArmPattern[] = [
  // GPS / position estimate
  {
    pattern: /(global position|position).*(not ready|denied|fail|estimate)|(estimator|position).*(not ready|fail)/i,
    category: 'gps',
    fix: { get hint() { return st('shared.prearm_checks.thePositionEstimateIsNotReady', 'The position estimate is not ready. Wait for a GPS lock under open sky and for the estimator to settle.'); } },
  },
  {
    pattern: /\b(gps|gnss)\b.*(fix|lock|not ready|fail)|need.*3d fix/i,
    category: 'gps',
    fix: { get hint() { return st('shared.prearm_checks.waitingForAGpsFixMove', 'Waiting for a GPS fix. Move to open sky and wait; if it persists, check the GPS setup.'); }, links: [configTab('sensor-config', 'GPS setup')] },
  },
  // Sensors / calibration
  {
    pattern: /(compass|mag(netometer)?).*(not calibrated|inconsistent|fail|interference)/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theMagnetometerIsNotCalibratedOr', 'The magnetometer is not calibrated, or its readings disagree. Move away from metal and power cables and recalibrate.'); }, links: [calibrate('compass', 'Calibrate compass')] },
  },
  {
    pattern: /accel(erometer)?.*(not calibrated|inconsistent|fail)/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theAccelerometerIsNotCalibratedOr', 'The accelerometer is not calibrated or inconsistent.'); }, links: [calibrate('accel-6point', 'Calibrate accelerometer')] },
  },
  {
    pattern: /gyro(scope)?.*(not calibrated|inconsistent|fail)/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theGyroscopeIsNotCalibratedKeep', 'The gyroscope is not calibrated. Keep the vehicle completely still during calibration.'); }, links: [calibrate('gyro', 'Calibrate gyro')] },
  },
  {
    pattern: /(accelerometer.*clipping|high vibration|vibration)/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.highVibrationOrAccelerometerClippingImprove', 'High vibration or accelerometer clipping. Improve the flight controller mounting and isolation, and balance the props.'); } },
  },
  {
    pattern: /(attitude|tilt).*(estimate|quality|too large|fail)|(estimator|quality).*(attitude|tilt)/i,
    category: 'sensors',
    fix: { get hint() { return st('shared.prearm_checks.theAttitudeEstimateIsNotStable', 'The attitude estimate is not stable. Level the vehicle, reduce vibration and let the estimator settle.'); } },
  },
  // RC / manual control
  {
    pattern: /(rc|radio|manual control).*(not calibrated|lost|fail|not configured)/i,
    category: 'rc',
    fix: { get hint() { return st('shared.prearm_checks.theRadioIsNotCalibratedOr', 'The radio is not calibrated or its signal is lost. Switch the transmitter on, check it is bound, and calibrate it.'); }, links: [configTab('receiver', 'Calibrate radio')] },
  },
  // Battery
  {
    pattern: /(battery).*(low|unhealthy|warning|critical|not connected)/i,
    category: 'battery',
    fix: { get hint() { return st('shared.prearm_checks.theBatteryIsLowOrUnhealthy', 'The battery is low or unhealthy. Charge or replace it, and check the battery setup if the reading looks wrong.'); }, links: [configTab('battery', 'Battery setup')] },
  },
  // ESC / motors
  {
    pattern: /(esc|motor).*(fail|not|telemetry|unhealthy)/i,
    category: 'motors',
    fix: { get hint() { return st('shared.prearm_checks.anEscOrMotorProblemWas', 'An ESC or motor problem was detected. Check the ESC wiring, telemetry and motor outputs.'); } },
  },
  // Geofence
  {
    pattern: /(geofence|\bgf\b)/i,
    category: 'mission',
    fix: { get hint() { return st('shared.prearm_checks.aGeofenceConditionIsBlockingArming', 'A geofence condition is blocking arming. Move the vehicle inside the fence, or review the fence.'); }, links: [openView('mission', 'Open fence')] },
  },
  // Home position
  {
    pattern: /(home position|home not set)/i,
    category: 'mission',
    fix: { get hint() { return st('shared.prearm_checks.theHomePositionIsNotSet', 'The home position is not set yet. Wait for a valid position so home can be captured.'); } },
  },
  // Kill switch / safety
  {
    pattern: /(kill switch|emergency)/i,
    category: 'system',
    fix: { get hint() { return st('shared.prearm_checks.theKillSwitchIsEngagedDisengage', 'The kill switch is engaged. Disengage it on the transmitter before arming.'); } },
  },
];

// Any PX4 arming or preflight failure without a known fix.
const PX4_GENERIC_FALLBACK: PreArmPattern = {
  pattern: /.*/,
  category: 'system',
  fix: {
    get hint() { return st('shared.prearm_checks.noAutomaticFixIsKnownFor2', 'No automatic fix is known for this check. The message comes straight from the flight controller; the preflight check reference explains each one.'); },
    links: [docs(PX4_PREARM_DOCS, 'PX4 preflight check reference')],
  },
};

// PX4 STATUSTEXT prefixes for arming / preflight failures.
const PX4_PREARM_PREFIX = /^(arming denied|preflight fail|preflight)\s*:/i;

/**
 * Check if a STATUSTEXT message is a pre-arm message.
 *
 * Defaults to ArduPilot detection ("PreArm:" / "Arm:") so existing callers are
 * unchanged. Pass firmware 'px4' to also match PX4 prefixes ("Arming denied:",
 * "Preflight Fail:", "Preflight:").
 */
export function isPreArmMessage(text: string, firmware?: FirmwareSource): boolean {
  if (firmware === 'px4') {
    return PX4_PREARM_PREFIX.test(text.trim());
  }
  return /(?:PreArm|Arm):/i.test(text);
}

/**
 * Extract the reason part from a pre-arm or arm-time error message.
 * ArduPilot: "PreArm: Motors: Check frame class" -> "Motors: Check frame class"
 * PX4:       "Arming denied: GPS not ready" -> "GPS not ready"
 */
export function extractPreArmReason(text: string, firmware?: FirmwareSource): string {
  if (firmware === 'px4') {
    const px4Match = text.trim().match(/^(?:arming denied|preflight fail|preflight)\s*:\s*(.+)/i);
    return px4Match ? px4Match[1]!.trim() : text.trim();
  }
  const match = text.match(/(?:PreArm|Arm):\s*(.+)/i);
  return match ? match[1]!.trim() : text;
}

/**
 * Match a STATUSTEXT message against known pre-arm patterns.
 * Returns null if the message is not a pre-arm message.
 * Returns a generic fallback if it's a pre-arm message but no specific pattern matches.
 *
 * Defaults to ArduPilot. Pass firmware 'px4' to match PX4 arming/preflight
 * patterns instead. The two pattern sets never cross-match.
 */
export function matchPreArmError(
  text: string,
  firmware?: FirmwareSource,
): { pattern: PreArmPattern; reason: string } | null {
  if (!isPreArmMessage(text, firmware)) return null;

  const reason = extractPreArmReason(text, firmware);

  const patterns = firmware === 'px4' ? PX4_PREARM_PATTERNS : PREARM_PATTERNS;
  const fallback = firmware === 'px4' ? PX4_GENERIC_FALLBACK : GENERIC_FALLBACK;

  for (const entry of patterns) {
    if (entry.pattern.test(reason)) {
      return { pattern: entry, reason };
    }
  }

  // Fallback: it's a pre-arm message but no specific pattern matched
  return { pattern: fallback, reason };
}
