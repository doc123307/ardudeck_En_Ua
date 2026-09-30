import { useEffect, useRef, useState } from 'react';
import { useConnectionStore } from '../../stores/connection-store';
import { useMessagesStore } from '../../stores/messages-store';
import { evaluateRadioPreflight, type PreflightCheck } from '../../utils/radio-preflight';
import type { ElrsModuleInfo, ElrsProgressEvent } from '../../../shared/link-doctor-types';
import { ELRS_USB_BAUD } from '../../../shared/link-doctor-types';
import { t } from '../../i18n';

type Step = 'scan' | 'noradio' | 'switch' | 'connect' | 'vehicle' | 'done';

const STEP_LABELS: Array<{ key: Step[]; label: string }> = [
  { key: ['scan', 'noradio'], get label() { return t('connection.RadioSetupWizard.findRadio'); } },
  { key: ['switch'], get label() { return t('connection.RadioSetupWizard.radioMode'); } },
  { key: ['connect'], get label() { return t('connection.RadioSetupWizard.connect'); } },
  { key: ['vehicle'], get label() { return t('connection.RadioSetupWizard.vehicle'); } },
  { key: ['done'], get label() { return t('connection.RadioSetupWizard.done'); } },
];

type FoundRadio =
  | { kind: 'serial'; port: string; info: ElrsModuleInfo | null } // info null = port already streams MAVLink
  | { kind: 'udp'; udpPort: number; sender: string | null }; // TX Backpack (or other bridge) over WiFi

const BACKPACK_UDP_PORT = 14550;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Connect the primary link on a specific serial port and baud. */
  connectSerial: (port: string, baud: number) => Promise<boolean>;
  /** Connect the primary link as a UDP listener (WiFi backpack path). */
  connectUdpListen: (udpPort: number) => Promise<boolean>;
}

/**
 * One guided flow for using an ExpressLRS module as the telemetry radio:
 * finds the module across serial ports, switches it to MAVLink mode
 * (walking the user through unpowering the receiver), connects, then checks
 * and fixes the vehicle-side settings - so nothing is ever hunted down
 * across tabs or parameter lists.
 */
