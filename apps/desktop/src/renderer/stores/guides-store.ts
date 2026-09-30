import { create } from 'zustand';

// Same keys as the mobile app's guides, so the two apps share one vocabulary.
const SEEN_PREFIX = 'guide-seen:';
const SUPPRESS_KEY = 'guides-auto-show-suppressed';

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function write(key: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key, 'true');
    else localStorage.removeItem(key);
  } catch {
    // storage blocked: the guide simply shows again next launch
  }
}

interface GuidesStore {
  /** Guides waiting to be shown, first is on screen. */
  queue: string[];
  /** Steps in the current run, for the "N of M" counter; 1 when replaying one guide. */
  runLength: number;
  isSeen: (id: string) => boolean;
  markSeen: (id: string) => void;
  isSuppressed: () => boolean;
  setSuppressed: (on: boolean) => void;
  /** Show these guides one after another. */
  start: (ids: string[]) => void;
  /** Current guide done: `continueRun` false (Skip, suppressed) ends the whole run. */
  finishCurrent: (continueRun: boolean) => void;
  resetSeen: (ids: string[]) => void;
}

export const useGuidesStore = create<GuidesStore>((set, get) => ({
  queue: [],
  runLength: 0,
  isSeen: (id) => read(SEEN_PREFIX + id),
  markSeen: (id) => write(SEEN_PREFIX + id, true),
  isSuppressed: () => read(SUPPRESS_KEY),
  setSuppressed: (on) => write(SUPPRESS_KEY, on),
  start: (ids) => set({ queue: ids, runLength: ids.length }),
  finishCurrent: (continueRun) => {
    const [current, ...rest] = get().queue;
    if (current) get().markSeen(current);
    set(continueRun && rest.length ? { queue: rest } : { queue: [], runLength: 0 });
  },
  resetSeen: (ids) => {
    for (const id of ids) write(SEEN_PREFIX + id, false);
    write(SUPPRESS_KEY, false);
  },
}));
