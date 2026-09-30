/**
 * Safety Tab - Unified Safety & Failsafe Configuration
 *
 * Combines all safety-related features in one place:
 * - Failsafe behavior (what happens when signal is lost)
 * - GPS Rescue (Betaflight RTH) or Navigation link (iNav)
 * - Receiver & Arming settings (iNav)
 *
 * Clean, modern UI with collapsible sections.
 */

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { DraggableSlider } from '../ui/DraggableSlider';
import {
  Shield,
  AlertTriangle,
  RefreshCw,
  Lock,
  Zap,
  Radio,
  Home,
  ChevronDown,
  Settings,
  Satellite,
  Gauge,
  ArrowUp,
  ArrowDown,
  Info,
  Check,
  X,
} from 'lucide-react';
import { useConnectionStore } from '../../stores/connection-store';

// ============================================================================
// Types & Constants
// ============================================================================

// Failsafe procedures
import {
  PlaneLanding,
  CircleSlash,
  Gamepad2,
  Monitor as MonitorIcon,
} from 'lucide-react';
import { t } from '../../i18n';

const FAILSAFE_PROCEDURES = [
  { value: 0, get label() { return t('parameters.SafetyTab.land'); }, icon: PlaneLanding, get description() { return t('parameters.SafetyTab.landInPlace'); }, color: 'amber' },
  { value: 1, get label() { return t('parameters.SafetyTab.drop'); }, icon: AlertTriangle, get description() { return t('parameters.SafetyTab.cutMotorsDangerous'); }, color: 'red' },
  { value: 2, label: 'RTH', icon: Home, get description() { return t('parameters.SafetyTab.returnToHome'); }, color: 'green' },
  { value: 3, get label() { return t('parameters.SafetyTab.none'); }, icon: CircleSlash, get description() { return t('parameters.SafetyTab.keepFlying'); }, color: 'gray' },
] as const;

// Receiver types (iNav)
const RECEIVER_TYPES = [
  { value: 'NONE', get label() { return t('parameters.SafetyTab.none'); }, icon: CircleSlash },
  { value: 'SERIAL', get label() { return t('parameters.SafetyTab.serial'); }, icon: Radio },
  { value: 'MSP', label: 'MSP', icon: MonitorIcon },
  { value: 'SIM (SITL)', label: 'SITL', icon: Gamepad2 },
] as const;

// Betaflight receiver providers (serialrx_provider) - numeric values match FC encoding
const BF_RECEIVER_PROVIDERS = [
  { value: 0, get label() { return t('parameters.SafetyTab.spektrum1024'); }, get description() { return t('parameters.SafetyTab.spektrumDsm21024'); } },
  { value: 1, get label() { return t('parameters.SafetyTab.spektrum2048'); }, get description() { return t('parameters.SafetyTab.spektrumDsm2Dsmx2048'); } },
  { value: 2, label: 'SBUS', get description() { return t('parameters.SafetyTab.frskySbusFPort'); } },
  { value: 3, label: 'SUMD', get description() { return t('parameters.SafetyTab.graupnerSumd'); } },
  { value: 4, label: 'SUMH', get description() { return t('parameters.SafetyTab.graupnerSumh'); } },
  { value: 5, get label() { return t('parameters.SafetyTab.xbusModeB'); }, get description() { return t('parameters.SafetyTab.jrXbusModeB'); } },
  { value: 6, get label() { return t('parameters.SafetyTab.xbusRj01'); }, get description() { return t('parameters.SafetyTab.jrXbusRj01'); } },
  { value: 7, label: 'IBUS', get description() { return t('parameters.SafetyTab.flyskyIbus'); } },
  { value: 8, get label() { return t('parameters.SafetyTab.jetiExbus'); }, get description() { return t('parameters.SafetyTab.jetiExbus'); } },
  { value: 9, label: 'CRSF', get description() { return t('parameters.SafetyTab.tbsCrossfireElrs'); } },
  { value: 10, label: 'SRXL', get description() { return t('parameters.SafetyTab.spektrumSrxl'); } },
  { value: 12, get label() { return t('parameters.SafetyTab.fPort'); }, get description() { return t('parameters.SafetyTab.frskyFPort'); } },
  { value: 13, label: 'SRXL2', get description() { return t('parameters.SafetyTab.spektrumSrxl2'); } },
  { value: 14, get label() { return t('parameters.SafetyTab.ghost'); }, get description() { return t('parameters.SafetyTab.immersionrcGhost'); } },
  { value: 15, label: 'MSP', get description() { return t('parameters.SafetyTab.mspForSitlTesting'); } },
] as const;

// Quick select buttons (most common protocols)
const BF_QUICK_SELECT = [
  { value: 9, label: 'CRSF' },
  { value: 2, label: 'SBUS' },
  { value: 7, label: 'IBUS' },
  { value: 15, label: 'MSP' },
] as const;

