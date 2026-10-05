/**
 * Settings → Operator workspace → "Control panel": everything on the operator's bottom bar
 * in one list. Every control can be moved, hidden or shown; vehicle outputs (relays) and
 * the administrator's own buttons, switches and sliders are added, set up and removed here.
 * A preview above the list shows the bar as the operator will see it.
 */

import { useState } from 'react';
import {
  ArrowLeftRight, ChevronDown, ChevronUp, Circle, Columns2, Eye, EyeOff, Gamepad2, Gauge, LayoutGrid, OctagonX, Pencil,
  Plus, RotateCcw, Trash2, type LucideIcon,
  X,
} from 'lucide-react';
import { useOperatorStore } from '../../stores/operator-store';
import { useRelayStore, type RelayButton } from '../../stores/relay-store';
import {
  arrangeControls, controlKind, defaultControlOrder, moveControl, type BuiltinControl,
} from '../../../shared/operator-panel';
import {
  RC_FUNCTION_KINDS, RC_MAX_FUNCTIONS, RC_MAX_REMOVED, newRcFunction, rcChannelConflicts, servoConflicts,
  type OperatorRcFunction, type RcFunctionKind,
} from '../../../shared/operator-rc';
import type { OperatorConfig } from '../../../shared/operator-types';
import { ICON_COMPONENTS } from './operator-look';
import { OperatorControls } from './OperatorControlBar';
import { FunctionEditor, useJoystick } from './OperatorRcSettings';
import { BTN, Card, ColorPicker, FIELD, IconPicker, SmallNumber, TextField, Toggle } from './OperatorSettingsParts';
import { t } from '../../i18n';

const BUILTIN_ICON: Record<BuiltinControl, LucideIcon> = {
  joystick: Gamepad2, reverse: ArrowLeftRight, cruise: Gauge, record: Circle, layout: LayoutGrid, reset: RotateCcw, pin: Columns2,
};

const ROW_BTN = 'flex h-7 w-7 items-center justify-center rounded text-content-tertiary hover:bg-surface hover:text-content disabled:opacity-30';

/** Why a built-in control is not on the bar even though it is not hidden. */
function builtinUnavailable(key: BuiltinControl, config: OperatorConfig): string | null {
  const { rc } = config;
  if ((key === 'joystick' || key === 'reverse') && !rc.drive.enabled) return t('operator.OperatorPanelSettings.offInDriving');
  if (key === 'reverse' && !rc.reverse.enabled) return t('operator.OperatorPanelSettings.offInDriving');
  if (key === 'cruise' && !rc.cruise.enabled) return t('operator.OperatorPanelSettings.offInDriving');
  if (key === 'record' && config.recordMode !== 'manual') return t('operator.OperatorPanelSettings.onlyManualRecording');
  if (key === 'pin' && config.hiddenElements.includes('cameraControls')) return t('operator.OperatorPanelSettings.cameraControlsOff');
  return null;
}

function RelayEditor({ button }: { button: RelayButton }) {
  const update = useRelayStore((s) => s.updateButton);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <TextField value={button.label} label={t('operator.OperatorRcSettings.name')} onCommit={(label) => { if (label) update(button.id, { label }); }} />
        <SmallNumber value={button.instance + 1} min={1} max={16} onCommit={(n) => update(button.id, { instance: n - 1 })} label={t('operator.OperatorPanelSettings.relayNumber')} />
        <label className="flex flex-col gap-1 text-xs text-content-secondary">
          {t('operator.OperatorPanelSettings.relayKind')}
          <select value={button.kind} onChange={(e) => update(button.id, { kind: e.target.value as RelayButton['kind'] })} className={`${FIELD} py-1`}>
            <option value="toggle">{t('vehicle_outputs.RelayButtons.kindToggle')}</option>
            <option value="momentary">{t('vehicle_outputs.RelayButtons.kindMomentary')}</option>
          </select>
        </label>
      </div>
      <p className="text-xs leading-snug text-content-tertiary">{t('vehicle_outputs.RelayButtons.howItWorks')}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="flex items-center gap-2 text-xs text-content-secondary">{t('operator.OperatorPanelSettings.icon')}<IconPicker value={button.icon} onChange={(icon) => update(button.id, { icon })} /></span>
        <span className="flex items-center gap-2 text-xs text-content-secondary">{t('operator.OperatorPanelSettings.color')}<ColorPicker value={button.color} onChange={(color) => update(button.id, { color })} /></span>
      </div>
    </div>
  );
}

