/** How the operator arranged their screen. Per PC, remembered between runs. */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FloatRect } from '../components/operator/float-layout';

/** `pip`: one camera full size, the others as movable windows. `grid`: all cameras side by side. */
export type OperatorCameraLayout = 'pip' | 'grid';

/** Key of a camera's movable window. */
export const cameraFloatKey = (sourceId: string) => `cam:${sourceId}`;
export const MAP_FLOAT_KEY = 'map';

/** Where the information block sits and how large it is; null = where and as the program puts it. */
export interface InfoBlockPlace {
  /** Distance from the right and bottom edges, as fractions of the camera area. */
  right: number | null;
  bottom: number | null;
  scale: number | null;
  /** Locked: it cannot be dragged or resized until unlocked. */
  locked: boolean;
}
const DEFAULT_INFO: InfoBlockPlace = { right: null, bottom: null, scale: null, locked: true };

interface OperatorUiStore {
  layout: OperatorCameraLayout;
  /** The camera shown full size; null follows the feed selected in the full UI. */
  mainSourceId: string | null;
  mapOpen: boolean;
  /** Camera image controls stay on screen instead of showing on hover only. */
  controlsPinned: boolean;
  /** Where each movable window was left (camera thumbnails, the map). */
  floats: Record<string, FloatRect>;
  /** Column and row sizes of the camera grid, as left by the dividers. */
  gridCols: number[];
  gridRows: number[];
  info: InfoBlockPlace;
  /** The window touched last, drawn above the others. Not remembered. */
  front: string | null;

  setLayout: (layout: OperatorCameraLayout) => void;
  setMainSource: (id: string) => void;
  setMapOpen: (open: boolean) => void;
  setControlsPinned: (pinned: boolean) => void;
  setFloat: (key: string, rect: FloatRect) => void;
  setInfo: (patch: Partial<InfoBlockPlace>) => void;
  setGridTracks: (axis: 'cols' | 'rows', tracks: number[]) => void;
  bringToFront: (key: string) => void;
  /** Back to the default arrangement. */
  resetArrangement: () => void;
}

export const useOperatorUiStore = create<OperatorUiStore>()(
  persist(
    (set) => ({
      layout: 'pip',
      mainSourceId: null,
      mapOpen: true,
      controlsPinned: false,
      floats: {},
      info: DEFAULT_INFO,
      gridCols: [],
      gridRows: [],
      front: null,

      setLayout: (layout) => set({ layout }),
      setMainSource: (id) => set({ mainSourceId: id }),
      setMapOpen: (open) => set({ mapOpen: open }),
      setControlsPinned: (pinned) => set({ controlsPinned: pinned }),
      setFloat: (key, rect) => set((s) => ({ floats: { ...s.floats, [key]: rect } })),
      setInfo: (patch) => set((s) => ({ info: { ...DEFAULT_INFO, ...s.info, ...patch } })),
      setGridTracks: (axis, tracks) => set(axis === 'cols' ? { gridCols: tracks } : { gridRows: tracks }),
      bringToFront: (key) => set({ front: key }),
      resetArrangement: () => set({ floats: {}, gridCols: [], gridRows: [], mapOpen: true, info: DEFAULT_INFO }),
    }),
    {
      name: 'stohid-operator-ui',
      partialize: ({ front: _front, ...rest }) => rest,
      // A layout saved before the information block could be moved has no place for it.
      merge: (stored, current) => {
        const s = (stored ?? {}) as Partial<OperatorUiStore>;
        return { ...current, ...s, info: { ...DEFAULT_INFO, ...(s.info ?? {}) } };
      },
    },
  ),
);
