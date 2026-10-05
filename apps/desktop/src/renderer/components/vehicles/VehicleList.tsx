/**
 * The vehicle list: pick the vehicle to work with, and (when allowed) add, change, copy and
 * remove vehicles. Shown in the full UI's connection panel and on the operator screen.
 * Each vehicle carries its link, cameras, outputs and operator panel; choosing one puts
 * all of that in place and connects.
 */

import { useState } from 'react';
import { Check, Copy, Pencil, Plus, Power, Trash2, Wifi } from 'lucide-react';
import { useVehiclesStore, currentConnection } from '../../stores/vehicles-store';
import { useConnectionStore } from '../../stores/connection-store';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { describeConnection } from '../operator/operator-logic';
import { nextVehicleName, newVehicleId, type VehiclePreset } from '../../../shared/vehicle-presets';
import type { ConnectOptions } from '../../../shared/ipc-channels';
import { t } from '../../i18n';

const FIELD = 'min-w-0 rounded-md border border-subtle bg-surface-input px-2 py-1 text-sm text-content focus:border-blue-500 focus:outline-none';
const BTN = 'inline-flex h-8 items-center gap-1.5 rounded-md border border-subtle bg-surface-raised px-2.5 text-xs font-medium text-content hover:border-content-tertiary/60 disabled:cursor-not-allowed disabled:opacity-40';
const ICON_BTN = 'flex h-8 w-8 items-center justify-center rounded-md text-content-tertiary hover:bg-surface-raised hover:text-content disabled:opacity-30';

type LinkKind = 'udp-client' | 'udp-listen' | 'tcp' | 'serial';

function linkKind(c: ConnectOptions | null): LinkKind {
  if (!c) return 'udp-client';
  if (c.type === 'tcp') return 'tcp';
  if (c.type === 'serial') return 'serial';
  return c.udpMode === 'listen' ? 'udp-listen' : 'udp-client';
}

/** A link of the chosen kind, keeping what can be kept from the one before. */
function withKind(kind: LinkKind, c: ConnectOptions | null): ConnectOptions {
  const protocol = c?.protocol ?? 'mavlink';
  if (kind === 'tcp') return { type: 'tcp', host: c?.host ?? c?.udpRemoteHost ?? '127.0.0.1', tcpPort: c?.tcpPort ?? 5760, protocol };
  if (kind === 'serial') return { type: 'serial', port: c?.port ?? 'COM3', baudRate: c?.baudRate ?? 115200 };
  if (kind === 'udp-listen') return { type: 'udp', udpMode: 'listen', udpPort: c?.udpPort ?? 14550, protocol };
  return {
    type: 'udp', udpMode: 'client', udpRemoteHost: c?.udpRemoteHost ?? c?.host ?? '', udpRemotePort: c?.udpRemotePort ?? 14550,
    udpClientLocalPort: c?.udpClientLocalPort ?? 14550, udpPort: c?.udpPort ?? 14550, protocol,
  };
}

