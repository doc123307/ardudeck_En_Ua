import { t } from '../i18n';
// RC-source priority: Trainer session > (sliders XOR joystick override) >
// pseudo-tx SITL stand-in, which gates only on the Trainer.

export type RcOverrideOwner = 'sliders' | 'joystick';

interface ArbiterState {
  trainerActive: boolean;
  owner: RcOverrideOwner | null;
}

const state: ArbiterState = { trainerActive: false, owner: null };

type Listener = (trainerActive: boolean) => void;
const listeners = new Set<Listener>();

export const TRAINER_OWNS_STICKS = 'Trainer session active - the Trainer owns the sticks';

export function claimRcOverride(owner: RcOverrideOwner): { ok: boolean; reason?: string } {
  if (state.trainerActive) return { ok: false, reason: TRAINER_OWNS_STICKS };
  if (state.owner !== null && state.owner !== owner) {
    return {
      ok: false,
      reason: owner === 'sliders' ? t('utils.rc_source_arbiter.joystickControlOwnsTheRcLink') : t('utils.rc_source_arbiter.virtualRcSlidersOwnTheRc'),
    };
  }
  state.owner = owner;
  return { ok: true };
}

export function releaseRcOverride(owner: RcOverrideOwner): void {
  if (state.owner === owner) state.owner = null;
}

export function rcOverrideOwner(): RcOverrideOwner | null {
  return state.owner;
}

export function isTrainerActive(): boolean {
  return state.trainerActive;
}

export function setTrainerActive(active: boolean): void {
  if (state.trainerActive === active) return;
  state.trainerActive = active;
  // The trainer preempts any owner; suspended sources must re-claim afterwards.
  if (active) state.owner = null;
  for (const l of listeners) l(active);
}

/** Subscribe to trainer-session changes. Returns an unsubscribe function. */
export function onTrainerActive(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Listeners survive the reset: stores register theirs once at module import.
export function resetRcArbiterForTest(): void {
  state.trainerActive = false;
  state.owner = null;
}
