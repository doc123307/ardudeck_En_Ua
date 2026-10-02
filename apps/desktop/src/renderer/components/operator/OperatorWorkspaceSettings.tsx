/**
 * Settings → "Operator workspace": what the operator screen shows and may do.
 * Reachable only from the full UI; the main process refuses these changes otherwise.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useOperatorStore } from '../../stores/operator-store';
import { useSettingsStore } from '../../stores/settings-store';
import {
  ADMIN_PASSWORD_MIN_LENGTH, OPERATOR_MODE_BUTTONS, type AdminAuthResult, type OperatorConfig, type OperatorModeButton,
} from '../../../shared/operator-types';
import { connectOptionsFromMemory, describeConnection } from './operator-logic';
import { authErrorText } from './AdminUnlockDialog';
import { t } from '../../i18n';

const FIELD = 'rounded-lg border border-subtle bg-surface-input px-3 py-1.5 text-sm text-content focus:border-blue-500 focus:outline-none';
const BTN = 'rounded-lg border border-subtle bg-surface-raised px-3 py-1.5 text-sm text-content hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40';

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-xl border border-subtle bg-surface p-5">
      <h3 className="text-sm font-semibold text-content">{title}</h3>
      {hint && <p className="mt-1 text-xs leading-snug text-content-secondary">{hint}</p>}
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
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
function NumberField({ value, min, max, onCommit, label, unit }: {
  value: number; min: number; max: number; onCommit: (v: number) => void; label: string; unit: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(n)) { setDraft(String(value)); return; }
    const next = Math.min(max, Math.max(min, Math.round(n)));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm text-content">
      <span className="min-w-[14rem]">{label}</span>
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={`${FIELD} w-24`}
      />
      <span className="text-content-secondary">{unit}</span>
    </label>
  );
}

function PasswordCard() {
  const hasPassword = useOperatorStore((s) => s.hasPassword);
  const changePassword = useOperatorStore((s) => s.changePassword);
  const createPassword = useOperatorStore((s) => s.createPassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (next !== repeat) { setNote({ text: t('operator.AdminUnlockDialog.mismatch'), ok: false }); return; }
    setBusy(true);
    try {
      const result: AdminAuthResult = hasPassword ? await changePassword(current, next) : await createPassword(next);
      if (result.ok) {
        setCurrent(''); setNext(''); setRepeat('');
        setNote({ text: t('operator.OperatorWorkspaceSettings.passwordSaved'), ok: true });
      } else {
        setNote({ text: authErrorText(result, Date.now(), Date.now() + (result.retryAfterMs ?? 0)), ok: false });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title={t('operator.OperatorWorkspaceSettings.password')}
      hint={t('operator.OperatorWorkspaceSettings.passwordHint', { n: ADMIN_PASSWORD_MIN_LENGTH })}
    >
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {hasPassword && (
          <input type="password" autoComplete="off" value={current} onChange={(e) => setCurrent(e.target.value)}
            placeholder={t('operator.OperatorWorkspaceSettings.currentPassword')} className={`${FIELD} w-48`} />
        )}
        <input type="password" autoComplete="off" value={next} onChange={(e) => setNext(e.target.value)}
          placeholder={t('operator.OperatorWorkspaceSettings.newPassword')} className={`${FIELD} w-48`} />
        <input type="password" autoComplete="off" value={repeat} onChange={(e) => setRepeat(e.target.value)}
          placeholder={t('operator.AdminUnlockDialog.repeat')} className={`${FIELD} w-48`} />
        <button type="submit" disabled={busy || !next || !repeat || (hasPassword && !current)} className={BTN}>
          {hasPassword ? t('operator.OperatorWorkspaceSettings.changePassword') : t('operator.AdminUnlockDialog.create')}
        </button>
      </form>
      {note && <p className={`text-xs ${note.ok ? 'text-emerald-400' : 'text-red-400'}`}>{note.text}</p>}
      <p className="text-xs leading-snug text-content-tertiary">{t('operator.OperatorWorkspaceSettings.passwordReset')}</p>
    </Card>
  );
}

export function OperatorWorkspaceSettings() {
  const config = useOperatorStore((s) => s.config);
  const saveConfig = useOperatorStore((s) => s.saveConfig);
  const memory = useSettingsStore((s) => s.connectionMemory);
  const [support, setSupport] = useState(config.supportContact);
  useEffect(() => setSupport(config.supportContact), [config.supportContact]);

  const save = (patch: Partial<OperatorConfig>) => { void saveConfig(patch); };
  const lastUsed = connectOptionsFromMemory(memory);
  const toggleMode = (mode: OperatorModeButton, on: boolean) => {
    const next = OPERATOR_MODE_BUTTONS.filter((m) => (m === mode ? on : config.modeButtons.includes(m)));
    save({ modeButtons: next });
  };

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-5 w-1.5 rounded-full bg-content-secondary" />
        <h2 className="text-sm font-medium uppercase tracking-wider text-content">{t('operator.OperatorWorkspaceSettings.title')}</h2>
      </div>
      <p className="text-sm leading-relaxed text-content-secondary">{t('operator.OperatorWorkspaceSettings.intro')}</p>

      <Card title={t('operator.OperatorWorkspaceSettings.startup')}>
        <Toggle
          checked={config.startInOperatorMode}
          onChange={(v) => save({ startInOperatorMode: v })}
          label={t('operator.OperatorWorkspaceSettings.startInOperatorMode')}
          hint={t('operator.OperatorWorkspaceSettings.startInOperatorModeHint')}
        />
        <NumberField
          value={config.autoLockMinutes}
          min={0}
          max={240}
          onCommit={(v) => save({ autoLockMinutes: v })}
          label={t('operator.OperatorWorkspaceSettings.autoLock')}
          unit={t('operator.OperatorWorkspaceSettings.minutes')}
        />
      </Card>

      <Card title={t('operator.OperatorWorkspaceSettings.connection')} hint={t('operator.OperatorWorkspaceSettings.connectionHint')}>
        <p className="text-sm text-content">
          {config.connection
            ? t('operator.OperatorWorkspaceSettings.connectionFixed', { link: describeConnection(config.connection) })
            : lastUsed
              ? t('operator.OperatorWorkspaceSettings.connectionLast', { link: describeConnection(lastUsed) })
              : t('operator.OperatorWorkspaceSettings.connectionNone')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => save({ connection: lastUsed })} disabled={!lastUsed} className={BTN}>
            {lastUsed
              ? t('operator.OperatorWorkspaceSettings.pinConnection', { link: describeConnection(lastUsed) })
              : t('operator.OperatorWorkspaceSettings.pinConnectionNone')}
          </button>
          <button onClick={() => save({ connection: null })} disabled={!config.connection} className={BTN}>
            {t('operator.OperatorWorkspaceSettings.unpinConnection')}
          </button>
        </div>
        <Toggle
          checked={config.autoConnect}
          onChange={(v) => save({ autoConnect: v })}
          label={t('operator.OperatorWorkspaceSettings.autoConnect')}
          hint={t('operator.OperatorWorkspaceSettings.autoConnectHint')}
        />
      </Card>

      <Card title={t('operator.OperatorWorkspaceSettings.actions')} hint={t('operator.OperatorWorkspaceSettings.actionsHint')}>
        <Toggle
          checked={config.allowArm}
          onChange={(v) => save({ allowArm: v })}
          label={t('operator.OperatorWorkspaceSettings.allowArm')}
          hint={t('operator.OperatorWorkspaceSettings.allowArmHint')}
        />
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {OPERATOR_MODE_BUTTONS.filter((m) => m !== 'hold').map((m) => (
            <Toggle key={m} checked={config.modeButtons.includes(m)} onChange={(v) => toggleMode(m, v)} label={t(`operator.OperatorScreen.mode_${m}`)} />
          ))}
        </div>
      </Card>

      <Card title={t('operator.OperatorWorkspaceSettings.tilt')} hint={t('operator.OperatorWorkspaceSettings.tiltHint')}>
        <NumberField value={config.tiltWarnDeg} min={5} max={85} onCommit={(v) => save({ tiltWarnDeg: v })}
          label={t('operator.OperatorWorkspaceSettings.tiltWarn')} unit="°" />
        <NumberField value={config.tiltLimitDeg} min={5} max={89} onCommit={(v) => save({ tiltLimitDeg: v })}
          label={t('operator.OperatorWorkspaceSettings.tiltLimit')} unit="°" />
      </Card>

      <Card title={t('operator.OperatorWorkspaceSettings.video')} hint={t('operator.OperatorWorkspaceSettings.videoHint')}>
        <Toggle
          checked={config.recordAllCameras}
          onChange={(v) => save({ recordAllCameras: v })}
          label={t('operator.OperatorWorkspaceSettings.recordAll')}
        />
      </Card>

      <Card title={t('operator.OperatorWorkspaceSettings.support')} hint={t('operator.OperatorWorkspaceSettings.supportHint')}>
        <input
          value={support}
          onChange={(e) => setSupport(e.target.value)}
          onBlur={() => { if (support.trim() !== config.supportContact) save({ supportContact: support }); }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="@stohid_support_bot"
          className={`${FIELD} max-w-md`}
        />
      </Card>

      <PasswordCard />
    </div>
  );
}
