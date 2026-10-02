/**
 * Operator mode: the app opens on a simplified operator screen; the full UI is the
 * administrator's and sits behind a password. These types cross the IPC boundary.
 */

import type { ConnectOptions } from './ipc-channels';

export type AppMode = 'operator' | 'admin';

/** Mode buttons the administrator can put on the operator screen (ArduPilot Rover / boat modes). */
export type OperatorModeButton = 'manual' | 'hold' | 'rtl' | 'smartRtl' | 'auto';

export const OPERATOR_MODE_BUTTONS: readonly OperatorModeButton[] = ['manual', 'hold', 'rtl', 'smartRtl', 'auto'];

/** ArduPilot Rover custom_mode numbers behind the mode buttons. */
export const ROVER_MODE_NUMBER: Record<OperatorModeButton, number> = {
  manual: 0,
  hold: 4,
  auto: 10,
  rtl: 11,
  smartRtl: 12,
};

export interface OperatorConfig {
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
  /** The record button records every camera, not just the main one. */
  recordAllCameras: boolean;
  /** Shown on the operator's About page. */
  supportContact: string;
  /** Minutes without input after which the full UI closes again. 0 = never. */
  autoLockMinutes: number;
}

export const DEFAULT_OPERATOR_CONFIG: OperatorConfig = {
  startInOperatorMode: true,
  autoConnect: true,
  connection: null,
  allowArm: true,
  modeButtons: ['manual'],
  tiltWarnDeg: 25,
  tiltLimitDeg: 35,
  recordAllCameras: true,
  supportContact: '@stohid_support_bot',
  autoLockMinutes: 15,
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
  const modes = Array.isArray(r.modeButtons)
    ? OPERATOR_MODE_BUTTONS.filter((m) => (r.modeButtons as unknown[]).includes(m) && m !== 'hold')
    : d.modeButtons;
  const connection = r.connection && typeof r.connection === 'object'
    && ['serial', 'tcp', 'udp'].includes((r.connection as { type?: string }).type ?? '')
    ? (r.connection as ConnectOptions)
    : null;
  const tiltWarnDeg = num(r.tiltWarnDeg, d.tiltWarnDeg, 5, 85);
  return {
    startInOperatorMode: bool(r.startInOperatorMode, d.startInOperatorMode),
    autoConnect: bool(r.autoConnect, d.autoConnect),
    connection,
    allowArm: bool(r.allowArm, d.allowArm),
    modeButtons: [...modes],
    tiltWarnDeg,
    tiltLimitDeg: Math.max(tiltWarnDeg, num(r.tiltLimitDeg, d.tiltLimitDeg, 5, 89)),
    recordAllCameras: bool(r.recordAllCameras, d.recordAllCameras),
    supportContact: typeof r.supportContact === 'string' ? r.supportContact.trim().slice(0, 120) : d.supportContact,
    autoLockMinutes: Math.round(num(r.autoLockMinutes, d.autoLockMinutes, 0, 240)),
  };
}
