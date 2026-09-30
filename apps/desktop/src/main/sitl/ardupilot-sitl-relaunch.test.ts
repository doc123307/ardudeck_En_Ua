/**
 * Relaunching SITL at a new simulated take-off point.
 *
 * `-O<lat,lng,alt,hdg>` on SITL's command line outranks the SIM_OPOS_* params,
 * so the sim handover endpoint moves the origin by respawning the process with
 * a fresh `-O`. These tests pin the two things that go wrong silently: the argv
 * the new process is actually given, and what the renderer is told about it.
 *
 * A fake binary stands in for SITL. It records its own argv and pid and then
 * sleeps, so the spawn, the kill and the respawn are all real.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtemp, writeFile, readFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tmp = await mkdtemp(path.join(tmpdir(), 'sitl-relaunch-'));
const ARGV_LOG = path.join(tmp, 'argv.log');
const FAKE_BIN = path.join(tmp, 'arducopter');

vi.mock('electron', () => ({
  app: { getPath: () => tmp },
  BrowserWindow: class {},
}));

vi.mock('electron-store', () => ({
  default: class {
    get() {
      return {};
    }
    set() {}
  },
}));

vi.mock('./ardupilot-sitl-downloader.js', () => ({
  ardupilotSitlDownloader: { getBinaryPath: () => FAKE_BIN },
}));

vi.mock('../sim/sim-engine-process.js', () => ({
  simEngineProcess: {
    isBinaryAvailable: () => true,
    start: async () => ({ success: true, wsPort: 9020 }),
    stop: () => {},
    get wsPort() {
      return 9020;
    },
  },
}));

// reapStaleSitl shells out to lsof and would SIGKILL whatever holds TCP 5760 on
// this machine, which during development is the developer's own live SITL.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    default: actual,
    execFile: (_file: unknown, _args: unknown, cb: (e: Error) => void) => {
      cb(new Error('lsof disabled in test'));
    },
  };
});

const { ardupilotSitlProcess } = await import('./ardupilot-sitl-process.js');
const { IPC_CHANNELS } = await import('../../shared/ipc-channels.js');
import type { ArduPilotSitlConfig } from '../../shared/ipc-channels.js';

const ARDUDECK_HOME = { lat: 42.4411, lng: 19.2632, alt: 47, heading: 0 };
const GAME_REGION_HOME = { lat: 42.272228, lng: 19.123764, alt: 1.569, heading: 0 };

const BASE_CONFIG = {
  vehicleType: 'copter',
  model: 'quad',
  releaseTrack: 'stable',
  homeLocation: ARDUDECK_HOME,
  useArduDeckSim: true,
} as ArduPilotSitlConfig;

/** Every IPC push the manager made, in order. */
const sent: Array<{ channel: string; data: unknown }> = [];

function attachFakeWindow(): void {
  ardupilotSitlProcess.setMainWindow({
    isDestroyed: () => false,
    webContents: {
      send: (channel: string, data: unknown) => {
        sent.push({ channel, data });
      },
    },
  } as unknown as Parameters<typeof ardupilotSitlProcess.setMainWindow>[0]);
}

function pushes(channel: string): unknown[] {
  return sent.filter((s) => s.channel === channel).map((s) => s.data);
}

/** The `-O` argument of each spawn the fake binary recorded, oldest first. */
async function spawnedOrigins(): Promise<string[]> {
  const log = await readFile(ARGV_LOG, 'utf-8').catch(() => '');
  return log
    .split('\n')
    .filter((l) => l.startsWith('ARG -O'))
    .map((l) => l.slice('ARG '.length));
}

const settle = (ms = 400) => new Promise((r) => setTimeout(r, ms));

const FAKE_BIN_SCRIPT = `#!/bin/sh
{
  echo "--- PID $$"
  for a in "$@"; do echo "ARG $a"; done
} >> "${ARGV_LOG}"
exec sleep 300
`;

async function installFakeBin(): Promise<void> {
  await writeFile(FAKE_BIN, FAKE_BIN_SCRIPT, 'utf-8');
  await chmod(FAKE_BIN, 0o755);
}

/**
 * Wait until `count` spawns have recorded themselves. start() resolves as soon
 * as the child is forked, well before the shell has run, so a fixed sleep here
 * loses the first argv on a loaded machine and the test reads as a regression.
 */
async function waitForSpawns(count: number, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const log = await readFile(ARGV_LOG, 'utf-8').catch(() => '');
    if ((log.match(/^--- PID /gm) ?? []).length >= count) return;
    if (Date.now() >= deadline) throw new Error(`only ${log} recorded, wanted ${count} spawns`);
    await settle(50);
  }
}

beforeAll(installFakeBin);

