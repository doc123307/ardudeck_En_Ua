/**
 * FlightModesTab
 *
 * Visual editor for ArduPilot flight mode configuration.
 * Shows 6 mode slots with dropdown selectors, PWM ranges, and live RC visualization.
 */

import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  Settings,
  Shield,
  TrendingUp,
  Map,
  Hand,
  Gamepad2,
  Ruler,
  Navigation,
  MapPin,
  Lock,
  Home,
  Circle,
  PlaneLanding,
  Wind,
  Dumbbell,
  RotateCcw,
  Wrench,
  Pin,
  Octagon,
  Rocket,
  Plane,
  Users,
  Zap,
  Move,
  AlertTriangle,
  HelpCircle,
  Activity,
  ToggleLeft,
  ToggleRight,
  Search,
  X,
  Check,
  Radio,
} from 'lucide-react';
import { useParameterStore } from '../../stores/parameter-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { useRcSignalStatus } from '../../hooks/useRcSignalStatus';
import { useEffectiveRc } from '../../stores/pseudo-tx-store';
import { useConnectionStore } from '../../stores/connection-store';

import { InfoCard } from '../ui/InfoCard';
import Px4FlightModesConfig from './Px4FlightModesConfig';
import { SwitchActionsSection } from './switches/SwitchActionsSection';
import { PresetSelector, type Preset } from '../ui/PresetSelector';
import {
  FLIGHT_MODE_PRESETS,
  PLANE_FLIGHT_MODE_PRESETS,
  type FlightModePreset,
} from './presets/mavlink-presets';
import { t } from '../../i18n';

// PWM ranges for each mode slot (standard 3-position switch mapping)
const MODE_PWM_RANGES = [
  { slot: 1, min: 900, max: 1230, get label() { return t('mavlink_config.FlightModesTab.position1Low'); }, position: 'low', group: 1 },
  { slot: 2, min: 1231, max: 1360, get label() { return t('mavlink_config.FlightModesTab.position2'); }, position: 'low', group: 1 },
  { slot: 3, min: 1361, max: 1490, get label() { return t('mavlink_config.FlightModesTab.position3Mid'); }, position: 'mid', group: 2 },
  { slot: 4, min: 1491, max: 1620, get label() { return t('mavlink_config.FlightModesTab.position4'); }, position: 'mid', group: 2 },
  { slot: 5, min: 1621, max: 1749, get label() { return t('mavlink_config.FlightModesTab.position5'); }, position: 'high', group: 3 },
  { slot: 6, min: 1750, max: 2100, get label() { return t('mavlink_config.FlightModesTab.position6High'); }, position: 'high', group: 3 },
];

// Switch position groupings (for 3-position switch), ordered top-to-bottom to match physical switch
const SWITCH_POSITIONS = [
  { name: 'High', get label() { return t('mavlink_config.FlightModesTab.switchUp'); }, slots: [5, 6], color: 'bg-orange-500' },
  { name: 'Mid', get label() { return t('mavlink_config.FlightModesTab.switchCenter'); }, slots: [3, 4], color: 'bg-purple-500' },
  { name: 'Low', get label() { return t('mavlink_config.FlightModesTab.switchDown'); }, slots: [1, 2], color: 'bg-blue-500' },
];

// Primary slots for simple mode (most commonly used with 3-position switch)
const PRIMARY_SLOTS = [1, 3, 6];

// AUX channel range for mode switch detection (CH5-CH12, 0-indexed: 4-11)
const AUX_START = 4;
const AUX_END = 12;
const DETECT_THRESHOLD = 150; // PWM movement to trigger detection

