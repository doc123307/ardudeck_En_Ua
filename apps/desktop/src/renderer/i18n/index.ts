import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { setSharedTranslator } from '../../shared/i18n-shim';

export const SUPPORTED_LANGUAGES = ['en', 'uk', 'ru'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Each language named in itself, so a pilot can find theirs whatever the UI is showing. */
export const LANGUAGE_NATIVE_NAMES: Record<AppLanguage, string> = {
  en: 'English',
  uk: 'Українська',
  ru: 'Русский',
};

type Tree = { [key: string]: string | Tree };

function deepMerge(target: Tree, source: Tree): Tree {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (typeof value === 'object' && typeof existing === 'object') deepMerge(existing, value);
    else target[key] = value;
  }
  return target;
}

// One file per UI area under locales/<lang>/, merged into a single namespace so keys read
// as "<area>.<Component>.<string>" no matter which file they live in.
const localeFiles = import.meta.glob<Tree>('./locales/*/*.json', { eager: true, import: 'default' });

export function loadLocaleTree(language: AppLanguage): Tree {
  const tree: Tree = {};
  for (const [path, content] of Object.entries(localeFiles)) {
    if (path.split('/')[2] === language) deepMerge(tree, content);
  }
  return tree;
}

// The settings store loads asynchronously over IPC, so the last choice is mirrored here
// to render the very first frame in the right language instead of flashing English.
const STORAGE_KEY = 'ardudeck.language';

// Store tests import this module under plain Node, where there is no DOM.
const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function readStoredLanguage(): AppLanguage | null {
  if (!hasDom) return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isAppLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** First run: follow the OS language when we have it, English otherwise. */
function detectSystemLanguage(): AppLanguage {
  const langs = hasDom ? navigator.languages ?? [navigator.language] : [];
  for (const tag of langs) {
    const base = tag?.toLowerCase().split('-')[0];
    if (isAppLanguage(base)) return base;
  }
  return 'en';
}

export function getInitialLanguage(): AppLanguage {
  return readStoredLanguage() ?? detectSystemLanguage();
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    SUPPORTED_LANGUAGES.map((lang) => [lang, { translation: loadLocaleTree(lang) }]),
  ),
  lng: getInitialLanguage(),
  // Anything not translated yet falls back to English rather than showing a raw key.
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
  // Resources are bundled, so finish synchronously: module-level labels call t() at import.
  initAsync: false,
});

if (hasDom) document.documentElement.lang = i18n.language;

// Shared tables (check lists, parameter groups) read their text through this.
setSharedTranslator((key) => (i18n.exists(key) ? i18n.t(key) : undefined));

/**
 * Translate outside React hooks. Works anywhere (render helpers, stores, module-level
 * getters); the app root remounts on a language change so rendered text follows.
 */
export const t = i18n.t.bind(i18n);

/**
 * An English plural ending ("s", "es") glued onto a translated word. Ukrainian and Russian
 * inflect the word itself, so the suffix only applies while the UI is in English.
 */
export const enPlural = (suffix: string): string => (i18n.language?.startsWith('en') ? suffix : '');

/** "3h ago" in the UI language, from a positive amount of a unit in the past. */
export const ago = (value: number, unit: Intl.RelativeTimeFormatUnit): string =>
  new Intl.RelativeTimeFormat(i18n.language, { style: 'narrow' }).format(-value, unit);

/** "in 30h" in the UI language, from a positive amount of a unit in the future. */
export const fromNow = (value: number, unit: Intl.RelativeTimeFormatUnit): string =>
  new Intl.RelativeTimeFormat(i18n.language, { style: 'narrow' }).format(value, unit);

/** "just now" in the UI language. */
export const justNow = (): string =>
  new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' }).format(0, 'second');

export function applyLanguage(language: AppLanguage): void {
  if (i18n.language !== language) void i18n.changeLanguage(language);
  if (!hasDom) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable; the settings store still persists the choice.
  }
  document.documentElement.lang = language;
}

export default i18n;
