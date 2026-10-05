import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { LicenseService, readLicenseKey } from './license-service';
import { machineCodeOf, regValue } from './machine-id';
import { normalizeMachineCode } from '../../shared/license-types';

// The key generator's own code makes the keys here: the two halves must agree.
const core = createRequire(import.meta.url)('../../../../keygen/lib/license-core.cjs') as {
  generateKeyPair: () => { publicKey: string; privateKey: string };
  issueLicense: (privateKey: string, data: { machine: string; owner?: string; vehicles?: string[]; id?: string; issued?: number }) => string;
  normalizeMachineCode: (text: string) => string | null;
};

const vendor = core.generateKeyPair();
const stranger = core.generateKeyPair();
const thisPc = machineCodeOf(['guid-1', 'Latitude 5420', '0XYZ']);
const otherPc = machineCodeOf(['guid-2', 'Latitude 5420', '0XYZ']);

describe('the PC code', () => {
  it('is 20 characters in four groups, the same for the same computer and different for another', () => {
    expect(thisPc).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/);
    expect(machineCodeOf(['GUID-1 ', 'latitude 5420', '0xyz'])).toBe(thisPc);
    expect(otherPc).not.toBe(thisPc);
  });

  it('is read back however it was typed', () => {
    const sloppy = thisPc.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
    expect(normalizeMachineCode(sloppy)).toBe(thisPc);
    expect(core.normalizeMachineCode(sloppy)).toBe(thisPc);
    expect(normalizeMachineCode('ABCDE-12345')).toBeNull();
    expect(normalizeMachineCode(`${thisPc.slice(0, -1)}U`)).toBeNull();
  });

  it('takes a value out of reg.exe output', () => {
    const out = '\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography\r\n    MachineGuid    REG_SZ    1b2c3d4e-aaaa-bbbb-cccc-0123456789ab\r\n\r\n';
    expect(regValue(out, 'MachineGuid')).toBe('1b2c3d4e-aaaa-bbbb-cccc-0123456789ab');
    expect(regValue(out, 'Missing')).toBe('');
  });
});

describe('a licence key', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'stohid-lic-')); });
  const key = (machine = thisPc) => core.issueLicense(vendor.privateKey, { machine, owner: 'Тестовий підрозділ', vehicles: ['20990101-0002', '20990101-0002', ' 20990101-0007 '], id: 'k1', issued: 1_760_000_000_000 });

  it('carries who it is for and which vehicles', () => {
    expect(readLicenseKey(vendor.publicKey, key())).toEqual({ id: 'k1', machine: thisPc, owner: 'Тестовий підрозділ', vehicles: ['20990101-0002', '20990101-0007'], issued: 1_760_000_000_000 });
  });

  it('activates the copy on its own PC, once: the next start needs nothing', () => {
    const first = new LicenseService(dir, thisPc, vendor.publicKey, true);
    expect(first.status()).toMatchObject({ required: true, licensed: false, machineCode: thisPc });
    // Pasted with line breaks from a messenger.
    const pasted = key().replace(/(.{40})/g, '$1\n');
    const result = first.activate(pasted);
    expect(result).toMatchObject({ ok: true, error: null });
    expect(result.status).toMatchObject({ licensed: true, owner: 'Тестовий підрозділ', id: 'k1' });
    expect(new LicenseService(dir, thisPc, vendor.publicKey, true).licensed).toBe(true);
  });

  it('does not work on another PC, even with the key file copied over', () => {
    new LicenseService(dir, thisPc, vendor.publicKey, true).activate(key());
    const copied = new LicenseService(dir, otherPc, vendor.publicKey, true);
    expect(copied.licensed).toBe(false);
    expect(copied.activate(key())).toMatchObject({ ok: false, error: 'machine' });
  });

  it('is refused when it is forged, altered or not a key at all', () => {
    const service = new LicenseService(dir, thisPc, vendor.publicKey, true);
    expect(service.activate(core.issueLicense(stranger.privateKey, { machine: thisPc }))).toMatchObject({ ok: false, error: 'signature' });
    const [prefix, body, signature] = key(otherPc).split('.');
    const forgedBody = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body!, 'base64url').toString()), m: thisPc })).toString('base64url');
    expect(service.activate(`${prefix}.${forgedBody}.${signature}`)).toMatchObject({ ok: false, error: 'signature' });
    expect(service.activate('hello')).toMatchObject({ ok: false, error: 'malformed' });
    expect(service.activate('')).toMatchObject({ ok: false, error: 'malformed' });
    expect(service.licensed).toBe(false);
    expect(existsSync(join(dir, 'license.key'))).toBe(false);
  });

  it('is not asked for in a development run', () => {
    const dev = new LicenseService(dir, thisPc, vendor.publicKey, false);
    expect(dev.status()).toMatchObject({ required: false, licensed: true });
  });

  it('is kept as one line of text', () => {
    new LicenseService(dir, thisPc, vendor.publicKey, true).activate(`  ${key()}  `);
    expect(readFileSync(join(dir, 'license.key'), 'utf8')).toBe(`${key()}\n`);
  });
});
