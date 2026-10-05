/**
 * The operator's About page: the same information as Settings → About in the full UI,
 * the support contact, and the way in for the administrator - the product logo, held down.
 * The logo gives no hint that it does anything; an operator is not meant to find it.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Globe, LifeBuoy, Mail, MessageCircle, Phone } from 'lucide-react';
import { AboutSection } from '../settings/SettingsView';
import { AdminUnlockDialog } from './AdminUnlockDialog';
import { useOperatorStore } from '../../stores/operator-store';
import logoImage from '../../assets/logo.png';
import { LicenseInfo } from '../license/LicenseGate';
import { t } from '../../i18n';

/** How long the logo must be held before the administrator sign-in opens. */
export const ADMIN_HOLD_MS = 2000;

/** "@name" is a Telegram handle; anything else is shown as written. */
export function supportLink(contact: string): string | null {
  const handle = /^@([A-Za-z0-9_]{3,})$/.exec(contact.trim());
  if (handle) return `https://t.me/${handle[1]}`;
  return /^https?:\/\//i.test(contact.trim()) ? contact.trim() : null;
}

/** A web address as typed ("stohid.com", "https://www.stohid.com/") to a link; null when it is not one. */
export function siteUrl(site: string): string | null {
  const text = site.trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

function ContactRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="shrink-0 text-content-tertiary">{icon}</span>
      <span className="shrink-0 text-content-secondary">{label}:</span>
      {children}
    </div>
  );
}

export function OperatorAbout({ onBack }: { onBack: () => void }) {
  const supportContact = useOperatorStore((s) => s.config.supportContact);
  const supportSite = useOperatorStore((s) => s.config.supportSite);
  const supportPhone = useOperatorStore((s) => s.config.supportPhone);
  const supportEmail = useOperatorStore((s) => s.config.supportEmail);
  const supportNote = useOperatorStore((s) => s.config.supportNote);
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
  const siteLink = siteUrl(supportSite);

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

        {(supportContact || supportSite || supportPhone || supportEmail || supportNote) && (
          <section className="mt-6 flex items-start gap-3 rounded-xl border border-subtle bg-surface p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-content">{t('operator.OperatorAbout.support')}</h3>
              <p className="text-sm text-content-secondary">{t('operator.OperatorAbout.supportHint')}</p>
              <div className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {supportSite && (
                  <ContactRow icon={<Globe className="h-4 w-4" />} label={t('operator.OperatorAbout.contactSite')}>
                    {siteLink
                      ? <a href={siteLink} target="_blank" rel="noopener noreferrer" className="break-all text-blue-400 hover:text-blue-300">{supportSite.replace(/^https?:\/\//i, '').replace(/\/$/, '')}</a>
                      : <span className="select-text break-all text-content">{supportSite}</span>}
                  </ContactRow>
                )}
                {supportContact && (
                  <ContactRow icon={<MessageCircle className="h-4 w-4" />} label={t('operator.OperatorAbout.contactTelegram')}>
                    {link
                      ? <a href={link} target="_blank" rel="noopener noreferrer" className="break-all text-blue-400 hover:text-blue-300">{supportContact}</a>
                      : <span className="select-text break-all text-content">{supportContact}</span>}
                  </ContactRow>
                )}
                {supportPhone && (
                  <ContactRow icon={<Phone className="h-4 w-4" />} label={t('operator.OperatorAbout.contactPhone')}>
                    <span className="select-text text-content">{supportPhone}</span>
                  </ContactRow>
                )}
                {supportEmail && (
                  <ContactRow icon={<Mail className="h-4 w-4" />} label={t('operator.OperatorAbout.contactEmail')}>
                    <span className="select-text break-all text-content">{supportEmail}</span>
                  </ContactRow>
                )}
              </div>
              {supportNote && <p className="mt-3 select-text whitespace-pre-wrap text-sm text-content-secondary">{supportNote}</p>}
            </div>
          </section>
        )}

        <LicenseInfo />

        <AboutSection />
      </div>

      {signIn && <AdminUnlockDialog onClose={() => setSignIn(false)} />}
    </div>
  );
}
