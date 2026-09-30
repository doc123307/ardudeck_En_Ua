import { GroupingDemo } from './GroupingDemo';
import { LayoutsDemo } from './LayoutsDemo';
import { SplitDemo } from './SplitDemo';

export interface AppGuide {
  /** Versioned id; bump the suffix to show a changed guide again. Shared with the mobile app where both have it. */
  id: string;
  title: string;
  blurb: string;
  Demo: () => JSX.Element;
}

/** Newest first. The launch run shows unseen guides oldest first, the order they build on each other. */
export const APP_GUIDES: AppGuide[] = [
  {
    id: 'map-split-v1',
    title: 'Map and vision side by side',
    blurb: 'The Split button on the map shares the panel with Vision. Drag the divider to set the size; the Pilot layout starts this way with synthetic vision.',
    Demo: SplitDemo,
  },
  {
    id: 'workspace-layouts-v1',
    title: 'Workspace layouts',
    blurb: 'The Workspace button switches between Pilot, FPV and Mission, each with its own panels, cockpit instruments and split. Save your own and share them as a file.',
    Demo: LayoutsDemo,
  },
  {
    id: 'grouping-v1',
    title: 'Instrument grouping',
    blurb: 'Drag one map instrument onto another to dock them into a shared card. Drag a member back out to free it, or scale the whole group at once.',
    Demo: GroupingDemo,
  },
];

export function getGuide(id: string): AppGuide | undefined {
  return APP_GUIDES.find((g) => g.id === id);
}
