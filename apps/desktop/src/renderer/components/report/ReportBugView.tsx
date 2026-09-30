/**
 * Report Bug View
 *
 * UI for creating encrypted bug reports that can be shared with the dev team.
 * Collects app logs, system info, and optionally board configuration.
 */

import { useState, useEffect, useRef } from 'react';
import { useConnectionStore } from '../../stores/connection-store';
import { useParameterStore } from '../../stores/parameter-store';
import { firmwareLabel } from '../../../shared/firmware-types';
import { t } from '../../i18n';

interface ProgressState {
  stage: string;
  message: string;
}

export default function ReportBugView() {
  const { connectionState } = useConnectionStore();
  const { parameters } = useParameterStore();

  const [description, setDescription] = useState('');
  const [includeLogs, setIncludeLogs] = useState(true);
  const [includeBoardDump, setIncludeBoardDump] = useState(false);
  const [logHours, setLogHours] = useState(24);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const generatingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [encryptionInfo, setEncryptionInfo] = useState<{
    isPlaceholderKey: boolean;
    keyVersion: number;
    formatVersion: number;
  } | null>(null);
  const [showWhatWeCollect, setShowWhatWeCollect] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);

  // Check if board is connected and what type
  const isConnected = connectionState.isConnected;
  const isMspBoard = connectionState.protocol === 'msp';
  const isMavlinkBoard = connectionState.protocol === 'mavlink';
  const boardInfo = isMspBoard
    ? `${connectionState.fcVariant} ${connectionState.fcVersion}`
    : isMavlinkBoard
      ? [firmwareLabel(connectionState), connectionState.vehicleType].filter(Boolean).join(' ') || 'MAVLink vehicle'
      : 'Not connected';

  // Fetch encryption info on mount
  useEffect(() => {
    window.electronAPI.reportGetEncryptionInfo().then(setEncryptionInfo);
  }, []);

  // Listen for progress updates
  useEffect(() => {
    const cleanup = window.electronAPI.onReportProgress((p) => {
      // a stage event landing after the save resolved must not bring the spinner back
      if (generatingRef.current) setProgress(p);
    });
    return () => { cleanup(); };
  }, []);

  const handleGenerateReport = async () => {
    if (!hasConsented) {
      setError(t('report.ReportBugView.pleaseAcknowledgeTheDataCollectionConsent'));
      return;
    }

    setIsGenerating(true);
    generatingRef.current = true;
    setError(null);
    setSuccess(null);
    setProgress(null);

    try {
      let boardDump: unknown | null = null;

      // Collect board dump if requested and connected
      if (includeBoardDump && isConnected) {
        if (isMspBoard) {
          setProgress({ stage: 'board_dump', message: t('report.ReportBugView.collectingBoardConfigurationCliMode') });
          const result = await window.electronAPI.reportCollectMspDump();
          if (!result.success) {
            throw new Error(result.error || 'Failed to collect board dump');
          }
          boardDump = result.dump;
        } else if (isMavlinkBoard) {
          setProgress({ stage: 'board_dump', message: t('report.ReportBugView.collectingBoardConfigurationMavlink') });
          const result = await window.electronAPI.reportCollectMavlinkDump();
          if (result.success && result.dump) {
            // Fill in parameters from the parameter store
            const mavlinkDump = result.dump as {
              type: 'mavlink';
              parameters: Record<string, number>;
              [key: string]: unknown;
            };
            mavlinkDump.parameters = Object.fromEntries(
              Array.from(parameters.entries()).map(([k, v]) => [k, v.value])
            );
            boardDump = mavlinkDump;
          }
        }
      }

      // Save the report
      setProgress({ stage: 'saving', message: t('report.ReportBugView.creatingEncryptedReport') });
      const result = await window.electronAPI.reportSave(
        description || 'No description provided',
        boardDump,
        includeLogs ? logHours : 0
      );

      if (result.success) {
        setSuccess(`Report saved to: ${result.filePath}`);
        setDescription('');
        setHasConsented(false);
      } else {
        throw new Error(result.error || 'Failed to save report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('report.ReportBugView.unknownError'));
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
      setProgress(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-base overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
        <div className="flex items-center gap-3">
          {/* Bug icon */}
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-content">{t('report.ReportBugView.reportABug')}</h1>
            <p className="text-xs text-content-secondary">{t('report.ReportBugView.createAnEncryptedReportToShare')}</p>
          </div>
        </div>

        {/* Connection status */}
        <div className="text-sm text-content-secondary">
          {isConnected ? (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {boardInfo}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-content-tertiary" />
              {t('report.ReportBugView.notConnected')}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-6 max-w-2xl">
        {/* Placeholder key warning */}
        {encryptionInfo?.isPlaceholderKey && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm">
            <span className="font-semibold">{t('report.ReportBugView.developmentMode')}</span> {t('report.ReportBugView.usingPlaceholderEncryptionKeyReportsCreated')}
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-content mb-2">
            {t('report.ReportBugView.describeTheIssue')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('report.ReportBugView.whatHappenedWhatWereYouTrying')}
            className="w-full h-32 px-3 py-2 bg-surface-input border border-border rounded-lg text-content placeholder-content-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none"
          />
        </div>

        {/* Options */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-content">{t('report.ReportBugView.whatToInclude')}</h3>

          {/* Include logs */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeLogs}
              onChange={(e) => setIncludeLogs(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-border bg-surface-input text-blue-500 focus:ring-blue-500/50"
            />
            <div>
              <span className="text-content">{t('report.ReportBugView.appLogs')}</span>
              <p className="text-xs text-content-secondary">
                {t('report.ReportBugView.includesErrorMessagesAndDiagnosticInformation')}{' '}
                <select
                  value={logHours}
                  onChange={(e) => setLogHours(Number(e.target.value))}
                  className="bg-surface-input border border-border rounded px-1 text-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value={1}>{t('report.ReportBugView.n1Hour')}</option>
                  <option value={6}>{t('report.ReportBugView.n6Hours')}</option>
                  <option value={24}>{t('report.ReportBugView.n24Hours')}</option>
                  <option value={72}>{t('report.ReportBugView.n3Days')}</option>
                  <option value={168}>{t('report.ReportBugView.n7Days')}</option>
                </select>
              </p>
            </div>
          </label>

          {/* Include board dump */}
          <label className={`flex items-start gap-3 ${!isConnected ? 'opacity-50' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={includeBoardDump}
              onChange={(e) => setIncludeBoardDump(e.target.checked)}
              disabled={!isConnected}
              className="mt-1 w-4 h-4 rounded border-border bg-surface-input text-blue-500 focus:ring-blue-500/50 disabled:opacity-50"
            />
            <div>
              <span className="text-content">{t('report.ReportBugView.boardConfiguration')}</span>
              <p className="text-xs text-content-secondary">
                {!isConnected ? (
                  t('report.ReportBugView.connectToABoardToInclude')
                ) : isMspBoard ? (
                  <span className="text-yellow-400">
                    {t('report.ReportBugView.willEnterCliModeAndReboot')}
                  </span>
                ) : (
                  t('report.ReportBugView.includesAllParametersAndSystemStatus')
                )}
              </p>
            </div>
          </label>
        </div>

        {/* What we collect (expandable) */}
        <div className="border border-subtle rounded-lg overflow-hidden">
          <button
            onClick={() => setShowWhatWeCollect(!showWhatWeCollect)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-content hover:bg-surface-input transition-colors"
          >
            <span>{t('report.ReportBugView.whatDataWillBeCollected')}</span>
            <svg
              className={`w-4 h-4 transition-transform ${showWhatWeCollect ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showWhatWeCollect && (
            <div className="px-4 pb-4 text-xs text-content-secondary space-y-2 border-t border-subtle pt-3">
              <p><strong className="text-content-secondary">{t('report.ReportBugView.included')}</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('report.ReportBugView.errorMessagesAndStackTraces')}</li>
                <li>{t('report.ReportBugView.appVersionAndSessionInfo')}</li>
                <li>{t('report.ReportBugView.operatingSystemAndArchitecture')}</li>
                <li>{t('report.ReportBugView.electronNodeJsVersions')}</li>
                <li>{t('report.ReportBugView.mavlinkMspProtocolMessagesNoPersonal')}</li>
                <li>{t('report.ReportBugView.boardConfigurationIfSelected')}</li>
                <li>{t('report.ReportBugView.yourDescriptionOfTheIssue')}</li>
              </ul>
              <p className="mt-3"><strong className="text-content-secondary">{t('report.ReportBugView.privacyProtected')}</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('report.ReportBugView.homeDirectoryPathsAreSanitized')}</li>
                <li>{t('report.ReportBugView.gpsCoordinatesAreRedacted')}</li>
                <li>{t('report.ReportBugView.emailAddressesAreRedacted')}</li>
                <li>{t('report.ReportBugView.ipAddressesAreRedacted')}</li>
                <li>{t('report.ReportBugView.passwordsAndCredentialsAreRedacted')}</li>
              </ul>
              <p className="mt-3"><strong className="text-content-secondary">{t('report.ReportBugView.encryption')}</strong></p>
              <p className="ml-2">
                {t('report.ReportBugView.theReportIsSecurelyEncryptedAnd')}
              </p>
            </div>
          )}
        </div>

        {/* Consent */}
        <label className="flex items-start gap-3 cursor-pointer p-3 bg-surface-input border border-subtle rounded-lg">
          <input
            type="checkbox"
            checked={hasConsented}
            onChange={(e) => setHasConsented(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-border bg-surface-input text-blue-500 focus:ring-blue-500/50"
          />
          <div className="text-sm text-content">
            {t('report.ReportBugView.iUnderstandThatTheCollectedData')}
          </div>
        </label>

        {/* Progress */}
        {progress && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {progress.message}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerateReport}
          disabled={isGenerating || !hasConsented}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-surface-raised disabled:text-content-secondary text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('report.ReportBugView.generatingReport')}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t('report.ReportBugView.generateSaveReport')}
            </>
          )}
        </button>

        {/* Info about the file */}
        <p className="text-xs text-content-secondary text-center">
          {t('report.ReportBugView.theReportWillBeSavedAs')} <code className="bg-surface-input px-1 rounded">.deckreport</code> {t('report.ReportBugView.fileThatYouCanShareWith')}
        </p>
      </div>
    </div>
  );
}
