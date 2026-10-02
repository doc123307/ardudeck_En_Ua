/**
 * The operator screen: status strip, cameras, map and the few actions an operator needs.
 * Everything else in the app is the administrator's and is not reachable from here.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, Columns2, LayoutGrid, OctagonX, PictureInPicture2, Pin, Scaling } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { useConnectionStore } from '../../stores/connection-store';
import { useActiveVehicleStore } from '../../stores/active-vehicle-store';
import { useMessagesStore } from '../../stores/messages-store';
import { useOperatorStore } from '../../stores/operator-store';
import { useOperatorUiStore } from '../../stores/operator-ui-store';
import { ROVER_MODE_NUMBER, type OperatorModeButton } from '../../../shared/operator-types';
import { extractPreArmReason, isPreArmMessage } from '../../../shared/prearm-checks';
import { RelayButtons } from '../vehicle-outputs/RelayButtons';
import { OperatorStatusBar } from './OperatorStatusBar';
import { OperatorCameras } from './OperatorCameras';
import { OperatorMiniMap } from './OperatorMiniMap';
import { OperatorInfoBlock } from './OperatorInfoBlock';
import { HoldButton } from './HoldButton';
import { useOperatorFeeds, useOperatorRecording } from './useOperatorFeeds';
import { isRoverLike } from './operator-logic';
import { t } from '../../i18n';

/** How long the vehicle gets to act on a command before the operator is told it did not. */
const COMMAND_SETTLE_MS = 2500;
const TOAST_MS = 5000;

type Toast = { text: string; tone: 'info' | 'error' };

const TOOL_BTN = 'flex h-10 items-center gap-2 rounded-lg border border-subtle bg-surface-raised px-3 text-sm font-medium text-content transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40';
const TOOL_ON = 'border-blue-500/60 bg-blue-600/30';

