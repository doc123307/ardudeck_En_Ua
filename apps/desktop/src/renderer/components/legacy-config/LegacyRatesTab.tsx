/**
 * Legacy Rates Tab
 *
 * Rate configuration for legacy F3 boards via CLI commands.
 * Modern UI with rate curve visualization and presets.
 */

import { useState, useMemo } from 'react';
import { useLegacyConfigStore } from '../../stores/legacy-config-store';
import { DraggableSlider } from '../ui/DraggableSlider';
import { Egg, Drama, Gauge, Film } from 'lucide-react';
import { t } from '../../i18n';

// Rate Presets
const RATE_PRESETS = {
  beginner: {
    name: 'Beginner',
    get description() { return t('legacy_config.LegacyRatesTab.slowPredictableGreatForLearning'); },
    icon: Egg,
    color: 'from-green-500/20 to-emerald-500/10 border-green-500/30',
    rates: { rcRate: 80, rcExpo: 20, rollRate: 40, pitchRate: 40, yawRate: 40, rcYawExpo: 20 },
  },
  freestyle: {
    name: 'Freestyle',
    get description() { return t('legacy_config.LegacyRatesTab.balancedForTricksFlow'); },
    icon: Drama,
    color: 'from-purple-500/20 to-violet-500/10 border-purple-500/30',
    rates: { rcRate: 100, rcExpo: 15, rollRate: 70, pitchRate: 70, yawRate: 65, rcYawExpo: 10 },
  },
  racing: {
    name: 'Racing',
    get description() { return t('legacy_config.LegacyRatesTab.fastResponsiveForSpeed'); },
    icon: Gauge,
    color: 'from-red-500/20 to-orange-500/10 border-red-500/30',
    rates: { rcRate: 120, rcExpo: 5, rollRate: 80, pitchRate: 80, yawRate: 70, rcYawExpo: 0 },
  },
  cinematic: {
    name: 'Cinematic',
    get description() { return t('legacy_config.LegacyRatesTab.ultraSmoothForFilming'); },
    icon: Film,
    color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
    rates: { rcRate: 70, rcExpo: 40, rollRate: 30, pitchRate: 30, yawRate: 25, rcYawExpo: 30 },
  },
};

// Custom profile storage
const RATE_PROFILES_KEY = 'ardudeck_legacy_rate_profiles';

