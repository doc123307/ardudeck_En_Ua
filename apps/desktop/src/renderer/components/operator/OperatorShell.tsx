/**
 * What the app is in operator mode: a slim header, the operator screen and the About
 * page. No navigation rail, no connection panel, no console - those belong to the full
 * UI, which opens only for the administrator (see OperatorAbout).
 */

import { useEffect, useState } from 'react';
import { Info, Plug, Unplug } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useUpdateStore } from '../../stores/update-store';
import { useSettingsStore } from '../../stores/settings-store';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { OperatorScreen } from './OperatorScreen';
import { OperatorAbout } from './OperatorAbout';
import { useOperatorConnection } from './useOperatorConnection';
import { describeConnection } from './operator-logic';
import iconImage from '../../assets/icon.png';
import { t } from '../../i18n';

type OperatorPage = 'screen' | 'about';

const HEADER_BTN = 'flex h-9 items-center gap-2 rounded-lg border border-subtle bg-surface px-3 text-sm font-medium text-content transition-colors hover:bg-surface-raised';

export function OperatorShell() {
  const [page, setPage] = useState<OperatorPage>('screen');
  const { options, linkUp, busy, connectionState, connectNow, disconnectNow } = useOperatorConnection();
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const fetchVersion = useUpdateStore((s) => s.fetchVersion);
  const voiceAlertsMuted = useSettingsStore((s) => s.voiceAlertsMuted);
  const setVoiceAlertsMuted = useSettingsStore((s) => s.setVoiceAlertsMuted);

  useTheme();
  useEffect(() => { void fetchVersion(); }, [fetchVersion]);

  const linkText = linkUp
    ? connectionState.isStale ? t('operator.OperatorShell.linkStale') : t('operator.OperatorShell.linkUp')
    : busy ? t('operator.OperatorShell.linkWaiting')
      : options ? t('operator.OperatorShell.linkDown') : t('operator.OperatorShell.linkNotSet');
  const dot = linkUp
    ? connectionState.isStale ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
    : busy ? 'bg-amber-400 animate-pulse' : 'bg-content-tertiary';

  return (
    <div className="flex h-screen flex-col bg-surface-base">
      <header className="relative z-50 flex h-14 shrink-0 items-center gap-3 border-b border-subtle bg-surface-nav pr-4">
        <div className="flex w-14 shrink-0 items-center justify-center">
          <img src={iconImage} alt="" className="h-8 w-8 rounded-md object-cover" />
        </div>
        <h1 className="whitespace-nowrap text-lg font-bold uppercase tracking-wide text-content">{t('brand.name')}</h1>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div
            className="flex h-9 min-w-0 items-center gap-2.5 rounded-full border border-subtle bg-surface px-3"
            data-tip={options ? describeConnection(options) : t('operator.OperatorShell.linkNotSetTip')}
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
            <span className="truncate text-sm font-medium text-content-secondary">{linkText}</span>
          </div>

          {linkUp || busy ? (
            <button onClick={disconnectNow} className={HEADER_BTN} data-tip={t('operator.OperatorShell.disconnectTip')}>
              <Unplug className="h-4 w-4" />
              <span className="whitespace-nowrap">{t('operator.OperatorShell.disconnect')}</span>
            </button>
          ) : (
            <button onClick={connectNow} disabled={!options} className={`${HEADER_BTN} disabled:cursor-not-allowed disabled:opacity-40`}>
              <Plug className="h-4 w-4" />
              <span className="whitespace-nowrap">{t('operator.OperatorShell.connect')}</span>
            </button>
          )}

          <button
            onClick={() => setVoiceAlertsMuted(!voiceAlertsMuted)}
            data-tip={voiceAlertsMuted ? t('header.voiceMuted') : t('header.voiceOn')}
            className={`${HEADER_BTN} px-2.5 ${voiceAlertsMuted ? 'text-content-tertiary' : ''}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              {voiceAlertsMuted
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.7-.51-1.94-1.36a9.02 9.02 0 010-4.86c.24-.85 1.06-1.36 1.94-1.36h2.24z" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M19.11 5.11a9 9 0 010 13.78M16.46 7.76a5.25 5.25 0 010 8.48M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.7-.51-1.94-1.36a9.02 9.02 0 010-4.86c.24-.85 1.06-1.36 1.94-1.36h2.24z" />}
            </svg>
          </button>

          <button
            onClick={() => setPage(page === 'about' ? 'screen' : 'about')}
            className={`${HEADER_BTN} ${page === 'about' ? 'border-blue-500/60 bg-blue-600/20' : ''}`}
          >
            <Info className="h-4 w-4" />
            <span className="whitespace-nowrap">{t('operator.OperatorShell.about')}</span>
            {currentVersion && <span className="whitespace-nowrap text-xs text-content-tertiary">v{currentVersion}</span>}
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {/* The screen stays mounted under About: video, recording and the STOP key must not stop for a look at the version. */}
        <div className={page === 'screen' ? 'h-full' : 'hidden'}>
          <ErrorBoundary label="operator screen"><OperatorScreen /></ErrorBoundary>
        </div>
        {page === 'about' && (
          <ErrorBoundary label="operator about"><OperatorAbout onBack={() => setPage('screen')} /></ErrorBoundary>
        )}
      </main>
    </div>
  );
}
