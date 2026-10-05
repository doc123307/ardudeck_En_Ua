/**
 * The operator screen: status strip, cameras, map and the few actions an operator needs.
 * Everything else in the app is the administrator's and is not reachable from here.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Hand, OctagonX, Play } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { useConnectionStore } from '../../stores/connection-store';
import { useActiveVehicleStore } from '../../stores/active-vehicle-store';
import { useMessagesStore } from '../../stores/messages-store';
import { useOperatorStore } from '../../stores/operator-store';
import { ROVER_MODE_NUMBER, type OperatorElement, type OperatorModeButton } from '../../../shared/operator-types';
import { extractPreArmReason, isPreArmMessage } from '../../../shared/prearm-checks';
import { useOperatorRcStore } from '../../stores/operator-rc-store';
import { isController } from '../../../shared/operator-rc';
import { OperatorStatusBar, modeLabel } from './OperatorStatusBar';
import { OperatorModeMenu, modeButtonLabel } from './OperatorModeMenu';
import { OperatorControls } from './OperatorControlBar';
import { useOperatorRc } from './useOperatorRc';
import { OperatorCameras } from './OperatorCameras';
import { OperatorMiniMap } from './OperatorMiniMap';
import { OperatorInfoBlock } from './OperatorInfoBlock';
import { OperatorMessages } from './OperatorMessages';
import { HoldButton } from './HoldButton';
import { useOperatorFeeds, useOperatorRecording } from './useOperatorFeeds';
import { isRoverLike } from './operator-logic';
import type { Size } from './float-layout';
import { t } from '../../i18n';

/** How long the vehicle gets to act on a command before the operator is told it did not. */
const COMMAND_SETTLE_MS = 2500;
const TOAST_MS = 5000;

type Toast = { text: string; tone: 'info' | 'error' };