function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-[11px] text-content-secondary ${grow ? 'min-w-[9rem] flex-1' : ''}`}>
      <span className="whitespace-nowrap">{label}</span>
      {children}
    </label>
  );
}

function LinkEditor({ value, onChange }: { value: ConnectOptions | null; onChange: (next: ConnectOptions) => void }) {
  const kind = linkKind(value);
  const c = value ?? withKind(kind, null);
  const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && v.trim() !== '' ? Math.round(Number(v)) : fallback);
  const kinds: LinkKind[] = ['udp-client', 'udp-listen', 'tcp', 'serial'];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {kinds.map((k) => (
          <button key={k} type="button" onClick={() => onChange(withKind(k, value))}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${kind === k ? 'bg-blue-600 text-white' : 'bg-surface-raised text-content-secondary hover:text-content'}`}>
            {t(`vehicles.VehicleList.link_${k}`)}
          </button>
        ))}
        <button type="button" onClick={() => { const now = currentConnection(); if (now) onChange(now); }} className={`${BTN} ml-auto`}>
          <Wifi className="h-3.5 w-3.5" />{t('vehicles.VehicleList.useCurrentLink')}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {kind === 'udp-client' && (
          <>
            <Field label={t('vehicles.VehicleList.host')} grow><input className={FIELD} value={c.udpRemoteHost ?? ''} placeholder="100.67.0.245" onChange={(e) => onChange({ ...c, udpRemoteHost: e.target.value.trim() })} /></Field>
            <Field label={t('vehicles.VehicleList.remotePort')}><input className={`${FIELD} w-24`} inputMode="numeric" value={c.udpRemotePort ?? ''} onChange={(e) => onChange({ ...c, udpRemotePort: num(e.target.value, 14550) })} /></Field>
            <Field label={t('vehicles.VehicleList.localPort')}><input className={`${FIELD} w-24`} inputMode="numeric" value={c.udpClientLocalPort ?? ''} onChange={(e) => onChange({ ...c, udpClientLocalPort: num(e.target.value, 14550) })} /></Field>
          </>
        )}
        {kind === 'udp-listen' && (
          <Field label={t('vehicles.VehicleList.listenPort')}><input className={`${FIELD} w-24`} inputMode="numeric" value={c.udpPort ?? ''} onChange={(e) => onChange({ ...c, udpPort: num(e.target.value, 14550) })} /></Field>
        )}
        {kind === 'tcp' && (
          <>
            <Field label={t('vehicles.VehicleList.host')} grow><input className={FIELD} value={c.host ?? ''} onChange={(e) => onChange({ ...c, host: e.target.value.trim() })} /></Field>
            <Field label={t('vehicles.VehicleList.port')}><input className={`${FIELD} w-24`} inputMode="numeric" value={c.tcpPort ?? ''} onChange={(e) => onChange({ ...c, tcpPort: num(e.target.value, 5760) })} /></Field>
          </>
        )}
        {kind === 'serial' && (
          <>
            <Field label={t('vehicles.VehicleList.serialPort')} grow><input className={FIELD} value={c.port ?? ''} placeholder="COM3" onChange={(e) => onChange({ ...c, port: e.target.value.trim() })} /></Field>
            <Field label={t('vehicles.VehicleList.baud')}><input className={`${FIELD} w-28`} inputMode="numeric" value={c.baudRate ?? ''} onChange={(e) => onChange({ ...c, baudRate: num(e.target.value, 115200) })} /></Field>
          </>
        )}
      </div>
    </div>
  );
}

