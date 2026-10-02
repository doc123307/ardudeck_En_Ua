/**
 * Operator RC: driving from a joystick, cruise control, reverse driving and the
 * administrator's own buttons, switches and sliders. All of it reaches the vehicle as
 * RC_CHANNELS_OVERRIDE. This file is the rules only (no timers, no IPC), so each one
 * is unit-tested; the engine that runs them is main/operator/operator-rc-engine.ts.
 */

export const RC_CHANNEL_SLOTS = 18;
/** The highest channel a function or a stick may use: ArduPilot takes overrides on channels 1-16. */
export const RC_MAX_CHANNEL = 16;
/** RC_CHANNELS_OVERRIDE: "leave this channel alone". */
export const RC_IGNORE = 65535;
export const RC_PWM_MIN = 800;
export const RC_PWM_MAX = 2200;

/** "Hand this channel back to the RC receiver": 0 for channels 1-8, UINT16_MAX-1 above them. */
export function rcReleaseValue(channelIndex: number): number {
  return channelIndex < 8 ? 0 : 65534;
}

// ---- Configuration (set by the administrator) ---------------------------------

/** Which joystick control drives a function. */
export type RcInput =
  | { kind: 'none' }
  | { kind: 'button'; index: number }
  /** Two buttons: off/on, down/up, less/more. */
  | { kind: 'buttons'; down: number; up: number }
  | { kind: 'axis'; index: number; reverse: boolean };

interface RcFunctionCommon {
  id: string;
  label: string;
  /** RC channel, 1-18. */
  channel: number;
  input: RcInput;
  /** Sent from the moment the vehicle connects; otherwise only once the operator has used it. */
  sendOnConnect: boolean;
}

/** A button: latching (press on, press off) or momentary (on while held). */
export interface RcButtonFunction extends RcFunctionCommon {
  kind: 'button';
  latching: boolean;
  offPwm: number;
  onPwm: number;
}

/** A three-position switch that either stays where it is put or springs back to the middle. */
export interface RcSwitchFunction extends RcFunctionCommon {
  kind: 'switch3';
  springCenter: boolean;
  lowPwm: number;
  midPwm: number;
  highPwm: number;
}

/** Where a slider goes when it is let go: nowhere, or back to one of its positions. */
export type RcSliderSpring = 'none' | 'min' | 'center' | 'max';
export const RC_SLIDER_SPRINGS: readonly RcSliderSpring[] = ['none', 'min', 'center', 'max'];

export interface RcSliderFunction extends RcFunctionCommon {
  kind: 'slider';
  spring: RcSliderSpring;
  minPwm: number;
  maxPwm: number;
}

export type OperatorRcFunction = RcButtonFunction | RcSwitchFunction | RcSliderFunction;
export type RcFunctionKind = OperatorRcFunction['kind'];
export const RC_FUNCTION_KINDS: readonly RcFunctionKind[] = ['button', 'switch3', 'slider'];
export const RC_MAX_FUNCTIONS = 16;

export interface RcDriveConfig {
  /** The operator may drive from a joystick. Taking control is still a deliberate press, every session. */
  enabled: boolean;
  steerChannel: number;
  throttleChannel: number;
  steerAxis: number;
  throttleAxis: number;
  steerReverse: boolean;
  throttleReverse: boolean;
  /** Stick travel around the centre that counts as centre, 0..0.5. */
  deadband: number;
  /** 0 = linear, 1 = softest around the centre. */
  expo: number;
  pwmMin: number;
  pwmTrim: number;
  pwmMax: number;
  /** Full stick gives this share of the throttle travel, percent. */
  throttleLimit: number;
  /** Joystick button that takes and drops control; null = on-screen button only. */
  engageButton: number | null;
}

export interface RcCruiseConfig {
  enabled: boolean;
  /** One press of + or - changes the held throttle by this many percent. */
  stepPercent: number;
  toggleButton: number | null;
  upButton: number | null;
  downButton: number | null;
}

export interface RcReverseConfig {
  enabled: boolean;
  /** Steering is mirrored too, so "right" on the stick is right in the rear camera. */
  invertSteering: boolean;
  /** Reverse driving puts the rear camera on the main view. */
  switchCamera: boolean;
  /** The rear camera; empty = found by its name. */
  cameraSourceId: string;
  toggleButton: number | null;
}

