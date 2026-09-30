// Decodes ArduPilot dataflash ERR / EV / MSG / MODE / CMD records into a
// human-readable, severity-graded event timeline. Pure (no DOM/store imports)
// so it is unit-testable and shareable between the events panel and the chart.

import { COPTER_MODE_NAMES, PLANE_MODE_NAMES, ROVER_MODE_NAMES } from '@ardudeck/dataflash-parser';
import { logRows, type LogColumns } from '../../utils/log-columns';
import { t } from '../../i18n';

export const COPTER_MODES = COPTER_MODE_NAMES;

/**
 * Mode number -> name, using the log's vehicle type to pick the right table.
 * The same number means different modes per vehicle (10 = plane/rover AUTO,
 * 11 = copter DRIFT but plane/rover RTL), so defaulting to the copter table
 * mislabels plane and rover logs.
 */
export function getModeName(modeNum: number, vehicleType?: string): string {
  const map = vehicleType === 'plane' ? PLANE_MODE_NAMES
    : vehicleType === 'rover' ? ROVER_MODE_NAMES
    : COPTER_MODE_NAMES;
  return map[modeNum] ?? `MODE_${modeNum}`;
}

export const MODE_COLORS: Record<string, string> = {
  STABILIZE: '#6b7280', ALT_HOLD: '#3b82f6', LOITER: '#10b981', AUTO: '#8b5cf6',
  RTL: '#f59e0b', LAND: '#ef4444', GUIDED: '#ec4899', POSHOLD: '#06b6d4',
  ACRO: '#f97316', CIRCLE: '#84cc16', BRAKE: '#6366f1', SMART_RTL: '#fbbf24',
  MANUAL: '#6b7280', CRUISE: '#06b6d4', FBWA: '#3b82f6', FBWB: '#0ea5e9',
  STEERING: '#3b82f6', HOLD: '#6366f1', TAKEOFF: '#84cc16', QLOITER: '#10b981',
};

/** ArduPilot LogErrorSubsystem ids (AP_Logger). */
const ERR_SUBSYSTEMS: Record<number, string> = {
  1: 'Main', 2: 'Radio', 3: 'Compass', get 4() { return t('logs.log_events.opticalFlow'); },
  get 5() { return t('logs.log_events.radioFailsafe'); }, get 6() { return t('logs.log_events.batteryFailsafe'); }, get 8() { return t('logs.log_events.gcsFailsafe'); },
  get 9() { return t('logs.log_events.fenceFailsafe'); }, get 10() { return t('logs.log_events.flightMode'); }, 11: 'GPS', get 12() { return t('logs.log_events.crashCheck'); },
  13: 'Flip', 15: 'Parachute', get 16() { return t('logs.log_events.ekfCheck'); }, get 17() { return t('logs.log_events.ekfFailsafe'); },
  18: 'Baro', get 19() { return t('logs.log_events.cpuLoad'); }, get 20() { return t('logs.log_events.adsbFailsafe'); }, 21: 'Terrain',
  22: 'Navigation', get 23() { return t('logs.log_events.terrainFailsafe'); }, get 24() { return t('logs.log_events.ekfPrimary'); },
  get 25() { return t('logs.log_events.thrustLossCheck'); }, get 26() { return t('logs.log_events.sensorFailsafe'); }, get 27() { return t('logs.log_events.leakFailsafe'); },
  get 28() { return t('logs.log_events.pilotInput'); }, get 29() { return t('logs.log_events.vibrationFailsafe'); }, get 30() { return t('logs.log_events.internalError'); },
  get 31() { return t('logs.log_events.deadReckoningFailsafe'); },
};

/** Per-subsystem error-code meanings; generic fallbacks below. */
const ERR_CODES_BY_SUBSYS: Record<number, Record<number, string>> = {
  2: { 2: 'late frame' },
  11: { get 2() { return t('logs.log_events.gpsGlitch'); }, 0: 'glitch cleared' },
  12: { 1: 'CRASH DETECTED', get 2() { return t('logs.log_events.lossOfControl'); } },
  16: { 2: 'bad variance', 0: 'variance cleared' },
  18: { 2: 'baro glitch', 0: 'glitch cleared' },
  25: { 1: 'THRUST LOSS' },
};

const ERR_CODES_GENERIC: Record<number, string> = {
  0: 'resolved',
  1: 'triggered',
  4: 'unhealthy',
};

