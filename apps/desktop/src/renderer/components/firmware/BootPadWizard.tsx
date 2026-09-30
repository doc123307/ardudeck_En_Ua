/**
 * Boot Pad Flash Wizard
 *
 * A step-by-step wizard to guide users through flashing boards
 * that require boot pads to be jumpered for bootloader entry.
 */

import { useEffect, useState, useCallback } from 'react';
import { useFirmwareStore } from '../../stores/firmware-store';
import { t } from '../../i18n';

type WizardStep = 'intro' | 'disconnect' | 'waiting' | 'ready' | 'flashing' | 'success' | 'error';

interface BootPadWizardProps {
  isOpen: boolean;
  onClose: () => void;
  boardName: string;
  firmwareVersion: string;
  firmwareSource: string;
}

export function BootPadWizard({
  isOpen,
  onClose,
  boardName,
  firmwareVersion,
  firmwareSource,
}: BootPadWizardProps) {
  const [step, setStep] = useState<WizardStep>('intro');
  const [jumperConfirmed, setJumperConfirmed] = useState(false);
  const [jumperRemoved, setJumperRemoved] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [detectedMcu, setDetectedMcu] = useState<string | null>(null);

  const {
    detectedBoard,
    flashState,
    flashProgress,
    flashError,
    startFlash,
    setFlashError,
  } = useFirmwareStore();

  // Poll for bootloader detection when in waiting step
  useEffect(() => {
    if (step === 'waiting') {
      const interval = setInterval(async () => {
        try {
          // Get the port from the previously detected board
          const ports = await window.electronAPI?.listSerialPorts?.();
          if (ports?.success && ports.ports && ports.ports.length > 0) {
            // Try to detect STM32 bootloader on each port
            for (const port of ports.ports) {
              const result = await window.electronAPI?.probeSTM32?.(port.path);
              if (result?.success && result.mcu) {
                setDetectedMcu(result.mcu);
                setStep('ready');
                break;
              }
            }
          }
        } catch {
          // Ignore errors, keep polling
        }
      }, 1500);

      setPollInterval(interval);
      return () => clearInterval(interval);
    } else if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  }, [step]);

  // Watch for flash completion
  useEffect(() => {
    if (step === 'flashing') {
      if (flashState === 'complete') {
        setStep('success');
      } else if (flashState === 'error') {
        setStep('error');
      }
    }
  }, [flashState, step]);

  // Reset state when wizard opens
  useEffect(() => {
    if (isOpen) {
      setStep('intro');
      setJumperConfirmed(false);
      setJumperRemoved(false);
      setRiskAccepted(false);
      setDetectedMcu(null);
      setFlashError(null);
    }
  }, [isOpen, setFlashError]);

  const handleStartFlash = useCallback(async () => {
    setStep('flashing');
    await startFlash();
  }, [startFlash]);

  const handleClose = useCallback(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    onClose();
  }, [onClose, pollInterval]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-solid rounded-2xl border border shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-subtle bg-surface">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-content">{t('firmware.BootPadWizard.bootPadFlashWizard')}</h2>
                <p className="text-sm text-content-secondary">{boardName}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-content-secondary hover:text-content p-1 rounded-lg hover:bg-surface-raised transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="px-6 py-3 bg-surface border-b border-subtle">
          <div className="flex items-center justify-between">
            {['intro', 'disconnect', 'waiting', 'ready'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                  ${step === s ? 'bg-blue-500 text-white' :
                    ['intro', 'disconnect', 'waiting', 'ready'].indexOf(step) > i ? 'bg-emerald-500 text-white' :
                    'bg-surface-raised text-content-secondary'}
                `}>
                  {['intro', 'disconnect', 'waiting', 'ready'].indexOf(step) > i ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i + 1}
                </div>
                {i < 3 && (
                  <div className={`w-12 h-0.5 mx-1 ${['intro', 'disconnect', 'waiting', 'ready'].indexOf(step) > i ? 'bg-emerald-500' : 'bg-surface-raised'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step: Intro */}
          {step === 'intro' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h3 className="text-amber-400 font-medium">{t('firmware.BootPadWizard.bootPadsRequired')}</h3>
                    <p className="text-content text-sm mt-1">
                      {t('firmware.BootPadWizard.yourBoard')}<span className="text-content font-medium">{boardName}</span>{t('firmware.BootPadWizard.usesAUsbSerialAdapterAnd')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-content-secondary text-sm">
                <p className="mb-2">{t('firmware.BootPadWizard.thisWizardWillGuideYouThrough')}</p>
                <ol className="list-decimal list-inside space-y-1 text-content">
                  <li>{t('firmware.BootPadWizard.disconnectingYourBoard')}</li>
                  <li>{t('firmware.BootPadWizard.shortingTheBootPads')}</li>
                  <li>{t('firmware.BootPadWizard.reconnectingInBootloaderMode')}</li>
                  <li>{t('firmware.BootPadWizard.flashing')} <span className="text-blue-400">{firmwareSource} {firmwareVersion}</span></li>
                </ol>
              </div>

              <button
                onClick={() => setStep('disconnect')}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {t('firmware.BootPadWizard.startWizard')}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Step: Disconnect */}
          {step === 'disconnect' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-raised flex items-center justify-center">
                  <svg className="w-8 h-8 text-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-content mb-2">{t('firmware.BootPadWizard.disconnectYourBoard')}</h3>
                <p className="text-content-secondary">{t('firmware.BootPadWizard.unplugTheUsbCableFromYour')}</p>
              </div>

              <div className="p-4 bg-surface-raised rounded-lg space-y-3">
                <h4 className="text-content font-medium">{t('firmware.BootPadWizard.thenShortTheBootPads')}</h4>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-medium flex-shrink-0">1</div>
                  <p className="text-content-secondary text-sm">{t('firmware.BootPadWizard.findThe')} <span className="text-content">BOOT</span> {t('firmware.BootPadWizard.padsOnYourBoardUsuallyLabeled')}</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-medium flex-shrink-0">2</div>
                  <p className="text-content-secondary text-sm">{t('firmware.BootPadWizard.useTweezersAJumperWireOr')} <span className="text-content">{t('firmware.BootPadWizard.shortTheTwoPadsTogether')}</span></p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-medium flex-shrink-0">3</div>
                  <p className="text-content-secondary text-sm"><span className="text-content">{t('firmware.BootPadWizard.keepThemShorted')}</span> {t('firmware.BootPadWizard.andPlugInTheUsbCable')}</p>
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 bg-surface-raised rounded-lg cursor-pointer hover:bg-surface transition-colors">
                <input
                  type="checkbox"
                  checked={jumperConfirmed}
                  onChange={(e) => setJumperConfirmed(e.target.checked)}
                  className="rounded border bg-surface-raised text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-content text-sm">
                  {t('firmware.BootPadWizard.iHaveShortedTheBootPads')}
                </span>
              </label>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('intro')}
                  className="px-4 py-2.5 text-content-secondary hover:text-content hover:bg-surface-raised rounded-lg transition-colors"
                >
                  {t('firmware.BootPadWizard.back')}
                </button>
                <button
                  onClick={() => setStep('waiting')}
                  disabled={!jumperConfirmed}
                  className={`flex-1 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2
                    ${jumperConfirmed ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-surface-raised text-content-secondary cursor-not-allowed'}
                  `}
                >
                  {t('firmware.BootPadWizard.detectBoard')}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step: Waiting for detection */}
          {step === 'waiting' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-xl font-semibold text-content mb-2">{t('firmware.BootPadWizard.waitingForBootloader')}</h3>
                <p className="text-content-secondary">{t('firmware.BootPadWizard.makeSureTheBootPadsAre')}</p>
              </div>

              <div className="p-4 bg-surface-raised rounded-lg text-center">
                <p className="text-content-secondary text-sm">
                  {t('firmware.BootPadWizard.scanningSerialPortsForStm32Bootloader')}
                </p>
              </div>

              <button
                onClick={() => setStep('disconnect')}
                className="w-full py-2.5 text-content-secondary hover:text-content hover:bg-surface-raised rounded-lg transition-colors"
              >
                {t('firmware.BootPadWizard.goBack')}
              </button>
            </div>
          )}

          {/* Step: Ready to flash */}
          {step === 'ready' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-content mb-2">{t('firmware.BootPadWizard.boardDetected')}</h3>
                <p className="text-content-secondary">
                  {t('firmware.BootPadWizard.found')} <span className="text-emerald-400 font-medium">{detectedMcu || 'STM32'}</span> {t('firmware.BootPadWizard.inBootloaderMode')}
                </p>
              </div>

              {/* Important instruction box */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-amber-300 font-medium mb-1">{t('firmware.BootPadWizard.beforeFlashingRemoveTheBootJumper')}</h4>
                    <p className="text-content text-sm">
                      {t('firmware.BootPadWizard.keepTheUsbConnectedBut')} <span className="text-amber-400 font-semibold">{t('firmware.BootPadWizard.removeTheJumperWireNow')}</span>{t('firmware.BootPadWizard.thisWayAfterFlashingCompletesThe')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-surface-raised rounded-lg">
                <h4 className="text-content font-medium mb-2">{t('firmware.BootPadWizard.readyToFlash')}</h4>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-content-secondary">{t('firmware.BootPadWizard.board')}</span>
                  <span className="text-content">{boardName}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-content-secondary">{t('firmware.BootPadWizard.firmware')}</span>
                  <span className="text-blue-400">{firmwareSource} {firmwareVersion}</span>
                </div>
              </div>

              <label className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg cursor-pointer hover:bg-emerald-500/20 transition-colors">
                <input
                  type="checkbox"
                  checked={jumperRemoved}
                  onChange={(e) => setJumperRemoved(e.target.checked)}
                  className="mt-0.5 rounded border bg-surface-raised text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-content text-sm">
                  {t('firmware.BootPadWizard.iHave')} <span className="text-emerald-400 font-semibold">{t('firmware.BootPadWizard.removedTheBootJumper')}</span> {t('firmware.BootPadWizard.usbStillConnected')}
                </span>
              </label>

              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={riskAccepted}
                    onChange={(e) => setRiskAccepted(e.target.checked)}
                    className="mt-0.5 rounded border bg-surface-raised text-red-500 focus:ring-red-500"
                  />
                  <span className="text-red-300 text-sm">
                    {t('firmware.BootPadWizard.iUnderstandThatFlashingIncorrectFirmware')} <span className="text-red-400 font-medium">{t('firmware.BootPadWizard.brickMyBoard')}</span> {t('firmware.BootPadWizard.andIHaveVerifiedTheBoard')}
                  </span>
                </label>
              </div>

              <button
                onClick={handleStartFlash}
                disabled={!jumperRemoved || !riskAccepted}
                className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2
                  ${jumperRemoved && riskAccepted
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-surface-raised text-content-secondary cursor-not-allowed'}
                `}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t('firmware.BootPadWizard.flashFirmware')}
              </button>
            </div>
          )}

          {/* Step: Flashing */}
          {step === 'flashing' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-xl font-semibold text-content mb-2">{t('firmware.BootPadWizard.flashing2')}</h3>
                <p className="text-content-secondary">{flashProgress?.message || t('firmware.BootPadWizard.pleaseWait')}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-content-secondary">{t('firmware.BootPadWizard.progress')}</span>
                  <span className="text-content">{flashProgress?.progress || 0}%</span>
                </div>
                <div className="h-3 bg-surface-inset rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${flashProgress?.progress || 0}%` }}
                  />
                </div>
              </div>

              <p className="text-content-secondary text-sm text-center">
                {t('firmware.BootPadWizard.doNotDisconnectTheBoardDuring')}
              </p>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-content mb-2">{t('firmware.BootPadWizard.flashComplete')}</h3>
                <p className="text-content-secondary">
                  {t('firmware.BootPadWizard.successfullyFlashed')} <span className="text-emerald-400">{firmwareSource} {firmwareVersion}</span>
                </p>
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                <p className="text-emerald-300 text-sm">
                  {t('firmware.BootPadWizard.yourBoardShouldNowRebootWith')}
                </p>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
              >
                {t('firmware.BootPadWizard.done')}
              </button>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-content mb-2">{t('firmware.BootPadWizard.flashFailed')}</h3>
                <p className="text-content-secondary">{t('firmware.BootPadWizard.somethingWentWrongDuringFlashing')}</p>
              </div>

              {flashError && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <pre className="text-red-300 text-sm whitespace-pre-wrap font-sans">
                    {flashError}
                  </pre>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('disconnect')}
                  className="flex-1 py-2.5 bg-surface-raised hover:bg-surface-raised text-content rounded-lg font-medium transition-colors"
                >
                  {t('firmware.BootPadWizard.tryAgain')}
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
                >
                  {t('firmware.BootPadWizard.close')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
