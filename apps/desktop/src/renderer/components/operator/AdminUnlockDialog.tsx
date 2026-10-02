/**
 * Administrator sign-in. On a fresh install there is no password yet: the first
 * person to open this creates it (whoever sets the app up), and is let in.
 */

import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useOperatorStore } from '../../stores/operator-store';
import { ADMIN_PASSWORD_MIN_LENGTH, type AdminAuthResult } from '../../../shared/operator-types';
import { t } from '../../i18n';

/** What to tell the person after a refused attempt. */
export function authErrorText(result: AdminAuthResult, now: number, lockedUntil: number): string {
  switch (result.error) {
    case 'wrong-password':
      return t('operator.AdminUnlockDialog.wrongPassword', { n: result.attemptsLeft ?? 0 });
    case 'locked-out':
      return t('operator.AdminUnlockDialog.lockedOut', { seconds: Math.max(1, Math.ceil((lockedUntil - now) / 1000)) });
    case 'too-short':
      return t('operator.AdminUnlockDialog.tooShort', { n: ADMIN_PASSWORD_MIN_LENGTH });
    case 'storage':
      return t('operator.AdminUnlockDialog.storageError');
    default:
      return t('operator.AdminUnlockDialog.notAllowed');
  }
}

const FIELD = 'w-full rounded-lg border border-subtle bg-surface-input px-3 py-2 text-sm text-content focus:border-blue-500 focus:outline-none';

export function AdminUnlockDialog({ onClose }: { onClose: () => void }) {
  const hasPassword = useOperatorStore((s) => s.hasPassword);
  const unlock = useOperatorStore((s) => s.unlock);
  const createPassword = useOperatorStore((s) => s.createPassword);
  // Fixed for the life of the dialog: creating the password flips hasPassword just before it closes.
  const [creating] = useState(!hasPassword);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<AdminAuthResult | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  // Count the lock-out down on screen.
  useEffect(() => {
    if (lockedUntil <= now) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [lockedUntil, now]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const locked = lockedUntil > now;

  const submit = async () => {
    if (busy || locked || !password) return;
    setMismatch(false);
    if (creating && password !== repeat) { setMismatch(true); return; }
    setBusy(true);
    try {
      const result = creating ? await createPassword(password) : await unlock(password);
      if (result.ok) { onClose(); return; }
      setFailed(result);
      setPassword('');
      setRepeat('');
      if (result.error === 'locked-out') {
        setNow(Date.now());
        setLockedUntil(Date.now() + (result.retryAfterMs ?? 0));
      }
    } finally {
      setBusy(false);
    }
  };

  const error = mismatch
    ? t('operator.AdminUnlockDialog.mismatch')
    : failed && (failed.error !== 'locked-out' || locked)
      ? authErrorText(failed, now, lockedUntil)
      : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <form
        className="mx-4 w-full max-w-sm rounded-2xl border border-subtle bg-surface-solid p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-content">
              {creating ? t('operator.AdminUnlockDialog.createTitle') : t('operator.AdminUnlockDialog.title')}
            </h2>
            <p className="text-xs text-content-secondary">
              {creating ? t('operator.AdminUnlockDialog.createHint', { n: ADMIN_PASSWORD_MIN_LENGTH }) : t('operator.AdminUnlockDialog.hint')}
            </p>
          </div>
        </div>

        <input
          type="password"
          autoFocus
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('operator.AdminUnlockDialog.password')}
          className={FIELD}
        />
        {creating && (
          <input
            type="password"
            autoComplete="off"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            placeholder={t('operator.AdminUnlockDialog.repeat')}
            className={`${FIELD} mt-2`}
          />
        )}

        <p className={`mt-2 min-h-[2rem] text-xs leading-snug ${error ? 'text-red-400' : 'text-content-tertiary'}`}>
          {error ?? (creating ? t('operator.AdminUnlockDialog.createNote') : '')}
        </p>

        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-surface-raised px-4 py-2 text-sm text-content hover:brightness-110">
            {t('operator.AdminUnlockDialog.cancel')}
          </button>
          <button
            type="submit"
            disabled={busy || locked || !password || (creating && !repeat)}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {creating ? t('operator.AdminUnlockDialog.create') : t('operator.AdminUnlockDialog.enter')}
          </button>
        </div>
      </form>
    </div>
  );
}