function loadCustomProfiles(): Record<string, { name: string; data: typeof RATE_PRESETS.beginner.rates }> {
  try {
    const stored = localStorage.getItem(RATE_PROFILES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveCustomProfiles(profiles: Record<string, { name: string; data: typeof RATE_PRESETS.beginner.rates }>): void {
  localStorage.setItem(RATE_PROFILES_KEY, JSON.stringify(profiles));
}

// Rate curve visualization
function RateCurve({
  rcRate,
  superRate,
  expo,
  color,
}: {
  rcRate: number;
  superRate: number;
  expo: number;
  color: string;
}) {
  const points = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 100; i += 2) {
      const stick = i / 100;
      const rcRateFactor = rcRate / 100;
      const superRateFactor = superRate / 100;
      const expoFactor = expo / 100;
      const expoValue = stick * Math.pow(Math.abs(stick), 3) * expoFactor + stick * (1 - expoFactor);
      const rate = rcRateFactor * (1 + Math.abs(expoValue) * superRateFactor * 0.01) * expoValue;
      const x = 5 + (i / 100) * 90;
      const y = 95 - Math.min(rate * 100, 90);
      pts.push(`${x},${y}`);
    }
    return pts.join(' ');
  }, [rcRate, superRate, expo]);

  const maxRate = useMemo(() => {
    return Math.round(superRate * 10);
  }, [superRate]);

  return (
    <div className="bg-surface-input rounded-lg p-3 border border-subtle">
      <div className="flex items-center justify-between text-xs text-content-secondary mb-2">
        <span>{t('legacy_config.LegacyRatesTab.responseCurve')}</span>
        <span className="text-content-secondary">{t('legacy_config.LegacyRatesTab.max')} <span style={{ color }}>{maxRate}°/s</span></span>
      </div>
      <svg viewBox="0 0 100 100" className="w-full h-24">
        {/* Grid */}
        <line x1="5" y1="95" x2="95" y2="95" stroke="#374151" strokeWidth="0.5" />
        <line x1="5" y1="50" x2="95" y2="50" stroke="#374151" strokeWidth="0.5" strokeDasharray="2,2" />
        <line x1="5" y1="5" x2="5" y2="95" stroke="#374151" strokeWidth="0.5" />
        <line x1="50" y1="5" x2="50" y2="95" stroke="#374151" strokeWidth="0.5" strokeDasharray="2,2" />
        {/* Labels */}
        <text x="50" y="99" fill="#6B7280" fontSize="4" textAnchor="middle">{t('legacy_config.LegacyRatesTab.stick')}</text>
        <text x="2" y="50" fill="#6B7280" fontSize="4" textAnchor="middle" transform="rotate(-90, 2, 50)">{t('legacy_config.LegacyRatesTab.rate')}</text>
        {/* Curve */}
        <polyline fill="none" stroke={color} strokeWidth="2.5" points={points} strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function LegacyRatesTab() {
  const { rates, updateRates } = useLegacyConfigStore();
  const [customProfiles, setCustomProfiles] = useState(loadCustomProfiles);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  if (!rates) {
    return (
      <div className="text-center py-8 text-content-secondary">
        {t('legacy_config.LegacyRatesTab.noRatesDataLoadedRunDump')}
      </div>
    );
  }

  const handleChange = (field: keyof typeof rates, value: number, paramName: string) => {
    const updated = { ...rates, [field]: value };
    updateRates(updated);
    window.electronAPI.cliSendCommand(`set ${paramName} = ${value}`);
  };

  const applyPreset = async (preset: typeof RATE_PRESETS.beginner) => {
    const updated = { ...rates, ...preset.rates };
    updateRates(updated);


    // Send all CLI commands with delays
    await window.electronAPI.cliSendCommand(`set rc_rate = ${preset.rates.rcRate}`);
    await new Promise(r => setTimeout(r, 50));
    await window.electronAPI.cliSendCommand(`set rc_expo = ${preset.rates.rcExpo}`);
    await new Promise(r => setTimeout(r, 50));
    await window.electronAPI.cliSendCommand(`set roll_rate = ${preset.rates.rollRate}`);
    await new Promise(r => setTimeout(r, 50));
    await window.electronAPI.cliSendCommand(`set pitch_rate = ${preset.rates.pitchRate}`);
    await new Promise(r => setTimeout(r, 50));
    await window.electronAPI.cliSendCommand(`set yaw_rate = ${preset.rates.yawRate}`);
    await new Promise(r => setTimeout(r, 50));
    await window.electronAPI.cliSendCommand(`set rc_yaw_expo = ${preset.rates.rcYawExpo}`);

  };

  const saveCurrentAsProfile = () => {
    if (!newProfileName.trim()) return;
    const id = `custom_${Date.now()}`;
    const newProfiles = {
      ...customProfiles,
      [id]: {
        name: newProfileName,
        data: {
          rcRate: rates.rcRate,
          rcExpo: rates.rcExpo,
          rollRate: rates.rollRate,
          pitchRate: rates.pitchRate,
          yawRate: rates.yawRate,
          rcYawExpo: rates.rcYawExpo,
        },
      },
    };
    setCustomProfiles(newProfiles);
    saveCustomProfiles(newProfiles);
    setShowSaveDialog(false);
    setNewProfileName('');
  };

  const deleteProfile = (id: string) => {
    const newProfiles = { ...customProfiles };
    delete newProfiles[id];
    setCustomProfiles(newProfiles);
    saveCustomProfiles(newProfiles);
  };

  const loadProfile = async (data: typeof RATE_PRESETS.beginner.rates) => {
    const updated = { ...rates, ...data };
    updateRates(updated);


    await window.electronAPI.cliSendCommand(`set rc_rate = ${data.rcRate}`);
    await new Promise(r => setTimeout(r, 50));
    await window.electronAPI.cliSendCommand(`set rc_expo = ${data.rcExpo}`);
    await new Promise(r => setTimeout(r, 50));
    await window.electronAPI.cliSendCommand(`set roll_rate = ${data.rollRate}`);
    await new Promise(r => setTimeout(r, 50));
    await window.electronAPI.cliSendCommand(`set pitch_rate = ${data.pitchRate}`);
    await new Promise(r => setTimeout(r, 50));
    await window.electronAPI.cliSendCommand(`set yaw_rate = ${data.yawRate}`);
    await new Promise(r => setTimeout(r, 50));
    await window.electronAPI.cliSendCommand(`set rc_yaw_expo = ${data.rcYawExpo}`);

  };

  const axisColors = {
    roll: '#EF4444',
    pitch: '#22C55E',
    yaw: '#3B82F6',
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <p className="text-sm text-amber-300">
          <strong>{t('legacy_config.LegacyRatesTab.legacyCliMode')}</strong> {t('legacy_config.LegacyRatesTab.changesAreSentImmediatelyViaCli')}
        </p>
      </div>

      {/* Presets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-content">{t('legacy_config.LegacyRatesTab.quickPresets')}</h3>
          <button
            onClick={() => setShowSaveDialog(true)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {t('legacy_config.LegacyRatesTab.saveCurrentAsProfile')}
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(RATE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(preset)}
              className={`p-3 rounded-lg border bg-gradient-to-br ${preset.color} hover:scale-[1.02] transition-all text-left`}
            >
              <div className="mb-1"><preset.icon className="w-6 h-6 text-content mx-auto" /></div>
              <div className="font-medium text-content text-sm">{preset.name}</div>
              <div className="text-xs text-content-secondary mt-0.5">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Profiles */}
      {Object.keys(customProfiles).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-content mb-3">{t('legacy_config.LegacyRatesTab.yourProfiles')}</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(customProfiles).map(([id, profile]) => (
              <div key={id} className="flex items-center gap-1 bg-surface-raised rounded-lg overflow-hidden">
                <button
                  onClick={() => loadProfile(profile.data)}
                  className="px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
                >
                  {profile.name}
                </button>
                <button
                  onClick={() => deleteProfile(id)}
                  className="px-2 py-1.5 text-content-secondary hover:text-red-400 hover:bg-surface-raised"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Profile Dialog */}
      {showSaveDialog && (
        <div className="p-4 bg-surface-raised rounded-lg border border">
          <h4 className="text-sm font-medium text-content mb-3">{t('legacy_config.LegacyRatesTab.saveCurrentRatesAsProfile')}</h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder={t('legacy_config.LegacyRatesTab.profileName')}
              className="flex-1 px-3 py-2 bg-surface-input border border rounded text-content text-sm"
              autoFocus
            />
            <button
              onClick={saveCurrentAsProfile}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium"
            >
              {t('legacy_config.LegacyRatesTab.save')}
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-4 py-2 bg-surface-raised hover:bg-surface-raised text-content rounded text-sm"
            >
              {t('legacy_config.LegacyRatesTab.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Rate Curves + Sliders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(['roll', 'pitch', 'yaw'] as const).map((axis) => {
          const rateKey = `${axis}Rate` as 'rollRate' | 'pitchRate' | 'yawRate';
          const expoKey = axis === 'yaw' ? 'rcYawExpo' : 'rcExpo';

          return (
            <div key={axis} className="bg-surface-input rounded-xl p-5 border border-subtle">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: axisColors[axis] }} />
                <h3 className="text-lg font-semibold text-content capitalize">{axis}</h3>
              </div>

              {/* Rate Curve */}
              <div className="mb-5">
                <RateCurve
                  rcRate={rates.rcRate}
                  superRate={rates[rateKey]}
                  expo={rates[expoKey]}
                  color={axisColors[axis]}
                />
              </div>

              {/* Sliders */}
              <div className="space-y-4">
                <DraggableSlider
                  label={t('legacy_config.LegacyRatesTab.rate')}
                  hint={t('legacy_config.LegacyRatesTab.maximumRotationSpeed')}
                  value={rates[rateKey]}
                  onChange={(v) => handleChange(rateKey, v, `${axis}_rate`)}
                  color={axisColors[axis]}
                  max={180}
                />
                <DraggableSlider
                  label={t('legacy_config.LegacyRatesTab.expo')}
                  hint={t('legacy_config.LegacyRatesTab.centerStickSensitivity')}
                  value={rates[expoKey]}
                  onChange={(v) => handleChange(expoKey, v, axis === 'yaw' ? 'rc_yaw_expo' : 'rc_expo')}
                  color={axisColors[axis]}
                  max={100}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Global RC Rate */}
      <div className="bg-surface-input rounded-xl p-5 border border-subtle">
        <h3 className="text-lg font-semibold text-content mb-4">{t('legacy_config.LegacyRatesTab.globalSettings')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DraggableSlider
            label={t('legacy_config.LegacyRatesTab.rcRate')}
            hint={t('legacy_config.LegacyRatesTab.overallStickSensitivityMultiplier')}
            value={rates.rcRate}
            onChange={(v) => handleChange('rcRate', v, 'rc_rate')}
            color="#8B5CF6"
            max={200}
          />
          <div className="grid grid-cols-2 gap-4">
            <DraggableSlider
              label={t('legacy_config.LegacyRatesTab.throttleMid')}
              hint={t('legacy_config.LegacyRatesTab.hoverPoint')}
              value={rates.throttleMid}
              onChange={(v) => handleChange('throttleMid', v, 'thr_mid')}
              color="#F59E0B"
              max={100}
            />
            <DraggableSlider
              label={t('legacy_config.LegacyRatesTab.throttleExpo')}
              hint={t('legacy_config.LegacyRatesTab.throttleCurve')}
              value={rates.throttleExpo}
              onChange={(v) => handleChange('throttleExpo', v, 'thr_expo')}
              color="#F59E0B"
              max={100}
            />
          </div>
        </div>
      </div>

      {/* TPA */}
      <div className="bg-surface-input rounded-xl p-5 border border-subtle">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-content">{t('legacy_config.LegacyRatesTab.throttlePidAttenuation')}</h3>
          <span className="text-xs text-content-secondary bg-surface-raised px-2 py-0.5 rounded">TPA</span>
        </div>
        <p className="text-sm text-content-secondary mb-4">
          {t('legacy_config.LegacyRatesTab.reducesPidStrengthAtHighThrottle')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DraggableSlider
            label={t('legacy_config.LegacyRatesTab.tpaRate')}
            hint={t('legacy_config.LegacyRatesTab.howMuchToReducePidsAt')}
            value={rates.tpaRate}
            onChange={(v) => handleChange('tpaRate', v, 'tpa_rate')}
            color="#10B981"
            max={100}
          />
          <DraggableSlider
            label={t('legacy_config.LegacyRatesTab.tpaBreakpoint')}
            hint={t('legacy_config.LegacyRatesTab.throttleLevelWhereTpaStarts')}
            value={rates.tpaBreakpoint}
            onChange={(v) => handleChange('tpaBreakpoint', v, 'tpa_breakpoint')}
            color="#10B981"
            min={1000}
            max={2000}
          />
        </div>
      </div>
    </div>
  );
}
