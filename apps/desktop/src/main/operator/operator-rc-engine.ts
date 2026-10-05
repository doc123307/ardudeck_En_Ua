/**
 * Runs the operator's RC control (see shared/operator-rc.ts for the rules) and puts it on
 * the wire as RC_CHANNELS_OVERRIDE, 20 times a second while there is something to send.
 *
 * It lives in the main process on purpose. The operator screen can be spread over several
 * windows, each its own renderer, and only the window in front can read a joystick; here
 * there is one state, one sender and one place that lets go of the vehicle.
 *
 * What it guarantees:
 * - Nothing is sent on a channel until the operator uses its control (or the administrator
 *   asked for "send from connection").
 * - A channel that stops being driven is handed back to the RC receiver, not left frozen.
 * - A joystick that goes quiet (window not in front, cable out) stops the vehicle: neutral
 *   first, then release. Control comes back only with the sticks at the centre.
 */

import {
  DEFAULT_RC_CONFIG, RC_CHANNEL_SLOTS, RC_IGNORE,
  buttonEdge, clampFunctionValue, composeChannels, driveCommand, driveSticks, functionFromPad, functionInitial, functionPwm,
  rcReleaseValue, stickPwm, sticksCentred,
  type DriveSticks, type OperatorRcConfig, type RcActionResult, type RcEngineState, type RcFunctionRuntime, type RcPad,
} from '../../shared/operator-rc.js';

export const RC_TICK_MS = 50;
/** A joystick reading older than this is not a reading. */
const PAD_FRESH_MS = 400;
/** Neutral frames sent before a driving channel is released. */
const NEUTRAL_FRAMES = 5;
/** Release frames per channel: the link may drop one. */
const RELEASE_FRAMES = 3;
/** A servo output set from a dragged slider is sent at most this often. */
const SERVO_MIN_INTERVAL_MS = 150;

export interface RcEngineDeps {
  /** A MAVLink vehicle is connected and may be commanded. */
  linkUp: () => boolean;
  /** Sends one frame of 18 raw channel values. */
  send: (channels: number[]) => Promise<void> | void;
  /** Sets one servo output (MAV_CMD_DO_SET_SERVO), for functions that drive a servo output directly. */
  setServo?: (servo: number, pwm: number) => Promise<void> | void;
  onState?: (state: RcEngineState) => void;
  now?: () => number;
}

export class OperatorRcEngine {
  private config: OperatorRcConfig = structuredClone(DEFAULT_RC_CONFIG);
  private attached = false;
  private pad: RcPad | null = null;
  private padAt = 0;
  private functions = new Map<string, RcFunctionRuntime>();
  private sticks: DriveSticks = { steer: 0, throttle: 0 };
  private driveEngaged = false;
  private driveLive = false;
  /** After a pause the sticks must be seen at the centre before they count again. */
  private needCentre = false;
  private neutralLeft = 0;
  private reverse = false;
  private cruiseOn = false;
  private cruiseValue = 0;
  private wasActive = new Array<boolean>(RC_CHANNEL_SLOTS).fill(false);
  private releaseLeft = new Array<number>(RC_CHANNEL_SLOTS).fill(0);
  private lastFrame: number[] = [];
  /** What each servo-output function last set, keyed by function and output, so a change is sent once. */
  private servoSent = new Map<string, { pwm: number; at: number }>();
  private error: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastEmitted = '';
  private readonly now: () => number;

  constructor(private readonly deps: RcEngineDeps) {
    this.now = deps.now ?? Date.now;
    this.resetFunctions();
  }

  // ---- Configuration and lifetime -------------------------------------------------

  setConfig(config: OperatorRcConfig): void {
    const old = this.functions;
    const oldKinds = new Map(this.config.functions.map((f) => [f.id, f.kind]));
    this.config = config;
    this.functions = new Map();
    for (const fn of config.functions) {
      const kept = oldKinds.get(fn.id) === fn.kind ? old.get(fn.id) : undefined;
      this.functions.set(fn.id, kept
        ? { value: clampFunctionValue(fn, kept.value), active: kept.active }
        : { value: functionInitial(fn), active: this.attached && fn.sendOnConnect });
    }
    if (!config.drive.enabled) this.dropDrive();
    if (!config.cruise.enabled) this.cruiseOn = false;
    if (!config.reverse.enabled) this.reverse = false;
    this.emit();
  }

  private resetFunctions(): void {
    this.functions = new Map(this.config.functions.map((fn) => [
      fn.id, { value: functionInitial(fn), active: this.attached && fn.sendOnConnect },
    ]));
  }