export function OperatorScreen() {
  const connectionState = useConnectionStore((s) => s.connectionState);
  const flight = useTelemetryStore((s) => s.flight);
  const vehicleKey = useActiveVehicleStore((s) => s.activeVehicleKey);
  const allowArm = useOperatorStore((s) => s.config.allowArm);
  const modeButtons = useOperatorStore((s) => s.config.modeButtons);
  const hidden = useOperatorStore((s) => s.config.hiddenElements);
  const shows = (element: OperatorElement) => !hidden.includes(element);
  const feeds = useOperatorFeeds();
  const recording = useOperatorRecording(feeds.sources, feeds.main);
  useOperatorRc(feeds.sources, feeds.main?.id ?? null, feeds.selectMain);

  // The camera area in px: movable windows are placed and clamped against it.
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setArea({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // A transmitter plugged in or pulled out is said aloud: the operator must know who is driving.
  useEffect(() => {
    const on = (e: GamepadEvent) => { if (isController(e.gamepad)) say(t('operator.OperatorScreen.padConnected', { name: e.gamepad.id })); };
    const off = (e: GamepadEvent) => { if (isController(e.gamepad)) say(t('operator.OperatorScreen.padDisconnected', { name: e.gamepad.id }), 'error'); };
    window.addEventListener('gamepadconnected', on);
    window.addEventListener('gamepaddisconnected', off);
    return () => {
      window.removeEventListener('gamepadconnected', on);
      window.removeEventListener('gamepaddisconnected', off);
    };
  }, [say]);

  const connected = connectionState.isConnected && connectionState.protocol === 'mavlink';
  const rover = isRoverLike(connectionState.mavType);
  const canDrive = connected && rover;

  // ---- Vehicle commands ---------------------------------------------------
  const lastModeAsked = useRef<number | null>(null);
  const setMode = useCallback(async (button: OperatorModeButton) => {
    if (!canDrive) return;
    const wanted = ROVER_MODE_NUMBER[button];
    lastModeAsked.current = wanted;
    const sent = await window.electronAPI.mavlinkSetMode(wanted);
    const label = modeButtonLabel(button);
    if (!sent) { say(t('operator.OperatorScreen.commandNotSent'), 'error'); return; }
    setTimeout(() => {
      // A mode asked for since then has replaced this one: its own check speaks for it.
      if (lastModeAsked.current !== wanted) return;
      if (useTelemetryStore.getState().flight.modeNum !== wanted) say(t('operator.OperatorScreen.modeRefused', { mode: label }), 'error');
    }, COMMAND_SETTLE_MS);
  }, [canDrive, say]);

  // The mode the vehicle was in when STOP was pressed: the same button gives it back.
  const modeBeforeStop = useRef<number | null>(null);
  const stop = useCallback(() => {
    // Nothing may keep the throttle open once STOP is pressed.
    useOperatorRcStore.getState().stop();
    const now = useTelemetryStore.getState().flight.modeNum;
    if (now !== ROVER_MODE_NUMBER.hold) modeBeforeStop.current = now;
    void setMode('hold');
  }, [setMode]);

  /** STOP pressed again: back to the mode driven in before, Manual if that is not known. */
  const resume = useCallback(async () => {
    if (!canDrive) return;
    const wanted = modeBeforeStop.current ?? ROVER_MODE_NUMBER.manual;
    lastModeAsked.current = wanted;
    const sent = await window.electronAPI.mavlinkSetMode(wanted);
    if (!sent) { say(t('operator.OperatorScreen.commandNotSent'), 'error'); return; }
    setTimeout(() => {
      if (lastModeAsked.current !== wanted) return;
      if (useTelemetryStore.getState().flight.modeNum !== wanted) say(t('operator.OperatorScreen.resumeRefused'), 'error');
    }, COMMAND_SETTLE_MS);
  }, [canDrive, say]);

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

  const toggleRecording = () => {
    say(recording.on ? t('operator.OperatorScreen.recordingSaved', { dir: recording.dir }) : t('operator.OperatorScreen.recordingOn'));
    recording.toggle();
  };

  const holding = connected && flight.modeNum === ROVER_MODE_NUMBER.hold;
  const several = feeds.sources.length > 1;

  return (
    <div className="flex h-full min-h-0 select-none flex-col bg-surface-base">
      <OperatorStatusBar recording={recording} />

      <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden">
        {/* Nothing is placed until the area has a size: a window laid out against 0x0 would jump. */}
        {area.width > 0 && <OperatorCameras feeds={feeds} area={area} allowPopOut={shows('popOut')} controls={shows('cameraControls')} />}
        {area.width > 0 && shows('map') && <OperatorMiniMap area={area} allowPopOut={shows('popOut')} />}
        {shows('infoBlock') && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-[14]">
            <OperatorInfoBlock tilt={shows('attitude')} />
          </div>
        )}

        {toast && (
          <div className={`pointer-events-none absolute left-1/2 top-14 z-30 max-w-[80%] -translate-x-1/2 rounded-lg px-4 py-2 text-center text-sm font-medium shadow-xl ${
            toast.tone === 'error' ? 'bg-red-700 text-white' : 'bg-black/80 text-white'
          }`}>
            {toast.text}
          </div>
        )}
      </div>

      {shows('messages') && <OperatorMessages />}

      {/* One compact bar: the administrator's controls on the left, mode / ARM / STOP on the right. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-subtle bg-surface px-2 py-1.5">
        <OperatorControls
          connected={connected}
          vehicleKey={vehicleKey}
          severalCameras={several}
          recording={{ mode: recording.mode, on: recording.on, toggle: toggleRecording }}
          onRefused={(text) => say(text, 'error')}
        />

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {connected && !rover && (
            <span className="max-w-[16rem] text-xs leading-snug text-amber-400">{t('operator.OperatorScreen.notRover')}</span>
          )}
          <OperatorModeMenu
            modes={modeButtons}
            modeNum={connected ? flight.modeNum : null}
            currentLabel={modeLabel(flight.mode)}
            disabled={!canDrive}
            onPick={(m) => void setMode(m)}
          />

          {allowArm && (
            <HoldButton
              onConfirm={() => void armDisarm(!flight.armed)}
              disabled={!connected}
              tip={t('operator.OperatorScreen.holdTip')}
              fillClassName={flight.armed ? 'bg-emerald-400/40' : 'bg-red-400/50'}
              className={`h-8 min-w-[5.5rem] rounded-md border px-2.5 text-xs font-bold uppercase tracking-wide ${
                connected && flight.armed
                  ? 'border-emerald-500/70 bg-emerald-500/15 text-emerald-400'
                  : 'border-red-500/70 bg-red-500/10 text-red-400'
              }`}
            >
              {/* "Hold" is said by the hand and the filling bar; the tooltip spells it out. */}
              <Hand className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{connected && flight.armed ? 'DISARM' : 'ARM'}</span>
            </HoldButton>
          )}

          {/* Stopped: the same button lets the vehicle go again. The Space key only ever stops. */}
          <button
            onClick={holding ? () => void resume() : stop}
            disabled={!canDrive}
            data-tip={holding ? t('operator.OperatorScreen.resumeTip') : t('operator.OperatorScreen.stopTip')}
            className={`flex h-9 min-w-[8.5rem] items-center justify-center gap-1.5 rounded-md px-3 text-sm font-extrabold uppercase tracking-wide text-white shadow-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              holding ? 'bg-amber-600 ring-2 ring-amber-300 hover:bg-amber-500' : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {holding ? <Play className="h-5 w-5" /> : <OctagonX className="h-5 w-5" />}
            <span className="whitespace-nowrap">{holding ? t('operator.OperatorScreen.resume') : t('operator.OperatorScreen.stop')}</span>
            {!holding && <kbd className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal">{t('operator.OperatorScreen.spaceKey')}</kbd>}
          </button>
        </div>
      </div>
    </div>
  );
}
