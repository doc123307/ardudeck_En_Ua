/**
 * NavigationTab
 *
 * iNav Navigation configuration for autonomous flight.
 * RTH settings, waypoint navigation, GPS config.
 */

import { useState, useEffect, useCallback } from 'react';
import { DraftNumberInput } from '../../hooks/useNumericDraft';
import { Compass, Home, PlaneLanding, MapPin, Satellite, AlertTriangle } from 'lucide-react';
import { t } from '../../i18n';

// Types matching msp-ts
interface MSPNavConfig {
  userControlMode: number;
  maxNavigationSpeed: number;
  maxClimbRate: number;
  maxManualSpeed: number;
  maxManualClimbRate: number;
  landDescendRate: number;
  landSlowdownMinAlt: number;
  landSlowdownMaxAlt: number;
  emergencyDescentRate: number;
  rthAltControlMode: number;
  rthAbortThreshold: number;
  rthAltitude: number;
  waypointRadius: number;
  waypointSafeAlt: number;
  maxBankAngle: number;
  useThrottleMidForAlthold: boolean;
  hoverThrottle: number;
}

interface MSPGpsConfig {
  provider: number;
  sbasMode: number;
  autoConfig: boolean;
  autoBaud: boolean;
  homePointOnce: boolean;
  ubloxUseGalileo: boolean;
}

const NAV_RTH_ALT_MODE = {
  CURRENT: 0,
  EXTRA: 1,
  FIXED: 2,
  MAX: 3,
  AT_LEAST: 4,
} as const;

const NAV_RTH_ALT_MODE_NAMES: Record<number, { name: string; description: string }> = {
  0: { name: 'Current', get description() { return t('parameters.NavigationTab.stayAtCurrentHeightCouldHit'); } },
  1: { name: 'Extra', get description() { return t('parameters.NavigationTab.climbHigherByRthAltitudeBefore'); } },
  2: { name: 'Fixed', get description() { return t('parameters.NavigationTab.alwaysReturnAtExactlyRthAltitude'); } },
  3: { name: 'Maximum', get description() { return t('parameters.NavigationTab.useHigherOfCurrentOrRth'); } },
  4: { name: 'At Least (Recommended)', get description() { return t('parameters.NavigationTab.climbToRthAltitudeIfBelow'); } },
};

const GPS_PROVIDER_NAMES: Record<number, string> = {
  0: 'NMEA',
  1: 'u-blox',
  2: 'MSP',
  3: 'Fake (Testing)',
};

const GPS_SBAS_NAMES: Record<number, string> = {
  0: 'Auto',
  1: 'EGNOS (Europe)',
  2: 'WAAS (USA)',
  3: 'MSAS (Japan)',
  4: 'GAGAN (India)',
  5: 'None',
};

// Default nav config (iNav defaults)
const DEFAULT_NAV_CONFIG: Partial<MSPNavConfig> = {
  maxNavigationSpeed: 300,     // 3 m/s
  maxClimbRate: 500,           // 5 m/s
  waypointRadius: 100,         // 1 m
  waypointSafeAlt: 2000,       // 20 m
  rthAltControlMode: NAV_RTH_ALT_MODE.AT_LEAST,
  rthAltitude: 3000,           // 30 m
  landDescendRate: 200,        // 2 m/s
  emergencyDescentRate: 500,   // 5 m/s
};

// Extended waypoint settings (CLI parameters via MSP2 COMMON_SETTING)
interface WaypointSettings {
  nav_wp_load_on_boot: string; // ON/OFF
  nav_wp_max_safe_distance: number; // 0-1500 (meters)
  nav_wp_mission_restart: string; // START/RESUME/SWITCH
  nav_mc_wp_slowdown: string; // ON/OFF (multicopter)
  nav_fw_wp_turn_smoothing: string; // OFF/ON/ON-CUT (fixed-wing)
}