// ArduCopter flight modes with proper icons
const COPTER_MODES: Record<number, { name: string; description: string; icon: React.ElementType; safe: boolean }> = {
  0: { name: 'Stabilize', get description() { return t('mavlink_config.FlightModesTab.manualFlightWithSelfLeveling'); }, icon: Hand, safe: true },
  1: { name: 'Acro', get description() { return t('mavlink_config.FlightModesTab.fullManualControlNoSelfLeveling'); }, icon: Gamepad2, safe: false },
  2: { name: 'AltHold', get description() { return t('mavlink_config.FlightModesTab.altitudeHoldWithManualPosition'); }, icon: Ruler, safe: true },
  3: { name: 'Auto', get description() { return t('mavlink_config.FlightModesTab.followMissionWaypoints'); }, icon: Map, safe: true },
  4: { name: 'Guided', get description() { return t('mavlink_config.FlightModesTab.flyToGcsCommandedPoints'); }, icon: Navigation, safe: true },
  5: { name: 'Loiter', get description() { return t('mavlink_config.FlightModesTab.holdPositionAndAltitude'); }, icon: Lock, safe: true },
  6: { name: 'RTL', get description() { return t('mavlink_config.FlightModesTab.returnToLaunchPoint'); }, icon: Home, safe: true },
  7: { name: 'Circle', get description() { return t('mavlink_config.FlightModesTab.circleAroundAPoint'); }, icon: Circle, safe: true },
  9: { name: 'Land', get description() { return t('mavlink_config.FlightModesTab.automaticLanding'); }, icon: PlaneLanding, safe: true },
  11: { name: 'Drift', get description() { return t('mavlink_config.FlightModesTab.likeStabilizeButWithDrift'); }, icon: Wind, safe: false },
  13: { name: 'Sport', get description() { return t('mavlink_config.FlightModesTab.stabilizeWithHigherRates'); }, icon: Dumbbell, safe: false },
  14: { name: 'Flip', get description() { return t('mavlink_config.FlightModesTab.automaticFlipManeuver'); }, icon: RotateCcw, safe: false },
  15: { name: 'AutoTune', get description() { return t('mavlink_config.FlightModesTab.automaticPidTuning'); }, icon: Wrench, safe: true },
  16: { name: 'PosHold', get description() { return t('mavlink_config.FlightModesTab.positionHoldLikeLoiter'); }, icon: Pin, safe: true },
  17: { name: 'Brake', get description() { return t('mavlink_config.FlightModesTab.stopImmediately'); }, icon: Octagon, safe: true },
  18: { name: 'Throw', get description() { return t('mavlink_config.FlightModesTab.throwToStart'); }, icon: Rocket, safe: false },
  19: { name: 'Avoid_ADSB', get description() { return t('mavlink_config.FlightModesTab.avoidOtherAircraft'); }, icon: Plane, safe: true },
  20: { name: 'Guided_NoGPS', get description() { return t('mavlink_config.FlightModesTab.guidedWithoutGps'); }, icon: Navigation, safe: false },
  21: { name: 'Smart_RTL', get description() { return t('mavlink_config.FlightModesTab.returnViaOriginalPath'); }, icon: Home, safe: true },
  22: { name: 'FlowHold', get description() { return t('mavlink_config.FlightModesTab.positionHoldWithOpticalFlow'); }, icon: Move, safe: true },
  23: { name: 'Follow', get description() { return t('mavlink_config.FlightModesTab.followAnotherVehicle'); }, icon: Users, safe: true },
  24: { name: 'ZigZag', get description() { return t('mavlink_config.FlightModesTab.zigzagSurveyPattern'); }, icon: Zap, safe: true },
  25: { name: 'SystemID', get description() { return t('mavlink_config.FlightModesTab.systemIdentification'); }, icon: Activity, safe: false },
};

// ArduPlane flight modes with proper icons
const PLANE_MODES: Record<number, { name: string; description: string; icon: React.ElementType; safe: boolean }> = {
  0: { name: 'Manual', get description() { return t('mavlink_config.FlightModesTab.fullManualControl'); }, icon: Hand, safe: false },
  1: { name: 'Circle', get description() { return t('mavlink_config.FlightModesTab.circleAroundAPoint'); }, icon: Circle, safe: true },
  2: { name: 'Stabilize', get description() { return t('mavlink_config.FlightModesTab.levelFlightWithManualThrottle'); }, icon: Hand, safe: true },
  3: { name: 'Training', get description() { return t('mavlink_config.FlightModesTab.limitsRollPitchButAllowsRecovery'); }, icon: Dumbbell, safe: true },
  4: { name: 'Acro', get description() { return t('mavlink_config.FlightModesTab.rateControlledAerobatics'); }, icon: Gamepad2, safe: false },
  5: { name: 'FBWA', get description() { return t('mavlink_config.FlightModesTab.flyByWireAStabilizedManual'); }, icon: Plane, safe: true },
  6: { name: 'FBWB', get description() { return t('mavlink_config.FlightModesTab.flyByWireBSpeedAltitude'); }, icon: Plane, safe: true },
  7: { name: 'Cruise', get description() { return t('mavlink_config.FlightModesTab.throttleAndRollHoldHeadingAlt'); }, icon: Navigation, safe: true },
  8: { name: 'AutoTune', get description() { return t('mavlink_config.FlightModesTab.automaticPidTuning'); }, icon: Wrench, safe: true },
  10: { name: 'Auto', get description() { return t('mavlink_config.FlightModesTab.followMissionWaypoints'); }, icon: Map, safe: true },
  11: { name: 'RTL', get description() { return t('mavlink_config.FlightModesTab.returnToLaunchPoint'); }, icon: Home, safe: true },
  12: { name: 'Loiter', get description() { return t('mavlink_config.FlightModesTab.circleAndHoldPosition'); }, icon: Lock, safe: true },
  13: { name: 'Takeoff', get description() { return t('mavlink_config.FlightModesTab.automaticTakeoff'); }, icon: Rocket, safe: true },
  14: { name: 'Avoid_ADSB', get description() { return t('mavlink_config.FlightModesTab.avoidOtherAircraft'); }, icon: AlertTriangle, safe: true },
  15: { name: 'Guided', get description() { return t('mavlink_config.FlightModesTab.flyToGcsCommandedPoints'); }, icon: Navigation, safe: true },
  17: { name: 'QStabilize', get description() { return t('mavlink_config.FlightModesTab.vtolStabilizeMode'); }, icon: Hand, safe: true },
  18: { name: 'QHover', get description() { return t('mavlink_config.FlightModesTab.vtolHoverInPlace'); }, icon: Pin, safe: true },
  19: { name: 'QLoiter', get description() { return t('mavlink_config.FlightModesTab.vtolPositionHold'); }, icon: Lock, safe: true },
  20: { name: 'QLand', get description() { return t('mavlink_config.FlightModesTab.vtolAutomaticLanding'); }, icon: PlaneLanding, safe: true },
  21: { name: 'QRTL', get description() { return t('mavlink_config.FlightModesTab.vtolReturnToLaunch'); }, icon: Home, safe: true },
  22: { name: 'QAutotune', get description() { return t('mavlink_config.FlightModesTab.vtolAutomaticPidTuning'); }, icon: Wrench, safe: true },
  23: { name: 'QAcro', get description() { return t('mavlink_config.FlightModesTab.vtolRateControlledAerobatics'); }, icon: Gamepad2, safe: false },
  24: { name: 'Thermal', get description() { return t('mavlink_config.FlightModesTab.soaringThermalDetection'); }, icon: Wind, safe: true },
  25: { name: 'Loiter to QLand', get description() { return t('mavlink_config.FlightModesTab.loiterThenVtolLand'); }, icon: PlaneLanding, safe: true },
};

