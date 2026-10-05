/**
 * This PC's code: a short fingerprint of things that stay the same on one computer and
 * differ on another - the operating system's own machine id and the model of the board.
 * Network addresses and disks are left out on purpose: a VPN adapter or a new drive must
 * not ask for a new key.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cpus, hostname } from 'node:os';
import { LICENSE_ALPHABET, MACHINE_CODE_LENGTH } from '../../shared/license-types.js';

const run = (file: string, args: string[]): string => {
  try {
    return execFileSync(file, args, { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};

const readText = (path: string): string => {
  try { return readFileSync(path, 'utf8').trim(); } catch { return ''; }
};

/** `reg query` output: the value of one name. */
export function regValue(output: string, name: string): string {
  const line = output.split(/\r?\n/).find((l) => new RegExp(`^\\s*${name}\\s+REG_`, 'i').test(l));
  return line ? line.replace(/^\s*\S+\s+REG_\S+\s*/, '').trim() : '';
}

/** What identifies this computer, per platform. Empty strings where a part cannot be read. */
export function machineFacts(platform: NodeJS.Platform = process.platform): string[] {
  if (platform === 'win32') {
    const system32 = `${process.env['SystemRoot'] ?? 'C:\\Windows'}\\System32\\reg.exe`;
    const guid = regValue(run(system32, ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64']), 'MachineGuid');
    const bios = run(system32, ['query', 'HKLM\\HARDWARE\\DESCRIPTION\\System\\BIOS']);
    return [guid, regValue(bios, 'SystemProductName'), regValue(bios, 'BaseBoardProduct')];
  }
  if (platform === 'darwin') {
    const uuid = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(run('/usr/sbin/ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']))?.[1] ?? '';
    return [uuid];
  }
  return [
    readText('/etc/machine-id') || readText('/var/lib/dbus/machine-id'),
    readText('/sys/class/dmi/id/product_name'),
    readText('/sys/class/dmi/id/board_name'),
  ];
}

/** Facts to the code shown to the user: 20 characters in four groups. */
export function machineCodeOf(facts: string[]): string {
  const digest = createHash('sha256').update(`stohid-pc-v1|${facts.map((f) => f.trim().toLowerCase()).join('|')}`).digest();
  let bits = 0;
  let acc = 0;
  let out = '';
  for (const byte of digest) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < MACHINE_CODE_LENGTH) {
      out += LICENSE_ALPHABET[(acc >> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
  }
  return out.match(/.{5}/g)!.join('-');
}

let cached: string | null = null;

export function machineCode(): string {
  if (cached) return cached;
  const facts = machineFacts();
  // A system that would not give its id still must not share one code with every other such system.
  if (!facts[0]) facts.push(hostname(), cpus()[0]?.model ?? '');
  cached = machineCodeOf(facts);
  return cached;
}
