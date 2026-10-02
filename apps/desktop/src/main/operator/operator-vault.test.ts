import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OperatorVault } from './operator-vault';

// Test-only values; nothing here is a real credential.
const PASSWORD = 'bench-admin-1';
const OTHER = 'bench-admin-2';

let dir: string;
let clock: number;
const now = () => clock;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'stohid-operator-'));
  clock = 1_000_000;
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('first run', () => {
  it('opens as the operator with no password yet', () => {
    const state = new OperatorVault(dir, now).state();
    expect(state.mode).toBe('operator');
    expect(state.hasPassword).toBe(false);
    expect(state.config.startInOperatorMode).toBe(true);
  });

  it('lets the installer create the password and opens the full UI', () => {
    const vault = new OperatorVault(dir, now);
    expect(vault.createPassword('short').error).toBe('too-short');
    const created = vault.createPassword(PASSWORD);
    expect(created.ok).toBe(true);
    expect(created.state).toMatchObject({ mode: 'admin', hasPassword: true });
  });

  it('does not let a second "first run" replace an existing password', () => {
    const vault = new OperatorVault(dir, now);
    vault.createPassword(PASSWORD);
    vault.lock();
    expect(vault.createPassword(OTHER).error).toBe('not-allowed');
    expect(vault.unlock(OTHER).ok).toBe(false);
    expect(vault.unlock(PASSWORD).ok).toBe(true);
  });
});

describe('stored password', () => {
  it('is kept as a salted hash, never as text', () => {
    new OperatorVault(dir, now).createPassword(PASSWORD);
    const file = readFileSync(join(dir, 'operator-admin.json'), 'utf8');
    expect(file).not.toContain(PASSWORD);
    expect(JSON.parse(file)).toMatchObject({ salt: expect.stringMatching(/^[0-9a-f]{32}$/), hash: expect.stringMatching(/^[0-9a-f]{128}$/) });
  });

  it('survives a restart, and the app starts locked again', () => {
    new OperatorVault(dir, now).createPassword(PASSWORD);
    const restarted = new OperatorVault(dir, now);
    expect(restarted.state()).toMatchObject({ mode: 'operator', hasPassword: true });
    expect(restarted.unlock(PASSWORD).state.mode).toBe('admin');
  });

  it('treats a damaged password file as "no password", the support reset', () => {
    new OperatorVault(dir, now).createPassword(PASSWORD);
    writeFileSync(join(dir, 'operator-admin.json'), '{ not json');
    expect(new OperatorVault(dir, now).state().hasPassword).toBe(false);
  });
});

describe('wrong passwords', () => {
  it('counts down the attempts, then makes the caller wait, longer each time', () => {
    const vault = new OperatorVault(dir, now);
    vault.createPassword(PASSWORD);
    vault.lock();

    for (let left = 4; left >= 1; left--) {
      expect(vault.unlock(OTHER)).toMatchObject({ ok: false, error: 'wrong-password', attemptsLeft: left });
    }
    expect(vault.unlock(OTHER)).toMatchObject({ ok: false, error: 'locked-out', retryAfterMs: 30_000 });
    // Even the right password waits out the pause.
    expect(vault.unlock(PASSWORD)).toMatchObject({ ok: false, error: 'locked-out' });

    clock += 30_001;
    expect(vault.unlock(OTHER)).toMatchObject({ error: 'locked-out', retryAfterMs: 60_000 });
    clock += 60_001;
    expect(vault.unlock(PASSWORD).ok).toBe(true);

    // A success clears the count.
    vault.lock();
    expect(vault.unlock(OTHER)).toMatchObject({ error: 'wrong-password', attemptsLeft: 4 });
  });
});

describe('administrator only', () => {
  it('refuses settings and password changes from the operator screen', () => {
    const vault = new OperatorVault(dir, now);
    vault.createPassword(PASSWORD);
    vault.lock();
    expect(vault.setConfig({ allowArm: false }).error).toBe('not-allowed');
    expect(vault.changePassword(PASSWORD, OTHER).error).toBe('not-allowed');
    expect(vault.state().config.allowArm).toBe(true);
  });

  it('saves settings, cleans them up and keeps them across a restart', () => {
    const vault = new OperatorVault(dir, now);
    vault.createPassword(PASSWORD);
    const saved = vault.setConfig({ allowArm: false, modeButtons: ['rtl', 'hold', 'bogus'], tiltWarnDeg: 40, tiltLimitDeg: 30, autoLockMinutes: 9999 });
    expect(saved.ok).toBe(true);
    const config = new OperatorVault(dir, now).state().config;
    expect(config).toMatchObject({ allowArm: false, modeButtons: ['rtl'], tiltWarnDeg: 40, tiltLimitDeg: 40, autoLockMinutes: 240 });
  });

  it('changes the password only with the current one', () => {
    const vault = new OperatorVault(dir, now);
    vault.createPassword(PASSWORD);
    expect(vault.changePassword(OTHER, OTHER).error).toBe('wrong-password');
    expect(vault.changePassword(PASSWORD, OTHER).ok).toBe(true);
    vault.lock();
    expect(vault.unlock(PASSWORD).ok).toBe(false);
    expect(vault.unlock(OTHER).ok).toBe(true);
  });

  it('opens straight into the full UI on a PC set up that way', () => {
    const vault = new OperatorVault(dir, now);
    vault.createPassword(PASSWORD);
    vault.setConfig({ startInOperatorMode: false });
    expect(new OperatorVault(dir, now).state().mode).toBe('admin');
  });
});

describe('operator screen layout settings', () => {
  it('keeps only known status values and elements, each once, in the order given', () => {
    const vault = new OperatorVault(dir, now);
    vault.createPassword(PASSWORD);
    vault.setConfig({ statusFields: ['speed', 'mode', 'bogus', 'speed', 'clock'], hiddenElements: ['map', 'nope', 'map'] });
    const config = new OperatorVault(dir, now).state().config;
    expect(config.statusFields).toEqual(['speed', 'mode', 'clock']);
    expect(config.hiddenElements).toEqual(['map']);
  });

  it('lets the administrator empty the status strip, and falls back to the default on a damaged value', () => {
    const vault = new OperatorVault(dir, now);
    vault.createPassword(PASSWORD);
    vault.setConfig({ statusFields: [] });
    expect(vault.state().config.statusFields).toEqual([]);
    writeFileSync(join(dir, 'operator.json'), JSON.stringify({ statusFields: 'everything' }));
    expect(new OperatorVault(dir, now).state().config.statusFields).toEqual(['mode', 'satellites', 'battery', 'uptime', 'speed', 'roll', 'pitch']);
  });
});
