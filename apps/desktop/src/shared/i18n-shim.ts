/**
 * Translation hook for the shared tables (check lists, parameter groups, ...).
 * They are imported by both processes and by plain-Node tests, so they cannot
 * pull in the renderer's i18next. The renderer installs a translator at
 * startup; everywhere else the English text is used as is.
 */
type Translate = (key: string) => string | undefined;

let translate: Translate = () => undefined;

export function setSharedTranslator(fn: Translate): void {
  translate = fn;
}

/** Text for `key` in the UI language, or `english` when no translation is available. */
export function st(key: string, english: string): string {
  return translate(key) ?? english;
}