beforeEach(async () => {
  sent.length = 0;
  await rm(ARGV_LOG, { force: true });
  attachFakeWindow();
});

afterAll(async () => {
  ardupilotSitlProcess.stop();
  await settle(200);
  await rm(tmp, { recursive: true, force: true });
});

// The fake SITL is a `#!/bin/sh` script, which Windows cannot exec, so a spawn there dies at once
// and every assertion about argv and exits would be testing that instead.
describe.skipIf(process.platform === 'win32')('relaunchWithHome', () => {
  it('respawns with the requested take-off point in argv', async () => {
    expect((await ardupilotSitlProcess.start(BASE_CONFIG)).success).toBe(true);
    const firstPid = ardupilotSitlProcess.getStatus().pid;
    await waitForSpawns(1);

    const res = await ardupilotSitlProcess.relaunchWithHome(GAME_REGION_HOME);
    expect(res.success).toBe(true);
    await waitForSpawns(2);

    // The `-O` has to be rebuilt from the new home. Reusing the command line
    // built at first start would carry the old origin forward and the take-off
    // point would never move, which is invisible from outside the process.
    expect(await spawnedOrigins()).toEqual([
      '-O42.4411,19.2632,47,0',
      '-O42.272228,19.123764,1.569,0',
    ]);
    expect(ardupilotSitlProcess.getStatus().pid).not.toBe(firstPid);
    expect(ardupilotSitlProcess.isRunning).toBe(true);
    expect(ardupilotSitlProcess.currentConfig?.homeLocation).toEqual(GAME_REGION_HOME);

    ardupilotSitlProcess.stop();
    await settle(200);
  }, 30_000);

  it('tells the renderer the new take-off point and that SITL is back', async () => {
    await ardupilotSitlProcess.start(BASE_CONFIG);
    sent.length = 0;

    await ardupilotSitlProcess.relaunchWithHome(GAME_REGION_HOME);
    await settle();

    const started = pushes(IPC_CHANNELS.ARDUPILOT_SITL_STARTED);
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({
      homeLocation: GAME_REGION_HOME,
      vehicleType: 'copter',
      wasRelaunch: true,
    });

    // The kill that precedes the respawn must not read as SITL stopping.
    const exits = pushes(IPC_CHANNELS.ARDUPILOT_SITL_EXIT);
    expect(exits).toHaveLength(1);
    expect(exits[0]).toMatchObject({ relaunching: true });

    ardupilotSitlProcess.stop();
    await settle(200);
  }, 30_000);

  it('marks an unexpected death as not a relaunch', async () => {
    await ardupilotSitlProcess.start(BASE_CONFIG);
    sent.length = 0;

    // Kill it the way a crash would, with no relaunch in progress.
    process.kill(ardupilotSitlProcess.getStatus().pid!, 'SIGKILL');
    for (let i = 0; i < 100 && pushes(IPC_CHANNELS.ARDUPILOT_SITL_EXIT).length === 0; i++) {
      await settle(50);
    }

    const exits = pushes(IPC_CHANNELS.ARDUPILOT_SITL_EXIT) as Array<{ relaunching?: boolean }>;
    expect(exits).toHaveLength(1);
    expect(exits[0]?.relaunching).toBeFalsy();
    expect(ardupilotSitlProcess.isRunning).toBe(false);
    expect(pushes(IPC_CHANNELS.ARDUPILOT_SITL_STARTED)).toHaveLength(0);
  }, 30_000);

  it('reports SITL as down when the relaunch cannot spawn', async () => {
    await ardupilotSitlProcess.start(BASE_CONFIG);
    sent.length = 0;

    // Take the binary away so the respawn fails its existence check. The old
    // process is already dead by then, so the renderer must be told plainly.
    await rm(FAKE_BIN, { force: true });
    try {
      const res = await ardupilotSitlProcess.relaunchWithHome(GAME_REGION_HOME);
      expect(res.success).toBe(false);
      await settle(200);

      expect(pushes(IPC_CHANNELS.ARDUPILOT_SITL_STARTED)).toHaveLength(0);
      const errors = pushes(IPC_CHANNELS.ARDUPILOT_SITL_ERROR) as string[];
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/relaunch/i);
      expect(ardupilotSitlProcess.isRunning).toBe(false);
    } finally {
      await installFakeBin();
    }
  }, 30_000);
});

describe('start', () => {
  it('pushes the running config on an ordinary cold start too', async () => {
    await ardupilotSitlProcess.start(BASE_CONFIG);
    await settle(200);

    const started = pushes(IPC_CHANNELS.ARDUPILOT_SITL_STARTED);
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ homeLocation: ARDUDECK_HOME, wasRelaunch: false });

    ardupilotSitlProcess.stop();
    await settle(200);
  }, 30_000);
});