function VehicleEditor({ initial, onSave, onCancel }: { initial: VehiclePreset; onSave: (p: VehiclePreset) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<VehiclePreset>(initial);
  return (
    <div className="flex flex-col gap-3 border-t border-subtle bg-surface px-3 py-3">
      <Field label={t('vehicles.VehicleList.name')}>
        <input className={FIELD} value={draft.name} maxLength={40} autoFocus onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <div>
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-content-tertiary">{t('vehicles.VehicleList.link')}</div>
        <LinkEditor value={draft.connection} onChange={(connection) => setDraft({ ...draft, connection })} />
      </div>
      <p className="text-[11px] leading-snug text-content-tertiary">{t('vehicles.VehicleList.panelNote')}</p>
      <div className="flex gap-2">
        <button type="button" className={`${BTN} border-blue-500 bg-blue-600 text-white hover:bg-blue-500`}
          disabled={!draft.name.trim()} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>
          <Check className="h-3.5 w-3.5" />{t('vehicles.VehicleList.save')}
        </button>
        <button type="button" className={BTN} onClick={onCancel}>{t('vehicles.VehicleList.cancel')}</button>
      </div>
    </div>
  );
}

function counts(p: VehiclePreset): string {
  const fn = p.panel.rc.functions.length;
  return [
    t('vehicles.VehicleList.camerasCount', { n: p.cameras.length }),
    t('vehicles.VehicleList.outputsCount', { n: p.relays.length + fn }),
  ].join(' · ');
}

export function VehicleList({ canEdit, onPicked }: { canEdit: boolean; onPicked?: () => void }) {
  const { state, activate, save, remove, fromCurrent } = useVehiclesStore();
  const connected = useConnectionStore((s) => s.connectionState.isConnected);
  const armed = useTelemetryStore((s) => s.flight.armed);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<VehiclePreset | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: 'switch' | 'delete' } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const pick = async (id: string) => {
    if (connected && armed) { setNote(t('vehicles.VehicleList.disarmFirst')); return; }
    setConfirm(null);
    setNote(null);
    const r = await activate(id);
    if (!r.ok) setNote(t('vehicles.VehicleList.failed'));
    else onPicked?.();
  };
  const askPick = (id: string) => {
    if (connected && id !== state.activeId) setConfirm({ id, kind: 'switch' });
    else void pick(id);
  };
  const store = async (preset: VehiclePreset) => {
    const r = await save(preset);
    if (!r.ok) { setNote(t(r.error === 'not-allowed' ? 'vehicles.VehicleList.notAllowed' : 'vehicles.VehicleList.failed')); return false; }
    return true;
  };

  return (
    <div className="flex flex-col gap-2">
      {state.presets.map((p) => {
        const active = p.id === state.activeId;
        return (
          <div key={p.id} className={`overflow-hidden rounded-lg border ${active ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-subtle bg-surface-raised/40'}`}>
            <div className="px-3 pb-2 pt-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${active ? (connected ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-content-tertiary/50'}`} />
                <span className="min-w-0 truncate text-sm font-semibold text-content">{p.name}</span>
                {active && <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-400">{t('vehicles.VehicleList.inUse')}</span>}
              </div>
              <div className="mt-0.5 truncate pl-[18px] text-[11px] text-content-secondary">
                {p.connection ? describeConnection(p.connection) : t('vehicles.VehicleList.noLink')} · {counts(p)}
              </div>
              <div className="mt-2 flex items-center gap-1 pl-[18px]">
              {!active && (
                <button type="button" className={`${BTN} border-blue-500/60 text-blue-300`} onClick={() => askPick(p.id)}>
                  <Power className="h-3.5 w-3.5" />{t('vehicles.VehicleList.choose')}
                </button>
              )}
              {active && !connected && p.connection && (
                <button type="button" className={BTN} onClick={() => void pick(p.id)}>
                  <Power className="h-3.5 w-3.5" />{t('vehicles.VehicleList.connect')}
                </button>
              )}
              {canEdit && (
                <>
                  <span className="flex-1" />
                  <button type="button" className={ICON_BTN} onClick={() => setEditing(editing === p.id ? null : p.id)} data-tip={t('vehicles.VehicleList.edit')}><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" className={ICON_BTN} data-tip={t('vehicles.VehicleList.copy')}
                    onClick={() => void store({ ...structuredClone(p), id: newVehicleId(state.presets), name: `${p.name} (${t('vehicles.VehicleList.copySuffix')})` })}>
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className={`${ICON_BTN} hover:text-red-400`} onClick={() => setConfirm({ id: p.id, kind: 'delete' })} data-tip={t('vehicles.VehicleList.remove')}><Trash2 className="h-3.5 w-3.5" /></button>
                </>
              )}
              </div>
            </div>
            {confirm?.id === p.id && (
              <div className="flex flex-wrap items-center gap-2 border-t border-subtle bg-surface px-3 py-2 text-xs text-content">
                <span className="flex-1">{confirm.kind === 'switch' ? t('vehicles.VehicleList.confirmSwitch', { name: p.name }) : t('vehicles.VehicleList.confirmDelete', { name: p.name })}</span>
                <button type="button" className={`${BTN} ${confirm.kind === 'delete' ? 'border-red-500 bg-red-600 text-white' : 'border-blue-500 bg-blue-600 text-white'}`}
                  onClick={() => { if (confirm.kind === 'switch') void pick(p.id); else { setConfirm(null); void remove(p.id); } }}>
                  {confirm.kind === 'switch' ? t('vehicles.VehicleList.yesSwitch') : t('vehicles.VehicleList.yesDelete')}
                </button>
                <button type="button" className={BTN} onClick={() => setConfirm(null)}>{t('vehicles.VehicleList.cancel')}</button>
              </div>
            )}
            {editing === p.id && (
              <VehicleEditor initial={p} onCancel={() => setEditing(null)} onSave={(next) => { void store(next).then((ok) => { if (ok) setEditing(null); }); }} />
            )}
          </div>
        );
      })}

      {state.presets.length === 0 && !adding && <p className="px-1 text-xs text-content-tertiary">{t('vehicles.VehicleList.empty')}</p>}

      {adding && (
        <div className="overflow-hidden rounded-lg border border-blue-500/50">
          <div className="px-3 py-2 text-sm font-semibold text-content">{t('vehicles.VehicleList.newVehicle')}</div>
          <VehicleEditor initial={adding} onCancel={() => setAdding(null)} onSave={(next) => { void store(next).then((ok) => { if (ok) setAdding(null); }); }} />
        </div>
      )}

      {note && <p className="px-1 text-xs text-amber-400">{note}</p>}

      {canEdit && !adding && (
        <button type="button" className={`${BTN} self-start`} onClick={() => setAdding(fromCurrent(nextVehicleName(state.presets, t('vehicles.VehicleList.defaultName'))))}>
          <Plus className="h-3.5 w-3.5" />{t('vehicles.VehicleList.add')}
        </button>
      )}
    </div>
  );
}