export interface OperatorRcConfig {
  /** The joystick to read, by (part of) its name; empty = the first one found. */
  padId: string;
  drive: RcDriveConfig;
  cruise: RcCruiseConfig;
  reverse: RcReverseConfig;
  functions: OperatorRcFunction[];
}

export const DEFAULT_RC_CONFIG: OperatorRcConfig = {
  padId: '',
  drive: {
    enabled: true,
    steerChannel: 1,
    throttleChannel: 3,
    steerAxis: 0,
    throttleAxis: 1,
    steerReverse: false,
    // A stick pushed away from you reads negative on a gamepad.
    throttleReverse: true,
    deadband: 0.05,
    expo: 0.2,
    pwmMin: 1000,
    pwmTrim: 1500,
    pwmMax: 2000,
    throttleLimit: 100,
    engageButton: null,
  },
  cruise: { enabled: true, stepPercent: 5, toggleButton: null, upButton: null, downButton: null },
  reverse: { enabled: true, invertSteering: true, switchCamera: true, cameraSourceId: '', toggleButton: null },
  // One of each kind, on channels a rover leaves free, so the feature can be seen and tried.
  // Nothing is sent on them until the operator touches the control.
  functions: [
    { id: 'aux9', label: 'AUX 9', channel: 9, kind: 'button', latching: true, offPwm: 1000, onPwm: 2000, input: { kind: 'none' }, sendOnConnect: false },
    { id: 'aux10', label: 'AUX 10', channel: 10, kind: 'switch3', springCenter: false, lowPwm: 1000, midPwm: 1500, highPwm: 2000, input: { kind: 'none' }, sendOnConnect: false },
    { id: 'aux11', label: 'AUX 11', channel: 11, kind: 'slider', spring: 'none', minPwm: 1000, maxPwm: 2000, input: { kind: 'none' }, sendOnConnect: false },
  ],
};

/** A new function of the given kind on the first channel nothing else uses. */
export function newRcFunction(kind: RcFunctionKind, existing: OperatorRcConfig): OperatorRcFunction {
  const used = new Set([existing.drive.steerChannel, existing.drive.throttleChannel, ...existing.functions.map((f) => f.channel)]);
  let channel = 5;
  while (channel < RC_MAX_CHANNEL && used.has(channel)) channel++;
  let n = existing.functions.length + 1;
  while (existing.functions.some((f) => f.id === `fn${n}`)) n++;
  const common = { id: `fn${n}`, label: `AUX ${channel}`, channel, input: { kind: 'none' } as RcInput, sendOnConnect: false };
  if (kind === 'button') return { ...common, kind, latching: true, offPwm: 1000, onPwm: 2000 };
  if (kind === 'switch3') return { ...common, kind, springCenter: false, lowPwm: 1000, midPwm: 1500, highPwm: 2000 };
  return { ...common, kind, spring: 'none', minPwm: 1000, maxPwm: 2000 };
}

// ---- Reading a stored configuration --------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) =>
  (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const int = (v: unknown, fallback: number, min: number, max: number) => Math.round(num(v, fallback, min, max));
const pwm = (v: unknown, fallback: number) => int(v, fallback, RC_PWM_MIN, RC_PWM_MAX);
const buttonIndex = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 64 ? v : null);

function normalizeInput(raw: unknown): RcInput {
  if (!isObject(raw)) return { kind: 'none' };
  if (raw.kind === 'button' && buttonIndex(raw.index) !== null) return { kind: 'button', index: raw.index as number };
  if (raw.kind === 'buttons' && buttonIndex(raw.down) !== null && buttonIndex(raw.up) !== null) {
    return { kind: 'buttons', down: raw.down as number, up: raw.up as number };
  }
  if (raw.kind === 'axis' && buttonIndex(raw.index) !== null) return { kind: 'axis', index: raw.index as number, reverse: bool(raw.reverse, false) };
  return { kind: 'none' };
}

