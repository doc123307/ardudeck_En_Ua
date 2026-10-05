/**
 * What the administrator puts on the operator screen: the controls on the bottom bar (in
 * which order, which are hidden) and any value from the vehicle on the status strip.
 * Pure rules only, shared by the main process (which stores them) and the screen.
 */

// ---- Icons and colours of the controls -------------------------------------------

/** Icons the administrator can give a control; the screen maps them to drawings. */
export const OPERATOR_ICONS = [
  'power', 'lightbulb', 'car', 'sun', 'flashlight', 'eye', 'siren', 'zap', 'fan', 'megaphone',
  'camera', 'arrowUpDown', 'gauge', 'wrench', 'lock', 'radio', 'droplet', 'flame', 'target', 'shield',
] as const;
export type OperatorIcon = (typeof OPERATOR_ICONS)[number];

/** Colour of a control that is on. IR is shown violet, since IR light itself is invisible. */
export const OPERATOR_COLORS = ['white', 'amber', 'red', 'ir', 'green', 'blue'] as const;
export type OperatorColor = (typeof OPERATOR_COLORS)[number];

export const isOperatorIcon = (v: unknown): v is OperatorIcon => (OPERATOR_ICONS as readonly unknown[]).includes(v);
export const isOperatorColor = (v: unknown): v is OperatorColor => (OPERATOR_COLORS as readonly unknown[]).includes(v);

// ---- Controls on the bottom bar ------------------------------------------------------

/**
 * Controls that come with the program. Vehicle outputs and the administrator's own RC
 * functions join them as `relay:<id>` and `fn:<id>`.
 */
export const BUILTIN_CONTROLS = ['joystick', 'reverse', 'cruise', 'record', 'layout', 'reset', 'pin'] as const;
export type BuiltinControl = (typeof BUILTIN_CONTROLS)[number];

export const relayControlKey = (id: string) => `relay:${id}`;
export const functionControlKey = (id: string) => `fn:${id}`;

/** What a control key names. */
export function controlKind(key: string): 'builtin' | 'relay' | 'fn' | null {
  if ((BUILTIN_CONTROLS as readonly string[]).includes(key)) return 'builtin';
  if (/^relay:[\w-]{1,64}$/.test(key)) return 'relay';
  if (/^fn:[\w-]{1,32}$/.test(key)) return 'fn';
  return null;
}

/** Which group a control belongs to; a thin divider is drawn between groups on the bar. */
export function controlGroup(key: string): 'drive' | 'outputs' | 'view' {
  if (key === 'joystick' || key === 'reverse' || key === 'cruise') return 'drive';
  if (key === 'record' || key === 'layout' || key === 'reset' || key === 'pin') return 'view';
  return 'outputs';
}

/**
 * The default order of everything that exists: driving, then vehicle outputs and the
 * administrator's functions, then the view tools.
 */
export function defaultControlOrder(relayIds: string[], functionIds: string[]): string[] {
  return [
    'joystick', 'reverse', 'cruise',
    ...relayIds.map(relayControlKey),
    ...functionIds.map(functionControlKey),
    'record', 'layout', 'reset', 'pin',
  ];
}

/**
 * The controls in the order the administrator set, with anything they never placed (a
 * function added later, a relay set up in the full UI) after them in the default order.
 * `available` is everything that exists; hidden ones are kept, so the editor can list them.
 */
export function arrangeControls(order: readonly string[], available: readonly string[]): string[] {
  const rank = new Map(order.map((key, i) => [key, i]));
  const placed = available.filter((key) => rank.has(key)).sort((a, b) => rank.get(a)! - rank.get(b)!);
  const fresh = available.filter((key) => !rank.has(key));
  // Something new (an output, a function) joins the controls before the view tools, not after them.
  const firstView = placed.findIndex((key) => controlGroup(key) === 'view');
  const at = firstView < 0 ? placed.length : firstView;
  const freshControls = fresh.filter((key) => controlGroup(key) !== 'view');
  const freshViews = fresh.filter((key) => controlGroup(key) === 'view');
  return [...placed.slice(0, at), ...freshControls, ...placed.slice(at), ...freshViews];
}

/** Moves one control by `by` places within the arranged list; returns the new full order. */
export function moveControl(arranged: readonly string[], key: string, by: number): string[] {
  const next = [...arranged];
  const i = next.indexOf(key);
  const j = i + by;
  if (i < 0 || j < 0 || j >= next.length) return next;
  next.splice(i, 1);
  next.splice(j, 0, key);
  return next;
}

// ---- Values on the status strip ("any parameter") -----------------------------------

/** Where a value comes from. */
export type OperatorValueSource =
  /** A field of any MAVLink message the vehicle sends, e.g. SYS_STATUS.voltageBattery; `index` picks from an array field. */
  | { kind: 'mavlink'; message: string; field: string; index: number | null }
  /** NAMED_VALUE_FLOAT / NAMED_VALUE_INT by name: what Lua scripts and companion computers report. */
  | { kind: 'named'; name: string }
  /** A flight controller parameter, e.g. CRUISE_SPEED. */
  | { kind: 'param'; name: string };

