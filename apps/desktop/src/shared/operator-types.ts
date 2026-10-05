/**
 * Operator mode: the app opens on a simplified operator screen; the full UI is the
 * administrator's and sits behind a password. These types cross the IPC boundary.
 */

import type { ConnectOptions } from './ipc-channels';
import { DEFAULT_RC_CONFIG, normalizeRcConfig, type OperatorRcConfig } from './operator-rc';
import { OPERATOR_MAX_VALUES, controlKind, normalizeValue, type OperatorValue } from './operator-panel';

export type AppMode = 'operator' | 'admin';

/** Modes the administrator can offer on the operator screen (ArduPilot Rover / boat modes). */
export type OperatorModeButton =
  | 'manual' | 'acro' | 'steering' | 'hold' | 'loiter' | 'auto' | 'rtl' | 'smartRtl' | 'guided' | 'follow' | 'simple' | 'circle' | 'dock';

/** In the order they are listed for the operator. */
export const OPERATOR_MODE_BUTTONS: readonly OperatorModeButton[] = [
  'manual', 'acro', 'steering', 'hold', 'loiter', 'auto', 'rtl', 'smartRtl', 'guided', 'follow', 'simple', 'circle', 'dock',
];

/** ArduPilot Rover custom_mode numbers behind the mode buttons. */
export const ROVER_MODE_NUMBER: Record<OperatorModeButton, number> = {
  manual: 0,
  acro: 1,
  steering: 3,
  hold: 4,
  loiter: 5,
  follow: 6,
  simple: 7,
  dock: 8,
  circle: 9,
  auto: 10,
  rtl: 11,
  smartRtl: 12,
  guided: 15,
};

/** When video is recorded: all the time, while the vehicle is armed, or by the operator's button. */
export type OperatorRecordMode = 'always' | 'armed' | 'manual';
export const OPERATOR_RECORD_MODES: readonly OperatorRecordMode[] = ['always', 'armed', 'manual'];

/** Settings written by this version. Older files get the newer defaults where the meaning changed. */
export const OPERATOR_CONFIG_SCHEMA = 3;
/** Files from before this schema had "Manual" as the only mode button by default. */
const MODE_LIST_SCHEMA = 2;

/**
 * Values the status strip shows out of the box; the administrator picks which, and in what
 * order, and adds any other value from the vehicle (`v:<id>`, see operator-panel.ts).
 */
export const OPERATOR_STATUS_FIELDS = [
  'mode', 'satellites', 'hdop', 'battery', 'current', 'uptime', 'speed', 'heading', 'altitude', 'throttle', 'roll', 'pitch', 'clock',
] as const;
export type OperatorStatusField = (typeof OPERATOR_STATUS_FIELDS)[number];

/** Parts of the operator screen the administrator can switch off. */
export const OPERATOR_ELEMENTS = ['map', 'infoBlock', 'cameraControls', 'popOut'] as const;
export type OperatorElement = (typeof OPERATOR_ELEMENTS)[number];

export interface OperatorConfig {
  schema: number;
  /** False lets a development or service PC open straight into the full UI. */
  startInOperatorMode: boolean;
  /** Connect to the vehicle as soon as the operator screen opens, and keep retrying. */
  autoConnect: boolean;
  /** The link the operator screen uses; null means "the last one used". */
  connection: ConnectOptions | null;
  /** Operator may arm and disarm (always by holding the button). */
  allowArm: boolean;
  /** Mode buttons shown next to STOP. STOP itself (Hold) is always there. */
  modeButtons: OperatorModeButton[];
  /** Roll / pitch (degrees) from which the readout turns amber, then red. */
  tiltWarnDeg: number;
  tiltLimitDeg: number;
  /** Every camera is recorded, not just the main one. */
  recordAllCameras: boolean;
  recordMode: OperatorRecordMode;
  /** Folder for recordings and snapshots; empty = "STOHID" in the user's Videos folder. */
  recordDir: string;
  /** A recording is cut into files of this many minutes; 0 = one file per recording. */
  recordSegmentMinutes: number;
  /** Joystick driving, cruise, reverse driving and the administrator's own RC functions. */
  rc: OperatorRcConfig;
  /** Shown on the operator's About page. */
  supportContact: string;
  /** Minutes without input after which the full UI closes again. 0 = never. */
  autoLockMinutes: number;
  /** Status strip values, left to right: built-in names (OPERATOR_STATUS_FIELDS) and `v:<id>` of `values`. */
  statusFields: string[];
  /** The administrator's own values: any MAVLink field, named value or parameter of the vehicle. */
  values: OperatorValue[];
  /** Controls of the bottom bar in the administrator's order (see arrangeControls). */
  controlOrder: string[];
  /** Controls taken off the bottom bar. */
  hiddenControls: string[];
  /** Screen parts that are switched off (everything else is shown). */
  hiddenElements: OperatorElement[];
}

