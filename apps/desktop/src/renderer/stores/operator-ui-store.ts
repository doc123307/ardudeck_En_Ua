/** How the operator arranged their screen. Per PC, remembered between runs. */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** `pip`: one camera full size, the others as thumbnails. `grid`: all cameras side by side. */
export type OperatorCameraLayout = 'pip' | 'grid';
export type OperatorThumbSize = 's' | 'm' | 'l';
export const THUMB_SIZES: readonly OperatorThumbSize[] = ['s', 'm', 'l'];

interface OperatorUiStore {
  layout: OperatorCameraLayout;
  thumbSize: OperatorThumbSize;
  /** The camera shown full size; null follows the feed selected in the full UI. */
  mainSourceId: string | null;
  mapOpen: boolean;
  mapLarge: boolean;
  /** Camera image controls stay on screen instead of showing on hover only. */
  controlsPinned: boolean;

  setLayout: (layout: OperatorCameraLayout) => void;
  cycleThumbSize: () => void;
  setMainSource: (id: string) => void;
  setMapOpen: (open: boolean) => void;
  setMapLarge: (large: boolean) => void;
  setControlsPinned: (pinned: boolean) => void;
}

export const useOperatorUiStore = create<OperatorUiStore>()(
  persist(
    (set) => ({
      layout: 'pip',
      thumbSize: 'm',
      mainSourceId: null,
      mapOpen: true,
      mapLarge: false,
      controlsPinned: false,

      setLayout: (layout) => set({ layout }),
      cycleThumbSize: () => set((s) => ({ thumbSize: THUMB_SIZES[(THUMB_SIZES.indexOf(s.thumbSize) + 1) % THUMB_SIZES.length]! })),
      setMainSource: (id) => set({ mainSourceId: id }),
      setMapOpen: (open) => set({ mapOpen: open }),
      setMapLarge: (large) => set({ mapLarge: large }),
      setControlsPinned: (pinned) => set({ controlsPinned: pinned }),
    }),
    { name: 'stohid-operator-ui' },
  ),
);