export interface OperatorValue {
  id: string;
  label: string;
  source: OperatorValueSource;
  /** Shown value = raw × scale + offset. */
  scale: number;
  offset: number;
  decimals: number;
  unit: string;
  /** Limits at which the value turns amber, then red. null = none. */
  warnBelow: number | null;
  warnAbove: number | null;
  dangerBelow: number | null;
  dangerAbove: number | null;
}

export const OPERATOR_MAX_VALUES = 24;
export const valueFieldKey = (id: string) => `v:${id}`;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const limit = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function normalizeSource(raw: unknown): OperatorValueSource | null {
  if (!isObject(raw)) return null;
  if (raw.kind === 'mavlink') {
    const message = text(raw.message, 64).toUpperCase();
    const field = text(raw.field, 64);
    if (!/^[A-Z0-9_]+$/.test(message) || !/^[A-Za-z_][\w]*$/.test(field)) return null;
    const index = typeof raw.index === 'number' && Number.isInteger(raw.index) && raw.index >= 0 && raw.index < 64 ? raw.index : null;
    return { kind: 'mavlink', message, field, index };
  }
  if (raw.kind === 'named') {
    const name = text(raw.name, 10);
    return name ? { kind: 'named', name } : null;
  }
  if (raw.kind === 'param') {
    const name = text(raw.name, 16).toUpperCase();
    return /^[A-Z0-9_]+$/.test(name) ? { kind: 'param', name } : null;
  }
  return null;
}

/** A value as stored, cleaned; null when it cannot be used. */
export function normalizeValue(raw: unknown, takenIds: Set<string> = new Set()): OperatorValue | null {
  if (!isObject(raw)) return null;
  const id = typeof raw.id === 'string' && /^[\w-]{1,32}$/.test(raw.id) && !takenIds.has(raw.id) ? raw.id : null;
  const source = normalizeSource(raw.source);
  if (!id || !source) return null;
  return {
    id,
    label: text(raw.label, 24) || describeSource(source),
    source,
    scale: finite(raw.scale, 1) || 1,
    offset: finite(raw.offset, 0),
    decimals: Math.round(Math.min(4, Math.max(0, finite(raw.decimals, 1)))),
    unit: text(raw.unit, 8),
    warnBelow: limit(raw.warnBelow),
    warnAbove: limit(raw.warnAbove),
    dangerBelow: limit(raw.dangerBelow),
    dangerAbove: limit(raw.dangerAbove),
  };
}

/** "SYS_STATUS.voltageBattery", "BATTERY_STATUS.voltages[0]", "NAMED temp1", "PARAM CRUISE_SPEED". */
export function describeSource(source: OperatorValueSource): string {
  if (source.kind === 'mavlink') return `${source.message}.${source.field}${source.index === null ? '' : `[${source.index}]`}`;
  if (source.kind === 'named') return source.name;
  return source.name;
}

/** A new value for a source, with a free id and a sensible look for well-known units. */
export function newValue(source: OperatorValueSource, existing: OperatorValue[]): OperatorValue {
  let n = existing.length + 1;
  while (existing.some((v) => v.id === `val${n}`)) n++;
  return {
    id: `val${n}`,
    label: (source.kind === 'mavlink' ? source.field : source.name).slice(0, 24),
    source,
    scale: 1,
    offset: 0,
    decimals: 1,
    unit: '',
    warnBelow: null,
    warnAbove: null,
    dangerBelow: null,
    dangerAbove: null,
  };
}

/** The raw number a source names in a decoded message, or null (missing, not a number). */
export function readField(fields: Record<string, unknown> | undefined, field: string, index: number | null): number | null {
  if (!fields) return null;
  let v: unknown = fields[field];
  if (index !== null) v = Array.isArray(v) || ArrayBuffer.isView(v) ? (v as ArrayLike<unknown>)[index] : undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  return null;
}

/** Numeric fields of a decoded message, arrays expanded: what the administrator can pick from. */
export function numericFields(fields: Record<string, unknown>): { field: string; index: number | null; value: number }[] {
  const out: { field: string; index: number | null; value: number }[] = [];
  for (const [field, v] of Object.entries(fields)) {
    if (Array.isArray(v) || ArrayBuffer.isView(v)) {
      const list = v as ArrayLike<unknown>;
      for (let i = 0; i < Math.min(list.length, 32); i++) {
        const x = readField(fields, field, i);
        if (x !== null) out.push({ field, index: i, value: x });
      }
    } else {
      const x = readField(fields, field, null);
      if (x !== null) out.push({ field, index: null, value: x });
    }
  }
  return out;
}

export function scaledValue(value: OperatorValue, raw: number): number {
  return raw * value.scale + value.offset;
}

export type ValueLevel = 'ok' | 'warn' | 'danger';

export function valueLevel(value: OperatorValue, shown: number): ValueLevel {
  if ((value.dangerBelow !== null && shown < value.dangerBelow) || (value.dangerAbove !== null && shown > value.dangerAbove)) return 'danger';
  if ((value.warnBelow !== null && shown < value.warnBelow) || (value.warnAbove !== null && shown > value.warnAbove)) return 'warn';
  return 'ok';
}

/** "12.6 V", "830", "--" for nothing yet. */
export function formatValue(value: OperatorValue, shown: number | null): string {
  if (shown === null || !Number.isFinite(shown)) return '--';
  const number = shown.toFixed(value.decimals);
  return value.unit ? `${number} ${value.unit}` : number;
}