function normalizeFunction(raw: unknown, takenIds: Set<string>): OperatorRcFunction | null {
  if (!isObject(raw) || !RC_FUNCTION_KINDS.includes(raw.kind as RcFunctionKind)) return null;
  const id = typeof raw.id === 'string' && /^[\w-]{1,32}$/.test(raw.id) && !takenIds.has(raw.id) ? raw.id : null;
  if (!id) return null;
  const channel = int(raw.channel, 9, 1, RC_MAX_CHANNEL);
  const common = {
    id,
    label: (typeof raw.label === 'string' ? raw.label.trim().slice(0, 24) : '') || `AUX ${channel}`,
    channel,
    input: normalizeInput(raw.input),
    sendOnConnect: bool(raw.sendOnConnect, false),
  };
  if (raw.kind === 'button') {
    return { ...common, kind: 'button', latching: bool(raw.latching, true), offPwm: pwm(raw.offPwm, 1000), onPwm: pwm(raw.onPwm, 2000) };
  }
  if (raw.kind === 'switch3') {
    return {
      ...common, kind: 'switch3', springCenter: bool(raw.springCenter, false),
      lowPwm: pwm(raw.lowPwm, 1000), midPwm: pwm(raw.midPwm, 1500), highPwm: pwm(raw.highPwm, 2000),
    };
  }
  return {
    ...common, kind: 'slider',
    spring: RC_SLIDER_SPRINGS.includes(raw.spring as RcSliderSpring) ? (raw.spring as RcSliderSpring) : 'none',
    minPwm: pwm(raw.minPwm, 1000), maxPwm: pwm(raw.maxPwm, 2000),
  };
}

/** Keeps only known fields with sane values; anything missing takes its default. */
export function normalizeRcConfig(raw: unknown): OperatorRcConfig {
  const d = DEFAULT_RC_CONFIG;
  if (!isObject(raw)) return structuredClone(d);
  const drive = isObject(raw.drive) ? raw.drive : {};
  const cruise = isObject(raw.cruise) ? raw.cruise : {};
  const reverse = isObject(raw.reverse) ? raw.reverse : {};
  const pwmMin = pwm(drive.pwmMin, d.drive.pwmMin);
  const pwmMax = Math.max(pwmMin + 100, pwm(drive.pwmMax, d.drive.pwmMax));
  const ids = new Set<string>();
  const functions: OperatorRcFunction[] = [];
  for (const item of Array.isArray(raw.functions) ? raw.functions : d.functions) {
    if (functions.length >= RC_MAX_FUNCTIONS) break;
    const fn = normalizeFunction(item, ids);
    if (fn) { ids.add(fn.id); functions.push(fn); }
  }
  return {
    padId: typeof raw.padId === 'string' ? raw.padId.trim().slice(0, 120) : '',
    drive: {
      enabled: bool(drive.enabled, d.drive.enabled),
      steerChannel: int(drive.steerChannel, d.drive.steerChannel, 1, RC_MAX_CHANNEL),
      throttleChannel: int(drive.throttleChannel, d.drive.throttleChannel, 1, RC_MAX_CHANNEL),
      steerAxis: int(drive.steerAxis, d.drive.steerAxis, 0, 31),
      throttleAxis: int(drive.throttleAxis, d.drive.throttleAxis, 0, 31),
      steerReverse: bool(drive.steerReverse, d.drive.steerReverse),
      throttleReverse: bool(drive.throttleReverse, d.drive.throttleReverse),
      deadband: num(drive.deadband, d.drive.deadband, 0, 0.5),
      expo: num(drive.expo, d.drive.expo, 0, 1),
      pwmMin,
      pwmTrim: Math.min(pwmMax - 50, Math.max(pwmMin + 50, pwm(drive.pwmTrim, d.drive.pwmTrim))),
      pwmMax,
      throttleLimit: int(drive.throttleLimit, d.drive.throttleLimit, 10, 100),
      engageButton: buttonIndex(drive.engageButton),
    },
    cruise: {
      enabled: bool(cruise.enabled, d.cruise.enabled),
      stepPercent: int(cruise.stepPercent, d.cruise.stepPercent, 1, 25),
      toggleButton: buttonIndex(cruise.toggleButton),
      upButton: buttonIndex(cruise.upButton),
      downButton: buttonIndex(cruise.downButton),
    },
    reverse: {
      enabled: bool(reverse.enabled, d.reverse.enabled),
      invertSteering: bool(reverse.invertSteering, d.reverse.invertSteering),
      switchCamera: bool(reverse.switchCamera, d.reverse.switchCamera),
      cameraSourceId: typeof reverse.cameraSourceId === 'string' ? reverse.cameraSourceId.slice(0, 80) : '',
      toggleButton: buttonIndex(reverse.toggleButton),
    },
    functions,
  };
}