// GPS Rescue altitude modes
const ALTITUDE_MODES = [
  { value: 0, get label() { return t('parameters.SafetyTab.maximum'); }, get description() { return t('parameters.SafetyTab.higherOfCurrentOrSetAltitude'); } },
  { value: 1, get label() { return t('parameters.SafetyTab.fixed'); }, get description() { return t('parameters.SafetyTab.alwaysClimbToSetAltitude'); } },
  { value: 2, get label() { return t('parameters.SafetyTab.current'); }, get description() { return t('parameters.SafetyTab.useCurrentAltitude'); } },
] as const;

// Sanity check options
const SANITY_CHECKS = [
  { value: 0, get label() { return t('parameters.SafetyTab.off'); }, get description() { return t('parameters.SafetyTab.noSafetyChecks'); } },
  { value: 1, get label() { return t('parameters.SafetyTab.flyaway'); }, get description() { return t('parameters.SafetyTab.detectFlyawaysOnly'); } },
  { value: 2, get label() { return t('parameters.SafetyTab.all'); }, get description() { return t('parameters.SafetyTab.allChecksRecommended'); } },
] as const;

// Interfaces
interface FailsafeConfig {
  failsafeDelay: number;
  failsafeOffDelay: number;
  failsafeThrottle: number;
  failsafeKillSwitch: number;
  failsafeThrottleLowDelay: number;
  failsafeProcedure: number;
  failsafeRecoveryDelay: number;
  failsafeFwRollAngle: number;
  failsafeFwPitchAngle: number;
  failsafeFwYawRate: number;
  failsafeStickMotionThreshold: number;
  failsafeMinDistance: number;
  failsafeMinDistanceProcedure: number;
}

interface ArmingSafetyConfig {
  receiverType: string;
  navExtraArmingSafety: string;
  navGpsMinSats: number;
}

interface BfReceiverConfig {
  serialrxProvider: number;
}

interface GpsRescueConfig {
  angle: number;
  initialAltitudeM: number;
  descentDistanceM: number;
  rescueGroundspeed: number;
  throttleMin: number;
  throttleMax: number;
  throttleHover: number;
  sanityChecks: number;
  minSats: number;
  ascendRate: number;
  descendRate: number;
  allowArmingWithoutFix: number;
  altitudeMode: number;
  minRescueDth: number;
  targetLandingAltitudeM: number;
}

interface GpsRescuePids {
  throttleP: number;
  throttleI: number;
  throttleD: number;
  velP: number;
  velI: number;
  velD: number;
  yawP: number;
}

// Defaults
const DEFAULT_FAILSAFE: FailsafeConfig = {
  failsafeDelay: 5,
  failsafeOffDelay: 10,
  failsafeThrottle: 1000,
  failsafeKillSwitch: 0,
  failsafeThrottleLowDelay: 100,
  failsafeProcedure: 2,
  failsafeRecoveryDelay: 5,
  failsafeFwRollAngle: 0,
  failsafeFwPitchAngle: 0,
  failsafeFwYawRate: 0,
  failsafeStickMotionThreshold: 50,
  failsafeMinDistance: 0,
  failsafeMinDistanceProcedure: 0,
};

const DEFAULT_ARMING: ArmingSafetyConfig = {
  receiverType: 'SERIAL',
  navExtraArmingSafety: 'ON',
  navGpsMinSats: 6,
};

const DEFAULT_BF_RECEIVER: BfReceiverConfig = {
  serialrxProvider: 9, // CRSF
};

const DEFAULT_GPS_RESCUE: GpsRescueConfig = {
  angle: 300,
  initialAltitudeM: 30,
  descentDistanceM: 20,
  rescueGroundspeed: 750,
  throttleMin: 1100,
  throttleMax: 1700,
  throttleHover: 1280,
  sanityChecks: 2,
  minSats: 8,
  ascendRate: 500,
  descendRate: 150,
  allowArmingWithoutFix: 0,
  altitudeMode: 0,
  minRescueDth: 30,
  targetLandingAltitudeM: 5,
};

const DEFAULT_GPS_PIDS: GpsRescuePids = {
  throttleP: 15,
  throttleI: 15,
  throttleD: 20,
  velP: 8,
  velI: 40,
  velD: 12,
  yawP: 40,
};

// ============================================================================
// Collapsible Section Component
// ============================================================================

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  defaultOpen?: boolean;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
}

