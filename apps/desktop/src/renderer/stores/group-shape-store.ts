/** Global preference for how a docked group's backdrop bulges round gauges. */

import { create } from 'zustand';
import { t } from '../i18n';

export type GroupShapeMode = 'square' | 'roundedAll' | 'edgesOnly';

export const GROUP_SHAPE_MODES: readonly GroupShapeMode[] = ['square', 'roundedAll', 'edgesOnly'];

export const GROUP_SHAPE_LABELS: Record<GroupShapeMode, string> = {
  square: 'Square',
  get roundedAll() { return t('stores.group_shape_store.roundedEveryGauge'); },
  get edgesOnly() { return t('stores.group_shape_store.roundedEndsOnly'); },
};

export const GROUP_SHAPE_DESCRIPTIONS: Record<GroupShapeMode, string> = {
  get square() { return t('stores.group_shape_store.flatCardNoBulgeTheOriginal'); },
  get roundedAll() { return t('stores.group_shape_store.everyRoundGaugeBulgesItsOwn'); },
  get edgesOnly() { return t('stores.group_shape_store.onlyTheRunSEndsBulge'); },
};

const KEY = 'ardudeck.groupShapeMode';
const DEFAULT_MODE: GroupShapeMode = 'edgesOnly';

function load(): GroupShapeMode {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && (GROUP_SHAPE_MODES as readonly string[]).includes(raw)) return raw as GroupShapeMode;
  } catch { /* ignore */ }
  return DEFAULT_MODE;
}

interface State {
  mode: GroupShapeMode;
  setMode: (mode: GroupShapeMode) => void;
}

export const useGroupShapeStore = create<State>((set) => ({
  mode: load(),
  setMode: (mode) => {
    set({ mode });
    try { localStorage.setItem(KEY, mode); } catch { /* ignore */ }
  },
}));
