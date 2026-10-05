/**
 * Live values for the operator's status strip: any field of any MAVLink message the vehicle
 * sends, NAMED_VALUE_FLOAT/INT by name, and flight controller parameters.
 *
 * Messages are decoded here from the raw packet stream (the same one the MAVLink inspector
 * uses), but only those a value on screen needs, or every message while the administrator
 * is picking one. Packets from anyone but the vehicle (the GCS's own echo) are ignored.
 */

import { useEffect, useState } from 'react';
import { getMessageInfo, getMessageInfoByName } from '@ardudeck/mavlink-ts/registry';
import { useConnectionStore } from './connection-store';
import { useParameterStore } from './parameter-store';
import { numericFields, readField, type OperatorValue, type OperatorValueSource } from '../../shared/operator-panel';

/** A value older than this is shown as stale. */
export const STALE_MS = 5000;
const PARAM_REFRESH_MS = 15000;
const MSG_NAMED_VALUE_FLOAT = 251;
const MSG_NAMED_VALUE_INT = 252;

interface Seen { fields: Record<string, unknown>; at: number }

const messages = new Map<string, Seen>();
const named = new Map<string, { value: number; at: number }>();
const params = new Map<string, { value: number; at: number }>();
/** Messages each mounted strip needs; the listener decodes their union. */
const wantedBy = new Map<symbol, Set<number>>();
let wanted = new Set<number>();
const recomputeWanted = () => { wanted = new Set([...wantedBy.values()].flatMap((set) => [...set])); };
let catalogUsers = 0;
let started = false;

function decode(msgid: number, payload: number[] | Uint8Array): Record<string, unknown> | null {
  const info = getMessageInfo(msgid);
  if (!info) return null;
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  // MAVLink 2 trims trailing zero bytes: pad back before the fixed-offset decoder reads them.
  const full = bytes.length < info.maxLength ? (() => { const b = new Uint8Array(info.maxLength); b.set(bytes); return b; })() : bytes;
  try {
    return info.deserialize(full) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Joins the packet stream; idempotent. */
export function startOperatorValues(): void {
  if (started || typeof window === 'undefined' || !window.electronAPI?.onPacket) return;
  started = true;
  window.electronAPI.onPacket((p) => {
    const vehicle = useConnectionStore.getState().connectionState.systemId;
    if (vehicle && p.sysid !== vehicle) return;
    if (p.msgid === MSG_NAMED_VALUE_FLOAT || p.msgid === MSG_NAMED_VALUE_INT) {
      const fields = decode(p.msgid, p.payload);
      const name = typeof fields?.name === 'string' ? fields.name : '';
      const value = readField(fields ?? undefined, 'value', null);
      if (name && value !== null) named.set(name, { value, at: p.rxtime || Date.now() });
      return;
    }
    if (catalogUsers === 0 && !wanted.has(p.msgid)) return;
    const fields = decode(p.msgid, p.payload);
    const info = getMessageInfo(p.msgid);
    if (fields && info) messages.set(info.name, { fields, at: p.rxtime || Date.now() });
  });
}

/** While held, every message is decoded, so the administrator can pick from all of them. */
export function acquireCatalog(): () => void {
  startOperatorValues();
  catalogUsers += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    catalogUsers -= 1;
  };
}

/** Messages seen recently, with their numeric fields: the administrator's picking list. */
export function messageCatalog(now = Date.now()): { message: string; fields: ReturnType<typeof numericFields> }[] {
  return [...messages]
    .filter(([, seen]) => now - seen.at < STALE_MS * 2)
    .map(([message, seen]) => ({ message, fields: numericFields(seen.fields) }))
    .filter((m) => m.fields.length > 0)
    .sort((a, b) => a.message.localeCompare(b.message));
}

/** NAMED_VALUE names seen recently. */
export function namedCatalog(now = Date.now()): { name: string; value: number }[] {
  return [...named]
    .filter(([, v]) => now - v.at < STALE_MS * 2)
    .map(([name, v]) => ({ name, value: v.value }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The raw number behind a source right now, and how old it is. */
export function readSource(source: OperatorValueSource, now = Date.now()): { raw: number | null; stale: boolean } {
  if (source.kind === 'mavlink') {
    const seen = messages.get(source.message);
    return { raw: readField(seen?.fields, source.field, source.index), stale: !seen || now - seen.at > STALE_MS };
  }
  if (source.kind === 'named') {
    const v = named.get(source.name);
    return { raw: v?.value ?? null, stale: !v || now - v.at > STALE_MS };
  }
  const fromStore = useParameterStore.getState().parameters.get(source.name)?.value;
  if (typeof fromStore === 'number') return { raw: fromStore, stale: false };
  const v = params.get(source.name);
  return { raw: v?.value ?? null, stale: !v };
}

/** Parameters the strip shows that the parameter list does not hold yet are asked for by name. */
async function refreshParams(names: string[]): Promise<void> {
  const store = useParameterStore.getState().parameters;
  const missing = names.filter((n) => typeof store.get(n)?.value !== 'number');
  if (missing.length === 0 || !useConnectionStore.getState().connectionState.isConnected) return;
  try {
    const result = await window.electronAPI.readParameterBatch(missing);
    const at = Date.now();
    for (const [name, value] of Object.entries(result.values ?? {})) params.set(name, { value, at });
  } catch {
    /* link down: try again next round */
  }
}

/** Test seam: what the packet listener would have stored. */
export function _injectForTest(kind: 'message' | 'named' | 'param', name: string, data: Record<string, unknown> | number, at = Date.now()): void {
  if (kind === 'message') messages.set(name, { fields: data as Record<string, unknown>, at });
  else if (kind === 'named') named.set(name, { value: data as number, at });
  else params.set(name, { value: data as number, at });
}

export interface LiveValue {
  raw: number | null;
  stale: boolean;
}

/** The administrator's values, live, re-read four times a second while any are on screen. */
export function useOperatorValues(values: OperatorValue[], active = true): Record<string, LiveValue> {
  const [, setTick] = useState(0);
  const key = JSON.stringify(values.map((v) => v.source));

  useEffect(() => {
    if (!active || values.length === 0) return;
    startOperatorValues();
    const sources = JSON.parse(key) as OperatorValueSource[];
    const token = Symbol('strip');
    wantedBy.set(token, new Set(sources.flatMap((s) => {
      if (s.kind !== 'mavlink') return [];
      const info = getMessageInfoByName(s.message);
      return info ? [info.msgid] : [];
    })));
    recomputeWanted();
    const paramNames = sources.flatMap((s) => (s.kind === 'param' ? [s.name] : []));
    const timer = setInterval(() => setTick((n) => n + 1), 250);
    let paramTimer: ReturnType<typeof setInterval> | null = null;
    if (paramNames.length > 0) {
      void refreshParams(paramNames);
      paramTimer = setInterval(() => void refreshParams(paramNames), PARAM_REFRESH_MS);
    }
    return () => {
      clearInterval(timer);
      if (paramTimer) clearInterval(paramTimer);
      wantedBy.delete(token);
      recomputeWanted();
    };
  }, [key, active, values.length]);

  const now = Date.now();
  return Object.fromEntries(values.map((v) => [v.id, readSource(v.source, now)]));
}