// ArduRover drive modes
const ROVER_MODES: Record<number, { name: string; description: string; icon: React.ElementType; safe: boolean }> = {
  0: { name: 'Manual', get description() { return t('mavlink_config.FlightModesTab.fullManualThrottleAndSteering'); }, icon: Hand, safe: true },
  1: { name: 'Acro', get description() { return t('mavlink_config.FlightModesTab.manualWithTurnRateControl'); }, icon: Gamepad2, safe: false },
  3: { name: 'Steering', get description() { return t('mavlink_config.FlightModesTab.manualSteeringSpeedControlled'); }, icon: Navigation, safe: true },
  4: { name: 'Hold', get description() { return t('mavlink_config.FlightModesTab.stopAndHoldPosition'); }, icon: Lock, safe: true },
  5: { name: 'Loiter', get description() { return t('mavlink_config.FlightModesTab.holdPositionUsingGps'); }, icon: Pin, safe: true },
  6: { name: 'Follow', get description() { return t('mavlink_config.FlightModesTab.followAnotherVehicle'); }, icon: Users, safe: true },
  7: { name: 'Simple', get description() { return t('mavlink_config.FlightModesTab.simplifiedControlRelativeToHome'); }, icon: Home, safe: true },
  10: { name: 'Auto', get description() { return t('mavlink_config.FlightModesTab.followMissionWaypoints'); }, icon: Map, safe: true },
  11: { name: 'RTL', get description() { return t('mavlink_config.FlightModesTab.returnToLaunchPoint'); }, icon: Home, safe: true },
  12: { name: 'Smart RTL', get description() { return t('mavlink_config.FlightModesTab.returnViaOriginalPath'); }, icon: Home, safe: true },
  15: { name: 'Guided', get description() { return t('mavlink_config.FlightModesTab.driveToGcsCommandedPoints'); }, icon: Navigation, safe: true },
  16: { name: 'Initialising', get description() { return t('mavlink_config.FlightModesTab.systemInitializing'); }, icon: Activity, safe: false },
};

// Convert FLIGHT_MODE_PRESETS to PresetSelector format
const COPTER_PRESET_SELECTOR: Record<string, Preset> = {
  beginner: {
    name: 'Beginner',
    description: FLIGHT_MODE_PRESETS.beginner!.description,
    icon: Shield,
    iconColor: 'text-green-400',
    color: 'from-green-500/20 to-emerald-500/10 border-green-500/30',
  },
  intermediate: {
    name: 'Intermediate',
    description: FLIGHT_MODE_PRESETS.intermediate!.description,
    icon: TrendingUp,
    iconColor: 'text-blue-400',
    color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
  },
  advanced: {
    name: 'Advanced',
    description: FLIGHT_MODE_PRESETS.advanced!.description,
    icon: Settings,
    iconColor: 'text-purple-400',
    color: 'from-purple-500/20 to-pink-500/10 border-purple-500/30',
  },
  mapping: {
    name: 'Mapping',
    description: FLIGHT_MODE_PRESETS.mapping!.description,
    icon: Map,
    iconColor: 'text-amber-400',
    color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30',
  },
};

