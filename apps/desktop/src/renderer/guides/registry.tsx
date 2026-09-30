import { GroupingDemo } from './GroupingDemo';
import { LayoutsDemo } from './LayoutsDemo';
import { SplitDemo } from './SplitDemo';
import { t } from '../i18n';

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
    get title() { return t('guides.registry.mapAndVisionSideBySide'); },
    get blurb() { return t('guides.registry.theSplitButtonOnTheMap'); },
    Demo: SplitDemo,
  },
  {
    id: 'workspace-layouts-v1',
    get title() { return t('guides.registry.workspaceLayouts'); },
    get blurb() { return t('guides.registry.theWorkspaceButtonSwitchesBetweenPilot'); },
    Demo: LayoutsDemo,
  },
  {
    id: 'grouping-v1',
    get title() { return t('guides.registry.instrumentGrouping'); },
    get blurb() { return t('guides.registry.dragOneMapInstrumentOntoAnother'); },
    Demo: GroupingDemo,
  },
];

export function getGuide(id: string): AppGuide | undefined {
  return APP_GUIDES.find((g) => g.id === id);
}