/** ArduPilot LogEvent ids (AP_Logger LogEvent enum). */
const EV_NAMES: Record<number, string> = {
  10: 'Armed', 11: 'Disarmed', get 15() { return t('logs.log_events.autoArmed'); },
  get 17() { return t('logs.log_events.landCompleteMaybe'); }, get 18() { return t('logs.log_events.landComplete'); }, get 19() { return t('logs.log_events.lostGps'); },
  get 21() { return t('logs.log_events.flipStart'); }, get 22() { return t('logs.log_events.flipEnd'); }, get 25() { return t('logs.log_events.homeSet'); },
  get 26() { return t('logs.log_events.simpleModeOn'); }, get 27() { return t('logs.log_events.simpleModeOff'); }, get 28() { return t('logs.log_events.notLanded'); },
  get 29() { return t('logs.log_events.superSimpleModeOn'); },
  get 30() { return t('logs.log_events.autotuneInitialised'); }, get 31() { return t('logs.log_events.autotuneOff'); }, get 32() { return t('logs.log_events.autotuneRestart'); },
  get 33() { return t('logs.log_events.autotuneSuccess'); }, get 34() { return t('logs.log_events.autotuneFailed'); }, get 35() { return t('logs.log_events.autotuneReachedLimit'); },
  get 36() { return t('logs.log_events.autotunePilotTesting'); }, get 37() { return t('logs.log_events.autotuneGainsSaved'); },
  get 38() { return t('logs.log_events.trimSaved'); }, get 39() { return t('logs.log_events.waypointSaved'); },
  get 41() { return t('logs.log_events.fenceEnabled'); }, get 42() { return t('logs.log_events.fenceDisabled'); },
  get 43() { return t('logs.log_events.acroTrainerOff'); }, get 44() { return t('logs.log_events.acroTrainerLeveling'); }, get 45() { return t('logs.log_events.acroTrainerLimited'); },
  get 46() { return t('logs.log_events.gripperGrab'); }, get 47() { return t('logs.log_events.gripperRelease'); },
  get 49() { return t('logs.log_events.parachuteDisabled'); }, get 50() { return t('logs.log_events.parachuteEnabled'); }, 51: 'PARACHUTE RELEASED',
  get 52() { return t('logs.log_events.landingGearDeployed'); }, get 53() { return t('logs.log_events.landingGearRetracted'); },
  54: 'MOTORS EMERGENCY STOPPED', get 55() { return t('logs.log_events.motorsEmergencyStopCleared'); },
  get 56() { return t('logs.log_events.motorsInterlockDisabled'); }, get 57() { return t('logs.log_events.motorsInterlockEnabled'); },
  get 58() { return t('logs.log_events.rotorRunupComplete'); }, 59: 'ROTOR SPEED BELOW CRITICAL',
  get 60() { return t('logs.log_events.ekfAltitudeReset'); }, get 61() { return t('logs.log_events.landCancelledByPilot'); }, get 62() { return t('logs.log_events.ekfYawReset'); },
  get 63() { return t('logs.log_events.adsbAvoidanceEnabled'); }, get 64() { return t('logs.log_events.adsbAvoidanceDisabled'); },
  get 65() { return t('logs.log_events.proximityAvoidanceEnabled'); }, get 66() { return t('logs.log_events.proximityAvoidanceDisabled'); },
  get 67() { return t('logs.log_events.gpsPrimaryChanged'); },
  get 71() { return t('logs.log_events.zigzagPointAStored'); }, get 72() { return t('logs.log_events.zigzagPointBStored'); },
  get 73() { return t('logs.log_events.landRepositioningActive'); }, get 74() { return t('logs.log_events.standbyEnabled'); }, get 75() { return t('logs.log_events.standbyDisabled'); },
};

/** ArduPilot ModeReason enum: why the vehicle changed flight mode. */
/** ArduPilot ModeReason enum: why the vehicle changed flight mode (labels in locales, logs.log_events.modeReasonN). */
const MODE_REASON_MAX = 45;
const modeReason = (n: number): string => (n >= 0 && n <= MODE_REASON_MAX ? t(`logs.log_events.modeReason${n}`) : String(n));

/** Event ids that deserve attention even though they are "events" not errors. */
const EV_WARN_IDS = new Set([19, 51, 54, 59, 60, 62]);

/** MSG text that indicates a problem rather than chatter. */
const MSG_WARN_RE = /prearm|pre-arm|failsafe|fail|error|crash|glitch|variance|unhealthy|leak|lost|timeout|emergency/i;

