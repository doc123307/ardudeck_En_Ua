/**
 * Keeps and checks this copy's licence key.
 *
 * A key is `STOHID1.<payload>.<signature>` (see apps/keygen/lib/license-core.cjs, which makes
 * them). It is accepted when the signature is the vendor's and the PC code inside it is this
 * PC's. The key file lives with the user's data; copied to another computer it simply does
 * not match that computer.
 */

import { createPublicKey, verify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LicenseActivateResult, LicenseError, LicenseStatus } from '../../shared/license-types.js';

const PREFIX = 'STOHID1';
const FILE = 'license.key';

interface LicensePayload {
  id: string;
  machine: string;
  owner: string;
  vehicles: string[];
  issued: number | null;
}

/** The contents of a key that carries the vendor's signature; null for anything else. */
export function readLicenseKey(publicKeyPem: string, key: string): LicensePayload | null {
  const parts = key.replace(/\s+/g, '').split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  try {
    const ok = verify(null, Buffer.from(`${PREFIX}.${parts[1]}`), createPublicKey(publicKeyPem), Buffer.from(parts[2]!, 'base64url'));
    if (!ok) return null;
    const p = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (p['v'] !== 1 || typeof p['m'] !== 'string') return null;
    return {
      id: typeof p['id'] === 'string' ? p['id'] : '',
      machine: p['m'],
      owner: typeof p['o'] === 'string' ? p['o'] : '',
      vehicles: Array.isArray(p['b']) ? p['b'].filter((s): s is string => typeof s === 'string') : [],
      issued: typeof p['t'] === 'number' ? p['t'] : null,
    };
  } catch {
    return null;
  }
}

const looksLikeKey = (key: string) => key.replace(/\s+/g, '').split('.').length === 3 && key.trim().startsWith(PREFIX);

export class LicenseService {
  private accepted: LicensePayload | null = null;

  constructor(
    private readonly dir: string,
    private readonly machine: string,
    private readonly publicKeyPem: string,
    /** False in a development run: the program works without a key. */
    private readonly required: boolean,
  ) {
    try {
      const file = join(dir, FILE);
      if (existsSync(file)) this.accepted = this.check(readFileSync(file, 'utf8')).payload;
    } catch {
      this.accepted = null;
    }
  }

  private check(key: string): { payload: LicensePayload | null; error: LicenseError | null } {
    if (!looksLikeKey(key)) return { payload: null, error: 'malformed' };
    const payload = readLicenseKey(this.publicKeyPem, key);
    if (!payload) return { payload: null, error: 'signature' };
    if (payload.machine !== this.machine) return { payload: null, error: 'machine' };
    return { payload, error: null };
  }

  /** May the program do its work: connect to a vehicle, show the screens. */
  get licensed(): boolean {
    return !this.required || this.accepted !== null;
  }

  status(): LicenseStatus {
    return {
      required: this.required,
      licensed: this.licensed,
      machineCode: this.machine,
      owner: this.accepted?.owner ?? '',
      vehicles: this.accepted?.vehicles ?? [],
      issued: this.accepted?.issued ?? null,
      id: this.accepted?.id ?? '',
    };
  }

  activate(key: string): LicenseActivateResult {
    const { payload, error } = this.check(key);
    if (!payload) return { ok: false, error, status: this.status() };
    this.accepted = payload;
    try {
      mkdirSync(this.dir, { recursive: true });
      writeFileSync(join(this.dir, FILE), `${key.replace(/\s+/g, '')}\n`, 'utf8');
    } catch {
      // Accepted for this run; it will be asked for again if the file could not be kept.
    }
    return { ok: true, error: null, status: this.status() };
  }
}
