/** Building blocks shared by the "Operator workspace" settings pages. */

import { useEffect, useState, type ReactNode } from 'react';
import { OPERATOR_COLORS, OPERATOR_ICONS, type OperatorColor, type OperatorIcon } from '../../../shared/operator-panel';
import { ICON_COMPONENTS, SWATCH } from './operator-look';
import { t } from '../../i18n';

export function IconPicker({ value, onChange }: { value: OperatorIcon; onChange: (icon: OperatorIcon) => void }) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {OPERATOR_ICONS.map((name) => {
        const Icon = ICON_COMPONENTS[name];
        return (
          <button key={name} type="button" onClick={() => onChange(name)}
            className={`flex h-7 w-7 items-center justify-center rounded ${value === name ? 'bg-blue-600 text-white' : 'text-content-secondary hover:bg-surface hover:text-content'}`}>
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: OperatorColor; onChange: (color: OperatorColor) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {OPERATOR_COLORS.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} data-tip={t(`vehicle_outputs.RelayButtons.color_${c}`)}
          className={`h-5 w-5 rounded-full ${SWATCH[c]} ${value === c ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-surface' : ''}`} />
      ))}
    </div>
  );
}

/** A row of tabs at the top of a settings page. */
export function SectionTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-1 rounded-xl border border-subtle bg-surface p-1 shadow-sm">
      {tabs.map((tab) => (
        <button key={tab.id} type="button" onClick={() => onChange(tab.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${value === tab.id ? 'bg-blue-600 text-white' : 'text-content-secondary hover:bg-surface-raised hover:text-content'}`}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** A text field saved when it is left. */
export function TextField({ value, onCommit, label, width = 'w-40', maxLength = 24, placeholder }: {
  value: string; onCommit: (v: string) => void; label: string; width?: string; maxLength?: number; placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="flex flex-col gap-1 text-xs text-content-secondary">
      <span className="whitespace-nowrap">{label}</span>
      <input
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft.trim() !== value) onCommit(draft.trim()); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={`${FIELD} ${width} px-2`}
      />
    </label>
  );
}

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

/**
 * A number that may be fractional and may be left empty (then null): scale factors, limits.
 * Saved when the field is left.
 */
export function DecimalField({ value, onCommit, label, allowEmpty = false, width = 'w-20' }: {
  value: number | null; onCommit: (v: number | null) => void; label: string; allowEmpty?: boolean; width?: string;
}) {
  const show = (v: number | null) => (v === null ? '' : String(v));
  const [draft, setDraft] = useState(show(value));
  useEffect(() => setDraft(show(value)), [value]);
  const commit = () => {
    const trimmed = draft.trim().replace(',', '.');
    if (trimmed === '') {
      if (allowEmpty) { if (value !== null) onCommit(null); } else setDraft(show(value));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) { setDraft(show(value)); return; }
    if (n !== value) onCommit(n);
  };
  return (
    <label className="flex flex-col gap-1 text-xs text-content-secondary">
      <span className="whitespace-nowrap">{label}</span>
      <input
        inputMode="decimal"
        value={draft}
        placeholder={allowEmpty ? '—' : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={`${FIELD} ${width} px-2`}
      />
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