const PLANE_PRESET_SELECTOR: Record<string, Preset> = {
  beginner: {
    name: 'Beginner',
    description: PLANE_FLIGHT_MODE_PRESETS.beginner!.description,
    icon: Shield,
    iconColor: 'text-green-400',
    color: 'from-green-500/20 to-emerald-500/10 border-green-500/30',
  },
  intermediate: {
    name: 'Intermediate',
    description: PLANE_FLIGHT_MODE_PRESETS.intermediate!.description,
    icon: TrendingUp,
    iconColor: 'text-blue-400',
    color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
  },
  advanced: {
    name: 'Advanced',
    description: PLANE_FLIGHT_MODE_PRESETS.advanced!.description,
    icon: Settings,
    iconColor: 'text-purple-400',
    color: 'from-purple-500/20 to-pink-500/10 border-purple-500/30',
  },
  vtol: {
    name: 'VTOL',
    description: PLANE_FLIGHT_MODE_PRESETS.vtol!.description,
    icon: Plane,
    iconColor: 'text-amber-400',
    color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30',
  },
};

type VehicleCategory = 'copter' | 'plane' | 'rover';

function getModesForCategory(category: VehicleCategory) {
  switch (category) {
    case 'plane': return PLANE_MODES;
    case 'rover': return ROVER_MODES;
    default: return COPTER_MODES;
  }
}

function getModeInfo(modeNum: number, category: VehicleCategory = 'copter') {
  const modes = getModesForCategory(category);
  return modes[modeNum] ?? { name: 'Unknown', description: t('mavlink_config.FlightModesTab.unknownMode'), icon: HelpCircle, safe: false };
}

interface FlightModesTabProps {
  vehicleCategory?: VehicleCategory;
}