export function OperatorScreen() {
  const connectionState = useConnectionStore((s) => s.connectionState);
  const flight = useTelemetryStore((s) => s.flight);
  const vehicleKey = useActiveVehicleStore((s) => s.activeVehicleKey);
  const allowArm = useOperatorStore((s) => s.config.allowArm);
  const modeButtons = useOperatorStore((s) => s.config.modeButtons);
  const ui = useOperatorUiStore();
  const feeds = useOperatorFeeds();
  const recording = useOperatorRecording(feeds.sources, feeds.main);

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const connected = connectionState.isConnected && connectionState.protocol === 'mavlink';
  const rover = isRoverLike(connectionState.mavType);
  const canDrive = connected && rover;

  // ---- Vehicle commands ---------------------------------------------------
  const setMode = useCallback(async (button: OperatorModeButton) => {
    if (!canDrive) return;
    const wanted = ROVER_MODE_NUMBER[button];
    const sent = await window.electronAPI.mavlinkSetMode(wanted);
    const label = t(`operator.OperatorScreen.mode_${button}`);
    if (!sent) { say(t('operator.OperatorScreen.commandNotSent'), 'error'); return; }
    setTimeout(() => {
      if (useTelemetryStore.getState().flight.modeNum !== wanted) say(t('operator.OperatorScreen.modeRefused', { mode: label }), 'error');
    }, COMMAND_SETTLE_MS);
  }, [canDrive, say]);

  const stop = useCallback(() => { void setMode('hold'); }, [setMode]);

  const armDisarm = useCallback(async (arm: boolean) => {
    if (!connected) return;
    const askedAt = Date.now();
    const sent = await window.electronAPI.mavlinkArmDisarm(arm, false);
    if (!sent) { say(t('operator.OperatorScreen.commandNotSent'), 'error'); return; }
    setTimeout(() => {
      if (useTelemetryStore.getState().flight.armed === arm) return;
      // The flight controller says why it refused in its pre-arm messages.
      const firmware = useConnectionStore.getState().connectionState.firmware;
      const reasons = useMessagesStore.getState().messages
        .filter((m) => m.timestamp >= askedAt - 1000 && isPreArmMessage(m.text, firmware))
        .map((m) => extractPreArmReason(m.text, firmware))
        .filter((reason, i, all) => all.indexOf(reason) === i)
        .slice(0, 3);
      const what = arm ? t('operator.OperatorScreen.armRefused') : t('operator.OperatorScreen.disarmRefused');
      say(reasons.length > 0 ? `${what}: ${reasons.join('; ')}` : what, 'error');
    }, COMMAND_SETTLE_MS);
  }, [connected, say]);

  // Space = STOP, wherever the focus is, except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      e.preventDefault();
      stop();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [stop]);

  const toggleRecording = async () => {
    const r = await recording.toggle();
    if (r.stopped > 0) say(t('operator.OperatorScreen.recordingSaved'));
    else if (r.started > 0 && r.failed === 0) say(t('operator.OperatorScreen.recordingStarted', { n: r.started }));
    else if (r.started > 0) say(t('operator.OperatorScreen.recordingPartly', { n: r.started, failed: r.failed }), 'error');
    else say(t('operator.OperatorScreen.recordingFailed', { reason: r.error ?? '' }), 'error');
  };

  const holding = connected && flight.modeNum === ROVER_MODE_NUMBER.hold;
  const several = feeds.sources.length > 1;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-base">
      <OperatorStatusBar recordingSince={recording.since} />

      <div className="relative min-h-0 flex-1">
        <OperatorCameras feeds={feeds} />

        {/* Corner blocks float over the video; the strip between them lets clicks through. */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-3">
          <OperatorMiniMap />
          <OperatorInfoBlock />
        </div>

        {toast && (
          <div className={`pointer-events-none absolute left-1/2 top-14 z-30 max-w-[80%] -translate-x-1/2 rounded-lg px-4 py-2 text-center text-sm font-medium shadow-xl ${
            toast.tone === 'error' ? 'bg-red-700 text-white' : 'bg-black/80 text-white'
          }`}>
            {toast.text}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-subtle bg-surface px-4 py-2.5">
        <RelayButtons vehicleKey={connected ? vehicleKey : null} editable={false} />

        <div className="flex flex-wrap items-center gap-2">
          {several && (
            <button
              onClick={() => ui.setLayout(ui.layout === 'pip' ? 'grid' : 'pip')}
              data-tip={ui.layout === 'pip' ? t('operator.OperatorScreen.layoutGridTip') : t('operator.OperatorScreen.layoutPipTip')}
              className={TOOL_BTN}
            >
              {ui.layout === 'pip' ? <LayoutGrid className="h-4 w-4" /> : <PictureInPicture2 className="h-4 w-4" />}
              <span className="whitespace-nowrap">{ui.layout === 'pip' ? t('operator.OperatorScreen.layoutGrid') : t('operator.OperatorScreen.layoutPip')}</span>
            </button>
          )}
          {several && ui.layout === 'pip' && (
            <button onClick={ui.cycleThumbSize} data-tip={t('operator.OperatorScreen.thumbSizeTip')} className={TOOL_BTN}>
              <Scaling className="h-4 w-4" />
              <span className="uppercase">{ui.thumbSize}</span>
            </button>
          )}
          <button
            onClick={() => ui.setControlsPinned(!ui.controlsPinned)}
            data-tip={t('operator.OperatorScreen.pinControlsTip')}
            className={`${TOOL_BTN} ${ui.controlsPinned ? TOOL_ON : ''}`}
          >
            {ui.controlsPinned ? <Pin className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
            <span className="whitespace-nowrap">{t('operator.OperatorScreen.cameraControls')}</span>
          </button>
          <button
            onClick={() => void toggleRecording()}
            disabled={recording.busy || !feeds.main}
            data-tip={recording.since !== null ? t('operator.OperatorScreen.stopRecordingTip') : t('operator.OperatorScreen.recordTip')}
            className={`${TOOL_BTN} ${recording.since !== null ? 'border-red-500/60 bg-red-600/30 text-red-200' : ''}`}
          >
            <Circle className={`h-3.5 w-3.5 ${recording.since !== null ? 'fill-current text-red-400' : ''}`} />
            <span className="whitespace-nowrap">{recording.since !== null ? t('operator.OperatorScreen.stopRecording') : t('operator.OperatorScreen.record')}</span>
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex flex-wrap items-center justify-end gap-2">
          {connected && !rover && (
            <span className="max-w-[16rem] text-xs leading-snug text-amber-300">{t('operator.OperatorScreen.notRover')}</span>
          )}
          {modeButtons.map((m) => (
            <button
              key={m}
              onClick={() => void setMode(m)}
              disabled={!canDrive}
              className={`${TOOL_BTN} h-12 px-4 ${connected && flight.modeNum === ROVER_MODE_NUMBER[m] ? TOOL_ON : ''}`}
            >
              <span className="whitespace-nowrap">{t(`operator.OperatorScreen.mode_${m}`)}</span>
            </button>
          ))}

          {allowArm && (
            <HoldButton
              onConfirm={() => void armDisarm(!flight.armed)}
              disabled={!connected}
              tip={t('operator.OperatorScreen.holdTip')}
              fillClassName={flight.armed ? 'bg-emerald-400/40' : 'bg-red-400/50'}
              className={`h-12 min-w-[9rem] rounded-lg border px-4 text-sm font-bold uppercase tracking-wide ${
                connected && flight.armed
                  ? 'border-emerald-500/60 bg-emerald-600/20 text-emerald-200'
                  : 'border-red-500/60 bg-red-600/20 text-red-200'
              }`}
            >
              <span className="whitespace-nowrap">{connected && flight.armed ? t('operator.OperatorScreen.disarm') : t('operator.OperatorScreen.arm')}</span>
            </HoldButton>
          )}

          <button
            onClick={stop}
            disabled={!canDrive}
            data-tip={t('operator.OperatorScreen.stopTip')}
            className={`flex h-12 min-w-[11rem] items-center justify-center gap-2 rounded-lg px-5 text-base font-extrabold uppercase tracking-wide text-white shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              holding ? 'bg-red-900 ring-2 ring-red-400' : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            <OctagonX className="h-5 w-5" />
            <span className="whitespace-nowrap">{holding ? t('operator.OperatorScreen.stopped') : t('operator.OperatorScreen.stop')}</span>
            <kbd className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal">{t('operator.OperatorScreen.spaceKey')}</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
