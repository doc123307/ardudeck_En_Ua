import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNumericDraft } from '../../../hooks/useNumericDraft';
import { useCompanionStore } from '../../../stores/companion-store';
import { PanelContainer, SectionTitle } from '../../panels/panel-utils';
import { ESP32_MODE_LABELS, PROTOCOL_LABELS } from '../../../../shared/dronebridge-types';
import type { DroneBridgeSettings } from '../../../../shared/dronebridge-types';
import { t } from '../../../i18n';

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
        checked ? 'bg-blue-600' : 'bg-gray-600'
      }`}
    >
      <div className={`w-4 h-4 rounded-full bg-white border border-strong shadow-sm absolute top-0.5 transition-all ${
        checked ? 'left-[18px]' : 'left-0.5'
      }`} />
    </button>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-content-secondary shrink-0">{label}</span>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, type = 'text', placeholder, className = '' }: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-surface-raised border border rounded px-2 py-1 text-sm text-content font-mono placeholder-content-tertiary focus:outline-none focus:border-blue-500 w-40 ${className}`}
    />
  );
}

function NumberInput({ value, onChange, min, max, className = '' }: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const draft = useNumericDraft(value, onChange, { min, max, integer: true });
  return (
    <input
      type="number"
      min={min}
      max={max}
      className={`bg-surface-raised border border rounded px-2 py-1 text-sm text-content font-mono placeholder-content-tertiary focus:outline-none focus:border-blue-500 w-24 ${className}`}
      {...draft}
    />
  );
}

