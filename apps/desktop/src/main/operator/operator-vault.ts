/**
 * Operator mode on the main-process side: who may see the full UI.
 *
 * - The administrator password is kept as a salted scrypt hash in its own file
 *   (`operator-admin.json`); deleting that file is the support reset procedure.
 * - The operator screen settings live in `operator.json` and only change while
 *   the administrator is in.
 * - The unlocked state is per run of the app and is held here, not in the
 *   renderer, so reloading the window does not hand out the full UI.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  normalizeOperatorConfig,
  type AdminAuthResult,
  type OperatorConfig,
  type OperatorState,
} from '../../shared/operator-types';

const KEY_LENGTH = 64;
/** Wrong passwords accepted before a pause; the pause doubles each time up to the cap. */
const FREE_ATTEMPTS = 5;
const FIRST_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 5 * 60_000;

interface StoredPassword {
  salt: string;
  hash: string;
}

function hashPassword(password: string, salt: Buffer): Buffer {
  return scryptSync(password.normalize('NFKC'), salt, KEY_LENGTH);
}

function readJson(path: string): unknown {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  } catch {
    return null;
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8');
}

export class OperatorVault {
  private readonly passwordPath: string;
  private readonly configPath: string;
  private config: OperatorConfig;
  private stored: StoredPassword | null;
  private unlocked: boolean;
  private failures = 0;
  private lockedUntil = 0;

  constructor(dir: string, private readonly now: () => number = Date.now) {
    this.passwordPath = join(dir, 'operator-admin.json');
    this.configPath = join(dir, 'operator.json');
    this.config = normalizeOperatorConfig(readJson(this.configPath));
    this.stored = this.readStored();
    // A service PC may be set to open in the full UI; everyone else starts as the operator.
    this.unlocked = !this.config.startInOperatorMode;
  }

  private readStored(): StoredPassword | null {
    const raw = readJson(this.passwordPath) as Partial<StoredPassword> | null;
    return raw && typeof raw.salt === 'string' && typeof raw.hash === 'string' && raw.hash.length === KEY_LENGTH * 2
      ? { salt: raw.salt, hash: raw.hash }
      : null;
  }

  state(): OperatorState {
    return { mode: this.unlocked ? 'admin' : 'operator', hasPassword: this.stored !== null, config: this.config };
  }

  private result(ok: boolean, extra: Partial<AdminAuthResult> = {}): AdminAuthResult {
    return { ok, ...extra, state: this.state() };
  }

  private matches(password: string): boolean {
    if (!this.stored) return false;
    const expected = Buffer.from(this.stored.hash, 'hex');
    const actual = hashPassword(password, Buffer.from(this.stored.salt, 'hex'));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  /** Checks a password against the stored one, counting failures towards a lock-out. */
  private check(password: string): AdminAuthResult | null {
    const wait = this.lockedUntil - this.now();
    if (wait > 0) return this.result(false, { error: 'locked-out', retryAfterMs: wait });
    if (this.matches(password)) {
      this.failures = 0;
      return null;
    }
    this.failures += 1;
    if (this.failures >= FREE_ATTEMPTS) {
      const lockout = Math.min(MAX_LOCKOUT_MS, FIRST_LOCKOUT_MS * 2 ** (this.failures - FREE_ATTEMPTS));
      this.lockedUntil = this.now() + lockout;
      return this.result(false, { error: 'locked-out', retryAfterMs: lockout });
    }
    return this.result(false, { error: 'wrong-password', attemptsLeft: FREE_ATTEMPTS - this.failures });
  }

  private store(password: string): boolean {
    const salt = randomBytes(16);
    const next = { salt: salt.toString('hex'), hash: hashPassword(password, salt).toString('hex') };
    try {
      writeJson(this.passwordPath, next);
    } catch {
      return false;
    }
    this.stored = next;
    return true;
  }

  /** Opens the full UI. */
  unlock(password: string): AdminAuthResult {
    if (!this.stored) return this.result(false, { error: 'not-allowed' });
    const failed = this.check(password);
    if (failed) return failed;
    this.unlocked = true;
    return this.result(true);
  }

  /** First run only: whoever sets the app up creates the password, and is let in. */
  createPassword(password: string): AdminAuthResult {
    if (this.stored) return this.result(false, { error: 'not-allowed' });
    if (password.length < ADMIN_PASSWORD_MIN_LENGTH) return this.result(false, { error: 'too-short' });
    if (!this.store(password)) return this.result(false, { error: 'storage' });
    this.unlocked = true;
    return this.result(true);
  }

  /** Needs the full UI to be open and the current password. */
  changePassword(current: string, next: string): AdminAuthResult {
    if (!this.unlocked || !this.stored) return this.result(false, { error: 'not-allowed' });
    if (next.length < ADMIN_PASSWORD_MIN_LENGTH) return this.result(false, { error: 'too-short' });
    const failed = this.check(current);
    if (failed) return failed;
    if (!this.store(next)) return this.result(false, { error: 'storage' });
    return this.result(true);
  }

  /** Back to the operator screen. */
  lock(): OperatorState {
    this.unlocked = false;
    return this.state();
  }

  /** Operator screen settings: administrator only. */
  setConfig(patch: unknown): AdminAuthResult {
    if (!this.unlocked) return this.result(false, { error: 'not-allowed' });
    const next = normalizeOperatorConfig({ ...this.config, ...(patch && typeof patch === 'object' ? patch : {}) });
    try {
      writeJson(this.configPath, next);
    } catch {
      return this.result(false, { error: 'storage' });
    }
    this.config = next;
    return this.result(true);
  }
}
