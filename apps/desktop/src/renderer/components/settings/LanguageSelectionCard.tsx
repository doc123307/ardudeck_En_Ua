import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_NATIVE_NAMES, SUPPORTED_LANGUAGES, isAppLanguage } from '../../i18n';
import { useSettingsStore } from '../../stores/settings-store';

export function LanguageSelectionCard() {
  const { t } = useTranslation();
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  return (
    <div className="bg-gradient-to-br from-surface to-surface-base rounded-xl border border-subtle p-4 mb-4">
      <div className="flex items-center gap-3 mb-1">
        <Languages className="w-4 h-4 text-blue-400" aria-hidden="true" />
        <div className="text-sm font-medium text-content">{t('settings.language.title')}</div>
      </div>
      <p className="text-xs text-content-secondary mb-4">{t('settings.language.description')}</p>

      <select
        value={language}
        onChange={(event) => {
          if (isAppLanguage(event.target.value)) setLanguage(event.target.value);
        }}
        aria-label={t('settings.language.title')}
        className="w-full sm:w-64 bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-content focus:outline-none focus:border-blue-500/50"
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_NATIVE_NAMES[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
