/**
 * Hooks that tie the operator screen to the RC control running in the main process.
 */

import { useEffect, useRef } from 'react';
import { useOperatorStore } from '../../stores/operator-store';
import { useOperatorUiStore } from '../../stores/operator-ui-store';
import { followOperatorRc, useOperatorRcStore } from '../../stores/operator-rc-store';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { useConnectionStore } from '../../stores/connection-store';
import { calibratePad, pickPad, rcUsesJoystick } from '../../../shared/operator-rc';
import type { CameraSourceConfig } from '../../../shared/camera-types';

/** 40 readings a second: smooth for driving, well inside what the link carries. */
const PAD_POLL_MS = 25;

/**
 * Reads the joystick in this window and hands the readings to the engine.
 *
 * Every operator window runs this - the screen itself and each camera or map pop-out -
 * because the browser only updates a joystick for the window in front. Whichever window
 * the operator last clicked is the one that reads; the others stay quiet.
 */
export function useOperatorGamepadFeed(): void {
  const ready = useOperatorStore((s) => s.ready);
  const wanted = useOperatorStore((s) => rcUsesJoystick(s.config.rc));
  const padId = useOperatorStore((s) => s.config.rc.padId);
  const calibration = useOperatorStore((s) => s.config.padCalibration);

  // A pop-out is its own renderer and has not read the operator settings yet.
  useEffect(() => { if (!ready) void useOperatorStore.getState().load(); }, [ready]);

  useEffect(() => {
    if (!wanted || typeof navigator.getGamepads !== 'function') return;
    const timer = setInterval(() => {
      if (!document.hasFocus()) return;
      const pad = pickPad(Array.from(navigator.getGamepads()), padId);
      if (!pad) return;
      // The engine works with calibrated sticks: centre is 0 and the ends are -1 and 1 whatever the device reports.
      window.electronAPI.operatorRcGamepad(calibratePad({ id: pad.id, axes: Array.from(pad.axes), buttons: pad.buttons.map((b) => b.pressed) }, calibration));
    }, PAD_POLL_MS);
    return () => clearInterval(timer);
  }, [wanted, padId, calibration]);
}

/** Which camera looks backwards: the administrator's choice, else the one named like it. */
export function rearCamera(sources: CameraSourceConfig[], configuredId: string): CameraSourceConfig | null {
  return sources.find((s) => s.id === configuredId)
    ?? sources.find((s) => /rear|back|зад|тил|корм/i.test(s.label ?? ''))
    ?? null;
}

/**
 * The operator screen's side of the RC control: the engine sends only while this screen
 * is up, cruise lets go when the vehicle disarms or the link drops, and reverse driving
 * puts the rear camera on the main view (and gives the view back afterwards).
 */
export function useOperatorRc(sources: CameraSourceConfig[], mainId: string | null, selectMain: (id: string) => void): void {
  useOperatorGamepadFeed();

  useEffect(() => {
    const unfollow = followOperatorRc();
    void window.electronAPI.operatorRcAttach(true).then((state) => useOperatorRcStore.setState({ state })).catch(() => {});
    return () => {
      unfollow();
      void window.electronAPI.operatorRcAttach(false).catch(() => {});
    };
  }, []);

  const armed = useTelemetryStore((s) => s.flight.armed);
  const connected = useConnectionStore((s) => s.connectionState.isConnected);
  useEffect(() => {
    if (!armed || !connected) useOperatorRcStore.getState().stop();
  }, [armed, connected]);

  const reverse = useOperatorRcStore((s) => s.state.reverse);
  const switchCamera = useOperatorStore((s) => s.config.rc.reverse.switchCamera);
  const rearId = useOperatorStore((s) => s.config.rc.reverse.cameraSourceId);
  // The view the operator had before reverse driving, to give back afterwards.
  const viewBefore = useRef<string | null>(null);
  const latest = useRef({ sources, mainId, selectMain });
  latest.current = { sources, mainId, selectMain };
  useEffect(() => {
    if (!switchCamera) return;
    const now = latest.current;
    if (reverse) {
      const rear = rearCamera(now.sources, rearId);
      if (!rear || rear.id === now.mainId) return;
      viewBefore.current = now.mainId;
      now.selectMain(rear.id);
    } else if (viewBefore.current) {
      const back = viewBefore.current;
      viewBefore.current = null;
      if (now.sources.some((s) => s.id === back)) now.selectMain(back);
    }
  }, [reverse, switchCamera, rearId]);

  // Leaving the screen with the rear view still up would leave it as the main view for good.
  useEffect(() => () => {
    if (viewBefore.current) useOperatorUiStore.getState().setMainSource(viewBefore.current);
  }, []);
}