function Section({ title, icon, color, defaultOpen = false, badge, badgeColor, children }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border-subtle overflow-hidden bg-surface">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-5 py-4 flex items-center gap-3 hover:bg-surface transition-colors`}
      >
        <div className={`w-10 h-10 rounded-lg bg-${color}-500/20 flex items-center justify-center`}>
          {icon}
        </div>
        <span className="flex-1 text-left font-medium text-content">{title}</span>
        {badge && (
          <span className={`px-2 py-0.5 text-xs rounded-full bg-${badgeColor || color}-500/20 text-${badgeColor || color}-400`}>
            {badge}
          </span>
        )}
        <ChevronDown
          className={`w-5 h-5 text-content-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 border-t border-subtle">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface SafetyTabHandle {
  save(): Promise<boolean>;
  hasChanges: boolean;
}

interface Props {
  isInav: boolean;
  setModified: (modified: boolean) => void;
}

const SafetyTab = forwardRef<SafetyTabHandle, Props>(function SafetyTab({ isInav, setModified }, ref) {
  // Connection state
  const connectionState = useConnectionStore((state) => state.connectionState);
  const isSitl = connectionState?.isSitl ?? false;

  // Failsafe state
  const [failsafe, setFailsafe] = useState<FailsafeConfig>(DEFAULT_FAILSAFE);
  const [originalFailsafe, setOriginalFailsafe] = useState<FailsafeConfig>(DEFAULT_FAILSAFE);

  // Arming safety state (iNav)
  const [arming, setArming] = useState<ArmingSafetyConfig>(DEFAULT_ARMING);
  const [originalArming, setOriginalArming] = useState<ArmingSafetyConfig>(DEFAULT_ARMING);

  // Receiver state (Betaflight)
  const [bfReceiver, setBfReceiver] = useState<BfReceiverConfig>(DEFAULT_BF_RECEIVER);
  const [originalBfReceiver, setOriginalBfReceiver] = useState<BfReceiverConfig>(DEFAULT_BF_RECEIVER);

  // GPS Rescue state (Betaflight)
  const [gpsRescue, setGpsRescue] = useState<GpsRescueConfig>(DEFAULT_GPS_RESCUE);
  const [originalGpsRescue, setOriginalGpsRescue] = useState<GpsRescueConfig>(DEFAULT_GPS_RESCUE);
  const [gpsPids, setGpsPids] = useState<GpsRescuePids>(DEFAULT_GPS_PIDS);
  const [originalGpsPids, setOriginalGpsPids] = useState<GpsRescuePids>(DEFAULT_GPS_PIDS);
  const [showGpsPids, setShowGpsPids] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check for changes
  const failsafeChanged = JSON.stringify(failsafe) !== JSON.stringify(originalFailsafe);
  const armingChanged = JSON.stringify(arming) !== JSON.stringify(originalArming);
  const bfReceiverChanged = JSON.stringify(bfReceiver) !== JSON.stringify(originalBfReceiver);
  const gpsRescueChanged = JSON.stringify(gpsRescue) !== JSON.stringify(originalGpsRescue);
  const gpsPidsChanged = JSON.stringify(gpsPids) !== JSON.stringify(originalGpsPids);
  const hasChanges = failsafeChanged || armingChanged || bfReceiverChanged || gpsRescueChanged || gpsPidsChanged;

  // Propagate change state to parent
  useEffect(() => {
    setModified(hasChanges);
  }, [hasChanges, setModified]);

  // Load all configuration
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load failsafe via MSP
      const failsafeConfig = await window.electronAPI.mspGetFailsafeConfig() as FailsafeConfig | null;
      if (failsafeConfig) {
        setFailsafe(failsafeConfig);
        setOriginalFailsafe(failsafeConfig);
      }

      // Load GPS Rescue and Receiver config for Betaflight
      if (!isInav) {
        const [rescueConfig, rescuePids] = await Promise.all([
          window.electronAPI.mspGetGpsRescue() as Promise<GpsRescueConfig | null>,
          window.electronAPI.mspGetGpsRescuePids() as Promise<GpsRescuePids | null>,
        ]);

        if (rescueConfig) {
          setGpsRescue(rescueConfig);
          setOriginalGpsRescue(rescueConfig);
        }
        if (rescuePids) {
          setGpsPids(rescuePids);
          setOriginalGpsPids(rescuePids);
        }

        // Load Betaflight receiver config via MSP_RX_CONFIG (no CLI disruption!)
        try {
          const rxConfig = await window.electronAPI.mspGetRxConfig();
          if (rxConfig) {
            setBfReceiver({ serialrxProvider: rxConfig.serialrxProvider });
            setOriginalBfReceiver({ serialrxProvider: rxConfig.serialrxProvider });
          }
        } catch {
          // Ignore - use defaults
        }
      }

      // Load arming safety for iNav
      if (isInav) {
        try {
          const settings = await window.electronAPI.mspGetSettings([
            'receiver_type',
            'nav_extra_arming_safety',
            'gps_min_sats',
          ]);

          if (settings?.['nav_extra_arming_safety'] !== null) {
            const safety: ArmingSafetyConfig = {
              receiverType: String(settings['receiver_type'] ?? 'SERIAL').toUpperCase(),
              navExtraArmingSafety: String(settings['nav_extra_arming_safety']).toUpperCase(),
              navGpsMinSats: Number(settings['gps_min_sats'] ?? 6),
            };
            setArming(safety);
            setOriginalArming(safety);
          }
        } catch {
          // Settings API not available, try CLI fallback for SITL
          if (isSitl) {
            try {
              await window.electronAPI.mspStopTelemetry();
              await new Promise(r => setTimeout(r, 200));
              const dump = await window.electronAPI.cliGetDump();

              const receiverMatch = dump.match(/set receiver_type\s*=\s*(.+?)$/im);
              const armingMatch = dump.match(/set nav_extra_arming_safety\s*=\s*(\S+)/i);
              const satsMatch = dump.match(/set gps_min_sats\s*=\s*(\d+)/i);

              setArming({
                receiverType: receiverMatch?.[1]?.trim().toUpperCase() ?? 'SERIAL',
                navExtraArmingSafety: armingMatch?.[1]?.toUpperCase() ?? 'ON',
                navGpsMinSats: satsMatch ? parseInt(satsMatch[1]!, 10) : 6,
              });
              setOriginalArming({
                receiverType: receiverMatch?.[1]?.trim().toUpperCase() ?? 'SERIAL',
                navExtraArmingSafety: armingMatch?.[1]?.toUpperCase() ?? 'ON',
                navGpsMinSats: satsMatch ? parseInt(satsMatch[1]!, 10) : 6,
              });

              await new Promise(r => setTimeout(r, 500));
              await window.electronAPI.mspStartTelemetry();
            } catch {
              // Ignore
              try { await window.electronAPI.mspStartTelemetry(); } catch { /* ignore */ }
            }
          }
        }
      }
    } catch (err) {
      console.error('[SafetyTab] Failed to load:', err);
      setError(t('parameters.SafetyTab.failedToLoadSafetyConfiguration'));
    } finally {
      setLoading(false);
    }
  }, [isInav, isSitl]);

  // Save all safety changes via MSP (called by parent via ref)
  // Parent handles EEPROM save after all tabs are saved
  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Save failsafe
      if (failsafeChanged) {
        if (isSitl) {
          // CLI path for SITL (CLI 'save' persists + reboots)
          await window.electronAPI.mspStopTelemetry();
          await new Promise(r => setTimeout(r, 200));
          await window.electronAPI.cliEnterMode();
          await new Promise(r => setTimeout(r, 300));

          await window.electronAPI.cliSendCommand(`set failsafe_delay = ${failsafe.failsafeDelay}`);
          await new Promise(r => setTimeout(r, 100));
          await window.electronAPI.cliSendCommand(`set failsafe_off_delay = ${failsafe.failsafeOffDelay}`);
          await new Promise(r => setTimeout(r, 100));
          await window.electronAPI.cliSendCommand(`set failsafe_throttle = ${failsafe.failsafeThrottle}`);
          await new Promise(r => setTimeout(r, 100));
          await window.electronAPI.cliSendCommand(`set failsafe_procedure = ${['LAND', 'DROP', 'RTH', 'NONE'][failsafe.failsafeProcedure]}`);
          await new Promise(r => setTimeout(r, 100));
          await window.electronAPI.cliSendCommand('save');

          setOriginalFailsafe({ ...failsafe });
          return true;
        } else {
          const result = await window.electronAPI.mspSetFailsafeConfig(failsafe);
          if (!result) throw new Error(t('parameters.SafetyTab.failedToSaveFailsafe'));
        }
      }

      // Save GPS Rescue (Betaflight)
      if (!isInav && gpsRescueChanged) {
        const result = await window.electronAPI.mspSetGpsRescue(gpsRescue);
        if (!result) throw new Error(t('parameters.SafetyTab.failedToSaveGpsRescue'));
      }

      if (!isInav && gpsPidsChanged) {
        const result = await window.electronAPI.mspSetGpsRescuePids(gpsPids);
        if (!result) throw new Error(t('parameters.SafetyTab.failedToSaveGpsRescuePids'));
      }

      // Save Betaflight receiver config via MSP
      if (!isInav && bfReceiverChanged) {
        const result = await window.electronAPI.mspSetRxConfig(bfReceiver.serialrxProvider);
        if (!result) throw new Error(t('parameters.SafetyTab.failedToSaveRxConfigVia'));
      }

      // Save arming safety (iNav)
      if (isInav && armingChanged) {
        if (!isSitl) {
          const result = await window.electronAPI.mspSetSettings({
            'receiver_type': arming.receiverType,
            'nav_extra_arming_safety': arming.navExtraArmingSafety,
            'gps_min_sats': arming.navGpsMinSats,
          });
          if (!result) throw new Error(t('parameters.SafetyTab.failedToSaveArmingSettings'));
        } else {
          // CLI path for SITL arming settings (CLI 'save' persists + reboots)
          await window.electronAPI.mspStopTelemetry();
          await new Promise(r => setTimeout(r, 200));
          await window.electronAPI.cliEnterMode();
          await new Promise(r => setTimeout(r, 300));

          await window.electronAPI.cliSendCommand(`set receiver_type = ${arming.receiverType}`);
          await new Promise(r => setTimeout(r, 100));
          await window.electronAPI.cliSendCommand(`set nav_extra_arming_safety = ${arming.navExtraArmingSafety}`);
          await new Promise(r => setTimeout(r, 100));
          await window.electronAPI.cliSendCommand(`set gps_min_sats = ${arming.navGpsMinSats}`);
          await new Promise(r => setTimeout(r, 100));
          await window.electronAPI.cliSendCommand('save');

          setOriginalArming({ ...arming });
          return true;
        }
      }

      // Update originals
      setOriginalFailsafe({ ...failsafe });
      setOriginalGpsRescue({ ...gpsRescue });
      setOriginalGpsPids({ ...gpsPids });
      setOriginalArming({ ...arming });
      setOriginalBfReceiver({ ...bfReceiver });

      return true;
    } catch (err) {
      console.error('[SafetyTab] Save failed:', err);
      setError(err instanceof Error ? err.message : t('parameters.SafetyTab.failedToSaveSettings'));
      try { await window.electronAPI.mspStartTelemetry(); } catch { /* ignore */ }
      return false;
    } finally {
      setSaving(false);
    }
  }, [failsafeChanged, failsafe, isSitl, isInav, gpsRescueChanged, gpsRescue, gpsPidsChanged, gpsPids, bfReceiverChanged, bfReceiver, armingChanged, arming]);

  // Expose save + hasChanges to parent via ref
  useImperativeHandle(ref, () => ({
    save,
    get hasChanges() { return hasChanges; },
  }), [save, hasChanges]);

  // Load on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Clear messages after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-content-secondary">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>{t('parameters.SafetyTab.loadingSafetyConfiguration')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-w-4xl mx-auto">
      {/* Messages */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border-red-500/30 rounded-xl text-red-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-500/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border-green-500/30 rounded-xl text-green-400">
          <Check className="w-5 h-5 shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Failsafe Section */}
      <Section
        title={t('parameters.SafetyTab.failsafeBehavior')}
        icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
        color="amber"
        defaultOpen={true}
        badge={failsafeChanged ? t('parameters.SafetyTab.modified') : undefined}
        badgeColor="yellow"
      >
        <div className="mt-4 space-y-6">
          {/* Procedure Selection - Visual Cards */}
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-3">
              {t('parameters.SafetyTab.whatShouldHappenWhenSignalIs')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {FAILSAFE_PROCEDURES.map((proc) => {
                const isSelected = failsafe.failsafeProcedure === proc.value;
                return (
                  <button
                    key={proc.value}
                    onClick={() => setFailsafe(prev => ({ ...prev, failsafeProcedure: proc.value }))}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${
                      isSelected
                        ? proc.color === 'red'
                          ? 'bg-red-500/20 border-red-500 text-white'
                          : proc.color === 'green'
                          ? 'bg-green-500/20 border-green-500 text-white'
                          : proc.color === 'amber'
                          ? 'bg-amber-500/20 border-amber-500 text-white'
                          : 'bg-surface-raised border text-content'
                        : 'bg-surface border-subtle text-content-secondary hover:bg-surface hover:border'
                    }`}
                  >
                    <div className="mb-1"><proc.icon className="w-6 h-6 mx-auto" /></div>
                    <div className="font-medium text-sm">{proc.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{proc.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timing Sliders */}
          <div className="grid grid-cols-2 gap-4">
            <DraggableSlider
              label={t('parameters.SafetyTab.activationDelay')}
              value={failsafe.failsafeDelay}
              onChange={(v) => setFailsafe(prev => ({ ...prev, failsafeDelay: v }))}
              min={0}
              max={50}
              step={1}
              unit="×0.1s"
              color="#F59E0B"
              hint={t('parameters.SafetyTab.sBeforeFailsafeTriggers', { v1: (failsafe.failsafeDelay / 10).toFixed(1) })}
            />
            <DraggableSlider
              label={t('parameters.SafetyTab.recoveryDelay')}
              value={failsafe.failsafeOffDelay}
              onChange={(v) => setFailsafe(prev => ({ ...prev, failsafeOffDelay: v }))}
              min={0}
              max={200}
              step={1}
              unit="×0.1s"
              color="#10B981"
              hint={t('parameters.SafetyTab.sAfterSignalRecovery', { v1: (failsafe.failsafeOffDelay / 10).toFixed(1) })}
            />
          </div>

          <DraggableSlider
            label={t('parameters.SafetyTab.failsafeThrottle')}
            value={failsafe.failsafeThrottle}
            onChange={(v) => setFailsafe(prev => ({ ...prev, failsafeThrottle: v }))}
            min={1000}
            max={2000}
            step={10}
            unit="µs"
            color="#6366F1"
            hint={t('parameters.SafetyTab.throttleValueDuringLandDrop')}
          />

          {/* Min Distance for RTH */}
          {isInav && failsafe.failsafeProcedure === 2 && (
            <DraggableSlider
              label={t('parameters.SafetyTab.minimumRthDistance')}
              value={failsafe.failsafeMinDistance}
              onChange={(v) => setFailsafe(prev => ({ ...prev, failsafeMinDistance: v }))}
              min={0}
              max={1000}
              step={10}
              unit="m"
              color="#8B5CF6"
              hint={t('parameters.SafetyTab.distanceBelowWhichRthWonT')}
            />
          )}
        </div>
      </Section>

      {/* GPS Rescue Section (Betaflight only) */}
      {!isInav && (
        <Section
          title={t('parameters.SafetyTab.gpsRescueReturnToHome')}
          icon={<Home className="w-5 h-5 text-green-400" />}
          color="green"
          defaultOpen={false}
          badge={gpsRescueChanged || gpsPidsChanged ? t('parameters.SafetyTab.modified') : undefined}
          badgeColor="green"
        >
          <div className="mt-4 space-y-6">
            {/* Info Banner */}
            <div className="flex items-start gap-3 p-3 bg-blue-500/10 border-blue-500/20 rounded-lg">
              <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-200/80">
                {t('parameters.SafetyTab.gpsRescueAutomaticallyFliesYourQuad')} <strong>GPS_RESCUE</strong> {t('parameters.SafetyTab.modeInTheModesTabTo')}
              </p>
            </div>

            {/* Altitude & Speed */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-content flex items-center gap-2">
                  <ArrowUp className="w-4 h-4 text-blue-400" />
                  {t('parameters.SafetyTab.altitudeClimb')}
                </h4>
                <DraggableSlider
                  label={t('parameters.SafetyTab.rescueAltitude')}
                  value={gpsRescue.initialAltitudeM}
                  onChange={(v) => setGpsRescue(prev => ({ ...prev, initialAltitudeM: v }))}
                  min={20}
                  max={200}
                  step={5}
                  unit="m"
                  color="#3B82F6"
                />
                <div className="flex items-center gap-3">
                  <span className="text-sm text-content-secondary w-28">{t('parameters.SafetyTab.altitudeMode')}</span>
                  <select
                    value={gpsRescue.altitudeMode}
                    onChange={(e) => setGpsRescue(prev => ({ ...prev, altitudeMode: parseInt(e.target.value) }))}
                    className="flex-1 px-3 py-2 bg-surface-raised border rounded-lg text-content text-sm"
                  >
                    {ALTITUDE_MODES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <DraggableSlider
                  label={t('parameters.SafetyTab.ascendRate')}
                  value={gpsRescue.ascendRate}
                  onChange={(v) => setGpsRescue(prev => ({ ...prev, ascendRate: v }))}
                  min={100}
                  max={1000}
                  step={25}
                  unit="cm/s"
                  color="#6366F1"
                  hint={`${(gpsRescue.ascendRate / 100).toFixed(1)} m/s`}
                />
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-content flex items-center gap-2">
                  <ArrowDown className="w-4 h-4 text-orange-400" />
                  {t('parameters.SafetyTab.returnDescent')}
                </h4>
                <DraggableSlider
                  label={t('parameters.SafetyTab.returnSpeed')}
                  value={gpsRescue.rescueGroundspeed}
                  onChange={(v) => setGpsRescue(prev => ({ ...prev, rescueGroundspeed: v }))}
                  min={100}
                  max={3000}
                  step={50}
                  unit="cm/s"
                  color="#10B981"
                  hint={`${(gpsRescue.rescueGroundspeed / 100).toFixed(1)} m/s`}
                />
                <DraggableSlider
                  label={t('parameters.SafetyTab.descendRate')}
                  value={gpsRescue.descendRate}
                  onChange={(v) => setGpsRescue(prev => ({ ...prev, descendRate: v }))}
                  min={50}
                  max={500}
                  step={25}
                  unit="cm/s"
                  color="#8B5CF6"
                  hint={`${(gpsRescue.descendRate / 100).toFixed(1)} m/s`}
                />
                <DraggableSlider
                  label={t('parameters.SafetyTab.descentDistance')}
                  value={gpsRescue.descentDistanceM}
                  onChange={(v) => setGpsRescue(prev => ({ ...prev, descentDistanceM: v }))}
                  min={5}
                  max={100}
                  step={5}
                  unit="m"
                  color="#F59E0B"
                />
              </div>
            </div>

            {/* Throttle Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-content flex items-center gap-2">
                <Gauge className="w-4 h-4 text-orange-400" />
                {t('parameters.SafetyTab.throttleLimits')}
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <DraggableSlider
                  label={t('parameters.SafetyTab.min')}
                  value={gpsRescue.throttleMin}
                  onChange={(v) => setGpsRescue(prev => ({ ...prev, throttleMin: v }))}
                  min={1000}
                  max={1500}
                  step={10}
                  color="#EF4444"
                />
                <DraggableSlider
                  label={t('parameters.SafetyTab.hover')}
                  value={gpsRescue.throttleHover}
                  onChange={(v) => setGpsRescue(prev => ({ ...prev, throttleHover: v }))}
                  min={1000}
                  max={2000}
                  step={10}
                  color="#F59E0B"
                />
                <DraggableSlider
                  label={t('parameters.SafetyTab.max')}
                  value={gpsRescue.throttleMax}
                  onChange={(v) => setGpsRescue(prev => ({ ...prev, throttleMax: v }))}
                  min={1500}
                  max={2000}
                  step={10}
                  color="#22C55E"
                />
              </div>
            </div>

            {/* GPS & Safety */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-content flex items-center gap-2">
                  <Satellite className="w-4 h-4 text-cyan-400" />
                  {t('parameters.SafetyTab.gpsRequirements')}
                </h4>
                <DraggableSlider
                  label={t('parameters.SafetyTab.minSatellites')}
                  value={gpsRescue.minSats}
                  onChange={(v) => setGpsRescue(prev => ({ ...prev, minSats: v }))}
                  min={5}
                  max={20}
                  color="#06B6D4"
                />
                <DraggableSlider
                  label={t('parameters.SafetyTab.minDistance')}
                  value={gpsRescue.minRescueDth}
                  onChange={(v) => setGpsRescue(prev => ({ ...prev, minRescueDth: v }))}
                  min={10}
                  max={200}
                  step={5}
                  unit="m"
                  color="#8B5CF6"
                  hint={t('parameters.SafetyTab.rescueWonTActivateCloser')}
                />
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-content flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  {t('parameters.SafetyTab.safetyChecks')}
                </h4>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-content-secondary w-24">{t('parameters.SafetyTab.sanity')}</span>
                  <select
                    value={gpsRescue.sanityChecks}
                    onChange={(e) => setGpsRescue(prev => ({ ...prev, sanityChecks: parseInt(e.target.value) }))}
                    className="flex-1 px-3 py-2 bg-surface-raised border rounded-lg text-content text-sm"
                  >
                    {SANITY_CHECKS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setGpsRescue(prev => ({ ...prev, allowArmingWithoutFix: prev.allowArmingWithoutFix ? 0 : 1 }))}
                  className={`w-full px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all border ${
                    gpsRescue.allowArmingWithoutFix
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-surface-raised border text-content-secondary'
                  }`}
                >
                  {gpsRescue.allowArmingWithoutFix ? (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      {t('parameters.SafetyTab.armWithoutGpsFix')}
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      {t('parameters.SafetyTab.requireGpsFixToArm')}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Advanced PIDs Toggle */}
            <button
              onClick={() => setShowGpsPids(!showGpsPids)}
              className="w-full px-4 py-3 flex items-center justify-between bg-surface hover:bg-surface-raised rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-content">{t('parameters.SafetyTab.gpsRescuePids')}</span>
                <span className="text-xs text-content-secondary">{t('parameters.SafetyTab.advanced')}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-content-secondary transition-transform ${showGpsPids ? 'rotate-180' : ''}`} />
            </button>

            {showGpsPids && (
              <div className="grid grid-cols-3 gap-6 p-4 bg-surface-raised rounded-lg">
                <div className="space-y-3">
                  <h5 className="text-xs font-medium text-orange-400">{t('parameters.SafetyTab.throttle')}</h5>
                  <DraggableSlider label="P" value={gpsPids.throttleP} onChange={(v) => setGpsPids(prev => ({ ...prev, throttleP: v }))} min={0} max={200} color="#F97316" />
                  <DraggableSlider label="I" value={gpsPids.throttleI} onChange={(v) => setGpsPids(prev => ({ ...prev, throttleI: v }))} min={0} max={200} color="#FB923C" />
                  <DraggableSlider label="D" value={gpsPids.throttleD} onChange={(v) => setGpsPids(prev => ({ ...prev, throttleD: v }))} min={0} max={200} color="#FDBA74" />
                </div>
                <div className="space-y-3">
                  <h5 className="text-xs font-medium text-blue-400">{t('parameters.SafetyTab.velocity')}</h5>
                  <DraggableSlider label="P" value={gpsPids.velP} onChange={(v) => setGpsPids(prev => ({ ...prev, velP: v }))} min={0} max={200} color="#3B82F6" />
                  <DraggableSlider label="I" value={gpsPids.velI} onChange={(v) => setGpsPids(prev => ({ ...prev, velI: v }))} min={0} max={200} color="#60A5FA" />
                  <DraggableSlider label="D" value={gpsPids.velD} onChange={(v) => setGpsPids(prev => ({ ...prev, velD: v }))} min={0} max={200} color="#93C5FD" />
                </div>
                <div className="space-y-3">
                  <h5 className="text-xs font-medium text-green-400">{t('parameters.SafetyTab.yaw')}</h5>
                  <DraggableSlider label="P" value={gpsPids.yawP} onChange={(v) => setGpsPids(prev => ({ ...prev, yawP: v }))} min={0} max={200} color="#22C55E" />
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Receiver settings moved note */}
      {isInav && (
        <Section
          title={t('parameters.SafetyTab.armingSafety')}
          icon={<Radio className="w-5 h-5 text-purple-400" />}
          color="purple"
          defaultOpen={false}
          badge={armingChanged ? t('parameters.SafetyTab.modified') : undefined}
          badgeColor="purple"
        >
          <div className="mt-4 space-y-6">
            {/* Arming Safety */}
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-3">{t('parameters.SafetyTab.navigationArmingSafety')}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setArming(prev => ({ ...prev, navExtraArmingSafety: 'ON' }))}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    arming.navExtraArmingSafety === 'ON'
                      ? 'bg-green-500/20 border-green-500 text-white'
                      : 'bg-surface border-subtle text-content-secondary hover:bg-surface'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-5 h-5" />
                    <span className="font-medium">{t('parameters.SafetyTab.enabled')}</span>
                  </div>
                  <p className="text-xs opacity-70">{t('parameters.SafetyTab.requireGpsFixSafeConditionsTo')}</p>
                </button>
                <button
                  onClick={() => setArming(prev => ({ ...prev, navExtraArmingSafety: 'ALLOW_BYPASS' }))}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    arming.navExtraArmingSafety === 'ALLOW_BYPASS'
                      ? 'bg-amber-500/20 border-amber-500 text-white'
                      : 'bg-surface border-subtle text-content-secondary hover:bg-surface'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-5 h-5" />
                    <span className="font-medium">{t('parameters.SafetyTab.allowBypass')}</span>
                  </div>
                  <p className="text-xs opacity-70">{t('parameters.SafetyTab.canBypassWithStickCommandsSitl')}</p>
                </button>
              </div>
            </div>

            {arming.navExtraArmingSafety === 'ALLOW_BYPASS' && (
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200/80">
                  <strong>{t('parameters.SafetyTab.bypassMode')}</strong> {t('parameters.SafetyTab.stickCommandsCanOverrideSafetyChecks')}
                </p>
              </div>
            )}

            {/* GPS Satellites */}
            <DraggableSlider
              label={t('parameters.SafetyTab.minimumGpsSatellites')}
              value={arming.navGpsMinSats}
              onChange={(v) => setArming(prev => ({ ...prev, navGpsMinSats: v }))}
              min={0}
              max={12}
              color="#A855F7"
              hint={t('parameters.SafetyTab.requiredForArming0NoGps')}
            />

            <div className="flex items-start gap-3 p-3 bg-surface border-subtle rounded-lg">
              <Info className="w-4 h-4 text-content-secondary shrink-0 mt-0.5" />
              <p className="text-xs text-content-secondary">
                {t('parameters.SafetyTab.receiverTypeAndProtocolSettingsHave')} <strong className="text-content">{t('parameters.SafetyTab.receiver')}</strong> {t('parameters.SafetyTab.tab')}
              </p>
            </div>
          </div>
        </Section>
      )}

      {/* iNav Navigation Note */}
      {isInav && (
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border-blue-500/20 rounded-xl">
          <Home className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-300">{t('parameters.SafetyTab.returnToHome2')}</h4>
            <p className="text-sm text-blue-200/70 mt-1">
              {t('parameters.SafetyTab.inavSAdvancedNavigationFeaturesRth')}{' '}
              <strong>{t('parameters.SafetyTab.navigation')}</strong> {t('parameters.SafetyTab.tabTheFailsafeRthOptionAbove')}
            </p>
          </div>
        </div>
      )}

    </div>
  );
});

export default SafetyTab;