/** Channels claimed twice: a function on a driving channel, or two functions on one channel. */
export function rcChannelConflicts(config: OperatorRcConfig): number[] {
  const seen = new Map<number, number>();
  const count = (channel: number) => seen.set(channel, (seen.get(channel) ?? 0) + 1);
  if (config.drive.enabled) { count(config.drive.steerChannel); count(config.drive.throttleChannel); }
  for (const f of config.functions) count(f.channel);
  return [...seen].filter(([, n]) => n > 1).map(([channel]) => channel).sort((a, b) => a - b);
}

/** Does anything in this configuration listen to a joystick? */
export function rcUsesJoystick(config: OperatorRcConfig): boolean {
  return config.drive.enabled
    || config.functions.some((f) => f.input.kind !== 'none')
    || [config.cruise.toggleButton, config.cruise.upButton, config.cruise.downButton, config.reverse.toggleButton]
      .some((b) => b !== null);
}

// ---- Joystick ---------------------------------------------------------------------

/** One reading of the joystick, as the Gamepad API reports it. */
export interface RcPad {
  id: string;
  axes: number[];
  buttons: boolean[];
}

/**
 * The joystick to read among those plugged in: the first one, unless the administrator named
 * one. A named joystick that is not there is not replaced by whatever else is plugged in.
 */