const FlightModesTab: React.FC<FlightModesTabProps> = ({ vehicleCategory = 'copter' }) => {
  const isRover = vehicleCategory === 'rover';
  const firmware = useConnectionStore((s) => s.connectionState.firmware);
  const { parameters, setParameter, modifiedCount } = useParameterStore();

  // ArduPilot Rover (incl. boats) uses MODE_CH/MODE1-6; Copter/Plane use FLTMODE_CH/FLTMODE1-6.
  const paramPrefix = useMemo(() => {
    if (vehicleCategory === 'rover') return 'MODE';
    if (parameters.has('MODE1')) return 'MODE';
    return 'FLTMODE';
  }, [parameters, vehicleCategory]);

  // --- Live RC from telemetry store (same pattern as ReceiverTab) ---
  const rcChannels = useTelemetryStore((s) => s.rcChannels);

  const [advancedMode, setAdvancedMode] = useState<boolean>(
    () => useSettingsStore.getState().uiVisibility.defaultAdvancedViews
  );
  const [detectMode, setDetectMode] = useState(false);
  const [detectedChannel, setDetectedChannel] = useState<number | null>(null);

  const signalStatus = useRcSignalStatus();

  // Channel baseline for active detection
  const [channelBaseline, setChannelBaseline] = useState<number[]>([]);

  useEffect(() => {
    if (channelBaseline.length === 0 && rcChannels.channels.length > 0) {
      setChannelBaseline([...rcChannels.channels]);
      return;
    }
    if (channelBaseline.length > 0 && !detectMode) {
      // Update baseline slowly when not detecting (for general active display)
      // No-op: baseline stays from initial capture
    }
  }, [rcChannels.channels, channelBaseline.length, detectMode]);

  // Detect-mode baseline: snapshot when entering detect mode
  const detectBaseline = useRef<number[]>([]);

  const startDetect = useCallback(() => {
    setDetectMode(true);
    setDetectedChannel(null);
    detectBaseline.current = [...rcChannels.channels];
  }, [rcChannels.channels]);

  const cancelDetect = useCallback(() => {
    setDetectMode(false);
    setDetectedChannel(null);
  }, []);

  const confirmDetect = useCallback((ch: number) => {
    setParameter(`${paramPrefix}_CH`, ch);
    setDetectMode(false);
    setDetectedChannel(null);
  }, [setParameter, paramPrefix]);

  // Auto-detect channel movement during detect mode
  useEffect(() => {
    if (!detectMode || detectBaseline.current.length === 0) return;
    for (let i = AUX_START; i < Math.min(AUX_END, rcChannels.channels.length); i++) {
      const current = rcChannels.channels[i];
      const base = detectBaseline.current[i];
      if (current !== undefined && base !== undefined && Math.abs(current - base) > DETECT_THRESHOLD) {
        setDetectedChannel(i + 1); // 1-based channel number
        return;
      }
    }
  }, [detectMode, rcChannels.channels]);

  // Get current flight mode values
  const flightModes = useMemo(() => {
    const modes: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const param = parameters.get(`${paramPrefix}${i}`);
      modes.push(param?.value ?? 0);
    }
    return modes;
  }, [parameters, paramPrefix]);

  // Get mode channel
  const modeChannel = useMemo(() => {
    const param = parameters.get(`${paramPrefix}_CH`);
    return param?.value ?? 5;
  }, [parameters, paramPrefix]);

  // Live RC value for the mode channel. Accepts the USB handset stand-in as a source, which
  // is what lets flight modes be set up and verified with no FC and no receiver attached:
  // flick the switch, watch the highlighted slot move.
  const effRc = useEffectiveRc(rcChannels);
  const rcUsable = effRc.source === 'pseudo' || signalStatus === 'active';
  const liveRcValue = useMemo(() => {
    const usable = effRc.source === 'pseudo' || signalStatus === 'active';
    if (!usable || effRc.channels.length === 0) return null;
    const idx = modeChannel - 1;
    return effRc.channels[idx] ?? null;
  }, [effRc.channels, effRc.source, modeChannel, signalStatus]);

  // Determine which mode slot is currently active
  const activeSlot = useMemo(() => {
    if (liveRcValue === null) return null;
    for (const range of MODE_PWM_RANGES) {
      if (liveRcValue >= range.min && liveRcValue <= range.max) {
        return range.slot;
      }
    }
    return null;
  }, [liveRcValue]);

  // Handle mode change
  const handleModeChange = (slot: number, modeNum: number) => {
    setParameter(`${paramPrefix}${slot}`, modeNum);
  };

  // Handle channel change
  const handleChannelChange = (channel: number) => {
    setParameter(`${paramPrefix}_CH`, channel);
  };

  // Get presets for current vehicle category
  const presetData = vehicleCategory === 'plane' ? PLANE_FLIGHT_MODE_PRESETS : FLIGHT_MODE_PRESETS;
  const presetSelectorPresets = vehicleCategory === 'plane' ? PLANE_PRESET_SELECTOR : COPTER_PRESET_SELECTOR;

  // Apply preset
  const applyPreset = (presetKey: string) => {
    const preset = presetData[presetKey];
    if (preset) {
      preset.modes.forEach((mode, index) => {
        setParameter(`${paramPrefix}${index + 1}`, mode);
      });
    }
  };

  const modified = modifiedCount();

  if (firmware === 'px4') {
    return <Px4FlightModesConfig />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with View Mode Toggle */}
      <div className="flex items-center justify-between">
        <InfoCard title={isRover ? t('mavlink_config.FlightModesTab.driveModeConfiguration') : vehicleCategory === 'plane' ? t('mavlink_config.FlightModesTab.planeModeConfiguration') : t('mavlink_config.FlightModesTab.flightModeConfiguration')} variant="info" className="flex-1">
          {advancedMode
            ? t('mavlink_config.FlightModesTab.configureAll6ModeSlotsFor')
            : t('mavlink_config.FlightModesTab.configureThe3PrimarySwitchPositions')}
        </InfoCard>
        <button
          onClick={() => setAdvancedMode(!advancedMode)}
          className={`ml-4 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            advancedMode
              ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
              : 'bg-surface-raised text-content-secondary border border-subtle'
          }`}
        >
          {advancedMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          {advancedMode ? t('mavlink_config.FlightModesTab.advanced') : t('mavlink_config.FlightModesTab.simple')}
        </button>
      </div>

      {/* Mode Switch Channel, with auto-detect */}
      <div className="bg-surface rounded-xl border border-subtle p-4">
        {!detectMode ? (
          /* Default state: dropdown + detect button */
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-content">{t('mavlink_config.FlightModesTab.modeSwitchChannel')}</h3>
              <p className="text-xs text-content-secondary mt-0.5">{t('mavlink_config.FlightModesTab.whichRcChannelControls')} {isRover ? t('mavlink_config.FlightModesTab.driveModes') : t('mavlink_config.FlightModesTab.flightModes')}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={modeChannel}
                onChange={(e) => handleChannelChange(Number(e.target.value))}
                className="px-3 py-2 bg-surface-raised border border-subtle rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
              >
                {[5, 6, 7, 8, 9, 10, 11, 12].map((ch) => (
                  <option key={ch} value={ch}>
                    {t('mavlink_config.FlightModesTab.channel')} {ch}
                  </option>
                ))}
              </select>
              <button
                onClick={startDetect}
                disabled={!rcUsable}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  rcUsable
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30'
                    : 'bg-surface-raised text-content-tertiary border border-subtle cursor-not-allowed'
                }`}
                title={signalStatus !== 'active' ? t('mavlink_config.FlightModesTab.connectToVehicleToUseAuto') : t('mavlink_config.FlightModesTab.autoDetectModeSwitchChannel')}
              >
                <Search className="w-3.5 h-3.5" />
                {t('mavlink_config.FlightModesTab.detect')}
              </button>
            </div>
          </div>
        ) : (
          /* Detect mode: channel bars + instruction */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-cyan-300">{t('mavlink_config.FlightModesTab.detectingModeSwitchChannel')}</h3>
                <p className="text-xs text-content-secondary mt-0.5">
                  {detectedChannel
                    ? t('mavlink_config.FlightModesTab.channelDetectedUseThisChannel', { detectedChannel })
                    : t('mavlink_config.FlightModesTab.flipYourModeSwitchOnYour')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {detectedChannel && (
                  <button
                    onClick={() => confirmDetect(detectedChannel)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t('mavlink_config.FlightModesTab.useCh')}{detectedChannel}
                  </button>
                )}
                <button
                  onClick={cancelDetect}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-surface-raised text-content-secondary border border-subtle hover:bg-surface transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  {t('mavlink_config.FlightModesTab.cancel')}
                </button>
              </div>
            </div>

            {/* AUX channel bars (CH5-CH12) */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {Array.from({ length: Math.min(AUX_END - AUX_START, rcChannels.channels.length - AUX_START) }, (_, i) => {
                const idx = AUX_START + i;
                const value = rcChannels.channels[idx] ?? 1500;
                const chNum = idx + 1;
                const isDetected = detectedChannel === chNum;
                const base = detectBaseline.current[idx] ?? 1500;
                const movement = Math.abs(value - base);
                const percent = Math.min(100, Math.max(0, ((value - 900) / 1200) * 100));

                return (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] ${isDetected ? 'text-green-400 font-medium' : 'text-content-secondary'}`}>
                        CH{chNum}
                        {isDetected && ' - Detected'}
                      </span>
                      <span className={`text-[10px] font-mono ${isDetected ? 'text-green-400' : 'text-content-tertiary'}`}>{value}</span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden relative ${isDetected ? 'bg-green-500/20' : 'bg-surface-raised'}`}>
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-surface-raised" />
                      <div
                        className={`absolute top-0 bottom-0 w-1.5 rounded-full transition-all ${
                          isDetected ? 'bg-green-500' : movement > 50 ? 'bg-cyan-500' : 'bg-zinc-600'
                        }`}
                        style={{ left: `calc(${percent}% - 3px)` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick Presets. Hidden for rovers: the presets contain copter/plane mode numbers
          which are wrong for the rover mode table. */}
      {!isRover && (
        <PresetSelector
          presets={presetSelectorPresets}
          onApply={applyPreset}
          label={t('mavlink_config.FlightModesTab.quickPresets')}
          hint={t('mavlink_config.FlightModesTab.clickToApplyAModeConfiguration')}
        />
      )}

      {/* Visual Switch Position Diagram */}
      <div className="bg-surface rounded-xl border border-subtle p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-content">{t('mavlink_config.FlightModesTab.switchPositionDiagram')}</h3>
          {signalStatus === 'active' ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="text-[10px] text-content-tertiary">{t('mavlink_config.FlightModesTab.connectToSeeLiveData')}</span>
          )}
        </div>
        <div className="flex items-center justify-center gap-8">
          {/* Physical switch representation */}
          <div className="flex flex-col items-center">
            {advancedMode ? (
              /* 6-position switch */
              <div className="w-12 h-48 bg-surface-raised rounded-lg relative border border-subtle">
                {MODE_PWM_RANGES.map((range, i) => {
                  const topPercent = 8 + i * (84 / 5); // Distribute 6 markers evenly
                  const slotColor = i <= 1 ? 'bg-blue-500' : i <= 3 ? 'bg-purple-500' : 'bg-orange-500';
                  return (
                    <div key={range.slot} className={`absolute left-1/2 -translate-x-1/2 w-8 h-1 ${slotColor} rounded`} style={{ top: `${100 - topPercent}%` }} />
                  );
                })}
                {activeSlot && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/50 transition-all duration-300"
                    style={{ top: `${100 - (8 + (activeSlot - 1) * (84 / 5))}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                  />
                )}
              </div>
            ) : (
              /* 3-position switch */
              <div className="w-12 h-32 bg-surface-raised rounded-lg relative border border-subtle">
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-orange-500 rounded" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1 bg-purple-500 rounded" />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded" />
                {activeSlot && (
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/50 transition-all duration-300 ${
                      activeSlot <= 2 ? 'bottom-1' : activeSlot <= 4 ? 'top-1/2 -translate-y-1/2' : 'top-1'
                    }`}
                  />
                )}
              </div>
            )}
            <span className="text-xs text-content-secondary mt-2">{t('mavlink_config.FlightModesTab.modeSwitch')}</span>
          </div>

          {/* Position to modes mapping */}
          <div className="flex-1 space-y-2">
            {advancedMode ? (
              /* 6-position: show all individual slots */
              [...MODE_PWM_RANGES].reverse().map((range) => {
                const isSlotActive = activeSlot === range.slot;
                const modeInfo = getModeInfo(flightModes[range.slot - 1] ?? 0, vehicleCategory);
                const IconComponent = modeInfo.icon;
                const positionInfo = SWITCH_POSITIONS.find(p => p.slots.includes(range.slot));
                const dotColor = positionInfo?.color ?? 'bg-zinc-500';

                return (
                  <div
                    key={range.slot}
                    className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                      isSlotActive
                        ? 'bg-cyan-500/10 border-cyan-500/30'
                        : 'bg-surface-raised border-transparent'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                    <div className="w-20">
                      <div className={`text-sm font-medium ${isSlotActive ? 'text-cyan-400' : 'text-content'}`}>
                        {t('mavlink_config.FlightModesTab.slot')} {range.slot}
                      </div>
                      <div className="text-[10px] text-content-secondary font-mono">{range.min}-{range.max}</div>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isSlotActive ? 'bg-cyan-500/20' : 'bg-surface-raised'
                      }`}>
                        <IconComponent className={`w-3.5 h-3.5 ${isSlotActive ? 'text-cyan-400' : 'text-content-secondary'}`} />
                      </div>
                      <span className={`text-sm ${isSlotActive ? 'text-cyan-300' : 'text-content-secondary'}`}>
                        {modeInfo.name}
                      </span>
                    </div>
                    {isSlotActive && liveRcValue !== null && (
                      <span className="text-xs font-mono text-cyan-400/70">{liveRcValue}</span>
                    )}
                  </div>
                );
              })
            ) : (
              /* 3-position: grouped by switch position */
              SWITCH_POSITIONS.map((pos) => {
                const isPositionActive = activeSlot !== null && pos.slots.includes(activeSlot);
                const primarySlot = pos.name === 'High' ? 6 : pos.name === 'Mid' ? 3 : 1;
                const modeInfo = getModeInfo(flightModes[primarySlot - 1] ?? 0, vehicleCategory);
                const IconComponent = modeInfo.icon;

                return (
                  <div
                    key={pos.name}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      isPositionActive
                        ? 'bg-cyan-500/10 border-cyan-500/30'
                        : 'bg-surface-raised border-transparent'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${pos.color}`} />
                    <div className="w-16">
                      <div className={`text-sm font-medium ${isPositionActive ? 'text-cyan-400' : 'text-content'}`}>
                        {pos.name}
                      </div>
                      <div className="text-[10px] text-content-secondary">{pos.label}</div>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isPositionActive ? 'bg-cyan-500/20' : 'bg-surface-raised'
                      }`}>
                        <IconComponent className={`w-4 h-4 ${isPositionActive ? 'text-cyan-400' : 'text-content-secondary'}`} />
                      </div>
                      <span className={`text-sm ${isPositionActive ? 'text-cyan-300' : 'text-content-secondary'}`}>
                        {modeInfo.name}
                      </span>
                    </div>
                    {isPositionActive && liveRcValue !== null && (
                      <span className="text-xs font-mono text-cyan-400/70">{liveRcValue}</span>
                    )}
                    <span className="text-xs text-content-tertiary">
                      {t('mavlink_config.FlightModesTab.slots')} {pos.slots.join(', ')}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Mode Slots - Simple Mode (Primary 3 positions) */}
      {!advancedMode && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-content">{isRover ? t('mavlink_config.FlightModesTab.drive') : t('mavlink_config.FlightModesTab.flight')} {t('mavlink_config.FlightModesTab.modes3PositionSwitch')}</h3>
          <div className="grid grid-cols-3 gap-4">
            {SWITCH_POSITIONS.map((pos) => {
              const primarySlot = pos.name === 'High' ? 6 : pos.name === 'Mid' ? 3 : 1;
              const currentMode = flightModes[primarySlot - 1] ?? 0;
              const modeInfo = getModeInfo(currentMode, vehicleCategory);
              const isSafe = modeInfo.safe;
              const isActive = activeSlot !== null && pos.slots.includes(activeSlot);
              const IconComponent = modeInfo.icon;

              return (
                <div
                  key={pos.name}
                  className={`bg-surface rounded-xl border p-4 space-y-3 transition-all ${
                    isActive
                      ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                      : 'border-subtle'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isActive ? 'bg-cyan-500/20' : isSafe ? 'bg-green-500/20' : 'bg-orange-500/20'
                    }`}>
                      <IconComponent className={`w-5 h-5 ${
                        isActive ? 'text-cyan-400' : isSafe ? 'text-green-400' : 'text-orange-400'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${pos.color}`} />
                        <span className="text-sm font-medium text-content">{pos.name}</span>
                      </div>
                      <div className="text-xs text-content-secondary">{pos.label}</div>
                    </div>
                    {isActive && (
                      <span className="ml-auto px-2 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-400 rounded-full">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  {/* Mode Selector */}
                  <select
                    value={currentMode}
                    onChange={(e) => {
                      const newMode = Number(e.target.value);
                      // Set both slots in this position group
                      pos.slots.forEach(slot => handleModeChange(slot, newMode));
                    }}
                    className="w-full px-3 py-2.5 bg-surface-input border border-subtle rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(getModesForCategory(vehicleCategory)).map(([num, mode]) => (
                      <option key={num} value={num}>
                        {mode.name} {!mode.safe ? t('mavlink_config.FlightModesTab.advanced2') : ''}
                      </option>
                    ))}
                  </select>

                  {/* Mode Description */}
                  <p className="text-xs text-content-secondary">{modeInfo.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode Slots - Advanced Mode (All 6 slots) */}
      {advancedMode && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-content">{isRover ? t('mavlink_config.FlightModesTab.drive') : t('mavlink_config.FlightModesTab.flight')} {t('mavlink_config.FlightModesTab.modeSlotsAll6')}</h3>
          <div className="grid grid-cols-2 gap-4">
            {MODE_PWM_RANGES.map((range) => {
              const currentMode = flightModes[range.slot - 1] ?? 0;
              const modeInfo = getModeInfo(currentMode, vehicleCategory);
              const isSafe = modeInfo.safe;
              const isActive = activeSlot === range.slot;
              const IconComponent = modeInfo.icon;
              const positionInfo = SWITCH_POSITIONS.find(p => p.slots.includes(range.slot));

              return (
                <div
                  key={range.slot}
                  className={`bg-surface rounded-xl border p-4 space-y-3 transition-all ${
                    isActive
                      ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                      : 'border-subtle'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isActive ? 'bg-cyan-500/20' : isSafe ? 'bg-green-500/20' : 'bg-orange-500/20'
                      }`}>
                        <IconComponent className={`w-5 h-5 ${
                          isActive ? 'text-cyan-400' : isSafe ? 'text-green-400' : 'text-orange-400'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-content">{t('mavlink_config.FlightModesTab.slot')} {range.slot}</span>
                          {positionInfo && (
                            <span className={`w-2 h-2 rounded-full ${positionInfo.color}`} />
                          )}
                        </div>
                        <div className="text-xs text-content-secondary">{range.label}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <span className="px-2 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-400 rounded-full">
                          ACTIVE
                        </span>
                      )}
                      {!isSafe && (
                        <span className="px-2 py-0.5 text-[10px] bg-orange-500/20 text-orange-400 rounded-full">
                          {t('mavlink_config.FlightModesTab.advanced')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* PWM Range Indicator */}
                  <div className="relative h-2 bg-surface-inset rounded-full overflow-hidden">
                    <div
                      className={`absolute h-full rounded-full ${
                        isActive ? 'bg-cyan-500' : 'bg-gradient-to-r from-blue-500 to-blue-400'
                      }`}
                      style={{
                        left: `${((range.min - 900) / 1200) * 100}%`,
                        width: `${((range.max - range.min) / 1200) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-content-secondary font-mono">
                    <span>{range.min}</span>
                    <span>{range.max}</span>
                  </div>

                  {/* Mode Selector */}
                  <select
                    value={currentMode}
                    onChange={(e) => handleModeChange(range.slot, Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-surface-input border border-subtle rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(getModesForCategory(vehicleCategory)).map(([num, mode]) => (
                      <option key={num} value={num}>
                        {mode.name} {!mode.safe ? t('mavlink_config.FlightModesTab.advanced2') : ''}
                      </option>
                    ))}
                  </select>

                  {/* Mode Description */}
                  <p className="text-xs text-content-secondary">{modeInfo.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Save Reminder */}
      {modified > 0 && (
        <div className="bg-amber-500/10 rounded-xl border border-amber-500/30 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <p className="text-sm text-amber-400">
            {t('mavlink_config.FlightModesTab.youHaveUnsavedChangesClick')} <span className="font-medium">{t('mavlink_config.FlightModesTab.saveAllChanges')}</span> {t('mavlink_config.FlightModesTab.inTheHeaderToSave')}
          </p>
        </div>
      )}

      {/* Mode Reference */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-content">{t('mavlink_config.FlightModesTab.modeReference')}</h3>
        <div className="bg-surface rounded-xl border border-subtle p-4">
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(getModesForCategory(vehicleCategory))
              .filter(([, mode]) => mode.safe)
              .map(([num, mode]) => {
                const IconComponent = mode.icon;
                return (
                  <div key={num} className="flex items-center gap-2 text-sm">
                    <IconComponent className="w-4 h-4 text-content-secondary" />
                    <span className="text-content">{mode.name}</span>
                    <span className="text-content-tertiary">-</span>
                    <span className="text-xs text-content-secondary truncate">{mode.description}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <SwitchActionsSection />
    </div>
  );
};

export default FlightModesTab;
