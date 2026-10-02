/** Building blocks shared by the "Operator workspace" settings pages. */

import { useEffect, useState, type ReactNode } from 'react';

export const FIELD = 'rounded-lg border border-subtle bg-surface-input px-3 py-1.5 text-sm text-content focus:border-blue-500 focus:outline-none';
export const BTN = 'rounded-lg border border-subtle bg-surface-raised px-3 py-1.5 text-sm text-content hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40';

export function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-xl border border-subtle bg-surface p-5">
      <h3 className="text-sm font-semibold text-content">{title}</h3>
      {hint && <p className="mt-1 text-xs leading-snug text-content-secondary">{hint}</p>}
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-500" />
      <span className="min-w-0">
        <span className="block text-sm text-content">{label}</span>
        {hint && <span className="block text-xs leading-snug text-content-secondary">{hint}</span>}
      </span>
    </label>
  );
}

/** A number that is saved when the field is left, so half-typed values never reach the screen. */
function useNumberDraft(value: number, min: number, max: number, onCommit: (v: number) => void) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(n)) { setDraft(String(value)); return; }
    const next = Math.min(max, Math.max(min, Math.round(n)));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  return {
    type: 'number' as const,
    value: draft,
    min,
    max,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); },
  };
}

export function NumberField({ value, min, max, onCommit, label, unit }: {
  value: number; min: number; max: number; onCommit: (v: number) => void; label: string; unit: string;
}) {
  const input = useNumberDraft(value, min, max, onCommit);
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm text-content">
      <span className="min-w-[14rem]">{label}</span>
      <input {...input} className={`${FIELD} w-24`} />
      <span className="text-content-secondary">{unit}</span>
    </label>
  );
}

/** The same, with its name above it: for rows of several numbers. */
export function SmallNumber({ value, min, max, onCommit, label }: {
  value: number; min: number; max: number; onCommit: (v: number) => void; label: string;
}) {
  const input = useNumberDraft(value, min, max, onCommit);
  return (
    <label className="flex flex-col gap-1 text-xs text-content-secondary">
      <span className="whitespace-nowrap">{label}</span>
      <input {...input} className={`${FIELD} w-20 px-2`} />
    </label>
  );
}
