/**
 * ConnectionRegistry - main process owner of all transports and vehicles.
 *
 * Replaces the module-level singletons (`currentTransport`, `mavlinkParser`,
 * `currentVehicleType`) in `ipc-handlers.ts`. Implements the Mission
 * Planner-style two-level model documented in `types.ts`: transports own
 * vehicles keyed by (sysid, compid).
 *
 * Design constraints:
 *   - Pure data structure. Does not create transports, open them, attach
 *     listeners, or know about IPC. Callers build transports the same way they
 *     do today, then `register()` them. Keeps the registry small, testable, and
 *     decoupled from connection lifecycle / IPC concerns.
 *   - Always multi-vehicle internally, even when only one transport is
 *     registered. Single-vehicle mode is a UI variant, not a data-model variant.
 *
 * Compatibility shims (`getActiveTransport`, `getActiveMavlinkParser`,
 * `getActiveVehicleType`) exist so the integration can replace the module-level
 * globals in `ipc-handlers.ts` with one-line accessor calls without touching
 * legacy read sites.
 */

import { randomUUID } from 'crypto';
import type { Transport } from '@ardudeck/comms';
import type { MAVLinkParser } from '@ardudeck/mavlink-ts';
import {
  makeVehicleKey,
  type ActiveSelection,
  type TransportConfig,
  type TransportEntry,
  type TransportId,
  type VehicleEntry,
  type VehicleKey,
} from './types.js';
import { mt } from '../i18n';

/**
 * Patch shape for `updateVehicle`. Only the fields the message-routing layer is
 * allowed to mutate after discovery. Identity fields (`key`, `transportId`,
 * `sysid`, `compid`) are immutable.
 */
type VehicleUpdate = Partial<Pick<VehicleEntry, 'mavType' | 'boardId' | 'boardUid'>>;

const initialStats = (): TransportEntry['stats'] => ({
  packetsRx: 0,
  packetsTx: 0,
  lastPacketAt: null,
  lastError: null,
});

export class ConnectionRegistry {
  private readonly transports = new Map<TransportId, TransportEntry>();
  private activeTransportId: TransportId | null = null;
  private activeVehicleKey: VehicleKey | null = null;

  // ==================== TRANSPORT LIFECYCLE ====================

  /**
   * Register an already-built transport with its parser.
   *
   * The registry takes ownership of bookkeeping (stats, vehicle map) but NOT of
   * the transport's lifecycle. Callers remain responsible for opening, closing,
   * and attaching data listeners. This lets the integration keep the existing
   * connect/disconnect flow essentially intact, with the registry calls bolted on.
   *
   * Returns the freshly-generated `TransportId`.
   */
  register(transport: Transport, parser: MAVLinkParser, config: TransportConfig): TransportId {
    const id = randomUUID();
    const entry: TransportEntry = {
      id,
      transport,
      parser,
      config,
      stats: initialStats(),
      vehicles: new Map(),
    };
    this.transports.set(id, entry);
    return id;
  }

  /**
   * Remove a transport from the registry.
   *
   * Does NOT close the underlying transport - the caller owns that. Silently
   * no-ops if the transport ID is unknown (so cleanup paths can call defensively).
   * If the removed transport was the active selection, both `activeTransportId`
   * and `activeVehicleKey` are cleared.
   */
  unregister(transportId: TransportId): void {
    const removed = this.transports.delete(transportId);
    if (!removed) return;
    if (this.activeTransportId === transportId) {
      this.activeTransportId = null;
      this.activeVehicleKey = null;
    }
  }

  /**
   * Remove all transports and clear the active selection.
   *
   * Used by mode switching where the caller wants a clean slate. Caller is still
   * responsible for closing each transport before calling this.
   */
  clear(): void {
    this.transports.clear();
    this.activeTransportId = null;
    this.activeVehicleKey = null;
  }

  // ==================== TRANSPORT LOOKUP ====================

  getTransport(transportId: TransportId): TransportEntry | undefined {
    return this.transports.get(transportId);
  }

