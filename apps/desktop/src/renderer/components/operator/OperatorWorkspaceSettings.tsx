/**
 * Settings → "Operator workspace": what the operator screen shows and may do.
 * Reachable only from the full UI; the main process refuses these changes otherwise.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useOperatorStore } from '../../stores/operator-store';
import { useSettingsStore } from '../../stores/settings-store';
import { FolderOpen } from 'lucide-react';
import {
  ADMIN_PASSWORD_MIN_LENGTH, OPERATOR_ELEMENTS, OPERATOR_MODE_BUTTONS, OPERATOR_RECORD_MODES,
  type AdminAuthResult, type OperatorConfig, type OperatorElement, type OperatorModeButton,
} from '../../../shared/operator-types';
import type { CameraRecordStatus } from '../../../shared/camera-types';
import { modeButtonLabel } from './OperatorModeMenu';
import { OperatorRcSettings } from './OperatorRcSettings';
import { OperatorPanelSettings } from './OperatorPanelSettings';
import { OperatorValuesSettings } from './OperatorValuesSettings';
import { BTN, Card, FIELD, NumberField, SectionTabs, Toggle } from './OperatorSettingsParts';
import { connectOptionsFromMemory, describeConnection } from './operator-logic';
import { authErrorText } from './AdminUnlockDialog';
import { t } from '../../i18n';

/** "12.3 GB" / "850 MB": how much room the recording folder's disk has. */
export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

