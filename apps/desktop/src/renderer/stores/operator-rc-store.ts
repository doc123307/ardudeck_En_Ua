/**
 * The operator's RC control as the screen sees it. The control itself runs in the main
 * process (main/operator/operator-rc-engine.ts); this store mirrors its state and passes
 * the operator's presses on.
 */

import { create } from 'zustand';
import { IDLE_RC_STATE, type RcActionResult, type RcEngineState } from '../../shared/operator-rc';

interface OperatorRcStore {
  state: RcEngineState;
  setFunction: (id: string, value: number) => Promise<RcActionResult>;
  setDrive: (on: boolean) => Promise<RcActionResult>;
  setReverse: (on: boolean) => Promise<RcActionResult>;
  setCruise: (on: boolean) => Promise<RcActionResult>;
  adjustCruise: (direction: 1 | -1) => Promise<RcActionResult>;
  /** STOP, disarm, link lost: cruise lets go of the throttle. */
  stop: () => void;
}

export const useOperatorRcStore = create<OperatorRcStore>((set) => {
  // The answer to a press arrives before the state event does; showing it at once keeps
  // a button from looking dead for a frame.
  const act = async (call: Promise<RcActionResult>): Promise<RcActionResult> => {
    try {
      const result = await call;
      set({ state: await window.electronAPI.operatorRcState() });
      return result;
    } catch {
      return { ok: false, reason: 'disabled' };
    }
  };
  return {
    state: IDLE_RC_STATE,
    setFunction: (id, value) => act(window.electronAPI.operatorRcFunction(id, value)),
    setDrive: (on) => act(window.electronAPI.operatorRcDrive(on)),
    setReverse: (on) => act(window.electronAPI.operatorRcReverse(on)),
    setCruise: (on) => act(window.electronAPI.operatorRcCruise({ on })),
    adjustCruise: (direction) => act(window.electronAPI.operatorRcCruise({ adjust: direction })),
    stop: () => { void window.electronAPI.operatorRcStop().catch(() => {}); },
  };
});

/** Follow the engine's state in this window. Returns the unsubscribe function. */
export function followOperatorRc(): () => void {
  void window.electronAPI.operatorRcState().then((state) => useOperatorRcStore.setState({ state })).catch(() => {});
  return window.electronAPI.onOperatorRcState((state) => useOperatorRcStore.setState({ state }));
}