export const DEFAULT_OPERATOR_CONFIG: OperatorConfig = {
  schema: OPERATOR_CONFIG_SCHEMA,
  startInOperatorMode: true,
  autoConnect: true,
  connection: null,
  allowArm: true,
  modeButtons: ['manual', 'acro', 'steering', 'loiter', 'auto', 'rtl', 'smartRtl', 'guided'],
  tiltWarnDeg: 25,
  tiltLimitDeg: 35,
  recordAllCameras: true,
  recordMode: 'always',
  recordDir: '',
  recordSegmentMinutes: 15,
  rc: DEFAULT_RC_CONFIG,
  supportContact: '@stohid_support_bot',
  autoLockMinutes: 15,
  statusFields: ['mode', 'satellites', 'battery', 'uptime', 'speed', 'roll', 'pitch'],
  values: [],
  controlOrder: [],
  hiddenControls: [],
  hiddenElements: [],
};

export const ADMIN_PASSWORD_MIN_LENGTH = 6;

export interface OperatorState {
  mode: AppMode;
  /** False until an administrator password has been created. */
  hasPassword: boolean;
  config: OperatorConfig;
}

export type AdminAuthError = 'wrong-password' | 'locked-out' | 'too-short' | 'not-allowed' | 'storage';

export interface AdminAuthResult {
  ok: boolean;
  error?: AdminAuthError;
  /** With `locked-out`: how long until another attempt is accepted. */
  retryAfterMs?: number;
  /** With `wrong-password`: attempts left before a lock-out. */
  attemptsLeft?: number;
  state: OperatorState;
}

/** Keeps only known fields with sane values, so a hand-edited or older file cannot break the screen. */
export function normalizeOperatorConfig(raw: unknown): OperatorConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_OPERATOR_CONFIG;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const num = (v: unknown, fallback: number, min: number, max: number) =>
    (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
  // Before schema 2 the operator had "Manual" alone unless the administrator added more; mode
  // switching is now on the screen by default, so an older file takes the new list.
  const schema = typeof r.schema === 'number' ? r.schema : 1;
  const modes = schema >= MODE_LIST_SCHEMA && Array.isArray(r.modeButtons)
    ? OPERATOR_MODE_BUTTONS.filter((m) => (r.modeButtons as unknown[]).includes(m) && m !== 'hold')
    : d.modeButtons;
  const connection = r.connection && typeof r.connection === 'object'
    && ['serial', 'tcp', 'udp'].includes((r.connection as { type?: string }).type ?? '')
    ? (r.connection as ConnectOptions)
    : null;
  const tiltWarnDeg = num(r.tiltWarnDeg, d.tiltWarnDeg, 5, 85);
  // Known names only, each once, in the order given.
  const known = <T extends string>(value: unknown, all: readonly T[], fallback: T[]): T[] => (Array.isArray(value)
    ? [...new Set(value.filter((v): v is T => (all as readonly unknown[]).includes(v)))]
    : fallback);
  const valueIds = new Set<string>();
  const values: OperatorValue[] = [];
  for (const item of Array.isArray(r.values) ? r.values : []) {
    if (values.length >= OPERATOR_MAX_VALUES) break;
    const value = normalizeValue(item, valueIds);
    if (value) { valueIds.add(value.id); values.push(value); }
  }
  const statusFields = Array.isArray(r.statusFields)
    ? [...new Set(r.statusFields.filter((f): f is string => typeof f === 'string'
      && ((OPERATOR_STATUS_FIELDS as readonly string[]).includes(f) || (f.startsWith('v:') && valueIds.has(f.slice(2))))))]
    : [...d.statusFields];
  const controlKeys = (value: unknown): string[] => (Array.isArray(value)
    ? [...new Set(value.filter((k): k is string => typeof k === 'string' && controlKind(k) !== null))].slice(0, 100)
    : []);
  const hiddenControls = controlKeys(r.hiddenControls);
  // Before schema 3 the record button and the layout switch were "screen elements".
  if (schema < 3 && Array.isArray(r.hiddenElements)) {
    if (r.hiddenElements.includes('record')) hiddenControls.push('record');
    if (r.hiddenElements.includes('layoutSwitch')) hiddenControls.push('layout');
  }
  return {
    schema: OPERATOR_CONFIG_SCHEMA,
    startInOperatorMode: bool(r.startInOperatorMode, d.startInOperatorMode),
    autoConnect: bool(r.autoConnect, d.autoConnect),
    connection,
    allowArm: bool(r.allowArm, d.allowArm),
    modeButtons: [...modes],
    tiltWarnDeg,
    tiltLimitDeg: Math.max(tiltWarnDeg, num(r.tiltLimitDeg, d.tiltLimitDeg, 5, 89)),
    recordAllCameras: bool(r.recordAllCameras, d.recordAllCameras),
    recordMode: OPERATOR_RECORD_MODES.includes(r.recordMode as OperatorRecordMode) ? (r.recordMode as OperatorRecordMode) : d.recordMode,
    recordDir: typeof r.recordDir === 'string' ? r.recordDir.trim().slice(0, 400) : d.recordDir,
    recordSegmentMinutes: Math.round(num(r.recordSegmentMinutes, d.recordSegmentMinutes, 0, 240)),
    rc: normalizeRcConfig(r.rc),
    supportContact: typeof r.supportContact === 'string' ? r.supportContact.trim().slice(0, 120) : d.supportContact,
    autoLockMinutes: Math.round(num(r.autoLockMinutes, d.autoLockMinutes, 0, 240)),
    statusFields,
    values,
    controlOrder: controlKeys(r.controlOrder),
    hiddenControls: [...new Set(hiddenControls)],
    hiddenElements: known(r.hiddenElements, OPERATOR_ELEMENTS, []),
  };
}
