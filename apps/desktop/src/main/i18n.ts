/**
 * Translations for text the main process shows: native dialogs, window titles, and the
 * status and error messages it hands to the renderer. The strings live beside the
 * renderer's, in locales/<lang>/main.json, and follow the language picked in Settings.
 */
import i18n from 'i18next';

type Tree = { [key: string]: string | Tree };

const SUPPORTED = ['en', 'uk', 'ru'] as const;
type MainLanguage = (typeof SUPPORTED)[number];

const localeFiles = import.meta.glob<Tree>('../renderer/i18n/locales/*/main.json', { eager: true, import: 'default' });

function treeFor(language: MainLanguage): Tree {
  for (const [path, content] of Object.entries(localeFiles)) {
    if (path.split('/').at(-2) === language) return content;
  }
  return {};
}

const translator = i18n.createInstance();
void translator.init({
  resources: Object.fromEntries(SUPPORTED.map((lang) => [lang, { translation: treeFor(lang) }])),
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

/** Translate a main-process string. */
export const mt = translator.t.bind(translator);

/** Called with the stored setting at startup and on every settings save. */
export function setMainLanguage(language: unknown): void {
  const next = (SUPPORTED as readonly unknown[]).includes(language) ? (language as MainLanguage) : 'en';
  if (translator.language !== next) void translator.changeLanguage(next);
}