export function RadioSetupWizard({ open, onClose, connectSerial, connectUdpListen }: Props) {
  const { connectionState, isConnecting, error: connectionError } = useConnectionStore();
  const messages = useMessagesStore((s) => s.messages);

  const [step, setStep] = useState<Step>('scan');
  const [scanStatus, setScanStatus] = useState('');
  const [scannedPorts, setScannedPorts] = useState<string[]>([]);
  const [radio, setRadio] = useState<FoundRadio | null>(null);
  const [progress, setProgress] = useState<ElrsProgressEvent | null>(null);
  const [switching, setSwitching] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [checks, setChecks] = useState<PreflightCheck[] | null>(null);
  const [paramTypes, setParamTypes] = useState<Record<string, number>>({});
  const [fixApplied, setFixApplied] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [busy, setBusy] = useState(false);

  const wasConnected = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const unsub = window.electronAPI.onElrsProgress?.((p) => setProgress(p));
    return () => {
      unsub?.();
    };
  }, []);

  // Fresh scan every time the wizard opens.
  useEffect(() => {
    if (!open) return;
    setStep('scan');
    setRadio(null);
    setFailure(null);
    setChecks(null);
    setFixApplied(false);
    setRestarting(false);
    void scanForRadio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-advance: the connect step completes when the primary link comes up;
  // a vehicle restart completes when the link drops and comes back.
  useEffect(() => {
    const connected = connectionState.isConnected ?? false;
    if (openRef.current && connected && !wasConnected.current) {
      if (step === 'connect') {
        setStep('vehicle');
        void runVehicleCheck();
      } else if (step === 'vehicle' && restarting) {
        setRestarting(false);
        void runVehicleCheck();
      }
    }
    wasConnected.current = connected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState.isConnected, step, restarting]);

  const scanForRadio = async () => {
    setScanStatus(t('connection.RadioSetupWizard.lookingAtYourUsbPorts'));
    const all = await window.electronAPI.listPorts();
    // USB serial devices only - skips Bluetooth and debug consoles.
    const usb = all.filter((p) => p.vendorId);
    const candidates = (usb.length > 0 ? usb : all).map((p) => p.path);
    setScannedPorts(candidates);

    for (const port of candidates) {
      if (!openRef.current) return;
      try {
        setScanStatus(t('connection.RadioSetupWizard.checking', { port }));
        const info = await window.electronAPI.elrsDetect(port);
        if (info) {
          setRadio({ kind: 'serial', port, info });
          setStep(info.linkMode?.value === 'MAVLink' ? 'connect' : 'switch');
          return;
        }
        const probe = await window.electronAPI.linkDoctorProbe(port, ELRS_USB_BAUD);
        if (probe.protocol === 'mavlink2' || probe.protocol === 'mavlink1') {
          setRadio({ kind: 'serial', port, info: null });
          setStep('connect');
          return;
        }
      } catch {
        // Port busy or unopenable - not our radio, keep looking.
      }
    }

    // No USB radio - listen for a WiFi backpack broadcasting MAVLink. This is
    // the only path for internal TX modules, which have no USB port at all.
    if (!openRef.current) return;
    try {
      setScanStatus(t('connection.RadioSetupWizard.listeningForAWifiRadioTx'));
      const { diagnosis, sender } = await window.electronAPI.linkDoctorProbeUdp(BACKPACK_UDP_PORT);
      if (!openRef.current) return;
      if (diagnosis.protocol === 'mavlink2' || diagnosis.protocol === 'mavlink1') {
        setRadio({ kind: 'udp', udpPort: BACKPACK_UDP_PORT, sender });
        setStep('connect');
        return;
      }
    } catch {
      // UDP port busy - fall through to guidance.
    }
    setStep('noradio');
  };

  const startSwitch = async () => {
    if (radio?.kind !== 'serial') return;
    setSwitching(true);
    setProgress(null);
    setFailure(null);
    try {
      const result = await window.electronAPI.elrsSetLinkMode(radio.port, 'MAVLink');
      if (result.status === 'confirmed' || result.status === 'probable') {
        setStep('connect');
      } else if (result.status === 'timeout') {
        setFailure(
          'The module kept refusing the change - the receiver was still powered and linked. Unpower the vehicle completely (battery AND USB cable) and press Start again.',
        );
      }
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The module stopped responding.');
    } finally {
      setSwitching(false);
    }
  };

  const doConnect = async () => {
    if (!radio) return;
    setFailure(null);
    const ok =
      radio.kind === 'serial'
        ? await connectSerial(radio.port, ELRS_USB_BAUD)
        : await connectUdpListen(radio.udpPort);
    if (!ok) {
      setFailure(
        radio.kind === 'serial'
          ? 'Could not open the port. Is another program using it?'
          : 'Could not listen on the WiFi port. Is another program using UDP 14550?',
      );
    }
    // Success advances via the isConnected effect.
  };

  const radioLabel = radio
    ? radio.kind === 'serial'
      ? radio.port
      : `WiFi${radio.sender ? ` (${radio.sender.split(':')[0]})` : ''}`
    : '';

  const firmwareBanner = messages.find((m) => /Ardu\w+\s+V\d+\.\d+/.test(m.text))?.text ?? null;

  const runVehicleCheck = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const res = await window.electronAPI.readParameterBatch(['RC_PROTOCOLS', 'RSSI_TYPE']);
      setParamTypes(res.types ?? {});
      const result = evaluateRadioPreflight((name) => res.values[name], firmwareBanner);
      setChecks(result);
      if (result.every((c) => c.status === 'pass')) setStep('done');
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Could not read vehicle settings.');
    } finally {
      setBusy(false);
    }
  };

  const applyFixes = async () => {
    if (!checks) return;
    setBusy(true);
    setFailure(null);
    try {
      const batch = checks
        .flatMap((c) => c.fix ?? [])
        .map((f) => ({ paramId: f.param, value: f.value, type: paramTypes[f.param] ?? 6 }));
      const result = await window.electronAPI.setParameterBatch(batch);
      if ((result?.failed ?? []).length > 0) {
        setFailure(`The vehicle rejected: ${result!.failed.join(', ')}`);
      } else {
        setFixApplied(true);
      }
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Applying settings failed.');
    } finally {
      setBusy(false);
    }
  };

  const restartVehicle = async () => {
    setRestarting(true);
    setFailure(null);
    try {
      await window.electronAPI.mavlinkReboot();
    } catch {
      setRestarting(false);
      setFailure('The restart command was not accepted.');
    }
  };

  const close = () => {
    if (switching) void window.electronAPI.elrsCancel();
    onClose();
  };

  if (!open) return null;

  const failing = checks?.filter((c) => c.status === 'fail') ?? [];
  const fixable = failing.flatMap((c) => c.fix ?? []);
  const dot = (status: 'pass' | 'fail' | 'unknown') =>
    status === 'pass' ? 'bg-emerald-400' : status === 'fail' ? 'bg-red-400' : 'bg-gray-500';
  const spinner = (
    <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="card w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-content">{t('connection.RadioSetupWizard.radioSetup')}</h3>
            <button onClick={close} className="text-content-secondary hover:text-content transition-colors" aria-label={t('connection.RadioSetupWizard.close')}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {STEP_LABELS.map((s, i) => {
              const active = s.key.includes(step);
              const passed = STEP_LABELS.findIndex((x) => x.key.includes(step)) > i;
              return (
                <div key={s.label} className="flex items-center gap-1 flex-1">
                  <div
                    className={`h-1 rounded-full flex-1 ${
                      active ? 'bg-blue-500' : passed ? 'bg-emerald-500' : 'bg-surface-raised'
                    }`}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-content-secondary -mt-2">
            {STEP_LABELS.find((s) => s.key.includes(step))?.label}
          </p>

          {failure && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs text-red-300">{failure}</p>
            </div>
          )}

          {step === 'scan' && (
            <div className="flex items-center gap-2 text-sm text-content-secondary py-4">
              {spinner}
              {scanStatus}
            </div>
          )}

          {step === 'noradio' && (
            <div className="space-y-3">
              <p className="text-sm text-content">{t('connection.RadioSetupWizard.noRadioFoundTwoWaysTo')}</p>
              <div className="p-3 bg-surface-raised rounded-lg space-y-1">
                <p className="text-xs font-medium text-content">{t('connection.RadioSetupWizard.usbCableExternalModules')}</p>
                <p className="text-xs text-content-secondary">
                  {t('connection.RadioSetupWizard.plugTheRadioModuleIntoThis')}
                  {scannedPorts.length > 0
                    ? t('connection.RadioSetupWizard.checked', { v1: scannedPorts.join(', ') })
                    : t('connection.RadioSetupWizard.noUsbSerialDevicesWerePresent')}
                </p>
              </div>
              <div className="p-3 bg-surface-raised rounded-lg space-y-1">
                <p className="text-xs font-medium text-content">{t('connection.RadioSetupWizard.wifiTxBackpackRequiredForInternal')}</p>
                <p className="text-xs text-content-secondary">
                  {t('connection.RadioSetupWizard.radiosBuiltIntoTheHandsetE')}
                </p>
              </div>
              <button onClick={() => { setStep('scan'); void scanForRadio(); }} className="btn btn-primary w-full text-sm">
                {t('connection.RadioSetupWizard.scanAgainUsbWifi')}
              </button>
            </div>
          )}

          {step === 'switch' && radio?.kind === 'serial' && radio.info && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-content font-medium">{radio.info.name}</span>
                {radio.info.firmware && <span className="text-content-secondary">v{radio.info.firmware}</span>}
                <span className="px-2 py-0.5 rounded-full border text-amber-300 border-amber-500/30 bg-amber-500/10">
                  {radio.info.linkMode?.value ?? t('connection.RadioSetupWizard.normal')} {t('connection.RadioSetupWizard.mode')}
                </span>
              </div>
              {radio.info.firmware?.startsWith('4.0.0') && (
                <p className="text-xs text-amber-300">
                  {t('connection.RadioSetupWizard.thisModuleRunsElrs40')}
                </p>
              )}
              <p className="text-sm text-content">
                {t('connection.RadioSetupWizard.theRadioNeedsToSwitchTo')}
              </p>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-amber-200 font-medium mb-1">{t('connection.RadioSetupWizard.firstPowerTheReceiverOff')}</p>
                <p className="text-xs text-content-secondary">
                  {t('connection.RadioSetupWizard.theRadioRefusesThisChangeWhile')}
                </p>
              </div>
              {switching ? (
                <div className="p-3 bg-surface-raised rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-xs text-content">
                    {spinner}
                    {t('connection.RadioSetupWizard.switching')}{progress ? ` - attempt ${progress.attempt}` : ''}...
                  </div>
                  {progress?.currentMode && progress.currentMode !== 'MAVLink' && (
                    <p className="text-xs text-content-secondary">
                      {t('connection.RadioSetupWizard.moduleStillReports')} {progress.currentMode} {t('connection.RadioSetupWizard.waitingForTheReceiverToGo')}
                    </p>
                  )}
                  <button onClick={() => window.electronAPI.elrsCancel()} className="btn btn-secondary w-full text-xs">
                    {t('connection.RadioSetupWizard.cancel')}
                  </button>
                </div>
              ) : (
                <button onClick={startSwitch} className="btn btn-primary w-full text-sm">
                  {t('connection.RadioSetupWizard.start')}
                </button>
              )}
            </div>
          )}

          {step === 'connect' && (
            <div className="space-y-3">
              <p className="text-sm text-content">
                {t('connection.RadioSetupWizard.theRadioOn')} {radioLabel} {t('connection.RadioSetupWizard.isReadyAndSpeakingMavlink')}
              </p>
              <p className="text-xs text-content-secondary">
                {t('connection.RadioSetupWizard.powerTheVehicleBackOnAnd')}
              </p>
              {connectionError && <p className="text-xs text-red-300">{connectionError}</p>}
              {isConnecting || connectionState.isWaitingForHeartbeat ? (
                <div className="flex items-center gap-2 text-xs text-content-secondary">
                  {spinner}
                  {t('connection.RadioSetupWizard.connectingThroughTheRadio')}
                </div>
              ) : (
                <button onClick={doConnect} className="btn btn-primary w-full text-sm">
                  {t('connection.RadioSetupWizard.connectThroughTheRadio')}
                </button>
              )}
            </div>
          )}

          {step === 'vehicle' && (
            <div className="space-y-3">
              <p className="text-sm text-content">{t('connection.RadioSetupWizard.connectedCheckingTheVehicleForRadio')}</p>
              {busy && (
                <div className="flex items-center gap-2 text-xs text-content-secondary">
                  {spinner}
                  {t('connection.RadioSetupWizard.readingVehicleSettingsOverTheRadio')}
                </div>
              )}
              {restarting && (
                <div className="flex items-center gap-2 text-xs text-content-secondary">
                  {spinner}
                  {t('connection.RadioSetupWizard.restartingTheVehicleTheLinkReconnects')}
                </div>
              )}
              {checks && !busy && (
                <div className="space-y-1.5">
                  {checks.map((c) => (
                    <div key={c.id} className="flex items-start gap-2">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dot(c.status)}`} />
                      <div>
                        <p className="text-xs text-content">{c.title}</p>
                        <p className="text-xs text-content-secondary">{c.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {checks && !busy && !restarting && (
                fixApplied ? (
                  <button onClick={restartVehicle} className="btn btn-primary w-full text-sm">
                    {t('connection.RadioSetupWizard.restartVehicleToFinish')}
                  </button>
                ) : fixable.length > 0 ? (
                  <button onClick={applyFixes} className="btn btn-primary w-full text-sm">
                    {t('connection.RadioSetupWizard.fixForMe')}
                  </button>
                ) : failing.length > 0 ? (
                  <p className="text-xs text-content-secondary">
                    {t('connection.RadioSetupWizard.theRemainingItemCannotBeFixed')}
                  </p>
                ) : null
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-sm text-emerald-300 font-medium">{t('connection.RadioSetupWizard.radioLinkFullySetUp')}</p>
                <p className="text-xs text-content-secondary mt-1">
                  {t('connection.RadioSetupWizard.telemetryStickControlAndSignalStrength')} {radioLabel} {t('connection.RadioSetupWizard.wheneverYouFlyOrDrive')}
                </p>
              </div>
              <button onClick={close} className="btn btn-primary w-full text-sm">
                {t('connection.RadioSetupWizard.close')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