  listTransports(): TransportEntry[] {
    return Array.from(this.transports.values());
  }

  hasAnyTransport(): boolean {
    return this.transports.size > 0;
  }

  transportCount(): number {
    return this.transports.size;
  }

  // ==================== VEHICLE DISCOVERY & LOOKUP ====================

  /**
   * Record a heartbeat from a vehicle on a given transport.
   *
   * Called for every MAVLink HEARTBEAT. If this is the first heartbeat for this
   * `(sysid, compid)` on this transport, a new `VehicleEntry` is created and
   * `isNew` is true. Otherwise the existing entry's `mavType`, `autopilot` and
   * `lastHeartbeatAt` are updated and `isNew` is false.
   *
   * Returns null only if the transport ID is unknown (defensive guard against
   * races where a heartbeat arrives after the transport was unregistered).
   */
  recordHeartbeat(
    transportId: TransportId,
    sysid: number,
    compid: number,
    mavType: number,
    autopilot = 0,
  ): { vehicle: VehicleEntry; isNew: boolean } | null {
    const entry = this.transports.get(transportId);
    if (!entry) return null;

    const key = makeVehicleKey(transportId, sysid, compid);
    const existing = entry.vehicles.get(key);
    if (existing) {
      existing.mavType = mavType;
      existing.autopilot = autopilot;
      existing.lastHeartbeatAt = Date.now();
      return { vehicle: existing, isNew: false };
    }

    const vehicle: VehicleEntry = {
      key,
      transportId,
      sysid,
      compid,
      mavType,
      autopilot,
      boardId: null,
      boardUid: null,
      lastHeartbeatAt: Date.now(),
    };
    entry.vehicles.set(key, vehicle);
    return { vehicle, isNew: true };
  }

  /**
   * Look up a vehicle by transport / sysid / compid without creating one.
   *
   * Returns undefined if no heartbeat has yet been received for this tuple. Used
   * by handlers for non-HEARTBEAT messages, which only operate on
   * already-discovered vehicles.
   */
  getVehicle(transportId: TransportId, sysid: number, compid: number): VehicleEntry | undefined {
    const entry = this.transports.get(transportId);
    if (!entry) return undefined;
    return entry.vehicles.get(makeVehicleKey(transportId, sysid, compid));
  }

  /**
   * Look up a vehicle by its `VehicleKey` directly.
   *
   * Convenience for callers that already hold a key (active vehicle pointer, IPC
   * payloads from the renderer).
   */
  getVehicleByKey(key: VehicleKey): VehicleEntry | undefined {
    const sep = key.indexOf(':');
    if (sep === -1) return undefined;
    const transportId = key.slice(0, sep);
    const entry = this.transports.get(transportId);
    if (!entry) return undefined;
    return entry.vehicles.get(key);
  }

  /**
   * Flat list of every vehicle across every transport.
   *
   * Order is transport-insertion order, then vehicle-discovery order within each
   * transport. Used by the multi-mode vehicle selector and debugging.
   */
  listVehicles(): VehicleEntry[] {
    const out: VehicleEntry[] = [];
    for (const entry of this.transports.values()) {
      for (const vehicle of entry.vehicles.values()) {
        out.push(vehicle);
      }
    }
    return out;
  }

  /**
   * Mutate metadata fields on an existing vehicle.
   *
   * Used by the AUTOPILOT_VERSION handler to attach `boardId` / `boardUid` after
   * they have been parsed. Identity fields cannot be patched. Silent no-op if
   * the key is unknown (defensive against races).
   */
  updateVehicle(key: VehicleKey, patch: VehicleUpdate): void {
    const vehicle = this.getVehicleByKey(key);
    if (!vehicle) return;
    if (patch.mavType !== undefined) vehicle.mavType = patch.mavType;
    if (patch.boardId !== undefined) vehicle.boardId = patch.boardId;
    if (patch.boardUid !== undefined) vehicle.boardUid = patch.boardUid;
  }

  // ==================== ACTIVE SELECTION ====================

