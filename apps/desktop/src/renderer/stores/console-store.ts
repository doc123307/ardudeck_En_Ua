import { create } from 'zustand';
import type { ConsoleLogEntry } from '../../shared/ipc-channels';
import { useSettingsStore } from './settings-store';

const MAX_LOG_ENTRIES = 500;
const DOCK_KEY = 'ardudeck.console.dock';
const SIZE_KEY = 'ardudeck.console.size';

export type ConsoleDock = 'bottom' | 'left' | 'right';

/** Size along the docked edge: height when bottom, width when left or right. */
const DEFAULT_SIZE: Record<ConsoleDock, number> = { bottom: 320, left: 420, right: 420 };

function readDock(): ConsoleDock {
  const v = localStorage.getItem(DOCK_KEY);
  return v === 'left' || v === 'right' ? v : 'bottom';
}

function readSize(dock: ConsoleDock): number {
  const v = Number(localStorage.getItem(`${SIZE_KEY}.${dock}`));
  return Number.isFinite(v) && v > 120 ? v : DEFAULT_SIZE[dock];
}

interface ConsoleStore {
  logs: ConsoleLogEntry[];
  isExpanded: boolean;
  filter: 'all' | 'info' | 'error' | 'packet';
  dock: ConsoleDock;
  /** Height when docked bottom, width when docked to a side. */
  size: number;

  addLog: (entry: ConsoleLogEntry) => void;
  clearLogs: () => void;
  setExpanded: (expanded: boolean) => void;
  toggleExpanded: () => void;
  setFilter: (filter: ConsoleStore['filter']) => void;
  setDock: (dock: ConsoleDock) => void;
  setSize: (size: number) => void;
}

let nextEntryId = 0;

export const useConsoleStore = create<ConsoleStore>((set) => ({
  logs: [],
  isExpanded: false,
  filter: 'all',
  dock: readDock(),
  size: readSize(readDock()),

  addLog: (entry) => {
    // Drop debug/packet-level logs when showDebugLogs is off
    if ((entry.level === 'debug' || entry.level === 'packet') && !useSettingsStore.getState().showDebugLogs) {
      return;
    }
    // Entries come from several main-process sources (the MAVLink log, the unified
    // logger, the flashers, MSP), each numbering its own from 1. Those ids collide,
    // and the list is keyed by id, so number the entries here, in arrival order.
    set((state) => ({
      logs: [...state.logs.slice(-(MAX_LOG_ENTRIES - 1)), { ...entry, id: ++nextEntryId }],
    }));
  },

  clearLogs: () => set({ logs: [] }),

  setExpanded: (expanded) => set({ isExpanded: expanded }),

  toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),

  setFilter: (filter) => set({ filter }),

  setDock: (dock) => {
    localStorage.setItem(DOCK_KEY, dock);
    // Each edge keeps its own size: a comfortable side width is a silly height.
    set({ dock, size: readSize(dock) });
  },

  setSize: (size) => {
    const clamped = Math.max(160, Math.round(size));
    set((state) => {
      localStorage.setItem(`${SIZE_KEY}.${state.dock}`, String(clamped));
      return { size: clamped };
    });
  },
}));
