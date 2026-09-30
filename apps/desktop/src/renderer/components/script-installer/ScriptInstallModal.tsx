/**
 * ArduDeck script install modal.
 *
 * Three stages, driven by the install state machine:
 *   1. Explainer  - "this is what we're about to do" + experimental warning
 *   2. Preview    - manifest, prereqs, full source code, SHA256 + consent
 *   3. Progress   - live progress as the install runs
 *
 * The component is reactive: it subscribes to InstallPhase events from the
 * main process and re-renders accordingly. All FC mutations are driven by the
 * main process - this UI just emits intent (begin / grant / cancel / apply-fix).
 */

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useInstallerState } from './useInstallerState';
import { LuaCodePreview } from './LuaCodePreview';
import { PreflightChecksList } from './PreflightChecksList';
import { useConnectionStore } from '../../stores/connection-store';
import type { PreflightCheck, PreflightFix, ScriptManifest } from '../../../shared/script-installer-types';
import { t } from '../../i18n';

type Stage = 'explainer' | 'preview' | 'progress' | 'success' | 'error' | 'manual';

interface ScriptInstallModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when the install completes successfully (e.g. to immediately fire the original command). */
  onSuccess?: () => void;
}

export function ScriptInstallModal({ open, onClose, onSuccess }: ScriptInstallModalProps) {
  const phase = useInstallerState();
  const [stage, setStage] = useState<Stage>('explainer');
  const [manifest, setManifest] = useState<ScriptManifest | null>(null);
  const [source, setSource] = useState<string>('');
  const [previewChecks, setPreviewChecks] = useState<PreflightCheck[]>([]);
  const [busyFix, setBusyFix] = useState<string | null>(null);

  // Reset stage whenever the modal opens fresh
  useEffect(() => {
    if (open) {
      setStage('explainer');
      setBusyFix(null);
    }
  }, [open]);

  // React to phase changes pushed from main
  useEffect(() => {
    if (!phase) return;
    if (phase.phase === 'awaiting_consent') {
      setManifest(phase.manifest);
      setSource(phase.sourceCode);
      setPreviewChecks(phase.checks);
      setBusyFix(null);
      setStage('preview');
    } else if (phase.phase === 'preflight') {
      // Initial preflight emit - waiting for the awaiting_consent that follows.
      // Don't change stage yet to avoid flicker.
    } else if (phase.phase === 'configuring_params' || phase.phase === 'rebooting' || phase.phase === 'probing_capability' || phase.phase === 'uploading' || phase.phase === 'awaiting_heartbeat' || phase.phase === 'verifying') {
      setStage('progress');
    } else if (phase.phase === 'success') {
      setStage('success');
      onSuccess?.();
    } else if (phase.phase === 'manual_install_needed') {
      setStage('manual');
    } else if (phase.phase === 'error') {
      setStage('error');
    }
  }, [phase, onSuccess]);

  const handleContinueFromExplainer = useCallback(async () => {
    // Begin starts the flow on the main process; we'll switch to preview when
    // the awaiting_consent phase event arrives.
    await window.electronAPI?.scriptInstallerBegin?.();
  }, []);

  const handleGrantConsent = useCallback(async () => {
    await window.electronAPI?.scriptInstallerGrantConsent?.();
  }, []);

  const handleCancel = useCallback(async () => {
    await window.electronAPI?.scriptInstallerCancel?.();
    onClose();
  }, [onClose]);

  const handleApplyFix = useCallback(async (check: PreflightCheck, fix: PreflightFix) => {
    setBusyFix(check.id);
    try {
      await window.electronAPI?.scriptInstallerApplyFix?.(fix);
    } finally {
      setBusyFix(null);
    }
  }, []);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[3000] bg-black/70 flex items-center justify-center p-6">
      <div className="bg-surface-solid rounded-xl border border-default shadow-2xl w-full max-w-[1100px] max-h-[92vh] flex flex-col overflow-hidden">
        {stage === 'explainer' && <ExplainerStage onContinue={handleContinueFromExplainer} onCancel={handleCancel} />}
        {/* The connection-state banner / disabled button live inside ExplainerStage */}
        {stage === 'preview' && manifest && (
          <PreviewStage
            manifest={manifest}
            source={source}
            checks={previewChecks}
            busyFix={busyFix}
            onApplyFix={handleApplyFix}
            onGrantConsent={handleGrantConsent}
            onCancel={handleCancel}
          />
        )}
        {stage === 'progress' && phase && <ProgressStage phase={phase} onCancel={handleCancel} />}
        {stage === 'success' && <SuccessStage onClose={onClose} />}
        {stage === 'manual' && phase && phase.phase === 'manual_install_needed' && (
          <ManualInstallStage
            manifest={phase.manifest}
            ftpError={phase.ftpError}
            targetPath={phase.targetPath}
            onClose={onClose}
            onRetry={() => setStage('explainer')}
          />
        )}
        {stage === 'error' && phase && phase.phase === 'error' && (
          <ErrorStage message={phase.message} retriable={phase.retriable} onClose={onClose} onRetry={() => setStage('explainer')} />
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Stage 1: Explainer ──────────────────────────────────────────────────────

function ExplainerStage({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  // Live connection state - controls whether Continue is enabled, since the
  // installer needs the FC to read params and run preflight.
  const isConnected = useConnectionStore(s => s.connectionState.isConnected);
  const isMavlink = useConnectionStore(s => s.connectionState.protocol === 'mavlink');
  const blockReason = !isConnected
    ? 'Connect to a flight controller to continue.'
    : !isMavlink
      ? 'Vehicle is connected via MSP. The Lua installer requires a MAVLink connection (ArduPilot).'
      : null;
  const blocked = blockReason !== null;

  return (
    <>
      <div className="px-6 py-5 border-b border-subtle">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider rounded bg-rose-600/20 text-rose-400 border border-rose-600/40">
            EXPERIMENTAL
          </span>
          <h2 className="text-lg font-semibold text-content">{t('script_installer.ScriptInstallModal.installArdudeckCommandsOnThisVehicle')}</h2>
        </div>
        <p className="text-sm text-content-secondary leading-relaxed">
          {t('script_installer.ScriptInstallModal.someCommandsArenTSupportedNatively')}
        </p>
      </div>

      <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
        {blocked && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200 flex items-start gap-2">
            <svg className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div className="font-semibold text-rose-300 mb-0.5">{t('script_installer.ScriptInstallModal.noFlightControllerConnected')}</div>
              <div className="text-rose-200/90 leading-snug">{blockReason}</div>
            </div>
          </div>
        )}

        <InfoCard variant="info" title={t('script_installer.ScriptInstallModal.whatGetsInstalled')}>
          <ul className="list-disc list-inside space-y-1 text-content-secondary">
            <li>{t('script_installer.ScriptInstallModal.oneLuaScript315Kb')} <code className="font-mono text-content">/APM/scripts/</code></li>
            <li>{t('script_installer.ScriptInstallModal.possiblyAParameterChangeEG')} <code className="font-mono text-content">SCR_ENABLE = 1</code>{t('script_installer.ScriptInstallModal.andARebootIfScriptingIsn')}</li>
            <li>{t('script_installer.ScriptInstallModal.aRegistryEntryOnThisComputer')}</li>
          </ul>
        </InfoCard>

        <InfoCard variant="success" title={t('script_installer.ScriptInstallModal.whyItSSafe')}>
          <ul className="list-disc list-inside space-y-1 text-content-secondary">
            <li>{t('script_installer.ScriptInstallModal.runsOnTheVehicleNotThe')}</li>
            <li>{t('script_installer.ScriptInstallModal.sandboxedCannotAffectStabilizationArmingOr')}</li>
            <li>{t('script_installer.ScriptInstallModal.youLlSeeTheFullSource')}</li>
            <li>{t('script_installer.ScriptInstallModal.removableAnyTimeFromSettings')}</li>
          </ul>
        </InfoCard>

        <InfoCard variant="warn" title={t('script_installer.ScriptInstallModal.whatCanGoWrong')}>
          <ul className="list-disc list-inside space-y-1 text-content-secondary">
            <li>{t('script_installer.ScriptInstallModal.thisFeatureIs')} <strong className="text-amber-400">{t('script_installer.ScriptInstallModal.experimental')}</strong>{t('script_installer.ScriptInstallModal.theScriptCouldFailToLoad')}</li>
            <li>{t('script_installer.ScriptInstallModal.if')} <code className="font-mono text-content">SCR_ENABLE</code> {t('script_installer.ScriptInstallModal.needsToChangeTheFcWill')}</li>
            <li>{t('script_installer.ScriptInstallModal.benchTestTheInstalledCommandBefore')}</li>
          </ul>
        </InfoCard>
      </div>

      <div className="px-6 py-4 border-t border-subtle flex justify-between items-center">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-content-secondary hover:text-content">
          {t('script_installer.ScriptInstallModal.cancel')}
        </button>
        <div className="flex items-center gap-3">
          {blocked && (
            <span className="text-xs text-rose-400">{blockReason}</span>
          )}
          <button
            onClick={onContinue}
            disabled={blocked}
            className={`px-4 py-2 text-sm font-medium rounded ${
              blocked
                ? 'bg-surface-raised text-content-tertiary cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
            title={blocked ? blockReason ?? '' : undefined}
          >
            {t('script_installer.ScriptInstallModal.continue')}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Stage 2: Preview + Consent ──────────────────────────────────────────────

function PreviewStage({
  manifest, source, checks, busyFix,
  onApplyFix, onGrantConsent, onCancel,
}: {
  manifest: ScriptManifest;
  source: string;
  checks: PreflightCheck[];
  busyFix: string | null;
  onApplyFix: (check: PreflightCheck, fix: PreflightFix) => void;
  onGrantConsent: () => void;
  onCancel: () => void;
}) {
  const blocked = checks.some(c => c.severity === 'block');
  return (
    <>
      <div className="px-6 py-4 border-b border-subtle">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider rounded bg-rose-600/20 text-rose-400 border border-rose-600/40">
            EXPERIMENTAL
          </span>
          <h2 className="text-base font-semibold text-content">{t('script_installer.ScriptInstallModal.reviewInstall')}</h2>
        </div>
        <p className="text-xs text-content-secondary">
          {t('script_installer.ScriptInstallModal.verifyTheSourceMatchesTheSha256')}
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] flex-1 min-h-0 overflow-hidden">
        {/* Left: code preview */}
        <div className="p-4 min-h-0 overflow-hidden flex flex-col">
          <LuaCodePreview
            source={source}
            filename={manifest.filename}
            version={manifest.version}
            sha256={manifest.sha256}
          />
        </div>

        {/* Right: manifest summary + checks */}
        <div className="p-4 border-l border-subtle overflow-y-auto space-y-4 bg-surface">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-content-secondary mb-2">{t('script_installer.ScriptInstallModal.commandsProvided')}</h3>
            <div className="space-y-2">
              {manifest.commands.map(cmd => (
                <div key={cmd.name} className="rounded border border-subtle p-2 bg-surface-raised text-xs">
                  <div className="font-semibold text-content mb-1">{cmd.label}</div>
                  <p className="text-content-secondary leading-snug">{cmd.description}</p>
                  <div className="mt-1 text-[10px] font-mono text-content-tertiary">cmd {cmd.trigger}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-content-secondary mb-2">{t('script_installer.ScriptInstallModal.vehiclePrerequisites')}</h3>
            <PreflightChecksList checks={checks} busyFix={busyFix} onApplyFix={onApplyFix} />
          </section>

          <section className="text-[11px] text-content-tertiary">
            {t('script_installer.ScriptInstallModal.heartbeat')} <span className="font-mono text-content-secondary">{manifest.heartbeat.name}</span> {t('script_installer.ScriptInstallModal.every')} {manifest.heartbeat.intervalSec}s
          </section>
        </div>
      </div>

      <div className="px-6 py-3 border-t border-subtle flex items-center justify-between bg-surface">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-content-secondary hover:text-content">
          {t('script_installer.ScriptInstallModal.cancel')}
        </button>
        <div className="flex items-center gap-3">
          {blocked && (
            <span className="text-xs text-rose-400">{t('script_installer.ScriptInstallModal.resolveBlockingChecksFirst')}</span>
          )}
          <button
            onClick={onGrantConsent}
            disabled={blocked}
            className={`px-4 py-2 text-sm font-medium rounded ${
              blocked
                ? 'bg-surface-raised text-content-tertiary cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {t('script_installer.ScriptInstallModal.iVeReviewedInstall')}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Stage 3: Progress ───────────────────────────────────────────────────────

function ProgressStage({ phase, onCancel }: { phase: NonNullable<ReturnType<typeof useInstallerState>>; onCancel: () => void }) {
  // Linear progression of progress phases. A row is `done` once we've moved
  // past it on the timeline; `active` exactly when its own phase is current.
  const PHASE_ORDER = ['preflight', 'awaiting_consent', 'configuring_params', 'rebooting', 'probing_capability', 'uploading', 'awaiting_heartbeat', 'verifying', 'success'] as const;
  type Phase = typeof PHASE_ORDER[number];
  const ord = (p: string) => {
    const i = PHASE_ORDER.indexOf(p as Phase);
    return i < 0 ? -1 : i;
  };
  const currentOrd = ord(phase.phase);
  const isPast = (p: Phase) => currentOrd > ord(p);
  const isCurrent = (p: Phase) => phase.phase === p;

  return (
    <>
      <div className="px-6 py-5 border-b border-subtle">
        <h2 className="text-base font-semibold text-content">{t('script_installer.ScriptInstallModal.installingArdudeckCommands')}</h2>
      </div>

      <div className="px-6 py-6 space-y-3 flex-1 min-h-0 overflow-y-auto">
        <ProgressRow done label={t('script_installer.ScriptInstallModal.verifyingPrerequisites')} />
        <ProgressRow
          done={isPast('configuring_params')}
          active={isCurrent('configuring_params')}
          label={
            phase.phase === 'configuring_params'
              ? `Setting ${phase.param} = ${phase.after}` + (phase.rebootRequired ? ' (reboot will follow)' : '')
              : t('script_installer.ScriptInstallModal.configureParameters')
          }
        />
        <ProgressRow
          done={isPast('rebooting')}
          active={isCurrent('rebooting')}
          label={
            phase.phase === 'rebooting'
              ? t('script_installer.ScriptInstallModal.rebootingFlightControllerSS', { secondsWaited: phase.secondsWaited, estimatedTotalSec: phase.estimatedTotalSec })
              : t('script_installer.ScriptInstallModal.rebootIfRequired')
          }
        >
          {phase.phase === 'rebooting' && (
            <div className="mt-1 h-1.5 rounded-full bg-surface-raised overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${Math.min(100, Math.round((phase.secondsWaited / Math.max(1, phase.estimatedTotalSec)) * 100))}%` }}
              />
            </div>
          )}
        </ProgressRow>
        <ProgressRow
          done={isPast('probing_capability')}
          active={isCurrent('probing_capability')}
          label={
            phase.phase === 'probing_capability'
              ? t('script_installer.ScriptInstallModal.probingFcForWriteCapability')
              : t('script_installer.ScriptInstallModal.probeFcWritability')
          }
        />
        <ProgressRow
          done={isPast('uploading')}
          active={isCurrent('uploading')}
          label={
            phase.phase === 'uploading'
              ? t('script_installer.ScriptInstallModal.uploadingB', { filename: phase.filename, v2: Math.round((phase.bytesWritten / Math.max(1, phase.bytesTotal)) * 100), bytesWritten: phase.bytesWritten, bytesTotal: phase.bytesTotal })
              : t('script_installer.ScriptInstallModal.uploadScript')
          }
        >
          {phase.phase === 'uploading' && (
            <div className="mt-1 h-1.5 rounded-full bg-surface-raised overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${Math.round((phase.bytesWritten / Math.max(1, phase.bytesTotal)) * 100)}%` }}
              />
            </div>
          )}
        </ProgressRow>
        <ProgressRow
          done={isPast('awaiting_heartbeat')}
          active={isCurrent('awaiting_heartbeat')}
          label={
            phase.phase === 'awaiting_heartbeat'
              ? t('script_installer.ScriptInstallModal.waitingForScriptHeartbeatSTimeout', { timeoutSec: phase.timeoutSec })
              : t('script_installer.ScriptInstallModal.waitForScriptHeartbeat')
          }
        />
        <ProgressRow
          done={isPast('verifying')}
          active={isCurrent('verifying')}
          label={t('script_installer.ScriptInstallModal.verifyingRegisteredVersion')}
        />
      </div>

      <div className="px-6 py-4 border-t border-subtle flex justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-content-secondary hover:text-content">
          {t('script_installer.ScriptInstallModal.cancel')}
        </button>
      </div>
    </>
  );
}

function ProgressRow({ done, active, label, children }: { done?: boolean; active?: boolean; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className={`shrink-0 w-5 text-center ${done ? 'text-emerald-400' : active ? 'text-blue-400' : 'text-content-tertiary'}`}>
        {done ? '✓' : active ? '⟳' : '○'}
      </span>
      <div className={`flex-1 ${done ? 'text-content' : active ? 'text-content' : 'text-content-tertiary'}`}>
        {label}
        {children}
      </div>
    </div>
  );
}

// ─── Stage 4: Success / Error ────────────────────────────────────────────────

function SuccessStage({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="px-6 py-5 border-b border-subtle">
        <h2 className="text-base font-semibold text-emerald-400">{t('script_installer.ScriptInstallModal.installed')}</h2>
      </div>
      <div className="px-6 py-6 text-sm text-content-secondary">
        {t('script_installer.ScriptInstallModal.ardudeckCommandsAreNowAvailableOn')}
      </div>
      <div className="px-6 py-4 border-t border-subtle flex justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded">
          {t('script_installer.ScriptInstallModal.done')}
        </button>
      </div>
    </>
  );
}

// ─── Stage 4b: Manual install fallback ───────────────────────────────────────

function ManualInstallStage({ manifest, ftpError, targetPath, onClose, onRetry }: {
  manifest: ScriptManifest;
  ftpError: string;
  targetPath: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await window.electronAPI?.scriptInstallerSaveToDisk?.();
      if (result?.success && result.filePath) {
        setSavedPath(result.filePath);
      } else if (result?.error && result.error !== 'Cancelled') {
        setSaveError(result.error);
      }
    } finally {
      setSaving(false);
    }
  }, []);

  return (
    <>
      <div className="px-6 py-5 border-b border-subtle">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider rounded bg-amber-600/20 text-amber-400 border border-amber-600/40">
            MANUAL STEP REQUIRED
          </span>
          <h2 className="text-base font-semibold text-content">{t('script_installer.ScriptInstallModal.automaticInstallNotAvailable')}</h2>
        </div>
        <p className="text-xs text-content-secondary leading-relaxed">
          {t('script_installer.ScriptInstallModal.yourFlightControllerSMavlinkFtp')}
        </p>
      </div>

      <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 min-h-0 text-sm">
        {/* Step 1: download */}
        <ManualStep number={1} title={t('script_installer.ScriptInstallModal.downloadTheScript')}>
          <p className="text-content-secondary mb-2">
            {t('script_installer.ScriptInstallModal.save')} <code className="font-mono text-content">{manifest.filename}</code> {t('script_installer.ScriptInstallModal.toYourComputerTheFileIs')}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded"
            >
              {saving ? t('script_installer.ScriptInstallModal.saving') : savedPath ? t('script_installer.ScriptInstallModal.saveAgain') : t('script_installer.ScriptInstallModal.downloadLua')}
            </button>
            {savedPath && (
              <span className="text-[11px] text-emerald-400 font-mono truncate" title={savedPath}>
                {t('script_installer.ScriptInstallModal.savedTo')} {savedPath}
              </span>
            )}
          </div>
          {saveError && <div className="mt-1 text-[11px] text-rose-400">{saveError}</div>}
          <div className="mt-2 text-[11px] text-content-tertiary font-mono">
            {t('script_installer.ScriptInstallModal.sha256')} {manifest.sha256}
          </div>
        </ManualStep>

        {/* Step 2: copy to FC */}
        <ManualStep number={2} title={t('script_installer.ScriptInstallModal.copyItToTheFlightController')}>
          <p className="text-content-secondary mb-2">
            {t('script_installer.ScriptInstallModal.copyTheFileTo')} <code className="font-mono text-content">{targetPath.replace(`/${manifest.filename}`, '/')}</code>
            {' '}{t('script_installer.ScriptInstallModal.onTheFcSSdCard')}
          </p>
          <ul className="list-disc list-inside space-y-1 text-content-secondary text-xs">
            <li>{t('script_installer.ScriptInstallModal.pullTheSdCardAndCopy')}</li>
            <li>{t('script_installer.ScriptInstallModal.useMissionPlannerConfigMavftpNavigate')} <code className="font-mono">/APM/scripts/</code> {t('script_installer.ScriptInstallModal.uploadFile')}</li>
            <li>{t('script_installer.ScriptInstallModal.if')} <code className="font-mono">/APM/scripts/</code> {t('script_installer.ScriptInstallModal.doesnTExistOnYourSd')}</li>
          </ul>
        </ManualStep>

        {/* Step 3: reboot */}
        <ManualStep number={3} title={t('script_installer.ScriptInstallModal.rebootTheFlightController')}>
          <p className="text-content-secondary">
            {t('script_installer.ScriptInstallModal.ardupilotLoadsScriptsOnBootAfter')}
          </p>
        </ManualStep>

        {/* Step 4: come back */}
        <ManualStep number={4} title={t('script_installer.ScriptInstallModal.comeBackToArdudeckItLl')}>
          <p className="text-content-secondary">
            {t('script_installer.ScriptInstallModal.onceTheScriptStartsRunningIt')}<code className="font-mono text-content">{manifest.heartbeat.name}</code>{t('script_installer.ScriptInstallModal.ardudeckListensForThisAndWill')}
          </p>
        </ManualStep>

        {/* Technical detail */}
        <div className="rounded-lg border border-subtle bg-surface-input px-3 py-2 text-[11px] text-content-tertiary">
          <span className="font-semibold text-content-secondary">{t('script_installer.ScriptInstallModal.technicalReason')} </span>
          <span className="font-mono">{ftpError}</span>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-subtle flex justify-between">
        <button onClick={onClose} className="px-4 py-2 text-sm text-content-secondary hover:text-content">
          {t('script_installer.ScriptInstallModal.close')}
        </button>
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm font-medium bg-surface-raised hover:bg-surface text-content border border-subtle rounded"
        >
          {t('script_installer.ScriptInstallModal.retryAutomaticInstall')}
        </button>
      </div>
    </>
  );
}

function ManualStep({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-subtle bg-surface-input p-3">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
          {number}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-content mb-1">{title}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

function ErrorStage({ message, retriable, onClose, onRetry }: { message: string; retriable: boolean; onClose: () => void; onRetry: () => void }) {
  return (
    <>
      <div className="px-6 py-5 border-b border-subtle">
        <h2 className="text-base font-semibold text-rose-400">{t('script_installer.ScriptInstallModal.installFailed')}</h2>
      </div>
      <div className="px-6 py-6 text-sm text-content-secondary">
        {message}
      </div>
      <div className="px-6 py-4 border-t border-subtle flex justify-between">
        <button onClick={onClose} className="px-4 py-2 text-sm text-content-secondary hover:text-content">
          {t('script_installer.ScriptInstallModal.close')}
        </button>
        {retriable && (
          <button onClick={onRetry} className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded">
            {t('script_installer.ScriptInstallModal.tryAgain')}
          </button>
        )}
      </div>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoCard({ variant, title, children }: { variant: 'info' | 'success' | 'warn'; title: string; children: React.ReactNode }) {
  const styles = {
    info: 'border-blue-500/30 bg-blue-500/10',
    success: 'border-emerald-500/30 bg-emerald-500/10',
    warn: 'border-amber-500/30 bg-amber-500/10',
  };
  const titleColors = {
    info: 'text-blue-400',
    success: 'text-emerald-400',
    warn: 'text-amber-400',
  };
  return (
    <div className={`rounded-lg border p-3 text-xs ${styles[variant]}`}>
      <div className={`font-semibold mb-2 ${titleColors[variant]}`}>{title}</div>
      <div className="text-content-secondary">{children}</div>
    </div>
  );
}
