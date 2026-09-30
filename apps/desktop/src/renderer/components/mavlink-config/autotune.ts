import { t } from '../../i18n';
// AUTOTUNE_AXES / AUTOTUNE_AGGR semantics, ported from the mobile AutoTune tab.

export const AXIS_ROLL = 1;
export const AXIS_PITCH = 2;
export const AXIS_YAW = 4;
export const AXIS_ALL = AXIS_ROLL | AXIS_PITCH | AXIS_YAW;

export const AXES: ReadonlyArray<{ bit: number; name: string }> = [
  { bit: AXIS_ROLL, name: 'Roll' },
  { bit: AXIS_PITCH, name: 'Pitch' },
  { bit: AXIS_YAW, name: 'Yaw' },
];

/** The vehicle returns a float; treat anything unknown as the firmware default (all three). */
export function normalizeAxes(value: number | undefined): number {
  const v = Math.round(value ?? AXIS_ALL);
  return v >= 1 && v <= AXIS_ALL ? v : AXIS_ALL;
}

// Tuning nothing is not a setting, it is a mode that will refuse to run.
export function toggleAxis(mask: number, bit: number): number {
  const next = (mask & bit) !== 0 ? mask & ~bit : mask | bit;
  return next === 0 ? mask : next;
}

export function axisNames(mask: number): string {
  const names = AXES.filter((a) => (mask & a.bit) !== 0).map((a) => a.name.toLowerCase());
  return names.length === 0 ? 'nothing' : names.join(', ');
}

export interface AggrChoice {
  value: number;
  title: string;
  blurb: string;
}

export const AGGR_CHOICES: ReadonlyArray<AggrChoice> = [
  { value: 0.05, get title() { return t('mavlink_config.autotune.gentle'); }, get blurb() { return t('mavlink_config.autotune.softerResponseMoreMarginCameraWork'); } },
  { value: 0.075, get title() { return t('mavlink_config.autotune.middle'); }, get blurb() { return t('mavlink_config.autotune.theUsualStartingPoint'); } },
  { value: 0.1, get title() { return t('mavlink_config.autotune.snappy'); }, get blurb() { return t('mavlink_config.autotune.sharpestResponseArdupilotWillTuneTo'); } },
];

// Three-decimal compare: the vehicle's float32 returns 0.075 as 0.07499999832.
export function aggrMatches(current: number | undefined, choice: number): boolean {
  if (current === undefined) return false;
  return Math.round(current * 1000) === Math.round(choice * 1000);
}

/** ArduPilot AutoTune flight-mode number per vehicle class; null = no such mode. */
export function autotuneModeNumber(category: 'copter' | 'plane' | 'rover'): number | null {
  if (category === 'copter') return 15;
  if (category === 'plane') return 8;
  return null;
}
