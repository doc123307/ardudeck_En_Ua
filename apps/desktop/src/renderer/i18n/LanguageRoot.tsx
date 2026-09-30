import { Fragment, useEffect, useState, type ReactNode } from 'react';
import i18n from './index';

/**
 * Remounts the tree when the language changes. Most of the UI calls the plain `t()`
 * rather than the hook, so a remount is what makes every label re-read its text.
 * Zustand stores live outside React, so connection and vehicle state survive it.
 */
export function LanguageRoot({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(i18n.language);

  useEffect(() => {
    const onChange = (next: string) => setLanguage(next);
    i18n.on('languageChanged', onChange);
    return () => i18n.off('languageChanged', onChange);
  }, []);

  return <Fragment key={language}>{children}</Fragment>;
}