function SelectInput<T extends string | number>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        const parsed = typeof value === 'number' ? Number(raw) : raw;
        onChange(parsed as T);
      }}
      className="bg-surface-raised border border rounded px-2 py-1 text-sm text-content focus:outline-none focus:border-blue-500"
    >
      {options.map((opt) => (
        <option key={String(opt.value)} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

const modeOptions = Object.entries(ESP32_MODE_LABELS).map(([k, v]) => ({
  value: Number(k),
  label: v,
}));

const protoOptions = Object.entries(PROTOCOL_LABELS).map(([k, v]) => ({
  value: Number(k),
  label: v,
}));

const baudOptions = BAUD_RATES.map((b) => ({ value: b, label: String(b) }));

const rssiOptions = [
  { value: 0, get label() { return t('companion.DroneBridgeSettingsPanel.percentage'); } },
  { value: 1, label: 'dBm' },
];

export function DroneBridgeSettingsPanel() {
  const droneBridgeIp = useCompanionStore((s) => s.droneBridgeIp);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Loaded settings from device (source of truth for dirty checking)
  const [loaded, setLoaded] = useState<DroneBridgeSettings | null>(null);

  // Local form state
  const [form, setForm] = useState<DroneBridgeSettings | null>(null);

  const updateField = useCallback(<K extends keyof DroneBridgeSettings>(key: K, value: DroneBridgeSettings[K]) => {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }, []);

  // Fetch settings on mount, with retries for freshly booted devices
  useEffect(() => {
    if (!droneBridgeIp) return;
    let cancelled = false;

    const fetchSettings = async () => {
      setLoading(true);
      setError(null);

      for (let attempt = 0; attempt < 6; attempt++) {
        if (cancelled) return;

        try {
          const settings = await window.electronAPI.dronebridgeGetSettings(droneBridgeIp);
          if (settings) {
            setLoaded(settings);
            setForm(settings);
            setLoading(false);
            return;
          }
        } catch {
          // will retry
        }

        if (attempt < 5) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      if (!cancelled) {
        setError(t('companion.DroneBridgeSettingsPanel.couldNotLoadSettingsDeviceMay'));
        setLoading(false);
      }
    };
    fetchSettings();
    return () => { cancelled = true; };
  }, [droneBridgeIp]);

  // Dirty check
  const isDirty = useMemo(() => {
    if (!form || !loaded) return false;
    return JSON.stringify(form) !== JSON.stringify(loaded);
  }, [form, loaded]);

  const handleSave = useCallback(async () => {
    if (!droneBridgeIp || !form) return;

    const confirmed = window.confirm(
      t('companion.DroneBridgeSettingsPanel.savingWillRebootTheDronebridgeConnection')
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      await window.electronAPI.dronebridgeUpdateSettings(droneBridgeIp, form);
      setSaving(false);
      setRebooting(true);

      // Wait for reboot
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Re-fetch settings to confirm
      try {
        const settings = await window.electronAPI.dronebridgeGetSettings(droneBridgeIp);
        setLoaded(settings);
        setForm(settings);
      } catch {
        setError(t('companion.DroneBridgeSettingsPanel.deviceRebootedButCouldNotRe'));
      }
      setRebooting(false);
    } catch {
      setError(t('companion.DroneBridgeSettingsPanel.failedToSaveSettings'));
      setSaving(false);
    }
  }, [droneBridgeIp, form]);

  if (!droneBridgeIp) {
    return (
      <PanelContainer className="flex items-center justify-center">
        <div className="text-center text-content-tertiary text-xs">
          <div className="text-content-secondary mb-1">{t('companion.DroneBridgeSettingsPanel.noDronebridgeConnected')}</div>
          <div>{t('companion.DroneBridgeSettingsPanel.openTheStatusPanelToDetect')}</div>
        </div>
      </PanelContainer>
    );
  }

  if (loading) {
    return (
      <PanelContainer className="flex items-center justify-center">
        <div className="flex items-center gap-2 text-content-secondary text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {t('companion.DroneBridgeSettingsPanel.loadingSettings')}
        </div>
      </PanelContainer>
    );
  }

  if (rebooting) {
    return (
      <PanelContainer className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-content-secondary">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div className="text-sm">{t('companion.DroneBridgeSettingsPanel.rebooting')}</div>
          <div className="text-xs text-content-tertiary">{t('companion.DroneBridgeSettingsPanel.reconnectingInAFewSeconds')}</div>
        </div>
      </PanelContainer>
    );
  }

  if (!form) {
    return (
      <PanelContainer className="flex items-center justify-center">
        <div className="text-center text-content-tertiary text-xs">
          {error ?? t('companion.DroneBridgeSettingsPanel.noSettingsDataAvailable')}
        </div>
      </PanelContainer>
    );
  }

  return (
    <PanelContainer>
      <div className="space-y-5">
        {error && (
          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
            {error}
          </div>
        )}

        {/* WiFi Section */}
        <div>
          <SectionTitle>WiFi</SectionTitle>
          <div className="space-y-0.5">
            <FieldRow label="SSID">
              <TextInput value={form.ssid} onChange={(v) => updateField('ssid', v)} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.password')}>
              <div className="flex items-center gap-1">
                <TextInput
                  value={form.wifi_pass}
                  onChange={(v) => updateField('wifi_pass', v)}
                  type={showPassword ? 'text' : 'password'}
                  className="w-32"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-content-secondary hover:text-content px-1.5 py-1 transition-colors"
                >
                  {showPassword ? t('companion.DroneBridgeSettingsPanel.hide') : t('companion.DroneBridgeSettingsPanel.show')}
                </button>
              </div>
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.channel')}>
              <NumberInput value={form.wifi_chan} onChange={(v) => updateField('wifi_chan', v)} min={1} max={13} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.mode')}>
              <SelectInput value={form.esp32_mode} onChange={(v) => updateField('esp32_mode', v)} options={modeOptions} />
            </FieldRow>
            <FieldRow label="802.11 g/n">
              <Toggle checked={form.wifi_en_gn === 1} onChange={(v) => updateField('wifi_en_gn', v ? 1 : 0)} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.externalAntenna')}>
              <Toggle checked={form.ant_use_ext === 1} onChange={(v) => updateField('ant_use_ext', v ? 1 : 0)} />
            </FieldRow>
          </div>
        </div>

        {/* Serial Section */}
        <div>
          <SectionTitle>{t('companion.DroneBridgeSettingsPanel.serial')}</SectionTitle>
          <div className="space-y-0.5">
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.baudRate')}>
              <SelectInput value={form.baud} onChange={(v) => updateField('baud', v)} options={baudOptions} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.protocol')}>
              <SelectInput value={form.proto} onChange={(v) => updateField('proto', v)} options={protoOptions} />
            </FieldRow>
            <FieldRow label="TX GPIO">
              <NumberInput value={form.gpio_tx} onChange={(v) => updateField('gpio_tx', v)} min={0} />
            </FieldRow>
            <FieldRow label="RX GPIO">
              <NumberInput value={form.gpio_rx} onChange={(v) => updateField('gpio_rx', v)} min={0} />
            </FieldRow>
            <FieldRow label="RTS GPIO">
              <NumberInput value={form.gpio_rts} onChange={(v) => updateField('gpio_rts', v)} min={0} />
            </FieldRow>
            <FieldRow label="CTS GPIO">
              <NumberInput value={form.gpio_cts} onChange={(v) => updateField('gpio_cts', v)} min={0} />
            </FieldRow>
          </div>
        </div>

        {/* Network Section */}
        <div>
          <SectionTitle>{t('companion.DroneBridgeSettingsPanel.network')}</SectionTitle>
          <div className="space-y-0.5">
            <FieldRow label="AP IP">
              <TextInput value={form.ap_ip} onChange={(v) => updateField('ap_ip', v)} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.staticIp')}>
              <TextInput value={form.ip_sta} onChange={(v) => updateField('ip_sta', v)} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.gateway')}>
              <TextInput value={form.ip_sta_gw} onChange={(v) => updateField('ip_sta_gw', v)} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.netmask')}>
              <TextInput value={form.ip_sta_netmsk} onChange={(v) => updateField('ip_sta_netmsk', v)} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.udpClientIp')}>
              <TextInput value={form.udp_client_ip} onChange={(v) => updateField('udp_client_ip', v)} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.udpClientPort')}>
              <NumberInput value={form.udp_client_port} onChange={(v) => updateField('udp_client_port', v)} min={1} max={65535} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.hostname')}>
              <TextInput value={form.wifi_hostname} onChange={(v) => updateField('wifi_hostname', v)} />
            </FieldRow>
          </div>
        </div>

        {/* Advanced Section */}
        <div>
          <SectionTitle>{t('companion.DroneBridgeSettingsPanel.advanced')}</SectionTitle>
          <div className="space-y-0.5">
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.transparentPacketSize')}>
              <NumberInput value={form.trans_pack_size} onChange={(v) => updateField('trans_pack_size', v)} min={1} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.serialTimeoutMs')}>
              <NumberInput value={form.serial_timeout} onChange={(v) => updateField('serial_timeout', v)} min={1} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.ltmFramesPacket')}>
              <NumberInput value={form.ltm_per_packet} onChange={(v) => updateField('ltm_per_packet', v)} min={1} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.disableRadioOnArm')}>
              <Toggle checked={form.radio_dis_onarm === 1} onChange={(v) => updateField('radio_dis_onarm', v ? 1 : 0)} />
            </FieldRow>
            <FieldRow label={t('companion.DroneBridgeSettingsPanel.rssiFormat')}>
              <SelectInput value={form.rep_rssi_dbm} onChange={(v) => updateField('rep_rssi_dbm', v)} options={rssiOptions} />
            </FieldRow>
          </div>
        </div>

        {/* Save button */}
        <div className="pt-2 border-t border-subtle">
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`w-full py-2 rounded text-sm font-medium transition-colors ${
              isDirty && !saving
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-surface-raised text-content-tertiary cursor-not-allowed'
            }`}
          >
            {saving ? t('companion.DroneBridgeSettingsPanel.saving') : t('companion.DroneBridgeSettingsPanel.saveAndReboot')}
          </button>
        </div>
      </div>
    </PanelContainer>
  );
}
