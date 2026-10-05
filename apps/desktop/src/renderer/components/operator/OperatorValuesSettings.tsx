/**
 * Settings → Operator workspace → "Values": the status strip. The built-in values, and any
 * other value the vehicle has: a field of any MAVLink message it sends, a NAMED_VALUE from a
 * Lua script or a companion computer, or a flight controller parameter. Each own value has
 * a name, unit, scale and limits at which it turns amber and red.
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Search, X } from 'lucide-react';
import {
  describeSource, newValue, valueFieldKey, type OperatorValue, type OperatorValueSource,
} from '../../../shared/operator-panel';
import { OPERATOR_STATUS_FIELDS, type OperatorConfig } from '../../../shared/operator-types';
import { acquireCatalog, messageCatalog, namedCatalog, useOperatorValues } from '../../stores/operator-values';
import { useConnectionStore } from '../../stores/connection-store';
import { ValueText, isBuiltinField, statusFieldLabel } from './OperatorStatusBar';
import { BTN, Card, DecimalField, FIELD, SmallNumber, TextField } from './OperatorSettingsParts';
import { t } from '../../i18n';

const ROW_BTN = 'flex h-7 w-7 items-center justify-center rounded text-content-tertiary hover:bg-surface hover:text-content disabled:opacity-30';
const PICKER_TICK_MS = 500;

type PickerTab = 'mavlink' | 'named' | 'param';

/** Everything the vehicle is sending right now, to pick a value from. */
function ValuePicker({ onPick, onClose }: { onPick: (source: OperatorValueSource) => void; onClose: () => void }) {
  const connected = useConnectionStore((s) => s.connectionState.isConnected);
  const [tab, setTab] = useState<PickerTab>('mavlink');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [param, setParam] = useState('');
  const [, setTick] = useState(0);
  useEffect(() => {
    const release = acquireCatalog();
    const timer = setInterval(() => setTick((n) => n + 1), PICKER_TICK_MS);
    return () => { clearInterval(timer); release(); };
  }, []);

  const q = query.trim().toLowerCase();
  const messages = messageCatalog().filter((m) => !q || m.message.toLowerCase().includes(q) || m.fields.some((f) => f.field.toLowerCase().includes(q)));
  const picked = messages.find((m) => m.message === message) ?? null;
  const named = namedCatalog().filter((n) => !q || n.name.toLowerCase().includes(q));
  const number = (v: number) => (Math.abs(v) >= 1000 || Number.isInteger(v) ? String(Math.round(v * 100) / 100) : v.toFixed(3));

  const tabs: { id: PickerTab; label: string }[] = [
    { id: 'mavlink', label: t('operator.OperatorValuesSettings.fromMessages') },
    { id: 'named', label: t('operator.OperatorValuesSettings.fromNamed') },
    { id: 'param', label: t('operator.OperatorValuesSettings.fromParam') },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-blue-500/50 bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-surface-raised p-0.5">
          {tabs.map((x) => (
            <button key={x.id} type="button" onClick={() => setTab(x.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${tab === x.id ? 'bg-blue-600 text-white' : 'text-content-secondary hover:text-content'}`}>
              {x.label}
            </button>
          ))}
        </div>
        {tab !== 'param' && (
          <label className="flex items-center gap-1.5 rounded-lg border border-subtle bg-surface-input px-2">
            <Search className="h-3.5 w-3.5 text-content-tertiary" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('operator.OperatorValuesSettings.search')}
              className="w-44 bg-transparent py-1 text-sm text-content focus:outline-none" />
          </label>
        )}
        <button type="button" onClick={onClose} className={`${ROW_BTN} ml-auto`} data-tip={t('operator.OperatorValuesSettings.close')}><X className="h-4 w-4" /></button>
      </div>

      {!connected && tab !== 'param' && <p className="text-xs text-amber-400">{t('operator.OperatorValuesSettings.connectFirst')}</p>}

      {tab === 'mavlink' && (
        <div className="grid min-h-[12rem] gap-2 md:grid-cols-[minmax(10rem,16rem)_1fr]">
          <div className="max-h-72 overflow-y-auto rounded-md border border-subtle">
            {messages.map((m) => (
              <button key={m.message} type="button" onClick={() => setMessage(m.message)}
                className={`block w-full truncate px-2 py-1 text-left font-mono text-xs ${message === m.message ? 'bg-blue-600 text-white' : 'text-content hover:bg-surface-raised'}`}>
                {m.message}
              </button>
            ))}
            {messages.length === 0 && <p className="p-2 text-xs text-content-tertiary">{t('operator.OperatorValuesSettings.nothingYet')}</p>}
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border border-subtle">
            {picked ? picked.fields.map((f) => (
              <button key={`${f.field}[${f.index ?? ''}]`} type="button"
                onClick={() => onPick({ kind: 'mavlink', message: picked.message, field: f.field, index: f.index })}
                className="flex w-full items-center justify-between gap-3 px-2 py-1 text-left text-xs text-content hover:bg-surface-raised">
                <span className="font-mono">{f.field}{f.index === null ? '' : `[${f.index}]`}</span>
                <span className="font-mono tabular-nums text-content-secondary">{number(f.value)}</span>
              </button>
            )) : <p className="p-2 text-xs text-content-tertiary">{t('operator.OperatorValuesSettings.pickMessage')}</p>}
          </div>
        </div>
      )}

      {tab === 'named' && (
        <div className="max-h-72 overflow-y-auto rounded-md border border-subtle">
          {named.map((n) => (
            <button key={n.name} type="button" onClick={() => onPick({ kind: 'named', name: n.name })}
              className="flex w-full items-center justify-between gap-3 px-2 py-1 text-left text-xs text-content hover:bg-surface-raised">
              <span className="font-mono">{n.name}</span>
              <span className="font-mono tabular-nums text-content-secondary">{number(n.value)}</span>
            </button>
          ))}
          {named.length === 0 && <p className="p-2 text-xs text-content-tertiary">{t('operator.OperatorValuesSettings.noNamed')}</p>}
        </div>
      )}

      {tab === 'param' && (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
          e.preventDefault();
          const name = param.trim().toUpperCase();
          if (/^[A-Z0-9_]{1,16}$/.test(name)) onPick({ kind: 'param', name });
        }}>
          <input value={param} onChange={(e) => setParam(e.target.value)} placeholder="CRUISE_SPEED" maxLength={16} className={`${FIELD} w-56 font-mono uppercase`} />
          <button type="submit" disabled={!/^[A-Za-z0-9_]{1,16}$/.test(param.trim())} className={BTN}>{t('operator.OperatorValuesSettings.addParam')}</button>
          <span className="text-xs text-content-tertiary">{t('operator.OperatorValuesSettings.paramHint')}</span>
        </form>
      )}
    </div>
  );
}

function ValueEditor({ value, onChange }: { value: OperatorValue; onChange: (next: OperatorValue) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <TextField value={value.label} label={t('operator.OperatorRcSettings.name')} onCommit={(label) => { if (label) onChange({ ...value, label }); }} />
        <TextField value={value.unit} label={t('operator.OperatorValuesSettings.unit')} width="w-20" maxLength={8} placeholder="V" onCommit={(unit) => onChange({ ...value, unit })} />
        <SmallNumber value={value.decimals} min={0} max={4} onCommit={(decimals) => onChange({ ...value, decimals })} label={t('operator.OperatorValuesSettings.decimals')} />
        <DecimalField value={value.scale} label={t('operator.OperatorValuesSettings.scale')} onCommit={(scale) => { if (scale) onChange({ ...value, scale }); }} />
        <DecimalField value={value.offset} label={t('operator.OperatorValuesSettings.offset')} onCommit={(offset) => onChange({ ...value, offset: offset ?? 0 })} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <DecimalField allowEmpty value={value.dangerBelow} label={t('operator.OperatorValuesSettings.dangerBelow')} onCommit={(dangerBelow) => onChange({ ...value, dangerBelow })} />
        <DecimalField allowEmpty value={value.warnBelow} label={t('operator.OperatorValuesSettings.warnBelow')} onCommit={(warnBelow) => onChange({ ...value, warnBelow })} />
        <DecimalField allowEmpty value={value.warnAbove} label={t('operator.OperatorValuesSettings.warnAbove')} onCommit={(warnAbove) => onChange({ ...value, warnAbove })} />
        <DecimalField allowEmpty value={value.dangerAbove} label={t('operator.OperatorValuesSettings.dangerAbove')} onCommit={(dangerAbove) => onChange({ ...value, dangerAbove })} />
      </div>
      <p className="text-xs leading-snug text-content-tertiary">{t('operator.OperatorValuesSettings.scaleHint', { source: describeSource(value.source) })}</p>
    </div>
  );
}

export function OperatorValuesSettings({ config, save }: { config: OperatorConfig; save: (patch: Partial<OperatorConfig>) => void }) {
  const { statusFields: fields, values } = config;
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const live = useOperatorValues(values);
  const unusedBuiltins = useMemo(() => OPERATOR_STATUS_FIELDS.filter((f) => !fields.includes(f)), [fields]);

  const move = (index: number, by: number) => {
    const next = [...fields];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item!);
    save({ statusFields: next });
  };
  const remove = (field: string) => {
    if (isBuiltinField(field)) { save({ statusFields: fields.filter((f) => f !== field) }); return; }
    // An own value lives only on the strip: taking it off forgets it.
    save({ statusFields: fields.filter((f) => f !== field), values: values.filter((v) => valueFieldKey(v.id) !== field) });
    if (open === field) setOpen(null);
  };
  const add = (source: OperatorValueSource) => {
    const value = newValue(source, values);
    save({ values: [...values, value], statusFields: [...fields, valueFieldKey(value.id)] });
    setPicking(false);
    setOpen(valueFieldKey(value.id));
  };
  const update = (next: OperatorValue) => save({ values: values.map((v) => (v.id === next.id ? next : v)) });

  return (
    <Card title={t('operator.OperatorWorkspaceSettings.statusFields')} hint={t('operator.OperatorValuesSettings.hint')}>
      <div className="flex flex-col divide-y divide-subtle overflow-hidden rounded-lg border border-subtle">
        {fields.map((field, i) => {
          const own = isBuiltinField(field) ? null : values.find((v) => valueFieldKey(v.id) === field) ?? null;
          const isOpen = open === field;
          return (
            <div key={field} className="bg-surface-raised/40">
              <div className="flex min-h-10 items-center gap-2 px-2 py-1">
                <span className="w-5 text-xs tabular-nums text-content-tertiary">{i + 1}</span>
                <span className="min-w-0 truncate text-sm text-content">{own ? own.label : isBuiltinField(field) ? statusFieldLabel(field) : field}</span>
                <span className="shrink-0 truncate rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-content-secondary">
                  {own ? describeSource(own.source) : t('operator.OperatorPanelSettings.kindBuiltin')}
                </span>
                {own && <span className="shrink-0 font-mono text-sm tabular-nums"><ValueText value={own} live={live[own.id]} /></span>}
                <span className="ml-auto flex shrink-0 items-center">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={ROW_BTN} data-tip={t('operator.OperatorWorkspaceSettings.moveLeft')}><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === fields.length - 1} className={ROW_BTN} data-tip={t('operator.OperatorWorkspaceSettings.moveRight')}><ArrowDown className="h-3.5 w-3.5" /></button>
                  {own && (
                    <button type="button" onClick={() => setOpen(isOpen ? null : field)} data-tip={t('operator.OperatorPanelSettings.edit')}
                      className={`${ROW_BTN} ${isOpen ? 'bg-blue-600 text-white hover:bg-blue-600 hover:text-white' : ''}`}><Pencil className="h-3.5 w-3.5" /></button>
                  )}
                  <button type="button" onClick={() => remove(field)} className={`${ROW_BTN} hover:text-red-400`} data-tip={t('operator.OperatorWorkspaceSettings.removeField')}><X className="h-4 w-4" /></button>
                </span>
              </div>
              {own && isOpen && (
                <div className="border-t border-subtle bg-surface px-3 py-3"><ValueEditor value={own} onChange={update} /></div>
              )}
            </div>
          );
        })}
        {fields.length === 0 && <p className="px-3 py-2 text-xs text-content-tertiary">{t('operator.OperatorWorkspaceSettings.noFields')}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {unusedBuiltins.map((f) => (
          <button key={f} type="button" onClick={() => save({ statusFields: [...fields, f] })}
            className="flex items-center gap-1 rounded-md border border-dashed border-subtle px-2 py-1 text-xs text-content-secondary hover:border-blue-500/60 hover:text-content">
            <Plus className="h-3 w-3" />{statusFieldLabel(f)}
          </button>
        ))}
        <button type="button" onClick={() => setPicking(!picking)} className={`${BTN} flex items-center gap-1.5 ${picking ? 'border-blue-500/60' : ''}`}>
          <Plus className="h-3.5 w-3.5" />{t('operator.OperatorValuesSettings.addAny')}
        </button>
      </div>
      {picking && <ValuePicker onPick={add} onClose={() => setPicking(false)} />}
    </Card>
  );
}
