/**
 * Per-FC script installation registry.
 *
 * Persistence layer for tracking which flight controllers have ArduDeck Lua
 * scripts installed, what version, and what changes ArduDeck has made on each.
 *
 * Keyed by autopilot UID (the unique ID from AUTOPILOT_VERSION). Never sent
 * over the network. Used to:
 *  - Skip the install prompt for FCs that already have the script (silent path)
 *  - Show "ArduDeck on this vehicle" audit page (full transparency)
 *  - Enable a clean uninstall that reverts every parameter change ArduDeck made
 */

import Store from 'electron-store';
import type {
  AuditEntry,
  AuditEventType,
  FcRegistryEntry,
  ParamChange,
  SubCommandName,
} from '../../shared/script-installer-types';

interface RegistrySchema {
  /** Map: autopilot UID -> per-FC entry. */
  entries: Record<string, FcRegistryEntry>;
}

const store = new Store<RegistrySchema>({
  name: 'fc-script-registry',
  defaults: { entries: {} },
});

/**
 * Stable string ID for an autopilot. ArduPilot's AUTOPILOT_VERSION exposes a
 * uid2 (16 bytes) and uid (uint64); we hex-encode whichever is available.
 *
 * For ArduDeck callers, just pass the already-formatted ID string from the
 * connection-state metadata - this module doesn't care how you derived it,
 * only that it uniquely identifies one FC.
 */
export function get(uid: string): FcRegistryEntry | null {
  const entries = store.get('entries');
  return entries[uid] ?? null;
}

export function getAll(): FcRegistryEntry[] {
  const entries = store.get('entries');
  return Object.values(entries);
}

/**
 * Create or replace the entry for `uid`. Use this on a fresh install/update.
 * For incremental updates (logging an audit entry, recording a param change)
 * prefer the targeted helpers below.
 */
export function setEntry(entry: FcRegistryEntry): void {
  const entries = store.get('entries');
  entries[entry.autopilotUid] = entry;
  store.set('entries', entries);
}

export function remove(uid: string): void {
  const entries = store.get('entries');
  delete entries[uid];
  store.set('entries', entries);
}

/**
 * Append an event to the FC's audit log. No-ops silently if the FC has no
 * registry entry yet (audit-before-install events should still log somewhere
 * - callers can pre-create a stub entry if needed).
 */
export function appendAudit(uid: string, type: AuditEventType, summary: string, data?: Record<string, unknown>): void {
  const entries = store.get('entries');
  const entry = entries[uid];
  if (!entry) return;
  const auditEntry: AuditEntry = {
    type,
    timestamp: new Date().toISOString(),
    summary,
    ...(data !== undefined ? { data } : {}),
  };
  entry.auditLog.push(auditEntry);
  // Cap audit log to a sane size; oldest entries fall off.
  const MAX_AUDIT_ENTRIES = 200;
  if (entry.auditLog.length > MAX_AUDIT_ENTRIES) {
    entry.auditLog.splice(0, entry.auditLog.length - MAX_AUDIT_ENTRIES);
  }
  entries[uid] = entry;
  store.set('entries', entries);
}

/**
 * Record a parameter change ArduDeck made. Used both for the audit trail and
 * to enable revert-on-uninstall.
 */
export function recordParamChange(uid: string, change: ParamChange): void {
  const entries = store.get('entries');
  const entry = entries[uid];
  if (!entry) return;
  entry.paramChanges.push(change);
  entries[uid] = entry;
  store.set('entries', entries);
}

/**
 * Convenience: build a fresh entry for a new install. Caller fills in the
 * dynamic fields (sha256, version, etc) and we attach the boilerplate.
 */
export function buildFreshEntry(args: {
  autopilotUid: string;
  vehicleLabel: string | null;
  scriptVersion: string;
  scriptSha256: string;
  enabledCommands: SubCommandName[];
  installMethod?: 'ftp' | 'manual';
}): FcRegistryEntry {
  const now = new Date().toISOString();
  const method = args.installMethod ?? 'ftp';
  return {
    autopilotUid: args.autopilotUid,
    vehicleLabel: args.vehicleLabel,
    installedAt: now,
    scriptVersion: args.scriptVersion,
    scriptSha256: args.scriptSha256,
    enabledCommands: args.enabledCommands,
    paramChanges: [],
    installMethod: method,
    auditLog: [
      {
        type: 'install',
        timestamp: now,
        summary: method === 'manual'
          ? `Detected STOHID commands v${args.scriptVersion} (manually installed - script heartbeat received)`
          : `Installed STOHID commands v${args.scriptVersion}`,
      },
    ],
  };
}
