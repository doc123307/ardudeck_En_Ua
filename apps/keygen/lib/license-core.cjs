/**
 * STOHID licence keys: how they are made and checked.
 *
 * A key is `STOHID1.<payload>.<signature>`: the payload is JSON (which PC, whose, which
 * vehicles), the signature is Ed25519 over the payload text. Only the holder of the private
 * key can make one; the program carries the public key and can only check.
 *
 * The program has its own copy of the checking half (apps/desktop/src/main/license); a test
 * there signs with this file and verifies with that one, so the two cannot drift apart.
 */

const crypto = require('node:crypto');

const PREFIX = 'STOHID1';
/** Crockford base32: no I, L, O, U - nothing to misread when a code is dictated. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const MACHINE_CODE_LENGTH = 20;

const b64u = (buf) => Buffer.from(buf).toString('base64url');

/** A PC code as typed or pasted, to its one canonical form `XXXXX-XXXXX-XXXXX-XXXXX`; null if it is not one. */
function normalizeMachineCode(text) {
  const raw = String(text ?? '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
  if (raw.length !== MACHINE_CODE_LENGTH || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return raw.match(/.{5}/g).join('-');
}

function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

function publicKeyOf(privateKeyPem) {
  return crypto.createPublicKey(crypto.createPrivateKey(privateKeyPem)).export({ type: 'spki', format: 'pem' }).toString();
}

/**
 * Make a key. `machine` is the code the program shows on the PC to be activated.
 * `vehicles` are the serial numbers the copy is sold with (shown in the program, kept in the list).
 */
function issueLicense(privateKeyPem, { machine, owner = '', vehicles = [], id, issued = Date.now() }) {
  const code = normalizeMachineCode(machine);
  if (!code) throw new Error('bad machine code');
  const payload = {
    v: 1,
    id: String(id ?? crypto.randomBytes(6).toString('hex')),
    m: code,
    o: String(owner).trim().slice(0, 80),
    b: [...new Set(vehicles.map((s) => String(s).trim()).filter(Boolean))].slice(0, 50),
    t: Math.round(issued),
  };
  const body = b64u(JSON.stringify(payload));
  const signature = crypto.sign(null, Buffer.from(`${PREFIX}.${body}`), crypto.createPrivateKey(privateKeyPem));
  return `${PREFIX}.${body}.${b64u(signature)}`;
}

/** The payload of a key that is genuine for `publicKeyPem`; null for anything else. */
function verifyLicense(publicKeyPem, key) {
  const parts = String(key ?? '').replace(/\s+/g, '').split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  try {
    const ok = crypto.verify(null, Buffer.from(`${PREFIX}.${parts[1]}`), crypto.createPublicKey(publicKeyPem), Buffer.from(parts[2], 'base64url'));
    if (!ok) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload && payload.v === 1 && typeof payload.m === 'string' ? payload : null;
  } catch {
    return null;
  }
}

module.exports = { PREFIX, ALPHABET, MACHINE_CODE_LENGTH, normalizeMachineCode, generateKeyPair, publicKeyOf, issueLicense, verifyLicense };
