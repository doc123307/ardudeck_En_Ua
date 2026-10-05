/**
 * Activation. A copy that has no key for this PC shows this screen instead of the program:
 * the PC's code to send to the vendor, and a place to enter the key that comes back. It is
 * asked for once; the key stays with the user's data.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, FileKey, KeyRound } from 'lucide-react';
import type { LicenseError, LicenseStatus } from '../../../shared/license-types';
import { BrandMark } from '../ui/BrandMark';
import { t } from '../../i18n';

const BTN_SHAPE = 'flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40';
const BTN = `${BTN_SHAPE} border-subtle bg-surface-raised text-content`;
const BTN_PRIMARY = `${BTN_SHAPE} border-blue-500 bg-blue-600 text-white`;

function ActivationScreen({ status, onActivated }: { status: LicenseStatus; onActivated: (next: LicenseStatus) => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<LicenseError | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const copy = () => {
    void navigator.clipboard.writeText(status.machineCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const activate = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await window.electronAPI.licenseActivate(text);
      if (result.ok) onActivated(result.status);
      else setError(result.error ?? 'malformed');
    } finally {
      setBusy(false);
    }
  };

  const fromFile = (file: File | undefined) => {
    if (!file) return;
    void file.text().then((text) => { setKey(text.trim()); void activate(text); }).catch(() => setError('malformed'));
  };

  return (
    <div className="flex h-screen items-center justify-center bg-surface-base p-6">
      <div className="flex w-full max-w-xl flex-col gap-5 rounded-2xl border border-subtle bg-surface p-8 shadow-2xl">
        <div className="flex flex-col gap-2">
          <h1 className="text-content"><BrandMark className="h-8" /></h1>
          <p className="text-sm text-content-secondary">{t('license.title')}</p>
        </div>

        <p className="text-sm leading-relaxed text-content-secondary">{t('license.intro')}</p>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-content-tertiary">{t('license.machineCode')}</span>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all rounded-lg border border-subtle bg-surface-input px-4 py-2.5 text-center font-mono text-lg font-semibold tracking-widest text-content">
              {status.machineCode}
            </code>
            <button type="button" onClick={copy} className={BTN}>
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              {copied ? t('license.copied') : t('license.copy')}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-content-tertiary">{t('license.key')}</span>
          <textarea
            value={key}
            onChange={(e) => { setKey(e.target.value); setError(null); }}
            rows={4}
            spellCheck={false}
            placeholder="STOHID1…"
            className="resize-none rounded-lg border border-subtle bg-surface-input px-3 py-2 font-mono text-xs leading-relaxed text-content focus:border-blue-500 focus:outline-none"
          />
          {error && <p className="text-sm text-red-400">{t(`license.error_${error}`)}</p>}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={() => void activate(key)} disabled={!key.trim() || busy}
            className={`${BTN_PRIMARY} flex-1`}>
            <KeyRound className="h-4 w-4" />{t('license.activate')}
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} className={BTN}>
            <FileKey className="h-4 w-4" />{t('license.fromFile')}
          </button>
          <input ref={fileInput} type="file" accept=".key,.txt,text/plain" className="hidden"
            onChange={(e) => { fromFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>
    </div>
  );
}

/** Shows the program to an activated copy and the activation screen to any other. */
export function LicenseGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  useEffect(() => {
    let alive = true;
    void window.electronAPI.licenseStatus().then((s) => { if (alive) setStatus(s); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!status) return <div className="h-screen bg-surface-base" />;
  if (!status.licensed) return <ActivationScreen status={status} onActivated={setStatus} />;
  return <>{children}</>;
}

/** "About" page: who this copy was issued to, for which vehicles, and the PC's code. */
export function LicenseInfo() {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  useEffect(() => { void window.electronAPI.licenseStatus().then(setStatus).catch(() => {}); }, []);
  if (!status) return null;
  const row = (label: string, value: string) => (
    <p className="text-sm text-content-secondary">{label}: <span className="select-text break-all text-content">{value}</span></p>
  );
  return (
    <section className="mt-6 flex items-start gap-3 rounded-xl border border-subtle bg-surface p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
        <KeyRound className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-content">{t('license.aboutTitle')}</h3>
        {!status.required && <p className="text-sm text-content-secondary">{t('license.aboutDev')}</p>}
        {status.owner && row(t('license.aboutOwner'), status.owner)}
        {status.vehicles.length > 0 && row(t('license.aboutVehicles'), status.vehicles.join(', '))}
        {status.id && row(t('license.aboutNumber'), status.id)}
        {row(t('license.machineCode'), status.machineCode)}
      </div>
    </section>
  );
}