export function pickPad<T extends { id: string }>(pads: readonly (T | null | undefined)[], padId: string): T | null {
  const present = pads.filter((p): p is T => !!p);
  const wanted = padId.trim().toLowerCase();
  if (!wanted) return present[0] ?? null;
  return present.find((p) => p.id.toLowerCase().includes(wanted)) ?? null;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const axisOf = (pad: RcPad | null, index: number) => clamp(pad?.axes[index] ?? 0, -1, 1);
const pressed = (pad: RcPad | null, index: number | null) => (index === null ? false : pad?.buttons[index] ?? false);

/** A button went down between two readings. */
export function buttonEdge(prev: RcPad | null, next: RcPad, index: number | null): boolean {
  return index !== null && pressed(next, index) && !pressed(prev, index);
}

/** Deadband around the centre (rescaled, so there is no step at its edge), then expo. */
export function shapeStick(raw: number, deadband: number, expo: number): number {
  const v = clamp(raw, -1, 1);
  const a = Math.abs(v);
  if (a <= deadband) return 0;
  const scaled = (a - deadband) / Math.max(1e-3, 1 - deadband);
  const e = clamp(expo, 0, 1);
  return Math.sign(v) * (scaled * (1 - e) + scaled ** 3 * e);
}

export interface DriveSticks {
  /** -1 left .. 1 right, as the operator sees it. */
  steer: number;
  /** -1 back .. 1 forward, as the operator sees it. */
  throttle: number;
}

export function driveSticks(drive: RcDriveConfig, pad: RcPad | null): DriveSticks {
  const read = (axis: number, reverse: boolean) => shapeStick(axisOf(pad, axis), drive.deadband, drive.expo) * (reverse ? -1 : 1) || 0;
  return { steer: read(drive.steerAxis, drive.steerReverse), throttle: read(drive.throttleAxis, drive.throttleReverse) };
}

/** Sticks this close to the centre count as "let go". */
export const STICK_CENTRED = 0.15;
/** Pulling the stick back this far while cruising is braking: cruise lets go. */
export const CRUISE_BRAKE = 0.2;

export function sticksCentred(sticks: DriveSticks): boolean {
  return Math.abs(sticks.steer) < STICK_CENTRED && Math.abs(sticks.throttle) < STICK_CENTRED;
}

export interface DriveCommand {
  /** -1..1 in the vehicle's own sense, ready for the RC channel. */
  steer: number;
  throttle: number;
  /** The operator braked: cruise must switch off. */
  cruiseCancelled: boolean;
}

/**
 * What goes to the vehicle for a stick position.
 * - Cruise holds the throttle at its set value; pushing further adds, pulling back cancels it.
 * - Reverse driving swaps forward and back, and (by default) left and right, so the vehicle
 *   is driven tail-first exactly as it is driven nose-first.
 */
export function driveCommand(
  sticks: DriveSticks,
  options: { reverse: boolean; invertSteering: boolean; cruiseOn: boolean; cruiseValue: number },
): DriveCommand {
  let throttle = sticks.throttle;
  let cruiseCancelled = false;
  if (options.cruiseOn) {
    if (sticks.throttle <= -CRUISE_BRAKE) cruiseCancelled = true;
    else throttle = Math.max(options.cruiseValue, sticks.throttle);
  }
  let steer = sticks.steer;
  if (options.reverse) {
    throttle = -throttle;
    if (options.invertSteering) steer = -steer;
  }
  return { steer: steer || 0, throttle: throttle || 0, cruiseCancelled };
}

/** -1..1 to microseconds around the trim; the two halves may be unequal. */
export function stickPwm(value: number, min: number, trim: number, max: number): number {
  const v = clamp(value, -1, 1);
  return Math.round(v >= 0 ? trim + v * (max - trim) : trim + v * (trim - min));
}

// ---- Functions --------------------------------------------------------------------

/**
 * A function's position as one number: button 0 | 1, switch -1 | 0 | 1, slider 0..1.
 */
export function clampFunctionValue(fn: OperatorRcFunction, value: number): number {
  if (!Number.isFinite(value)) return functionInitial(fn);
  if (fn.kind === 'button') return value >= 0.5 ? 1 : 0;
  if (fn.kind === 'switch3') return value > 0.5 ? 1 : value < -0.5 ? -1 : 0;
  return clamp(value, 0, 1);
}

/** Where a spring-loaded slider rests; null for one that stays put. */
export function sliderRest(spring: RcSliderSpring): number | null {
  return spring === 'min' ? 0 : spring === 'center' ? 0.5 : spring === 'max' ? 1 : null;
}

/** Position before anyone has touched the control. */
export function functionInitial(fn: OperatorRcFunction): number {
  if (fn.kind === 'button') return 0;
  if (fn.kind === 'switch3') return fn.springCenter ? 0 : -1;
  return sliderRest(fn.spring) ?? 0;
}

/** Where the control goes when it is let go; null when it stays where it was put. */
export function functionRest(fn: OperatorRcFunction): number | null {
  if (fn.kind === 'button') return fn.latching ? null : 0;
  if (fn.kind === 'switch3') return fn.springCenter ? 0 : null;
  return sliderRest(fn.spring);
}

export function functionPwm(fn: OperatorRcFunction, value: number): number {
  const v = clampFunctionValue(fn, value);
  if (fn.kind === 'button') return v ? fn.onPwm : fn.offPwm;
  if (fn.kind === 'switch3') return v > 0 ? fn.highPwm : v < 0 ? fn.lowPwm : fn.midPwm;
  return Math.round(fn.minPwm + v * (fn.maxPwm - fn.minPwm));
}

/** A slider without a spring, moved by a stick or two buttons, crosses its travel in this long. */
export const SLIDER_TRAVEL_MS = 1500;

const zone = (a: number) => (a > 0.5 ? 1 : a < -0.5 ? -1 : 0);

/**
 * A function's new position after a joystick reading. Only a CHANGE on the joystick moves
 * it, so the same function can also be worked from the screen without the two fighting.
 * `prev` is the reading before; with none there is nothing to compare, so nothing moves.
 */
export function functionFromPad(fn: OperatorRcFunction, value: number, prev: RcPad | null, next: RcPad, dtMs: number): number {
  const input = fn.input;
  if (input.kind === 'none' || !prev) return value;
  const down = (i: number) => buttonEdge(prev, next, i);
  const up = (i: number) => !pressed(next, i) && pressed(prev, i);
  const axis = (pad: RcPad) => (input.kind === 'axis' ? axisOf(pad, input.index) * (input.reverse ? -1 : 1) : 0);

  if (fn.kind === 'button') {
    if (input.kind === 'button') {
      if (fn.latching) return down(input.index) ? 1 - value : value;
      return down(input.index) ? 1 : up(input.index) ? 0 : value;
    }
    if (input.kind === 'buttons') return down(input.up) ? 1 : down(input.down) ? 0 : value;
    const high = axis(next) > 0.5;
    if (high === axis(prev) > 0.5) return value;
    if (fn.latching) return high ? 1 - value : value;
    return high ? 1 : 0;
  }

  if (fn.kind === 'switch3') {
    if (input.kind === 'button') {
      if (fn.springCenter) return down(input.index) ? 1 : up(input.index) ? 0 : value;
      return down(input.index) ? (value >= 1 ? -1 : value + 1) : value;
    }
    if (input.kind === 'buttons') {
      if (fn.springCenter) {
        const changed = pressed(next, input.up) !== pressed(prev, input.up) || pressed(next, input.down) !== pressed(prev, input.down);
        if (!changed) return value;
        return pressed(next, input.up) ? 1 : pressed(next, input.down) ? -1 : 0;
      }
      return down(input.up) ? Math.min(1, value + 1) : down(input.down) ? Math.max(-1, value - 1) : value;
    }
    const now = zone(axis(next));
    if (now === zone(axis(prev))) return value;
    if (fn.springCenter) return now;
    return now === 0 ? value : clamp(value + now, -1, 1);
  }

  const rest = sliderRest(fn.spring);
  const step = clamp(dtMs, 0, 200) / SLIDER_TRAVEL_MS;
  if (input.kind === 'axis') {
    const a = axis(next);
    if (rest === null) return Math.abs(a) > 0.1 ? clamp(value + a * step, 0, 1) : value;
    if (Math.abs(a - axis(prev)) < 0.005) return value;
    // The stick's own centre is the slider's rest position.
    if (fn.spring === 'center') return clamp((a + 1) / 2, 0, 1);
    return fn.spring === 'min' ? clamp(a, 0, 1) : clamp(1 + a, 0, 1);
  }
  if (input.kind === 'buttons') {
    if (pressed(next, input.up)) return clamp(value + step, 0, 1);
    if (pressed(next, input.down)) return clamp(value - step, 0, 1);
    return rest !== null && (up(input.up) || up(input.down)) ? rest : value;
  }
  if (rest === null) return down(input.index) ? (value > 0.5 ? 0 : 1) : value;
  return down(input.index) ? (rest >= 1 ? 0 : 1) : up(input.index) ? rest : value;
}

// ---- The frame ----------------------------------------------------------------------

export interface RcFunctionRuntime {
  value: number;
  /** The channel is being sent. False until the operator first uses the control. */
  active: boolean;
}

/**
 * One RC_CHANNELS_OVERRIDE frame: every channel is "ignore" except the functions in use
 * and, when given, the two driving channels (which win over a function on the same channel).
 */
export function composeChannels(
  config: OperatorRcConfig,
  functions: ReadonlyMap<string, RcFunctionRuntime>,
  drive: { steerPwm?: number; throttlePwm?: number },
): number[] {
  const out = new Array<number>(RC_CHANNEL_SLOTS).fill(RC_IGNORE);
  for (const fn of config.functions) {
    const runtime = functions.get(fn.id);
    if (runtime?.active) out[fn.channel - 1] = clamp(functionPwm(fn, runtime.value), RC_PWM_MIN, RC_PWM_MAX);
  }
  if (drive.steerPwm !== undefined) out[config.drive.steerChannel - 1] = clamp(drive.steerPwm, RC_PWM_MIN, RC_PWM_MAX);
  if (drive.throttlePwm !== undefined) out[config.drive.throttleChannel - 1] = clamp(drive.throttlePwm, RC_PWM_MIN, RC_PWM_MAX);
  return out;
}

// ---- What the screen is told --------------------------------------------------------

/** Why an action was refused; the screen says it in the operator's language. */
export type RcRefusal = 'disabled' | 'no-joystick' | 'not-centred' | 'not-connected' | 'needs-joystick' | 'moving';

export interface RcActionResult {
  ok: boolean;
  reason?: RcRefusal;
}

export interface RcEngineState {
  /** A joystick is being read right now (a window of the program is in front). */
  padLive: boolean;
  padName: string;
  drive: {
    /** The operator has taken control with the joystick. */
    engaged: boolean;
    /** ...and its sticks are going to the vehicle at this moment. */
    live: boolean;
    steer: number;
    throttle: number;
  };
  reverse: boolean;
  cruise: { on: boolean; value: number };
  functions: Record<string, RcFunctionRuntime>;
  /** The frame last sent (65535 = channel left alone); empty when nothing is being sent. */
  channels: number[];
  /** Why the last frame did not go out, or null. */
  error: string | null;
}

export const IDLE_RC_STATE: RcEngineState = {
  padLive: false,
  padName: '',
  drive: { engaged: false, live: false, steer: 0, throttle: 0 },
  reverse: false,
  cruise: { on: false, value: 0 },
  functions: {},
  channels: [],
  error: null,
};