  /** The operator screen is up: the engine may send. */
  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.resetFunctions();
    this.timer ??= setInterval(() => this.tick(), RC_TICK_MS);
    this.emit();
  }

  /** The operator screen is gone: let go of everything. */
  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    this.dropDrive();
    this.cruiseOn = false;
    this.pad = null;
    this.resetFunctions();
    this.emit();
    // The timer stays until the release frames are out; tick() stops it.
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ---- Joystick -------------------------------------------------------------------

  private padFresh(): boolean {
    return this.pad !== null && this.now() - this.padAt < PAD_FRESH_MS;
  }

  /** A reading from the window in front. */
  gamepad(next: RcPad): void {
    if (!this.attached) return;
    const now = this.now();
    // After a gap the previous reading says nothing about what was pressed meanwhile.
    const prev = this.padFresh() ? this.pad : null;
    const dt = prev ? now - this.padAt : 0;
    this.pad = next;
    this.padAt = now;
    this.sticks = driveSticks(this.config.drive, next);
    if (!prev) return;

    for (const fn of this.config.functions) {
      const runtime = this.functions.get(fn.id);
      if (!runtime) continue;
      const value = functionFromPad(fn, runtime.value, prev, next, dt);
      if (value !== runtime.value) this.functions.set(fn.id, { value, active: true });
    }
    const { drive, cruise, reverse } = this.config;
    if (buttonEdge(prev, next, drive.engageButton)) this.setDrive(!this.driveEngaged);
    if (buttonEdge(prev, next, cruise.toggleButton)) this.setCruise(!this.cruiseOn);
    if (buttonEdge(prev, next, cruise.upButton)) this.adjustCruise(1);
    if (buttonEdge(prev, next, cruise.downButton)) this.adjustCruise(-1);
    if (buttonEdge(prev, next, reverse.toggleButton)) this.setReverse(!this.reverse);
  }

  // ---- Operator actions -----------------------------------------------------------

  setFunction(id: string, value: number): RcActionResult {
    const fn = this.config.functions.find((f) => f.id === id);
    if (!fn || !this.attached) return { ok: false, reason: 'disabled' };
    this.functions.set(id, { value: clampFunctionValue(fn, value), active: true });
    this.emit();
    return { ok: true };
  }

  setDrive(on: boolean): RcActionResult {
    if (!on) {
      this.dropDrive();
      this.emit();
      return { ok: true };
    }
    if (!this.config.drive.enabled || !this.attached) return { ok: false, reason: 'disabled' };
    if (!this.padFresh()) return { ok: false, reason: 'no-joystick' };
    if (!sticksCentred(this.sticks)) return { ok: false, reason: 'not-centred' };
    this.driveEngaged = true;
    this.needCentre = false;
    this.emit();
    return { ok: true };
  }

  private dropDrive(): void {
    if (this.driveLive) this.neutralLeft = NEUTRAL_FRAMES;
    this.driveEngaged = false;
    this.driveLive = false;
    this.needCentre = false;
    this.reverse = false;
    this.cruiseOn = false;
  }

  /** Reverse driving swaps the sticks' sense, so it only switches with the vehicle at rest. */
  setReverse(on: boolean): RcActionResult {
    if (!on) {
      if (this.reverse && this.moving()) return { ok: false, reason: 'moving' };
      this.reverse = false;
      this.emit();
      return { ok: true };
    }
    if (!this.config.reverse.enabled || !this.attached) return { ok: false, reason: 'disabled' };
    if (!this.driveEngaged) return { ok: false, reason: 'needs-joystick' };
    if (this.moving()) return { ok: false, reason: 'moving' };
    this.reverse = true;
    this.emit();
    return { ok: true };
  }

  private moving(): boolean {
    return (this.cruiseOn && this.cruiseValue > 0.02) || (this.driveLive && !sticksCentred({ steer: 0, throttle: this.sticks.throttle }));
  }

  setCruise(on: boolean): RcActionResult {
    if (!on) {
      this.cruiseOn = false;
      this.emit();
      return { ok: true };
    }
    if (!this.config.cruise.enabled || !this.attached) return { ok: false, reason: 'disabled' };
    if (!this.deps.linkUp()) return { ok: false, reason: 'not-connected' };
    // The joystick is the operator's but is not being read: there would be no way to brake.
    if (this.driveEngaged && !this.driveLive) return { ok: false, reason: 'no-joystick' };
    // With the joystick in hand cruise takes over the speed it is holding now; from the
    // screen alone it starts at a standstill and is raised with "+".
    this.cruiseValue = this.driveLive ? Math.min(1, Math.max(0, this.sticks.throttle)) : 0;
    this.cruiseOn = true;
    this.emit();
    return { ok: true };
  }

  adjustCruise(direction: number): RcActionResult {
    if (!this.cruiseOn) return { ok: false, reason: 'disabled' };
    const step = this.config.cruise.stepPercent / 100;
    this.cruiseValue = Math.min(1, Math.max(0, Math.round((this.cruiseValue + Math.sign(direction) * step) * 1000) / 1000));
    this.emit();
    return { ok: true };
  }

  /** STOP, disarm, link lost: nothing keeps the throttle open. */
  stop(): void {
    if (!this.cruiseOn) return;
    this.cruiseOn = false;
    this.emit();
  }

  // ---- The loop ---------------------------------------------------------------------

  tick(): void {
    if (!this.deps.linkUp()) {
      // Nothing can be released over a dead link; the vehicle times the override out itself.
      this.wasActive.fill(false);
      this.releaseLeft.fill(0);
      this.neutralLeft = 0;
      this.cruiseOn = false;
      this.lastFrame = [];
      this.error = null;
      // A vehicle that comes back may have rebooted: its servo outputs are set again.
      this.servoSent.clear();
      if (this.driveLive || this.driveEngaged) { this.driveLive = false; this.needCentre = this.driveEngaged; }
      this.stopTimerIfIdle();
      this.emit();
      return;
    }

    const fresh = this.padFresh();
    if (this.driveEngaged) {
      if (!fresh) {
        if (this.driveLive) this.neutralLeft = NEUTRAL_FRAMES;
        this.driveLive = false;
        this.needCentre = true;
        this.cruiseOn = false;
      } else if (this.needCentre) {
        if (sticksCentred(this.sticks)) this.needCentre = false;
      }
      if (fresh && !this.needCentre) this.driveLive = true;
    }

    const { drive } = this.config;
    const out: { steerPwm?: number; throttlePwm?: number } = {};
    const limit = drive.throttleLimit / 100;
    if (this.driveLive) {
      const command = driveCommand(this.sticks, {
        reverse: this.reverse,
        invertSteering: this.config.reverse.invertSteering,
        invertThrottle: this.config.reverse.invertThrottle,
        cruiseOn: this.cruiseOn,
        cruiseValue: this.cruiseValue,
      });
      if (command.cruiseCancelled) this.cruiseOn = false;
      out.steerPwm = stickPwm(command.steer, drive.pwmMin, drive.pwmTrim, drive.pwmMax);
      out.throttlePwm = stickPwm(command.throttle * limit, drive.pwmMin, drive.pwmTrim, drive.pwmMax);
    } else if (this.neutralLeft > 0) {
      this.neutralLeft -= 1;
      out.steerPwm = drive.pwmTrim;
      out.throttlePwm = drive.pwmTrim;
    } else if (this.cruiseOn && !this.driveEngaged) {
      // Cruise from the screen, steering left to the RC transmitter.
      out.throttlePwm = stickPwm(this.cruiseValue * limit, drive.pwmMin, drive.pwmTrim, drive.pwmMax);
    }

    this.sendServos();

    const frame = composeChannels(this.config, this.attached ? this.functions : new Map(), out, this.reverse);
    let anything = false;
    for (let i = 0; i < RC_CHANNEL_SLOTS; i++) {
      const active = frame[i] !== RC_IGNORE;
      if (active) {
        this.releaseLeft[i] = 0;
      } else {
        if (this.wasActive[i]) this.releaseLeft[i] = RELEASE_FRAMES;
        if (this.releaseLeft[i]! > 0) {
          this.releaseLeft[i]! -= 1;
          frame[i] = rcReleaseValue(i);
        }
      }
      this.wasActive[i] = active;
      if (frame[i] !== RC_IGNORE) anything = true;
    }

    if (anything) {
      this.lastFrame = frame;
      const failed = (e: unknown) => { this.error = e instanceof Error ? e.message : String(e); };
      try {
        const sent = this.deps.send(frame);
        if (sent) sent.then(() => { this.error = null; }, failed);
        else this.error = null;
      } catch (e) {
        failed(e);
      }
    } else {
      this.lastFrame = [];
      this.stopTimerIfIdle();
    }
    this.emit();
  }

  /** Servo-output functions are set once per change (the flight controller holds the output). */
  private sendServos(): void {
    if (!this.attached || !this.deps.setServo) return;
    const now = this.now();
    for (const fn of this.config.functions) {
      if (fn.output !== 'servo') continue;
      const runtime = this.functions.get(fn.id);
      if (!runtime?.active) continue;
      const pwm = functionPwm(fn, runtime.value);
      const key = `${fn.id}:${fn.channel}`;
      const last = this.servoSent.get(key);
      if (last?.pwm === pwm || (last && now - last.at < SERVO_MIN_INTERVAL_MS)) continue;
      this.servoSent.set(key, { pwm, at: now });
      const failed = (e: unknown) => { this.error = e instanceof Error ? e.message : String(e); this.servoSent.delete(key); };
      try {
        const sent = this.deps.setServo(fn.channel, pwm);
        if (sent) sent.then(undefined, failed);
      } catch (e) {
        failed(e);
      }
    }
  }

  private stopTimerIfIdle(): void {
    if (this.attached || !this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  // ---- State ------------------------------------------------------------------------

  state(): RcEngineState {
    const round = (v: number) => Math.round(v * 50) / 50;
    return {
      padLive: this.padFresh(),
      padName: this.pad?.id ?? '',
      drive: { engaged: this.driveEngaged, live: this.driveLive, steer: round(this.sticks.steer), throttle: round(this.sticks.throttle) },
      reverse: this.reverse,
      cruise: { on: this.cruiseOn, value: this.cruiseValue },
      functions: Object.fromEntries([...this.functions].map(([id, f]) => [id, { value: Math.round(f.value * 1000) / 1000, active: f.active }])),
      channels: this.lastFrame,
      error: this.error,
    };
  }

  private emit(): void {
    if (!this.deps.onState) return;
    const state = this.state();
    const key = JSON.stringify(state);
    if (key === this.lastEmitted) return;
    this.lastEmitted = key;
    this.deps.onState(state);
  }
}
