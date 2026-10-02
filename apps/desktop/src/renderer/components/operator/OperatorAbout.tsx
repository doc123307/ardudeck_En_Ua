/**
 * The operator's About page: the same information as Settings → About in the full UI,
 * the support contact, and the way in for the administrator - the product logo, held down.
 * The logo gives no hint that it does anything; an operator is not meant to find it.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, LifeBuoy } from 'lucide-react';
import { AboutSection } from '../settings/SettingsView';
import { AdminUnlockDialog } from './AdminUnlockDialog';
import { useOperatorStore } from '../../stores/operator-store';
import logoImage from '../../assets/logo.png';
import { t } from '../../i18n';

/** How long the logo must be held before the administrator sign-in opens. */
export const ADMIN_HOLD_MS = 2000;

/** "@name" is a Telegram handle; anything else is shown as written. */
export function supportLink(contact: string): string | null {
  const handle = /^@([A-Za-z0-9_]{3,})$/.exec(contact.trim());
  if (handle) return `https://t.me/${handle[1]}`;
  return /^https?:\/\//i.test(contact.trim()) ? contact.trim() : null;
}

export function OperatorAbout({ onBack }: { onBack: () => void }) {
  const supportContact = useOperatorStore((s) => s.config.supportContact);
  const [signIn, setSignIn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHold = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const startHold = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    cancelHold();
    timer.current = setTimeout(() => { timer.current = null; setSignIn(true); }, ADMIN_HOLD_MS);
  };
  useEffect(() => cancelHold, []);

  const link = supportLink(supportContact);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 rounded-lg border border-subtle bg-surface px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('operator.OperatorAbout.back')}
        </button>

        <div className="flex items-center gap-4">
          <img
            src={logoImage}
            alt=""
            draggable={false}
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            onContextMenu={(e) => e.preventDefault()}
            className="h-20 w-20 shrink-0 select-none rounded-2xl object-cover"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-content">{t('brand.name')}</h1>
            <p className="text-sm text-content-secondary">{t('brand.tagline')}</p>
          </div>
        </div>

        {supportContact && (
          <section className="mt-6 flex items-center gap-3 rounded-xl border border-subtle bg-surface p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-content">{t('operator.OperatorAbout.support')}</h3>
              <p className="text-sm text-content-secondary">
                {t('operator.OperatorAbout.supportHint')}{' '}
                {link
                  ? <a href={link} target="_blank" rel="noopener noreferrer" className="break-all text-blue-400 hover:text-blue-300">{supportContact}</a>
                  : <span className="break-all text-content">{supportContact}</span>}
              </p>
            </div>
          </section>
        )}

        <AboutSection />
      </div>

      {signIn && <AdminUnlockDialog onClose={() => setSignIn(false)} />}
    </div>
  );
}
