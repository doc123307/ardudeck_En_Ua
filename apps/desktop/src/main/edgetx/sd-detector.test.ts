import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { probeVolume } from './sd-detector';

describe('EdgeTX SD card probe', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), 'edgetx-sd-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  const card = (name: string, files: Record<string, string>, dirs: string[] = []) => {
    const vol = path.join(root, name);
    mkdirSync(vol);
    for (const d of dirs) mkdirSync(path.join(vol, d), { recursive: true });
    for (const [f, body] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(vol, f)), { recursive: true });
      writeFileSync(path.join(vol, f), body);
    }
    return vol;
  };

  // A replacement card the radio formatted and wrote its settings to, without the SD pack.
  it('finds a fresh card that only has RADIO/radio.yml', async () => {
    const vol = card('TX16S', { 'RADIO/radio.yml': 'semver: 2.11.2\nboard: tx16s\n' });
    const found = await probeVolume(vol);
    expect(found?.volumeName).toBe('TX16S');
    expect(found?.radioLabel).toBe('RadioMaster TX16S');
  });

  it('still finds an SD-pack card without radio.yml', async () => {
    expect(await probeVolume(card('OLDCARD', {}, ['SCRIPTS', 'RADIO']))).not.toBeNull();
  });

  it('ignores an ordinary USB stick', async () => {
    expect(await probeVolume(card('STICK', { 'notes.txt': 'hi' }, ['Photos']))).toBeNull();
  });
});