const DEFAULT_WP_SETTINGS: WaypointSettings = {
  nav_wp_load_on_boot: 'OFF',
  nav_wp_max_safe_distance: 100,
  nav_wp_mission_restart: 'RESUME',
  nav_mc_wp_slowdown: 'ON',
  nav_fw_wp_turn_smoothing: 'OFF',
};

interface Props {
  modified: boolean;
  setModified: (v: boolean) => void;
}

export default function NavigationTab({ modified, setModified }: Props) {
  const [navConfig, setNavConfig] = useState<Partial<MSPNavConfig>>(DEFAULT_NAV_CONFIG);
  const [gpsConfig, setGpsConfig] = useState<MSPGpsConfig | null>(null);
  const [wpSettings, setWpSettings] = useState<WaypointSettings>(DEFAULT_WP_SETTINGS);
  const [wpSettingsSupported, setWpSettingsSupported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load navigation configuration
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nav = await window.electronAPI.mspGetNavConfig();
      if (nav) {
        setNavConfig((prev) => ({ ...prev, ...nav }));
      }

      const gps = await window.electronAPI.mspGetGpsConfig();
      if (gps) {
        setGpsConfig(gps as MSPGpsConfig);
      }

      // Load extended waypoint settings via generic settings API
      try {
        const wpSettingNames = [
          'nav_wp_load_on_boot',
          'nav_wp_max_safe_distance',
          'nav_wp_mission_restart',
          'nav_mc_wp_slowdown',
          'nav_fw_wp_turn_smoothing',
        ];
        const settings = await window.electronAPI.mspGetSettings(wpSettingNames);

        // Check if we got any valid settings back
        const hasValidSettings = Object.values(settings).some(v => v !== null);
        setWpSettingsSupported(hasValidSettings);

        if (hasValidSettings) {
          setWpSettings({
            nav_wp_load_on_boot: String(settings.nav_wp_load_on_boot ?? 'OFF'),
            nav_wp_max_safe_distance: Number(settings.nav_wp_max_safe_distance ?? 100),
            nav_wp_mission_restart: String(settings.nav_wp_mission_restart ?? 'RESUME'),
            nav_mc_wp_slowdown: String(settings.nav_mc_wp_slowdown ?? 'ON'),
            nav_fw_wp_turn_smoothing: String(settings.nav_fw_wp_turn_smoothing ?? 'OFF'),
          });
          console.log('[Navigation] Loaded waypoint settings:', settings);
        }
      } catch (wpErr) {
        console.log('[Navigation] Extended waypoint settings not available:', wpErr);
        setWpSettingsSupported(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parameters.NavigationTab.failedToLoadNavigationConfig'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Update nav config
  const updateNavConfig = (updates: Partial<MSPNavConfig>) => {
    setNavConfig((prev) => ({ ...prev, ...updates }));
    setModified(true);
  };

  // Update GPS config
  const updateGpsConfig = (updates: Partial<MSPGpsConfig>) => {
    if (gpsConfig) {
      setGpsConfig({ ...gpsConfig, ...updates });
      setModified(true);
    }
  };

  // Update waypoint settings
  const updateWpSettings = (updates: Partial<WaypointSettings>) => {
    setWpSettings((prev) => ({ ...prev, ...updates }));
    setModified(true);
  };

  // Save all changes
  const saveAll = async () => {
    setError(null);
    try {
      console.log('[Navigation] Saving nav config...');
      const navSuccess = await window.electronAPI.mspSetNavConfig(navConfig);
      if (!navSuccess) {
        // MSP2 might not be supported on old iNav - try GPS config only
        console.log('[Navigation] Nav config save failed (may not be supported on old iNav)');
      }

      if (gpsConfig) {
        console.log('[Navigation] Saving GPS config...');
        const gpsSuccess = await window.electronAPI.mspSetGpsConfig(gpsConfig);
        if (!gpsSuccess) {
          setError(t('parameters.NavigationTab.failedToSetGpsConfig'));
          return;
        }
      }

      // Save extended waypoint settings via generic settings API
      if (wpSettingsSupported) {
        console.log('[Navigation] Saving waypoint settings...');
        const wpSuccess = await window.electronAPI.mspSetSettings({
          nav_wp_load_on_boot: wpSettings.nav_wp_load_on_boot,
          nav_wp_max_safe_distance: wpSettings.nav_wp_max_safe_distance,
          nav_wp_mission_restart: wpSettings.nav_wp_mission_restart,
          nav_mc_wp_slowdown: wpSettings.nav_mc_wp_slowdown,
          nav_fw_wp_turn_smoothing: wpSettings.nav_fw_wp_turn_smoothing,
        });
        if (!wpSuccess) {
          console.log('[Navigation] Some waypoint settings failed to save');
        }
      }

      // Save to EEPROM
      console.log('[Navigation] Saving to EEPROM...');
      const eepromSuccess = await window.electronAPI.mspSaveEeprom();
      if (!eepromSuccess) {
        setError(t('parameters.NavigationTab.configSentButEepromSaveFailed'));
        return;
      }

      console.log('[Navigation] Saved successfully');
      setModified(false);
    } catch (err) {
      console.error('[Navigation] Save error:', err);
      setError(err instanceof Error ? err.message : t('parameters.NavigationTab.failedToSave'));
    }
  };

  // Convert cm/s to m/s for display
  const toMs = (cms: number) => (cms / 100).toFixed(1);
  const fromMs = (ms: number) => Math.round(ms * 100);

  // Convert cm to m for display
  const toM = (cm: number) => (cm / 100).toFixed(0);
  const fromM = (m: number) => Math.round(m * 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-2 mx-auto" />
          <p className="text-content-secondary">{t('parameters.NavigationTab.loadingNavigationConfiguration')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-blue-500/10 rounded-xl border-blue-500/30 p-4 flex items-start gap-4">
        <Compass className="w-6 h-6 text-blue-400" />
        <div>
          <p className="text-blue-400 font-medium">{t('parameters.NavigationTab.navigationSettingsInavAutonomousFlight')}</p>
          <p className="text-sm text-content-secondary mt-1">
            {t('parameters.NavigationTab.theseSettingsControlWhatHappensWhen')} <strong className="text-content">{t('parameters.NavigationTab.withoutYourInput')}</strong>{t('parameters.NavigationTab.likeFlyingHomeAutomaticallyOrFollowing')}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-content-secondary">
            <p><span className="text-green-400 inline-flex items-center gap-1"><Home className="w-3.5 h-3.5" /> RTH</span>{t('parameters.NavigationTab.returnToHomeFliesBackTo')}</p>
            <p><span className="text-purple-400 inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {t('parameters.NavigationTab.waypoints')}</span>{t('parameters.NavigationTab.prePlannedGpsPointsTheAircraft')}</p>
            <p><span className="text-amber-400 inline-flex items-center gap-1"><PlaneLanding className="w-3.5 h-3.5" /> {t('parameters.NavigationTab.landing')}</span>{t('parameters.NavigationTab.howFastSlowItComesDown')}</p>
            <p><span className="text-blue-400 inline-flex items-center gap-1"><Satellite className="w-3.5 h-3.5" /> GPS</span>{t('parameters.NavigationTab.satelliteSettingsUsuallyLeaveOnAuto')}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
            ×
          </button>
        </div>
      )}

      {/* RTH Settings */}
      <div className="bg-surface rounded-xl border-subtle p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Home className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-content">{t('parameters.NavigationTab.returnToHomeRth')}</h3>
            <p className="text-xs text-content-secondary">{t('parameters.NavigationTab.whatHappensWhenRthIsTriggered')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* RTH Altitude Mode */}
          <div className="space-y-3">
            <label className="text-xs text-content-secondary block">{t('parameters.NavigationTab.rthAltitudeMode')}</label>
            <div className="space-y-2">
              {Object.entries(NAV_RTH_ALT_MODE_NAMES).map(([value, info]) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                    navConfig.rthAltControlMode === Number(value)
                      ? 'bg-green-500/20 border-green-500/50'
                      : 'bg-surface border hover:border'
                  }`}
                >
                  <input
                    type="radio"
                    name="rthAltMode"
                    value={value}
                    checked={navConfig.rthAltControlMode === Number(value)}
                    onChange={() => updateNavConfig({ rthAltControlMode: Number(value) })}
                    className="w-4 h-4 text-green-500"
                  />
                  <div>
                    <div className="text-sm text-content">{info.name}</div>
                    <div className="text-xs text-content-secondary">{info.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* RTH Altitude & Speeds */}
          <div className="space-y-4">
            <div>
              <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.NavigationTab.rthAltitudeM')}</label>
              <DraftNumberInput
                value={Number(toM(navConfig.rthAltitude ?? 3000))}
                onCommit={(v) => updateNavConfig({ rthAltitude: fromM(v) })}
                className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
                min={5}
                max={300}
              />
              <p className="text-[10px] text-content-tertiary mt-1">{t('parameters.NavigationTab.usedWithFixedMaxAtLeast')}</p>
            </div>

            <div>
              <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.NavigationTab.maxNavigationSpeedMS')}</label>
              <DraftNumberInput
                value={Number(toMs(navConfig.maxNavigationSpeed ?? 300))}
                onCommit={(v) => updateNavConfig({ maxNavigationSpeed: fromMs(v) })}
                className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
                min={0.5}
                max={20}
                step={0.5}
              />
            </div>

            <div>
              <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.NavigationTab.maxClimbRateMS')}</label>
              <DraftNumberInput
                value={Number(toMs(navConfig.maxClimbRate ?? 500))}
                onCommit={(v) => updateNavConfig({ maxClimbRate: fromMs(v) })}
                className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
                min={0.5}
                max={10}
                step={0.5}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Landing Settings */}
      <div className="bg-surface rounded-xl border-subtle p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <PlaneLanding className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-content">{t('parameters.NavigationTab.landingConfiguration')}</h3>
            <p className="text-xs text-content-secondary">{t('parameters.NavigationTab.howTheAircraftLandsAfterRth')}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.NavigationTab.descentRateMS')}</label>
            <DraftNumberInput
              value={Number(toMs(navConfig.landDescendRate ?? 200))}
              onCommit={(v) => updateNavConfig({ landDescendRate: fromMs(v) })}
              className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
              min={0.2}
              max={5}
              step={0.1}
            />
            <p className="text-[10px] text-content-tertiary mt-1">{t('parameters.NavigationTab.slowerSofterLanding')}</p>
          </div>

          <div>
            <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.NavigationTab.slowdownMinAltM')}</label>
            <DraftNumberInput
              value={Number(toM(navConfig.landSlowdownMinAlt ?? 500))}
              onCommit={(v) => updateNavConfig({ landSlowdownMinAlt: fromM(v) })}
              className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
              min={1}
              max={50}
            />
            <p className="text-[10px] text-content-tertiary mt-1">{t('parameters.NavigationTab.startSlowingAtThisAlt')}</p>
          </div>

          <div>
            <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.NavigationTab.emergencyDescentMS')}</label>
            <DraftNumberInput
              value={Number(toMs(navConfig.emergencyDescentRate ?? 500))}
              onCommit={(v) => updateNavConfig({ emergencyDescentRate: fromMs(v) })}
              className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
              min={1}
              max={10}
              step={0.5}
            />
            <p className="text-[10px] text-content-tertiary mt-1">{t('parameters.NavigationTab.gpsLossDescentRate')}</p>
          </div>
        </div>
      </div>

      {/* Waypoint Settings */}
      <div className="bg-surface rounded-xl border-subtle p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-content">{t('parameters.NavigationTab.waypointNavigation')}</h3>
            <p className="text-xs text-content-secondary">{t('parameters.NavigationTab.settingsForMissionWaypoints')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.NavigationTab.waypointRadiusM')}</label>
            <DraftNumberInput
              value={Number(toM(navConfig.waypointRadius ?? 100))}
              onCommit={(v) => updateNavConfig({ waypointRadius: fromM(v) })}
              className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
              min={0.5}
              max={20}
              step={0.5}
            />
            <p className="text-[10px] text-content-tertiary mt-1">{t('parameters.NavigationTab.waypointConsideredReachedWithinThisRadius')}</p>
          </div>

          <div>
            <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.NavigationTab.safeAltitudeM')}</label>
            <DraftNumberInput
              value={Number(toM(navConfig.waypointSafeAlt ?? 2000))}
              onCommit={(v) => updateNavConfig({ waypointSafeAlt: fromM(v) })}
              className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
              min={5}
              max={200}
            />
            <p className="text-[10px] text-content-tertiary mt-1">{t('parameters.NavigationTab.minimumSafeAltitudeForMissions')}</p>
          </div>
        </div>

        {/* Extended waypoint settings (via generic settings API) */}
        {wpSettingsSupported && (
          <>
            <div className="border-t border-subtle pt-4 mt-4">
              <p className="text-xs text-content-secondary mb-3">{t('parameters.NavigationTab.advancedMissionSettings')}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.NavigationTab.maxSafeDistanceM')}</label>
                  <DraftNumberInput
                    value={wpSettings.nav_wp_max_safe_distance}
                    onCommit={(v) => updateWpSettings({ nav_wp_max_safe_distance: v })}
                    className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
                    min={0}
                    max={1500}
                    step={10}
                  />
                  <p className="text-[10px] text-content-tertiary mt-1">{t('parameters.NavigationTab.maxDistanceFromHome0Disabled')}</p>
                </div>

                <div>
                  <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.NavigationTab.missionRestartMode')}</label>
                  <select
                    value={wpSettings.nav_wp_mission_restart}
                    onChange={(e) => updateWpSettings({ nav_wp_mission_restart: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
                  >
                    <option value="START">{t('parameters.NavigationTab.startFromBeginning')}</option>
                    <option value="RESUME">{t('parameters.NavigationTab.resumeFromLastWp')}</option>
                    <option value="SWITCH">{t('parameters.NavigationTab.switchToNextMission')}</option>
                  </select>
                  <p className="text-[10px] text-content-tertiary mt-1">{t('parameters.NavigationTab.whatHappensAfterRth')}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wpSettings.nav_wp_load_on_boot === 'ON'}
                  onChange={(e) => updateWpSettings({ nav_wp_load_on_boot: e.target.checked ? 'ON' : 'OFF' })}
                  className="w-4 h-4 rounded border bg-surface-raised text-purple-500"
                />
                <span className="text-sm text-content-secondary">{t('parameters.NavigationTab.loadMissionOnBoot')}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wpSettings.nav_mc_wp_slowdown === 'ON'}
                  onChange={(e) => updateWpSettings({ nav_mc_wp_slowdown: e.target.checked ? 'ON' : 'OFF' })}
                  className="w-4 h-4 rounded border bg-surface-raised text-purple-500"
                />
                <span className="text-sm text-content-secondary">{t('parameters.NavigationTab.slowdownAtWaypointsMc')}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <select
                  value={wpSettings.nav_fw_wp_turn_smoothing}
                  onChange={(e) => updateWpSettings({ nav_fw_wp_turn_smoothing: e.target.value })}
                  className="px-2 py-1 bg-surface-raised border rounded text-sm text-content focus:outline-none focus:border-blue-500"
                >
                  <option value="OFF">{t('parameters.NavigationTab.off')}</option>
                  <option value="ON">{t('parameters.NavigationTab.on')}</option>
                  <option value="ON-CUT">{t('parameters.NavigationTab.onCutThrottle')}</option>
                </select>
                <span className="text-sm text-content-secondary">{t('parameters.NavigationTab.turnSmoothingFw')}</span>
              </label>
            </div>
          </>
        )}
      </div>

      {/* GPS Configuration */}
      {gpsConfig && (
        <div className="bg-surface rounded-xl border-subtle p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Satellite className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-content">{t('parameters.NavigationTab.gpsConfiguration')}</h3>
              <p className="text-xs text-content-secondary">{t('parameters.NavigationTab.gpsModuleSettings')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.NavigationTab.gpsProvider')}</label>
              <select
                value={gpsConfig.provider}
                onChange={(e) => updateGpsConfig({ provider: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
              >
                {Object.entries(GPS_PROVIDER_NAMES).map(([val, name]) => (
                  <option key={val} value={val}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-content-secondary block mb-1.5">{t('parameters.NavigationTab.sbasMode')}</label>
              <select
                value={gpsConfig.sbasMode}
                onChange={(e) => updateGpsConfig({ sbasMode: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
              >
                {Object.entries(GPS_SBAS_NAMES).map(([val, name]) => (
                  <option key={val} value={val}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gpsConfig.autoConfig}
                onChange={(e) => updateGpsConfig({ autoConfig: e.target.checked })}
                className="w-4 h-4 rounded border bg-surface-raised text-blue-500"
              />
              <span className="text-sm text-content-secondary">{t('parameters.NavigationTab.autoConfigureGps')}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gpsConfig.autoBaud}
                onChange={(e) => updateGpsConfig({ autoBaud: e.target.checked })}
                className="w-4 h-4 rounded border bg-surface-raised text-blue-500"
              />
              <span className="text-sm text-content-secondary">{t('parameters.NavigationTab.autoDetectBaudRate')}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gpsConfig.ubloxUseGalileo}
                onChange={(e) => updateGpsConfig({ ubloxUseGalileo: e.target.checked })}
                className="w-4 h-4 rounded border bg-surface-raised text-blue-500"
              />
              <span className="text-sm text-content-secondary">{t('parameters.NavigationTab.enableGalileoUBlox')}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gpsConfig.homePointOnce}
                onChange={(e) => updateGpsConfig({ homePointOnce: e.target.checked })}
                className="w-4 h-4 rounded border bg-surface-raised text-blue-500"
              />
              <span className="text-sm text-content-secondary">{t('parameters.NavigationTab.setHomeOnceDonTUpdate')}</span>
            </label>
          </div>
        </div>
      )}

      {/* Safety Warning */}
      <div className="bg-amber-500/10 rounded-xl border-amber-500/30 p-4 flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <div>
          <p className="text-amber-400 font-medium">{t('parameters.NavigationTab.importantSafetyNotes')}</p>
          <ul className="text-sm text-content-secondary mt-1 space-y-1 list-disc list-inside">
            <li>{t('parameters.NavigationTab.alwaysTestRthInAnOpen')}</li>
            <li>{t('parameters.NavigationTab.ensureRthAltitudeIsAboveAll')}</li>
            <li>{t('parameters.NavigationTab.checkGpsSatelliteCount8Before')}</li>
            <li>{t('parameters.NavigationTab.configureFailsafeToRthForAdded')}</li>
          </ul>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        <button
          onClick={loadConfig}
          className="px-4 py-2 text-sm bg-surface-raised text-content rounded-lg hover:bg-surface-raised"
        >
          {t('parameters.NavigationTab.refresh')}
        </button>
        <button
          onClick={saveAll}
          disabled={!modified}
          className={`px-4 py-2 text-sm rounded-lg ${
            modified
              ? 'bg-blue-500 text-white hover:bg-blue-400'
              : 'bg-surface-raised text-content-secondary cursor-not-allowed'
          }`}
        >
          {t('parameters.NavigationTab.saveNavigationConfig')}
        </button>
      </div>
    </div>
  );
}
