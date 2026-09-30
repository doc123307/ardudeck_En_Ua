/**
 * In-map split state for the telemetry MapPanel: which second panel (if any)
 * shares the map panel's content area, and how wide the map half is. The split
 * happens INSIDE MapPanel (not via dockview) so the floating instruments overlay
 * spans both halves. Persisted to localStorage so the operator's split survives
 * reload, matching the map-instruments store's plain-persist pattern.
 */
import { create } from 'zustand';
import type { PanelId } from '../components/panels';

const STORAGE_KEY = 'map-split-state';

/** Map (left) fraction bounds. Keeps both halves usable at the extremes. */
export const MAP_SPLIT_RATIO_MIN = 0.25;
export const MAP_SPLIT_RATIO_MAX = 0.75;
const DEFAULT_RATIO = 0.6;

function clampRatio(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_RATIO;
  return Math.max(MAP_SPLIT_RATIO_MIN, Math.min(MAP_SPLIT_RATIO_MAX, v));
}

interface Persisted {
  target: PanelId | null;
  ratio: number;
}

function readStored(): Persisted {
  const fallback: Persisted = { target: null, ratio: DEFAULT_RATIO };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // 'map' is never a valid split target (would embed the map in itself).
    const target =
      typeof parsed.target === 'string' && parsed.target !== 'map'
        ? (parsed.target as PanelId)
        : null;
    const ratio = typeof parsed.ratio === 'number' ? clampRatio(parsed.ratio) : DEFAULT_RATIO;
    return { target, ratio };
  } catch {
    return fallback;
  }
}

function persist(s: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // storage full/blocked: keep in-memory state only
  }
}

interface MapSplitStore {
  /** Panel sharing the map panel, or null for full map. */
  target: PanelId | null;
  /** Map (left) fraction of the content area, MIN..MAX. */
  ratio: number;
  setTarget: (target: PanelId | null) => void;
  /**
   * Set by a workspace layout, which brings its own cockpit: MapPanel must not swap in the
   * split profile or ask. Consumed once by MapPanel's split effect.
   */
  applyFromLayout: (target: PanelId | null, ratio: number) => void;
  /** True once after applyFromLayout changed whether the map is split. */
  consumeLayoutApply: () => boolean;
  layoutApplyPending: boolean;
  setRatio: (ratio: number) => void;
  clear: () => void;
}

const initial = readStored();

export const useMapSplitStore = create<MapSplitStore>((set, get) => ({
  target: initial.target,
  ratio: initial.ratio,
  layoutApplyPending: false,
  applyFromLayout: (target, ratio) => {
    const next = target === 'map' ? null : target;
    const flips = (get().target === null) !== (next === null);
    const clamped = clampRatio(ratio);
    set({ target: next, ratio: clamped, layoutApplyPending: flips });
    persist({ target: next, ratio: clamped });
  },
  consumeLayoutApply: () => {
    if (!get().layoutApplyPending) return false;
    set({ layoutApplyPending: false });
    return true;
  },
  setTarget: (target) => {
    const next = target === 'map' ? null : target;
    set({ target: next });
    persist({ target: next, ratio: get().ratio });
  },
  setRatio: (ratio) => {
    const clamped = clampRatio(ratio);
    set({ ratio: clamped });
    persist({ target: get().target, ratio: clamped });
  },
  clear: () => {
    set({ target: null });
    persist({ target: null, ratio: get().ratio });
  },
}));
