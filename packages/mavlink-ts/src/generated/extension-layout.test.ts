import { describe, it, expect } from 'vitest';
import { getAllMessageInfos } from './message-registry.js';
import fixtures from './extension-layout.fixtures.json';

// Payloads packed by pymavlink: extension fields follow the base fields, never size-sorted in.
const byName = new Map(getAllMessageInfos().map((info) => [info.name, info]));

const key = (snake: string) => snake.replace(/_/g, '').toLowerCase();

function normalise(v: unknown): unknown {
  if (typeof v === 'bigint') return Number(v);
  if (Array.isArray(v)) return v.map(normalise);
  return v;
}

describe('extension fields sit after the base fields', () => {
  for (const [name, fixture] of Object.entries(fixtures as Record<string, { hex: string; fields: Record<string, unknown> }>)) {
    it(name, () => {
      const info = byName.get(name);
      expect(info, `${name} in registry`).toBeDefined();
      const payload = Uint8Array.from(fixture.hex.match(/../g)!.map((b) => parseInt(b, 16)));

      const decoded = info!.deserialize(payload) as Record<string, unknown>;
      const got = new Map(Object.entries(decoded).map(([k, v]) => [k.toLowerCase(), normalise(v)]));
      for (const [field, value] of Object.entries(fixture.fields)) {
        expect(got.get(key(field)), `${name}.${field}`).toEqual(value);
      }

      expect(Array.from(info!.serialize(decoded))).toEqual(Array.from(payload));
    });
  }
});
