/**
 * Activation: one copy of the program works on one PC. The program shows the PC's code, the
 * vendor's key generator signs a key for that code, and the key is entered once.
 */

/** Why a key was not accepted. */
export type LicenseError = 'malformed' | 'signature' | 'machine';

export interface LicenseStatus {
  /** False in a development run: nothing is asked for. */
  required: boolean;
  licensed: boolean;
  /** This PC's code, `XXXXX-XXXXX-XXXXX-XXXXX`: what the vendor needs to make a key. */
  machineCode: string;
  /** Who the copy was issued to. */
  owner: string;
  /** Serial numbers of the vehicles the copy was issued with. */
  vehicles: string[];
  /** When the key was made, ms since epoch. */
  issued: number | null;
  /** The key's number in the vendor's list. */
  id: string;
}

export interface LicenseActivateResult {
  ok: boolean;
  error: LicenseError | null;
  status: LicenseStatus;
}

/** Crockford base32: no I, L, O, U - nothing to misread when a code is dictated. */
export const LICENSE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const MACHINE_CODE_LENGTH = 20;

/** A PC code as typed or pasted, to its canonical form; null if it is not one. */
export function normalizeMachineCode(text: string): string | null {
  const raw = text.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
  if (raw.length !== MACHINE_CODE_LENGTH || [...raw].some((c) => !LICENSE_ALPHABET.includes(c))) return null;
  return raw.match(/.{5}/g)!.join('-');
}
