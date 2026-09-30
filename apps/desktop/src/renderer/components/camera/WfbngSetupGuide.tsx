/**
 * Guided setup for OpenIPC / RunCam WiFiLink (wfb-ng) video.
 *
 * Dongle-first: the end state is "plug the kit's WiFi dongle into this
 * computer, add the feed, done". The card shows the three things that make
 * that work (dongle, receiver component, pairing key) as live status chips
 * with one action each. A collapsed section covers the alternative - a
 * separate ground station forwarding video over the network.
 */

import { useCallback, useEffect, useState } from 'react';
import type { StreamDiagnosis } from '../../../shared/link-doctor-types';
import type { WfbngStatus } from '../../../shared/camera-types';

const CHANNELS = [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149, 153, 157, 161, 165, 169, 173, 177];

export function WfbngSetupGuide({ port }: { port: number }) {
  const [status, setStatus] = useState<WfbngStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const [localIps, setLocalIps] = useState<string[]>([]);
  useEffect(() => {
    if (showNetwork && localIps.length === 0) {
      void window.electronAPI.wfbngLocalIps().then(setLocalIps);
    }
  }, [showNetwork, localIps.length]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ diagnosis: StreamDiagnosis; sender: string | null } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await window.electronAPI.wfbngStatus());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const importKey = async () => {
    const r = await window.electronAPI.wfbngImportKey();
    if (r.imported) void refresh();
  };

  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const installReceiver = async () => {
    setInstalling(true);
    setInstallError(null);
    try {
      const r = await window.electronAPI.wfbngInstall();
      if (!r.ok) setInstallError(r.error ?? 'Download failed.');
      void refresh();
    } finally {
      setInstalling(false);
    }
  };

  const setOption = async (opts: { channel?: number; bandwidth?: 20 | 40 }) => {
    await window.electronAPI.wfbngSetOptions(opts);
    void refresh();
  };

  const testPort = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      setTestResult(await window.electronAPI.linkDoctorProbeUdp(port));
    } catch (e) {
      setTestError(
        e instanceof Error && e.message.includes('EADDRINUSE')
          ? `Port ${port} is busy - if the feed is already running, that is the stream itself.`
          : e instanceof Error ? e.message : 'Could not listen on the port.',
      );
    } finally {
      setTesting(false);
    }
  };

  const chip = (ok: boolean, okText: string, missingText: string, action?: React.ReactNode) => (
    <div className="flex items-center gap-1.5 text-[10px] leading-tight">
      <span className={`h-2 w-2 shrink-0 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      <span className={ok ? 'text-content-secondary' : 'text-content'}>{ok ? okText : missingText}</span>
      {!ok && action}
    </div>
  );

  const ready = status?.dongleName && status.receiverInstalled && status.gsKeyImported;

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="rounded-lg border border-subtle bg-surface p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-content">Direct reception (dongle in this computer)</p>
          <button
            onClick={() => void refresh()}
            disabled={checking}
            className="text-[10px] text-content-secondary hover:text-content disabled:opacity-50"
            data-tip="Re-check dongle, receiver and key"
          >
            {checking ? '...' : 'Recheck'}
          </button>
        </div>

        {status && (
          <>
            {chip(
              status.dongleName !== null,
              `Dongle connected (${status.dongleName})`,
              'Plug the WiFi dongle from the camera kit into this computer',
            )}
            {status.driverNote && (
              <p className="pl-3.5 text-[9px] leading-tight text-content-tertiary">{status.driverNote}</p>
            )}
            {chip(
              status.receiverInstalled,
              'Receiver component installed',
              'Receiver component missing',
              <button
                onClick={() => void installReceiver()}
                disabled={installing}
                className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-content hover:bg-surface-raised disabled:opacity-50"
              >
                {installing ? 'Downloading...' : 'Install'}
              </button>,
            )}
            {installError && <p className="text-[10px] leading-tight text-red-400">{installError}</p>}
            {chip(
              status.gsKeyImported,
              'Pairing key imported',
              'Pairing key missing',
              <button onClick={() => void importKey()} className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-content hover:bg-surface-raised">
                Import gs.key
              </button>,
            )}
            <div className="flex items-center gap-2 pt-0.5 text-[10px] text-content-secondary">
              <label className="flex items-center gap-1" data-tip="Must match the channel set on the camera VTX">
                Channel
                <select
                  value={status.channel}
                  onChange={(e) => void setOption({ channel: Number(e.target.value) })}
                  className="rounded bg-surface-input px-1 py-0.5 text-content"
                >
                  {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1" data-tip="Radio bandwidth - must match the VTX setting">
                BW
                <select
                  value={status.bandwidth}
                  onChange={(e) => void setOption({ bandwidth: Number(e.target.value) as 20 | 40 })}
                  className="rounded bg-surface-input px-1 py-0.5 text-content"
                >
                  <option value={20}>20 MHz</option>
                  <option value={40}>40 MHz</option>
                </select>
              </label>
            </div>
            {ready && !status.running && (
              <p className="text-[10px] leading-tight text-emerald-400">
                Ready - press Add, select the feed, and power the camera.
              </p>
            )}
            {status.running && (
              <p className="text-[10px] leading-tight text-emerald-400">
                Receiving{status.stats ? ` - ${status.stats.wifi} radio frames, ${status.stats.rtp} video packets` : '...'}
              </p>
            )}
          </>
        )}
        <p className="text-[9px] leading-tight text-content-tertiary" data-tip="The camera creates gs.key on its first boot - fetch it once from the camera's SD card or web interface">
          The pairing key (gs.key) comes from the camera - created on its first boot.
        </p>
      </div>

      <button
        onClick={() => setShowNetwork((v) => !v)}
        className="flex w-full items-center gap-1 text-[10px] text-content-secondary hover:text-content"
      >
        <span className={`transition-transform ${showNetwork ? 'rotate-90' : ''}`}>▸</span>
        Using a separate ground station instead?
      </button>
      {showNetwork && (
        <div className="space-y-1.5 pl-1">
          <p className="text-[10px] leading-tight text-content-secondary">
            If this computer can't power the dongle (dark LED / USB errors), run the receiver on another machine
            that can - a PC, or a Linux / Radxa / Raspberry Pi box - and have it forward the video here over your
            network. Both machines must be on the same network. Then set this feed to <span className="text-content">Network</span> mode.
          </p>
          <div className="rounded bg-surface-raised p-1.5">
            <p className="text-[9px] font-medium uppercase tracking-wide text-content-tertiary">On the other machine, run:</p>
            <code className="mt-0.5 block whitespace-pre-wrap break-all text-[10px] text-content">
              {`ardudeck-wfb-rx --key gs.key --channel ${status?.channel ?? 161} --bandwidth ${status?.bandwidth ?? 20} --host ${localIps[0] ?? '<this-computer-ip>'}`}
            </code>
            {localIps.length > 0 ? (
              <p className="mt-0.5 text-[9px] text-content-tertiary">
                This computer's address{localIps.length > 1 ? 'es' : ''}: {localIps.join(', ')}
              </p>
            ) : (
              <p className="mt-0.5 text-[9px] text-content-tertiary">Finding this computer's network address…</p>
            )}
          </div>
          <p className="text-[9px] leading-tight text-content-tertiary">
            The receiver binary is on the ArduDeck releases page (build it from tools/wfb-rx to run on the PC).
            PixelPilot on Android can display the feed but cannot forward it.
          </p>
          <button
            onClick={() => void testPort()}
            disabled={testing}
            className="w-full rounded bg-surface-raised px-2 py-1 text-[11px] text-content hover:bg-surface-raised disabled:opacity-50"
            data-tip="Listens for a couple of seconds and reports what is arriving"
          >
            {testing ? 'Listening...' : `Is video arriving? Test port ${port}`}
          </button>
          {testError && <p className="text-[10px] leading-tight text-red-400">{testError}</p>}
          {testResult && (testResult.diagnosis.protocol === 'rtp' || testResult.diagnosis.protocol === 'mpegts' ? (
            <p className="text-[10px] leading-tight text-emerald-400">
              Video detected{testResult.sender ? ` from ${testResult.sender.split(':')[0]}` : ''} - press Add and select the feed.
            </p>
          ) : testResult.diagnosis.protocol === 'silence' ? (
            <p className="text-[10px] leading-tight text-amber-300">
              Nothing on port {port} yet - make sure the ground station shows video and forwards to this computer's IP.
            </p>
          ) : (
            <p className="text-[10px] leading-tight text-amber-300">Arriving data is not video: {testResult.diagnosis.summary}</p>
          ))}
        </div>
      )}
    </div>
  );
}
