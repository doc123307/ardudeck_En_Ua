import { t } from '../../i18n';
// How chart series are assigned to Y axes.
//
// Mission Planner's log browser keeps one axis per UNIT (AddYAxis(unit), reused
// via YAxisList.IndexOf(unit)), so every field measured in metres shares a
// scale and stays directly comparable. One axis per series looks tidy but makes
// two altitudes 5 mm apart render a fifth of the panel apart.

export type YMode = 'shared' | 'unit' | 'field';

export const Y_MODE_ORDER: YMode[] = ['unit', 'shared', 'field'];

export const Y_MODE_LABEL: Record<YMode, string> = {
  unit: 'Y: Unit',
  get shared() { return t('logs.log_y_scales.yShared'); },
  field: 'Y: Field',
};

export const Y_MODE_TIP: Record<YMode, string> = {
  unit: 'One axis per unit: fields measured in the same unit share a scale and stay comparable. Click for one shared axis.',
  get shared() { return t('logs.log_y_scales.oneAxisForEveryFieldWhatever'); },
  field: 'Every field on its own auto-scaled axis, for comparing shapes rather than values. Click to group by unit again.',
};

/** Unit suffix the log's UNIT records leave on a series label, e.g. "Alt (m)". */
export function unitOfLabel(label: string): string | undefined {
  return /\(([^()]+)\)$/.exec(label)?.[1];
}

/** uPlot scale key a series rides under the given mode. */
export function scaleKeyFor(mode: YMode, label: string, index: number): string {
  if (mode === 'shared') return 'y';
  if (mode === 'field') return `y${index}`;
  return `u_${unitOfLabel(label) ?? ''}`;
}

/** Series indexes per scale key, in first-appearance order. */
export function groupSeriesByScale(mode: YMode, labels: string[]): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  labels.forEach((label, i) => {
    const key = scaleKeyFor(mode, label, i);
    const bucket = groups.get(key);
    if (bucket) bucket.push(i); else groups.set(key, [i]);
  });
  return groups;
}