/** When video is recorded and where the files go. */
function RecordingCard({ config, save }: { config: OperatorConfig; save: (patch: Partial<OperatorConfig>) => void }) {
  const [status, setStatus] = useState<CameraRecordStatus | null>(null);
  useEffect(() => {
    let alive = true;
    void window.electronAPI.cameraRecordStatus().then((s) => { if (alive) setStatus(s); }).catch(() => {});
    return () => { alive = false; };
  }, [config.recordDir]);

  const pick = async () => {
    const dir = await window.electronAPI.operatorPickRecordDir();
    if (dir) save({ recordDir: dir });
  };

  return (
    <Card title={t('operator.OperatorWorkspaceSettings.video')} hint={t('operator.OperatorWorkspaceSettings.videoHint')}>
      <div className="flex flex-col gap-2">
        {OPERATOR_RECORD_MODES.map((mode) => (
          <label key={mode} className="flex cursor-pointer items-start gap-3">
            <input type="radio" name="record-mode" checked={config.recordMode === mode} onChange={() => save({ recordMode: mode })} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-500" />
            <span className="min-w-0">
              <span className="block text-sm text-content">{t(`operator.OperatorWorkspaceSettings.recordMode_${mode}`)}</span>
              <span className="block text-xs leading-snug text-content-secondary">{t(`operator.OperatorWorkspaceSettings.recordModeHint_${mode}`)}</span>
            </span>
          </label>
        ))}
      </div>
      <Toggle
        checked={config.recordAllCameras}
        onChange={(v) => save({ recordAllCameras: v })}
        label={t('operator.OperatorWorkspaceSettings.recordAll')}
      />
      <NumberField
        value={config.recordSegmentMinutes}
        min={0}
        max={240}
        onCommit={(v) => save({ recordSegmentMinutes: v })}
        label={t('operator.OperatorWorkspaceSettings.recordSegment')}
        unit={t('operator.OperatorWorkspaceSettings.recordSegmentUnit')}
      />
      <div className="flex flex-col gap-2">
        <span className="text-sm text-content">{t('operator.OperatorWorkspaceSettings.recordDir')}</span>
        <code className="max-w-full select-text break-all rounded-lg border border-subtle bg-surface-input px-3 py-1.5 text-xs text-content">
          {status?.dir ?? '…'}
        </code>
        <span className="text-xs text-content-secondary">
          {config.recordDir ? t('operator.OperatorWorkspaceSettings.recordDirCustom') : t('operator.OperatorWorkspaceSettings.recordDirDefault')}
          {status && status.freeBytes !== null && ` ${t('operator.OperatorWorkspaceSettings.recordDirFree', { free: formatBytes(status.freeBytes) })}`}
        </span>
        {status?.dirError && <span className="text-xs text-amber-400">{status.dirError}</span>}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void pick()} className={BTN}>{t('operator.OperatorWorkspaceSettings.recordDirPick')}</button>
          <button onClick={() => save({ recordDir: '' })} disabled={!config.recordDir} className={BTN}>{t('operator.OperatorWorkspaceSettings.recordDirReset')}</button>
          <button onClick={() => void window.electronAPI.operatorOpenRecordDir()} className={`${BTN} flex items-center gap-1.5`}>
            <FolderOpen className="h-3.5 w-3.5" />{t('operator.OperatorWorkspaceSettings.recordDirOpen')}
          </button>
        </div>
      </div>
    </Card>
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

const SECTIONS = ['panel', 'values', 'driving', 'screen', 'video', 'general'] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_KEY = 'stohid-operator-settings-section';

export function OperatorWorkspaceSettings() {
  const config = useOperatorStore((s) => s.config);
  const saveConfig = useOperatorStore((s) => s.saveConfig);
  const memory = useSettingsStore((s) => s.connectionMemory);
  const [support, setSupport] = useState(config.supportContact);
  useEffect(() => setSupport(config.supportContact), [config.supportContact]);

  const save = (patch: Partial<OperatorConfig>) => { void saveConfig(patch); };
  const [section, setSection] = useState<Section>(() => {
    try {
      const saved = localStorage.getItem(SECTION_KEY) as Section | null;
      return saved && SECTIONS.includes(saved) ? saved : 'panel';
    } catch {
      return 'panel';
    }
  });
  const pickSection = (next: Section) => {
    setSection(next);
    try { localStorage.setItem(SECTION_KEY, next); } catch { /* the tab is only a convenience */ }
  };
  const lastUsed = connectOptionsFromMemory(memory);
  const toggleMode = (mode: OperatorModeButton, on: boolean) => {
    const next = OPERATOR_MODE_BUTTONS.filter((m) => (m === mode ? on : config.modeButtons.includes(m)));
    save({ modeButtons: next });
  };

  const sections: { id: Section; label: string }[] = [
    { id: 'panel', label: t('operator.OperatorWorkspaceSettings.section_panel') },
    { id: 'values', label: t('operator.OperatorWorkspaceSettings.section_values') },
    { id: 'driving', label: t('operator.OperatorWorkspaceSettings.section_driving') },
    { id: 'screen', label: t('operator.OperatorWorkspaceSettings.section_screen') },
    { id: 'video', label: t('operator.OperatorWorkspaceSettings.section_video') },
    { id: 'general', label: t('operator.OperatorWorkspaceSettings.section_general') },
  ];
  const pages: Record<Section, ReactNode> = {
    panel: <OperatorPanelSettings config={config} save={save} />,
    values: <OperatorValuesSettings config={config} save={save} />,
    driving: (
      <>
          <Card title={t('operator.OperatorWorkspaceSettings.actions')} hint={t('operator.OperatorWorkspaceSettings.actionsHint')}>
            <Toggle
              checked={config.allowArm}
              onChange={(v) => save({ allowArm: v })}
              label={t('operator.OperatorWorkspaceSettings.allowArm')}
              hint={t('operator.OperatorWorkspaceSettings.allowArmHint')}
            />
          </Card>
          <Card title={t('operator.OperatorWorkspaceSettings.modes')} hint={t('operator.OperatorWorkspaceSettings.modesHint')}>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {OPERATOR_MODE_BUTTONS.filter((m) => m !== 'hold').map((m) => (
                <Toggle key={m} checked={config.modeButtons.includes(m)} onChange={(v) => toggleMode(m, v)} label={modeButtonLabel(m)} />
              ))}
            </div>
          </Card>
        <OperatorRcSettings rc={config.rc} onChange={(rc) => save({ rc })} />
      </>
    ),
    screen: (
      <>
          <Card title={t('operator.OperatorWorkspaceSettings.elements')} hint={t('operator.OperatorWorkspaceSettings.elementsHint')}>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {OPERATOR_ELEMENTS.map((el: OperatorElement) => (
                <Toggle
                  key={el}
                  checked={!config.hiddenElements.includes(el)}
                  onChange={(on) => save({ hiddenElements: OPERATOR_ELEMENTS.filter((x) => (x === el ? !on : config.hiddenElements.includes(x))) })}
                  label={t(`operator.OperatorWorkspaceSettings.element_${el}`)}
                />
              ))}
            </div>
          </Card>
          <Card title={t('operator.OperatorWorkspaceSettings.tilt')} hint={t('operator.OperatorWorkspaceSettings.tiltHint')}>
            <NumberField value={config.tiltWarnDeg} min={5} max={85} onCommit={(v) => save({ tiltWarnDeg: v })}
              label={t('operator.OperatorWorkspaceSettings.tiltWarn')} unit="°" />
            <NumberField value={config.tiltLimitDeg} min={5} max={89} onCommit={(v) => save({ tiltLimitDeg: v })}
              label={t('operator.OperatorWorkspaceSettings.tiltLimit')} unit="°" />
          </Card>
      </>
    ),
    video: <RecordingCard config={config} save={save} />,
    general: (
      <>
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
            <Toggle
              checked={config.operatorEditsVehicles}
              onChange={(v) => save({ operatorEditsVehicles: v })}
              label={t('operator.OperatorWorkspaceSettings.operatorEditsVehicles')}
              hint={t('operator.OperatorWorkspaceSettings.operatorEditsVehiclesHint')}
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
      </>
    ),
  };

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-5 w-1.5 rounded-full bg-content-secondary" />
        <h2 className="text-sm font-medium uppercase tracking-wider text-content">{t('operator.OperatorWorkspaceSettings.title')}</h2>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-content-secondary">{t('operator.OperatorWorkspaceSettings.intro')}</p>
      <SectionTabs tabs={sections} value={section} onChange={pickSection} />
      {pages[section]}
    </div>
  );
}
