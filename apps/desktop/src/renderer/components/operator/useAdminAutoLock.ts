/**
 * The full UI closes by itself: left open on a field PC, it would stay open for
 * whoever sits down next. After the configured idle time the app goes back to the
 * operator screen. A PC set to open in the full UI (a service PC) is left alone.
 */

import { useEffect } from 'react';
import { useOperatorStore } from '../../stores/operator-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { useCliStore } from '../../stores/cli-store';

const CHECK_MS = 15_000;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;

/** True once there has been no input for the configured time. */
export function idleExpired(lastActivity: number, now: number, minutes: number): boolean {
  return minutes > 0 && now - lastActivity >= minutes * 60_000;
}

/** Leave the full UI in a state that is safe to walk away from, then show the operator screen. */
export async function returnToOperatorMode(): Promise<void> {
  // A flight controller left in its CLI sends no telemetry: take it out first.
  const cli = useCliStore.getState();
  if (cli.isCliMode) await cli.exitCliMode().catch(() => undefined);
  useNavigationStore.getState().setView('telemetry');
  await useOperatorStore.getState().lock();
}

export function useAdminAutoLock(): void {
  const mode = useOperatorStore((s) => s.mode);
  const minutes = useOperatorStore((s) => s.config.autoLockMinutes);
  const startsAsOperator = useOperatorStore((s) => s.config.startInOperatorMode);

  useEffect(() => {
    if (mode !== 'admin' || minutes <= 0 || !startsAsOperator) return;
    let lastActivity = Date.now();
    const touch = () => { lastActivity = Date.now(); };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, touch, { capture: true, passive: true });
    const id = setInterval(() => {
      if (idleExpired(lastActivity, Date.now(), minutes)) void returnToOperatorMode();
    }, CHECK_MS);
    return () => {
      clearInterval(id);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, touch, { capture: true });
    };
  }, [mode, minutes, startsAsOperator]);
}