  /**
   * Set the active transport and (optionally) the active vehicle within it.
   *
   * If `vehicleKey` is omitted or null, the active vehicle is cleared. If
   * `transportId` is null, both the active transport and active vehicle are
   * cleared. Throws if `transportId` is non-null and unknown, or if `vehicleKey`
   * is non-null and does not belong to that transport - these indicate caller
   * bugs and a silent no-op would mask them.
   */
  setActive(transportId: TransportId | null, vehicleKey?: VehicleKey | null): void {
    if (transportId === null) {
      this.activeTransportId = null;
      this.activeVehicleKey = null;
      return;
    }
    const entry = this.transports.get(transportId);
    if (!entry) {
      throw new Error(mt('main.connection_connection_registry.connectionregistrySetactiveUnknownTransportid', { transportId }));
    }
    if (vehicleKey != null) {
      const vehicle = entry.vehicles.get(vehicleKey);
      if (!vehicle) {
        throw new Error(
          mt('main.connection_connection_registry.connectionregistrySetactiveVehiclekeyDoesNotBelo', { vehicleKey, transportId }),
        );
      }
    }
    this.activeTransportId = transportId;
    this.activeVehicleKey = vehicleKey ?? null;
  }

  /**
   * Snapshot of the currently-active selection.
   *
   * Returns null if there is no active transport, or if there is an active
   * transport but no active vehicle has been pinned yet (e.g., between connect
   * and the first heartbeat).
   */
  getActive(): ActiveSelection | null {
    if (this.activeTransportId === null || this.activeVehicleKey === null) return null;
    const transport = this.transports.get(this.activeTransportId);
    if (!transport) return null;
    const vehicle = transport.vehicles.get(this.activeVehicleKey);
    if (!vehicle) return null;
    return { transport, vehicle };
  }

  getActiveTransportId(): TransportId | null {
    return this.activeTransportId;
  }

  getActiveVehicleKey(): VehicleKey | null {
    return this.activeVehicleKey;
  }

  // ==================== COMPATIBILITY SHIMS (transitional) ====================
  //
  // These let the integration replace the module-level globals in
  // `ipc-handlers.ts` with one-liner accessor calls. They will be removed once
  // legacy call sites migrate to per-vehicle access in Sub-spec B.

  /**
   * Equivalent of the old `currentTransport` module global.
   * Returns the active transport's underlying `Transport` instance, or null.
   */
  getActiveTransport(): Transport | null {
    if (this.activeTransportId === null) return null;
    const entry = this.transports.get(this.activeTransportId);
    return entry?.transport ?? null;
  }

  /**
   * Equivalent of the old `mavlinkParser` module global.
   * Returns the active transport's parser, or null.
   */
  getActiveMavlinkParser(): MAVLinkParser | null {
    if (this.activeTransportId === null) return null;
    const entry = this.transports.get(this.activeTransportId);
    return entry?.parser ?? null;
  }

  /**
   * Equivalent of the old `currentVehicleType` module global.
   * Returns the active vehicle's `mavType`, or 0 if there is no active vehicle
   * (matching the legacy initial value).
   */
  getActiveVehicleType(): number {
    const active = this.getActive();
    return active?.vehicle.mavType ?? 0;
  }

  // ==================== STATS ====================

  recordPacketRx(transportId: TransportId): void {
    const entry = this.transports.get(transportId);
    if (!entry) return;
    entry.stats.packetsRx += 1;
    entry.stats.lastPacketAt = Date.now();
  }

  recordPacketTx(transportId: TransportId): void {
    const entry = this.transports.get(transportId);
    if (!entry) return;
    entry.stats.packetsTx += 1;
  }

  recordTransportError(transportId: TransportId, error: string): void {
    const entry = this.transports.get(transportId);
    if (!entry) return;
    entry.stats.lastError = error;
  }
}

/**
 * Singleton instance shared by the main process. `ipc-handlers.ts` imports this
 * and replaces its module-level transport globals with calls against it. Tests
 * that need isolation instantiate `ConnectionRegistry` directly instead.
 */
export const connectionRegistry = new ConnectionRegistry();