export type LogEventKind = 'ERR' | 'EV' | 'MSG' | 'MODE' | 'CMD';
export type LogEventSeverity = 'error' | 'warn' | 'info';

export interface LogEventEntry {
  timeS: number;
  kind: LogEventKind;
  severity: LogEventSeverity;
  label: string;
  detail?: string;
}

type LogMessages = Record<string, LogColumns>;

export function decodeErr(subsys: number, ecode: number, vehicleType?: string): { label: string; detail: string; severity: LogEventSeverity } {
  const label = ERR_SUBSYSTEMS[subsys] ?? `Subsystem ${subsys}`;
  let detail: string;
  if (subsys === 10) {
    // Flight mode subsystem: the code is the mode number that was refused.
    detail = `cannot enter ${getModeName(ecode, vehicleType)}`;
  } else {
    detail = ERR_CODES_BY_SUBSYS[subsys]?.[ecode] ?? ERR_CODES_GENERIC[ecode] ?? `code ${ecode}`;
  }
  return { label, detail, severity: ecode === 0 ? 'info' : 'error' };
}

export function decodeEv(id: number): { label: string; severity: LogEventSeverity } {
  return { label: EV_NAMES[id] ?? t('logs.log_events.event', { id }), severity: EV_WARN_IDS.has(id) ? 'warn' : 'info' };
}

/**
 * Flattens ERR/EV/MSG/MODE/CMD records into one chronological event list.
 * MP buries these in separate raw tabs; here they are one severity-graded
 * timeline the user can filter and click to jump the charts to.
 */
export function extractLogEvents(log: { messages: LogMessages; metadata?: { vehicleType?: string } }): LogEventEntry[] {
  const out: LogEventEntry[] = [];
  const vehicleType = log.metadata?.vehicleType;

  for (const m of logRows(log, 'ERR')) {
    const subsys = typeof m.fields['Subsys'] === 'number' ? m.fields['Subsys'] : -1;
    const ecode = typeof m.fields['ECode'] === 'number' ? m.fields['ECode'] : -1;
    const d = decodeErr(subsys, ecode, vehicleType);
    out.push({ timeS: m.timeUs / 1_000_000, kind: 'ERR', severity: d.severity, label: d.label, detail: d.detail });
  }

  for (const m of logRows(log, 'EV')) {
    const id = typeof m.fields['Id'] === 'number' ? m.fields['Id'] : -1;
    const d = decodeEv(id);
    out.push({ timeS: m.timeUs / 1_000_000, kind: 'EV', severity: d.severity, label: d.label });
  }

  for (const m of logRows(log, 'MSG')) {
    const text = typeof m.fields['Message'] === 'string' ? m.fields['Message'] : '';
    if (!text) continue;
    out.push({
      timeS: m.timeUs / 1_000_000,
      kind: 'MSG',
      severity: MSG_WARN_RE.test(text) ? 'warn' : 'info',
      label: text,
    });
  }

  for (const m of logRows(log, 'MODE')) {
    const modeNum = (typeof m.fields['ModeNum'] === 'number' ? m.fields['ModeNum'] : m.fields['Mode']);
    const name = typeof modeNum === 'number' ? getModeName(modeNum, vehicleType) : String(m.fields['Mode'] ?? '?');
    const rsn = m.fields['Rsn'];
    out.push({
      timeS: m.timeUs / 1_000_000,
      kind: 'MODE',
      severity: 'info',
      label: t('logs.log_events.mode', { name }),
      detail: typeof rsn === 'number' ? t('logs.log_events.reasonDetail', { reason: modeReason(rsn) }) : undefined,
    });
  }

  for (const m of logRows(log, 'CMD')) {
    const num = m.fields['CNum'];
    const name = typeof m.fields['CName'] === 'string' ? m.fields['CName'] : `cmd ${m.fields['CId'] ?? '?'}`;
    out.push({
      timeS: m.timeUs / 1_000_000,
      kind: 'CMD',
      severity: 'info',
      label: typeof num === 'number' ? `WP ${num}: ${name}` : String(name),
    });
  }

  out.sort((a, b) => a.timeS - b.timeS);
  return out;
}

/** mm:ss.s for event timestamps (logs run minutes to hours). */
export function fmtEventTime(timeS: number): string {
  const mm = Math.floor(timeS / 60);
  const ss = timeS - mm * 60;
  return `${mm}:${ss < 10 ? '0' : ''}${ss.toFixed(1)}`;
}