/** A deleted element in the "Add" row: one click puts it back as it was, the cross forgets it for good. */
function RestoreChip({ name, disabled, onRestore, onForget }: { name: string; disabled: boolean; onRestore: () => void; onForget: () => void }) {
  return (
    <span className="flex items-center rounded-lg border border-dashed border-subtle text-sm text-content-secondary hover:border-blue-500/60">
      <button type="button" onClick={onRestore} disabled={disabled} data-tip={t('operator.OperatorPanelSettings.restoreTip')}
        className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-1 hover:text-content disabled:cursor-not-allowed disabled:opacity-40">
        <Plus className="h-3.5 w-3.5" />{name}
      </button>
      <button type="button" onClick={onForget} data-tip={t('operator.OperatorPanelSettings.forgetTip')} className="px-1.5 py-1.5 text-content-tertiary hover:text-red-400">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function OperatorPanelSettings({ config, save }: { config: OperatorConfig; save: (patch: Partial<OperatorConfig>) => void }) {
  const relays = useRelayStore((s) => s.buttons);
  const addRelay = useRelayStore((s) => s.addButton);
  const removeRelay = useRelayStore((s) => s.removeButton);
  // Deleted outputs wait in the vehicle's own settings, so each vehicle offers back only its own.
  const removedRelays = config.removedRelays;
  const restoreRelay = (id: string) => {
    const back = removedRelays.find((r) => r.id === id);
    if (!back || relays.some((r) => r.id === id)) return;
    addRelay(back as Partial<RelayButton>);
    save({ removedRelays: removedRelays.filter((r) => r.id !== id) });
  };
  const forgetRelay = (id: string) => save({ removedRelays: removedRelays.filter((r) => r.id !== id) });
  const { pad } = useJoystick(config.rc.padId, config.padCalibration);
  const [open, setOpen] = useState<string | null>(null);
  const { rc } = config;
  const rcConflicts = rcChannelConflicts(rc);
  const servoClashes = servoConflicts(rc);

  const all = defaultControlOrder(relays.map((r) => r.id), rc.functions.map((f) => f.id));
  // Deleted built-ins leave the list; they come back through "Add".
  const arranged = arrangeControls(config.controlOrder, all).filter((key) => !config.removedControls.includes(key));

  const setHidden = (key: string, hide: boolean) => save({
    hiddenControls: hide ? [...new Set([...config.hiddenControls, key])] : config.hiddenControls.filter((k) => k !== key),
  });
  const setFunction = (next: OperatorRcFunction) => save({ rc: { ...rc, functions: rc.functions.map((f) => (f.id === next.id ? next : f)) } });
  const addFunction = (kind: RcFunctionKind) => {
    const fn = newRcFunction(kind, rc);
    save({ rc: { ...rc, functions: [...rc.functions, fn] } });
    setOpen(`fn:${fn.id}`);
  };
  const remove = (key: string) => {
    if (controlKind(key) === 'builtin') {
      save({ removedControls: [...new Set([...config.removedControls, key])], hiddenControls: config.hiddenControls.filter((k) => k !== key) });
      if (open === key) setOpen(null);
      return;
    }
    // Deleted outputs and functions are kept whole: the "Add" row offers them back by name.
    const panel = { controlOrder: arranged.filter((k) => k !== key), hiddenControls: config.hiddenControls.filter((k) => k !== key) };
    if (controlKind(key) === 'relay') {
      const id = key.slice('relay:'.length);
      const gone = relays.find((r) => r.id === id);
      removeRelay(id);
      save({ ...panel, removedRelays: gone ? [gone, ...removedRelays.filter((r) => r.id !== id)].slice(0, 12) : removedRelays });
    } else {
      const gone = rc.functions.find((f) => `fn:${f.id}` === key);
      save({
        ...panel,
        rc: {
          ...rc,
          functions: rc.functions.filter((f) => `fn:${f.id}` !== key),
          removedFunctions: gone ? [gone, ...rc.removedFunctions].slice(0, RC_MAX_REMOVED) : rc.removedFunctions,
        },
      });
    }
    if (open === key) setOpen(null);
  };
  const restoreFunction = (id: string) => {
    const back = rc.removedFunctions.find((f) => f.id === id);
    if (!back) return;
    save({ rc: { ...rc, functions: [...rc.functions, back], removedFunctions: rc.removedFunctions.filter((f) => f.id !== id) } });
  };
  const forgetFunction = (id: string) => save({ rc: { ...rc, removedFunctions: rc.removedFunctions.filter((f) => f.id !== id) } });
  const addOutput = () => {
    addRelay();
    const added = useRelayStore.getState().buttons.at(-1);
    if (added) setOpen(`relay:${added.id}`);
  };

  const describe = (key: string): { icon: LucideIcon; name: string; detail: string; editable: boolean; note: string | null } => {
    const kind = controlKind(key);
    if (kind === 'builtin') {
      const b = key as BuiltinControl;
      return { icon: BUILTIN_ICON[b], name: t(`operator.OperatorPanelSettings.builtin_${b}`), detail: t('operator.OperatorPanelSettings.kindBuiltin'), editable: false, note: builtinUnavailable(b, config) };
    }
    if (kind === 'relay') {
      const r = relays.find((x) => `relay:${x.id}` === key)!;
      return { icon: ICON_COMPONENTS[r.icon], name: r.label, detail: `${t('operator.OperatorPanelSettings.kindRelay')} · RELAY${r.instance + 1}`, editable: true, note: null };
    }
    const f = rc.functions.find((x) => `fn:${x.id}` === key)!;
    const where = f.output === 'rc' ? `RC ${f.channel}` : `SERVO ${f.channel}`;
    const clash = f.output === 'rc' ? rcConflicts.includes(f.channel) : servoClashes.includes(f.channel);
    return { icon: ICON_COMPONENTS[f.icon], name: f.label, detail: `${t(`operator.OperatorRcSettings.kind_${f.kind}`)} · ${where}`, editable: true, note: clash ? t('operator.OperatorRcSettings.channelConflict', { n: f.channel }) : null };
  };

  return (
    <>
      <Card title={t('operator.OperatorPanelSettings.preview')} hint={t('operator.OperatorPanelSettings.previewHint')}>
        <Toggle checked={config.panelIconsOnly} onChange={(panelIconsOnly) => save({ panelIconsOnly })}
          label={t('operator.OperatorPanelSettings.iconsOnly')} hint={t('operator.OperatorPanelSettings.iconsOnlyHint')} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-subtle bg-surface-base p-2">
          <OperatorControls preview connected vehicleKey={null} severalCameras recording={{ mode: config.recordMode, on: false, toggle: () => {} }} onRefused={() => {}} />
          <div className="pointer-events-none ml-auto flex items-center gap-1.5">
            <span className="flex h-8 items-center rounded-md border border-subtle bg-surface-raised px-2.5 text-xs text-content-secondary">{t('operator.OperatorScreen.modeMenu')}</span>
            {config.allowArm && <span className="flex h-8 items-center rounded-md border border-red-500/70 bg-red-500/10 px-2.5 text-xs font-bold uppercase text-red-400">ARM</span>}
            <span className="flex h-9 items-center gap-1.5 rounded-md bg-red-600 px-3 text-sm font-extrabold uppercase text-white"><OctagonX className="h-5 w-5" />{t('operator.OperatorScreen.stop')}</span>
          </div>
        </div>
      </Card>

      <Card title={t('operator.OperatorPanelSettings.controls')} hint={t('operator.OperatorPanelSettings.controlsHint')}>
        <div className="flex flex-col divide-y divide-subtle overflow-hidden rounded-lg border border-subtle">
          {arranged.map((key, i) => {
            const d = describe(key);
            const hidden = config.hiddenControls.includes(key);
            const Icon = d.icon;
            const isOpen = open === key;
            const relay = controlKind(key) === 'relay' ? relays.find((x) => `relay:${x.id}` === key) : undefined;
            const fn = controlKind(key) === 'fn' ? rc.functions.find((x) => `fn:${x.id}` === key) : undefined;
            return (
              <div key={key} className={hidden ? 'bg-surface-base/60' : 'bg-surface-raised/40'}>
                <div className="flex min-h-10 items-center gap-2 px-2 py-1">
                  <Icon className={`h-4 w-4 shrink-0 ${hidden ? 'text-content-tertiary' : 'text-content-secondary'}`} />
                  <span className={`min-w-0 truncate text-sm ${hidden ? 'text-content-tertiary line-through' : 'text-content'}`}>{d.name}</span>
                  <span className="shrink-0 whitespace-nowrap rounded bg-surface px-1.5 py-0.5 text-[11px] text-content-secondary">{d.detail}</span>
                  {d.note && <span className="min-w-0 truncate text-[11px] text-amber-400">{d.note}</span>}
                  <span className="ml-auto flex shrink-0 items-center">
                    <button type="button" className={ROW_BTN} onClick={() => setHidden(key, !hidden)}
                      data-tip={hidden ? t('operator.OperatorPanelSettings.show') : t('operator.OperatorPanelSettings.hide')}>
                      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button type="button" className={ROW_BTN} disabled={i === 0} onClick={() => save({ controlOrder: moveControl(arranged, key, -1) })} data-tip={t('operator.OperatorPanelSettings.moveUp')}>
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button type="button" className={ROW_BTN} disabled={i === arranged.length - 1} onClick={() => save({ controlOrder: moveControl(arranged, key, 1) })} data-tip={t('operator.OperatorPanelSettings.moveDown')}>
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {/* Built-in controls have nothing to set up here: keep the columns aligned. */}
                    {!d.editable && <span className="w-7" aria-hidden />}
                    {d.editable && (
                      <button type="button" className={`${ROW_BTN} ${isOpen ? 'bg-blue-600 text-white hover:bg-blue-600 hover:text-white' : ''}`} onClick={() => setOpen(isOpen ? null : key)} data-tip={t('operator.OperatorPanelSettings.edit')}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button type="button" className={`${ROW_BTN} hover:text-red-400`} onClick={() => remove(key)} data-tip={t('operator.OperatorRcSettings.remove')}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
                {isOpen && (
                  <div className="border-t border-subtle bg-surface px-3 py-3">
                    {relay && <RelayEditor button={relay} />}
                    {fn && <FunctionEditor fn={fn} pad={pad} conflict={!!d.note} onChange={setFunction} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-content-secondary">{t('operator.OperatorPanelSettings.add')}</span>
          {RC_FUNCTION_KINDS.map((kind: RcFunctionKind) => (
            <button key={kind} type="button" onClick={() => addFunction(kind)} disabled={rc.functions.length >= RC_MAX_FUNCTIONS} className={`${BTN} flex items-center gap-1.5`}>
              <Plus className="h-3.5 w-3.5" />{t(`operator.OperatorRcSettings.kind_${kind}`)}
            </button>
          ))}
          <button type="button" onClick={addOutput} disabled={relays.length >= 16} className={`${BTN} flex items-center gap-1.5`}>
            <Plus className="h-3.5 w-3.5" />{t('operator.OperatorPanelSettings.addRelay')}
          </button>
          {rc.removedFunctions.map((fn) => (
            <RestoreChip key={`fn:${fn.id}`} name={fn.label} disabled={rc.functions.length >= RC_MAX_FUNCTIONS}
              onRestore={() => restoreFunction(fn.id)} onForget={() => forgetFunction(fn.id)} />
          ))}
          {removedRelays.map((relay) => (
            <RestoreChip key={`relay:${relay.id}`} name={relay.label} disabled={relays.length >= 16}
              onRestore={() => restoreRelay(relay.id)} onForget={() => forgetRelay(relay.id)} />
          ))}
          {config.removedControls.map((key) => {
            const Icon = BUILTIN_ICON[key as BuiltinControl];
            return (
              <button key={key} type="button" onClick={() => save({ removedControls: config.removedControls.filter((k) => k !== key) })}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-subtle px-2.5 py-1.5 text-sm text-content-secondary hover:border-blue-500/60 hover:text-content">
                <Plus className="h-3.5 w-3.5" />{Icon && <Icon className="h-3.5 w-3.5" />}{t(`operator.OperatorPanelSettings.builtin_${key}`)}
              </button>
            );
          })}
        </div>
        <p className="text-xs leading-snug text-content-tertiary">{t('operator.OperatorRcSettings.functionsHint')}</p>
      </Card>
    </>
  );
}
