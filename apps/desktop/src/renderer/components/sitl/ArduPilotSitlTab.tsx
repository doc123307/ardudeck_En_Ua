/**
 * ArduPilot SITL Tab
 *
 * Configuration and control panel for ArduPilot SITL simulator.
 */

import { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { DraftNumberInput } from '../../hooks/useNumericDraft';
import { useArduPilotSitlStore, ARDUPILOT_MODELS } from '../../stores/ardupilot-sitl-store';
import { useConnectionStore } from '../../stores/connection-store';
import { useSettingsStore } from '../../stores/settings-store';
import type { VirtualRCState, ArduPilotVehicleType, ArduPilotReleaseTrack, ArduPilotFrameInfo, SwarmFormation, SwarmInstanceState } from '../../../shared/ipc-channels';
import { getIpLocation } from '../../utils/ip-geolocation';
import { getElevation } from '../../utils/elevation-api';
import { MapPointPickerDialog } from '../map/MapPointPickerDialog';
import SitlEnvironmentPanel from './SitlEnvironmentPanel';
import SitlFailurePanel from './SitlFailurePanel';
import { CustomFramePanel } from './CustomFramePanel';
import { PseudoTxSwitch } from '../PseudoTxSwitch';
import { usePseudoTxStore } from '../../stores/pseudo-tx-store';
import { useSwarmSitlStore } from '../../stores/swarm-sitl-store';
import {
  altitudeValueFromMeters,
  toMetersFromAltitudeUnit,
  UNIT_LABELS,
} from '../../../shared/user-units.js';
import { TrainerQuickAction } from '../trainer/TrainerQuickAction';
import { t, ago, justNow } from '../../i18n';

const VEHICLE_TYPE_OPTIONS: Array<{ value: ArduPilotVehicleType; label: string; icon: string }> = [
  { value: 'copter', get label() { return t('sitl.ArduPilotSitlTab.copter'); }, icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { value: 'plane', get label() { return t('sitl.ArduPilotSitlTab.plane'); }, icon: 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z' },
  { value: 'rover', get label() { return t('sitl.ArduPilotSitlTab.rover'); }, icon: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z' },
  { value: 'sub', get label() { return t('sitl.ArduPilotSitlTab.sub'); }, icon: 'M11 19v-4H9.5C7.01 15 5 12.99 5 10.5S7.01 6 9.5 6h5C17.99 6 20 8.01 20 10.5S17.99 15 15.5 15H14v4h-3z' },
];

// One-click home presets for the in-app simulator. CMAC is ArduPilot's canonical
// SITL home (Canberra Model Aircraft Club); the rest are well-known open spaces.
const HOME_PRESETS: Array<{ name: string; lat: number; lng: number; alt: number; heading: number }> = [
  { name: 'CMAC (default)', lat: -35.3632621, lng: 149.1652374, alt: 584, heading: 353 },
  { name: 'SF Bay', lat: 37.7749, lng: -122.4194, alt: 0, heading: 270 },
  { name: 'Nevada Desert', lat: 39.5296, lng: -119.8138, alt: 1370, heading: 0 },
  { name: 'Swiss Alps', lat: 46.5197, lng: 7.9628, alt: 1800, heading: 90 },
];

const RELEASE_TRACK_OPTIONS: Array<{ value: ArduPilotReleaseTrack; label: string; description: string }> = [
  { value: 'stable', get label() { return t('sitl.ArduPilotSitlTab.stable'); }, get description() { return t('sitl.ArduPilotSitlTab.recommendedForMostUsers'); } },
  { value: 'beta', get label() { return t('sitl.ArduPilotSitlTab.beta'); }, get description() { return t('sitl.ArduPilotSitlTab.releaseCandidatesAndTesting'); } },
  { value: 'dev', get label() { return t('sitl.ArduPilotSitlTab.dev'); }, get description() { return t('sitl.ArduPilotSitlTab.latestDevelopmentBuilds'); } },
];

const SWARM_FORMATIONS: Array<{ value: SwarmFormation; label: string }> = [
  { value: 'grid', get label() { return t('sitl.ArduPilotSitlTab.grid'); } },
  { value: 'line', get label() { return t('sitl.ArduPilotSitlTab.line'); } },
  { value: 'circle', get label() { return t('sitl.ArduPilotSitlTab.circle'); } },
];

const SWARM_STATE_STYLE: Record<SwarmInstanceState, { dot: string; label: string }> = {
  spawning: { dot: 'bg-amber-400 animate-pulse', label: 'spawning' },
  ready: { dot: 'bg-emerald-400', label: 'ready' },
  exited: { dot: 'bg-content-tertiary', label: 'exited' },
  error: { dot: 'bg-rose-400', label: 'error' },
};

export default function ArduPilotSitlTab() {
  const {
    platformSupported,
    platformError,
    isRunning,
    isStarting,
    isStopping,
    isStatusChecked,
    isDownloading,
    downloadProgress,
    binaryInfo,
    output,
    vehicleType,
    model,
    releaseTrack,
    homeLocation,
    speedup,
    wipeOnStart,
    lastCommand,
    lastError,
    isRcSending,
    rcState,
    framesLoading,
    framesCatalog,
    crashRecovery,
    start,
    stop,
    download,
    checkBinary,
    clearOutput,
    setVehicleType,
    setModel,
    setReleaseTrack,
    setHomeLocation,
    setSpeedup,
    setWipeOnStart,
    useArduDeckSim,
    setUseArduDeckSim,
    startRcSender,
    stopRcSender,
    setRcState,
    resetRcState,
    initListeners,
    checkStatus,
    loadFrames,
    refreshFrames,
    acceptCrashRecovery,
    dismissCrashRecovery,
    flightGearInstalled,
    flightGearRunning,
    flightGearStarting,
    flightGearError,
    launchFlightGear,
    stopFlightGear,
    browseFlightGear,
  } = useArduPilotSitlStore();

  const {
    count: swarmCount,
    spacingM: swarmSpacing,
    formation: swarmFormation,
    isRunning: swarmRunning,
    isStarting: swarmStarting,
    isStopping: swarmStopping,
    instances: swarmInstances,
    lastError: swarmError,
    setCount: setSwarmCount,
    setSpacingM: setSwarmSpacing,
    setFormation: setSwarmFormation,
    start: startSwarm,
    stop: stopSwarm,
    initListeners: initSwarmListeners,
    refreshStatus: refreshSwarmStatus,
  } = useSwarmSitlStore();

  // Run mode: a single vehicle, or a swarm fleet. Both share the airframe/home
  // config above; they're mutually exclusive at runtime (same base port).
  const [runMode, setRunMode] = useState<'single' | 'swarm'>('single');

  // A USB handset overwrites the RC state at 50Hz, so while it is live the sliders below are
  // inert - saying so beats letting someone drag a control that cannot win.
  const txLive = usePseudoTxStore((s) => s.enabled && s.connected);

  const { connectionState } = useConnectionStore();
  const { setPendingSitlSwitch, unitPreferences } = useSettingsStore();
  const altitudeUnit = unitPreferences.altitude;
  const homeAltitudeDisplay = altitudeValueFromMeters(homeLocation.alt, altitudeUnit);
  const [homeAltitudeDraft, setHomeAltitudeDraft] = useState(() => String(Number(homeAltitudeDisplay.toFixed(altitudeUnit === 'km' ? 3 : 1))));
  // Editable drafts for the swarm number inputs so the field can be cleared and
  // retyped freely; the store's hard clamp only applies on blur, not per keystroke.
  const [swarmCountDraft, setSwarmCountDraft] = useState(String(swarmCount));
  const [swarmSpacingDraft, setSwarmSpacingDraft] = useState(String(swarmSpacing));
  useEffect(() => { setSwarmCountDraft(String(swarmCount)); }, [swarmCount]);
  useEffect(() => { setSwarmSpacingDraft(String(swarmSpacing)); }, [swarmSpacing]);
  const outputRef = useRef<HTMLDivElement>(null);

  // Geolocation state
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [homeAltitudeFocused, setHomeAltitudeFocused] = useState(false);
  const [isMatchingTerrain, setIsMatchingTerrain] = useState(false);

  useEffect(() => {
    if (!homeAltitudeFocused) {
      setHomeAltitudeDraft(String(Number(homeAltitudeDisplay.toFixed(altitudeUnit === 'km' ? 3 : 1))));
    }
  }, [altitudeUnit, homeAltitudeDisplay, homeAltitudeFocused]);

  // Resolve the user's approximate location via the shared fallback chain:
  // IP geolocation (no permission needed) → browser geolocation → default.
  // Matches the behaviour used elsewhere in the app (map, telemetry).
  //
  // SITL's ground is a flat plane at this altitude (AMSL); FlightGear's viewer
  // renders that same absolute altitude against its OWN real-world terrain
  // (TerraSync). If the two don't match, the vehicle looks like it is floating
  // or buried even though it is correctly resting on SITL's ground. We close
  // that gap by looking up the real elevation for the new location (Open-Meteo,
  // the same DEM source the survey/terrain-follow tooling already uses) and
  // using it as the home altitude, so both "ground truths" agree.
  const getCurrentLocation = useCallback(async () => {
    setIsGettingLocation(true);
    setLocationError(null);
    try {
      const loc = await getIpLocation();
      if (loc.source === 'default') {
        setLocationError(t('sitl.ArduPilotSitlTab.unableToDetermineLocation'));
        return;
      }
      const lat = Math.round(loc.lat * 10000) / 10000;
      const lng = Math.round(loc.lon * 10000) / 10000;
      const elevation = await getElevation(lat, lng).catch(() => null);
      setHomeLocation({
        lat,
        lng,
        // Prefer the real ground elevation at the new location; if the lookup
        // fails, preserve the previous alt rather than coercing to 0/10 (0 is a
        // valid "ground" value, and a nonzero fallback spawns planes airborne).
        alt: elevation ?? homeLocation.alt,
        heading: homeLocation.heading,
      });
    } catch {
      setLocationError(t('sitl.ArduPilotSitlTab.unableToGetLocation'));
    } finally {
      setIsGettingLocation(false);
    }
  }, [setHomeLocation, homeLocation.alt, homeLocation.heading]);

  // Map-first spawn placement: pick the home point on a map instead of typing
  // coordinates. Confirming also fetches the real ground elevation so SITL's
  // flat ground matches the terrain at the picked spot.
  const [showMapPicker, setShowMapPicker] = useState(false);
  const handleMapPick = useCallback(async (lat: number, lng: number) => {
    const elevation = await getElevation(lat, lng).catch(() => null);
    setHomeLocation({
      ...homeLocation,
      lat,
      lng,
      ...(elevation !== null ? { alt: elevation } : {}),
    });
  }, [setHomeLocation, homeLocation]);

  /** Re-fetch real elevation for the CURRENT lat/lng (manual edits, presets, or
      a map pick can leave the altitude stale/arbitrary). Same terrain-match
      rationale as getCurrentLocation, without touching lat/lng. */
  const matchTerrainElevation = useCallback(async () => {
    setIsMatchingTerrain(true);
    setLocationError(null);
    try {
      const elevation = await getElevation(homeLocation.lat, homeLocation.lng);
      if (elevation === null) {
        setLocationError(t('sitl.ArduPilotSitlTab.unableToLookUpTerrainElevation'));
        return;
      }
      setHomeLocation({ ...homeLocation, alt: elevation });
    } catch {
      setLocationError(t('sitl.ArduPilotSitlTab.unableToLookUpTerrainElevation'));
    } finally {
      setIsMatchingTerrain(false);
    }
  }, [setHomeLocation, homeLocation]);

  const openSimWindow = useCallback(() => {
    window.electronAPI?.openDetachedWindow?.({
      componentId: 'sim-world',
      title: t('sitl.ArduPilotSitlTab.n3dSimWorld'),
      initialBounds: { width: 1280, height: 800 },
    });
  }, []);

  // One-click: start standard SITL if nothing is simulating yet (which
  // auto-connects MAVLink via the connection panel's retry), then open the
  // telemetry-driven 3D world window. The 3D world reads MAVLink, so it works
  // whether physics is the built-in model or the ArduDeck engine. With SITL or
  // a swarm already running, just open the window; a fresh start only opens it
  // on success (a failed launch has nothing to show).
  const launchSim = useCallback(async () => {
    if (isRunning || swarmRunning) {
      openSimWindow();
      return;
    }
    const success = await start();
    if (success) {
      setPendingSitlSwitch(true);
      openSimWindow();
    }
  }, [isRunning, swarmRunning, start, setPendingSitlSwitch, openSimWindow]);

  // Initialize listeners and check status on mount
  useEffect(() => {
    checkStatus();
    const cleanup = initListeners();
    return cleanup;
  }, [initListeners, checkStatus]);

  // Swarm: subscribe to instance/state pushes and reconcile status on mount.
  useEffect(() => {
    refreshSwarmStatus();
    const cleanup = initSwarmListeners();
    return cleanup;
  }, [initSwarmListeners, refreshSwarmStatus]);

  // If a swarm is already running (e.g. on tab re-mount), reflect that in the
  // mode toggle so the Run card shows swarm controls instead of the single one.
  useEffect(() => {
    if (swarmRunning) setRunMode('swarm');
  }, [swarmRunning]);

  // Fetch the upstream frame catalog once on mount. Stays cached after first
  // load — refreshFrames is the explicit user action behind the refresh icon.
  useEffect(() => {
    if (!framesCatalog) loadFrames();
  }, [framesCatalog, loadFrames]);

  // Check binary when vehicle type or release track changes
  useEffect(() => {
    checkBinary();
  }, [vehicleType, releaseTrack, checkBinary]);

  // Switch connection panel to TCP when SITL starts
  useEffect(() => {
    if (isRunning) {
      setPendingSitlSwitch(true);
    }
  }, [isRunning, setPendingSitlSwitch]);

  // Auto-scroll output to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Convert normalized value (-1 to +1) to PWM (1000-2000)
  const normalizedToPWM = (value: number): number => {
    return Math.round(1500 + value * 500);
  };

  // Update RC value
  const updateRC = useCallback(async (key: keyof VirtualRCState, value: number) => {
    await setRcState({ [key]: value });
  }, [setRcState]);

  // Build the frame picker data. Prefer upstream-fetched frames, fall back to
  // the small hardcoded list so the dropdown is never empty pre-fetch.
  const upstreamForVehicle: ArduPilotFrameInfo[] = useMemo(
    () => (framesCatalog?.frames ?? []).filter(f => f.vehicleType === vehicleType),
    [framesCatalog, vehicleType],
  );
  const fallbackForVehicle = useMemo(
    () => (ARDUPILOT_MODELS[vehicleType] ?? []).map<ArduPilotFrameInfo>(opt => ({
      value: opt.value,
      label: opt.label,
      vehicleType,
      category: 'Other',
      defaultParamFiles: [],
    })),
    [vehicleType],
  );
  const framesForVehicle = upstreamForVehicle.length > 0 ? upstreamForVehicle : fallbackForVehicle;

  // Group by category for <optgroup>; sort categories deterministically with
  // the most "default-y" group first to match user expectations.
  const groupedFrames = useMemo(() => {
    const order = ['Multirotor', 'Helicopter', 'Plane', 'Quadplane', 'Tailsitter', 'Rover', 'Boat', 'Sub', 'Other'] as const;
    const map = new Map<string, ArduPilotFrameInfo[]>();
    for (const frame of framesForVehicle) {
      const arr = map.get(frame.category) ?? [];
      arr.push(frame);
      map.set(frame.category, arr);
    }
    const sorted: Array<[string, ArduPilotFrameInfo[]]> = [];
    for (const cat of order) {
      const list = map.get(cat);
      if (list && list.length > 0) sorted.push([cat, list]);
    }
    // Surface unexpected categories last so we don't silently drop them.
    for (const [cat, list] of map) {
      if (!order.includes(cat as typeof order[number])) sorted.push([cat, list]);
    }
    return sorted;
  }, [framesForVehicle]);

  const selectedFrame = useMemo(
    () => framesForVehicle.find(f => f.value === model) ?? null,
    [framesForVehicle, model],
  );

  // Snap-back: if the saved model isn't valid for the current vehicle, pick
  // the first frame in its list. CRITICAL: only do this after the upstream
  // catalog has actually loaded — otherwise the bootstrap render (when
  // framesCatalog is still null and we're on the small hardcoded fallback)
  // would clobber persisted choices like "plane-tailsitter" that aren't in
  // the fallback but DO exist upstream.
  useEffect(() => {
    if (!framesCatalog) return;
    if (framesForVehicle.length === 0) return;
    if (!framesForVehicle.some(f => f.value === model)) {
      setModel(framesForVehicle[0]!.value);
    }
  }, [framesCatalog, framesForVehicle, model, setModel]);

  return (
    <div className="flex flex-col gap-4">
      {/* Platform not supported banner */}

      {/* Platform Error */}
      {!platformSupported && platformError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-400">{t('sitl.ArduPilotSitlTab.platformError')}</h3>
              <p className="text-xs text-red-300/80 mt-1">{platformError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Crash recovery — content varies by strike count. First strike
          (stable crashed) offers a track upgrade; second strike (upgraded
          track also crashed) offers a frame fallback. */}
      {crashRecovery && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-amber-400">
                {t('sitl.ArduPilotSitlTab.sitlCrashedDuringInit')}{crashRecovery.uptimeMs}ms{crashRecovery.signal ? ` · ${crashRecovery.signal}` : ''})
              </h3>
              {crashRecovery.kind === 'switch-track' ? (
                <>
                  <p className="text-xs text-content-secondary mt-1 leading-snug">
                    {t('sitl.ArduPilotSitlTab.the')} <span className="font-mono text-content">{crashRecovery.failedTrack}</span> {t('sitl.ArduPilotSitlTab.binaryDoesnTRun')} <span className="font-mono text-content">{crashRecovery.model}</span> {t('sitl.ArduPilotSitlTab.onThisPlatformThe')} <span className="font-mono text-content">{crashRecovery.suggestedTrack}</span> {t('sitl.ArduPilotSitlTab.trackIsRebuiltNightlyAndShips')}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => { void acceptCrashRecovery(); }}
                      disabled={isStarting || isDownloading}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('sitl.ArduPilotSitlTab.switchTo')} {crashRecovery.suggestedTrack} {t('sitl.ArduPilotSitlTab.retry')}
                    </button>
                    <button
                      onClick={dismissCrashRecovery}
                      className="px-3 py-1.5 text-xs font-medium text-content-secondary hover:text-content rounded-lg transition-colors"
                    >
                      {t('sitl.ArduPilotSitlTab.dismiss')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-content-secondary mt-1 leading-snug">
                    {t('sitl.ArduPilotSitlTab.bothStableAndDevBinariesCrash')}{' '}
                    <span className="font-mono text-content">{crashRecovery.failedModel}</span> {t('sitl.ArduPilotSitlTab.forThisPlatformLooksLikeAn')} <span className="font-mono text-content">{crashRecovery.suggestedModel}</span> {t('sitl.ArduPilotSitlTab.insteadItSTheSafeDefault')}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => { void acceptCrashRecovery(); }}
                      disabled={isStarting || isDownloading}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('sitl.ArduPilotSitlTab.switchTo')} {crashRecovery.suggestedModel} {t('sitl.ArduPilotSitlTab.retry')}
                    </button>
                    <button
                      onClick={dismissCrashRecovery}
                      className="px-3 py-1.5 text-xs font-medium text-content-secondary hover:text-content rounded-lg transition-colors"
                    >
                      {t('sitl.ArduPilotSitlTab.dismiss')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Type Selection */}
      <div className="bg-surface-input border border-subtle rounded-xl p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-content">{t('sitl.ArduPilotSitlTab.vehicleType')}</h3>
            <p className="text-xs text-content-secondary">{t('sitl.ArduPilotSitlTab.chooseTheAirframeClassToSimulate')}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {VEHICLE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVehicleType(opt.value)}
              disabled={isRunning || isStarting}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                vehicleType === opt.value
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                  : 'bg-surface border text-content-secondary hover:bg-surface hover:text-content'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={opt.icon} />
              </svg>
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Physics & Home/Scenarios row */}
      <div className="grid grid-cols-2 gap-4 items-start">
        {/* Physics & Frame */}
        <div className="bg-surface-input border border-subtle rounded-xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-content">{t('sitl.ArduPilotSitlTab.physicsFrame')}</h3>
              <p className="text-xs text-content-secondary">{t('sitl.ArduPilotSitlTab.flightDynamicsModelAndAirframe')}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Frame/Model */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-content-secondary">{t('sitl.ArduPilotSitlTab.frameModel')}</label>
                <FrameCatalogStatus
                  source={framesCatalog?.source}
                  fetchedAt={framesCatalog?.fetchedAt}
                  loading={framesLoading}
                  error={framesCatalog?.error}
                  onRefresh={refreshFrames}
                />
              </div>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isRunning || isStarting}
                className="w-full px-3 py-1.5 text-sm bg-surface-raised text-content border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
              >
                {groupedFrames.length === 1
                  // Single-category vehicle (e.g. Sub) — flat list reads cleaner.
                  ? groupedFrames[0]![1].map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))
                  : groupedFrames.map(([category, frames]) => (
                      <optgroup key={category} label={t(`sitl.ArduPilotSitlTab.group_${category}`)}>
                        {frames.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </optgroup>
                    ))
                }
              </select>
              <FrameDefaultsHint frame={selectedFrame} />
            </div>

            <CustomFramePanel />

            {/* Physics engine (copter only in v1) */}
            {vehicleType === 'copter' && (
              <div className="rounded-lg border border-subtle bg-surface p-3 mt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-content">{t('sitl.ArduPilotSitlTab.physicsEngine')}</div>
                    <div className="text-xs text-content-secondary">
                      {t('sitl.ArduPilotSitlTab.builtInUsesArdupilotSModel')}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useArduDeckSim}
                      onChange={(e) => setUseArduDeckSim(e.target.checked)}
                      disabled={isRunning || isStarting}
                      className="w-4 h-4 rounded border bg-surface-raised text-blue-500 focus:ring-blue-500/50"
                    />
                    <span className="text-xs text-content-secondary">{t('sitl.ArduPilotSitlTab.ardudeckEngine')}</span>
                  </label>
                </div>
              </div>
            )}

            {/* Release Track */}
            <div>
              <label className="block text-xs text-content-secondary mb-1">{t('sitl.ArduPilotSitlTab.releaseTrack')}</label>
              <div className="grid grid-cols-3 gap-1">
                {RELEASE_TRACK_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setReleaseTrack(opt.value)}
                    disabled={isRunning || isStarting}
                    className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                      releaseTrack === opt.value
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                        : 'bg-surface border text-content-secondary hover:bg-surface'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={opt.description}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3D Sim World — telemetry-driven view over standard SITL */}
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/[0.04] p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-content">{t('sitl.ArduPilotSitlTab.n3dSimWorld')}</span>
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-500/15 text-indigo-300">{t('sitl.ArduPilotSitlTab.popOut')}</span>
              </div>
              <p className="text-[11px] text-content-secondary mt-1 leading-snug">
                {t('sitl.ArduPilotSitlTab.a3dViewOfTheConnected')}
              </p>
              <button
                onClick={launchSim}
                disabled={isStarting}
                data-tip={isRunning || swarmRunning ? t('sitl.ArduPilotSitlTab.openThe3dSimWorldWindow') : t('sitl.ArduPilotSitlTab.startSitlConnectAndOpenThe')}
                className="mt-3 w-full py-2 text-sm font-medium text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7m0 0v7m0-7L10 14M19 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5" />
                </svg>
                {isRunning || swarmRunning ? t('sitl.ArduPilotSitlTab.open3dWorld') : isStarting ? t('sitl.ArduPilotSitlTab.starting') : t('sitl.ArduPilotSitlTab.startSitlOpen3dWorld')}
              </button>

              {/* The third "watch it" surface, and the only one that keeps THIS flight
                  controller: the Trainer is spawned by us, so it serves the physics and never
                  starts a stack of its own. Absent until its cargo is installed. */}
              <TrainerQuickAction />

              {/* FlightGear viewer — the other "watch it" surface, so both live in
                  one place instead of one being buried under Run 400 lines down.
                  Single-vehicle only; SITL streams FGNetFDM on 127.0.0.1:5503. */}
              {runMode === 'single' && (
                <>
                  <div className="mt-3 flex items-center gap-2 text-[10px] text-content-tertiary">
                    <div className="h-px flex-1 bg-subtle" />
                    {t('sitl.ArduPilotSitlTab.or')}
                    <div className="h-px flex-1 bg-subtle" />
                  </div>
                  {flightGearRunning ? (
                    <button
                      onClick={() => { void stopFlightGear(); }}
                      data-tip={t('sitl.ArduPilotSitlTab.closeTheFlightgearWindow')}
                      className="mt-2 w-full py-2 text-sm font-medium text-sky-200 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {t('sitl.ArduPilotSitlTab.closeFlightgear')}
                    </button>
                  ) : flightGearInstalled === false ? (
                    <button
                      onClick={() => { void browseFlightGear(); }}
                      data-tip={t('sitl.ArduPilotSitlTab.flightgearNotDetectedInstallItFrom')}
                      className="mt-2 w-full py-2 text-sm font-medium text-content-secondary bg-surface-input hover:bg-surface-raised border border-subtle rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      {t('sitl.ArduPilotSitlTab.locateFlightgear')}
                    </button>
                  ) : (
                    <button
                      onClick={() => { void launchFlightGear(); }}
                      disabled={flightGearStarting || !isRunning}
                      data-tip={isRunning ? t('sitl.ArduPilotSitlTab.openFlightgearAsA3dView') : t('sitl.ArduPilotSitlTab.startSitlFirstThenViewIt')}
                      className="mt-2 w-full py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
                      </svg>
                      {flightGearStarting ? t('sitl.ArduPilotSitlTab.opening') : isRunning ? t('sitl.ArduPilotSitlTab.viewInFlightgear') : t('sitl.ArduPilotSitlTab.viewInFlightgearStartSitlFirst')}
                    </button>
                  )}
                  {flightGearError && (
                    <div className="mt-1.5 text-xs text-rose-400">{flightGearError}</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Home & Scenarios */}
        <div className="bg-surface-input border border-subtle rounded-xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-content">{t('sitl.ArduPilotSitlTab.homeScenarios')}</h3>
              <p className="text-xs text-content-secondary">{t('sitl.ArduPilotSitlTab.spawnLocationForTheSimulatedVehicle')}</p>
            </div>
            <button
              onClick={() => setShowMapPicker(true)}
              disabled={isRunning || isStarting}
              data-tip={t('sitl.ArduPilotSitlTab.pickTheSpawnPointOnA')}
              className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t('sitl.ArduPilotSitlTab.pickOnMap')}
            </button>
          </div>
          {showMapPicker && (
            <MapPointPickerDialog
              title={t('sitl.ArduPilotSitlTab.sitlSpawnLocation')}
              subtitle={t('sitl.ArduPilotSitlTab.clickWhereTheSimulatedVehicleShould')}
              initial={{ lat: homeLocation.lat, lng: homeLocation.lng }}
              confirmLabel={t('sitl.ArduPilotSitlTab.setSpawnPoint')}
              onConfirm={(lat, lng) => { void handleMapPick(lat, lng); }}
              onClose={() => setShowMapPicker(false)}
            />
          )}

          {/* Scenario presets — populate the home fields below */}
          <div className="mb-4">
            <label className="block text-xs text-content-secondary mb-1.5">{t('sitl.ArduPilotSitlTab.scenarioPresets')}</label>
            <div className="grid grid-cols-2 gap-2">
              {HOME_PRESETS.map((p) => {
                const active =
                  Math.abs(homeLocation.lat - p.lat) < 1e-4 && Math.abs(homeLocation.lng - p.lng) < 1e-4;
                return (
                  <button
                    key={p.name}
                    onClick={() => setHomeLocation({ lat: p.lat, lng: p.lng, alt: p.alt, heading: p.heading })}
                    disabled={isRunning || isStarting}
                    data-tip={`${p.lat.toFixed(4)}, ${p.lng.toFixed(4)} · ${p.alt}m`}
                    className={`px-2 py-2 text-xs rounded-lg border transition-colors ${
                      active
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                        : 'bg-surface border text-content-secondary hover:bg-surface hover:text-content'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Home location fields — populated by presets above */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-content-secondary mb-1">{t('sitl.ArduPilotSitlTab.latitude')}</label>
              <DraftNumberInput
                step="0.0001"
                min={-90}
                max={90}
                value={homeLocation.lat}
                onCommit={(v) => setHomeLocation({ ...homeLocation, lat: v })}
                disabled={isRunning || isStarting}
                className="w-full px-2 py-1.5 text-sm bg-surface-raised text-content border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-content-secondary mb-1">{t('sitl.ArduPilotSitlTab.longitude')}</label>
              <DraftNumberInput
                step="0.0001"
                min={-180}
                max={180}
                value={homeLocation.lng}
                onCommit={(v) => setHomeLocation({ ...homeLocation, lng: v })}
                disabled={isRunning || isStarting}
                className="w-full px-2 py-1.5 text-sm bg-surface-raised text-content border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-content-secondary mb-1">{t('sitl.ArduPilotSitlTab.altitude')}</label>
              <div className="relative">
                <input
                  type="number"
                  value={homeAltitudeDraft}
                  onFocus={() => setHomeAltitudeFocused(true)}
                  onChange={(e) => {
                    const next = e.target.value;
                    setHomeAltitudeDraft(next);
                    if (next.trim() === '') return;
                    const displayValue = Number(next);
                    if (!Number.isFinite(displayValue)) return;
                    setHomeLocation({ ...homeLocation, alt: toMetersFromAltitudeUnit(displayValue, altitudeUnit) });
                  }}
                  onBlur={() => {
                    setHomeAltitudeFocused(false);
                    const displayValue = Number(homeAltitudeDraft);
                    if (homeAltitudeDraft.trim() === '' || !Number.isFinite(displayValue)) {
                      setHomeAltitudeDraft(String(Number(homeAltitudeDisplay.toFixed(altitudeUnit === 'km' ? 3 : 1))));
                      return;
                    }
                    if (displayValue === Number(homeAltitudeDisplay.toFixed(altitudeUnit === 'km' ? 3 : 1))) return;
                    setHomeLocation({ ...homeLocation, alt: toMetersFromAltitudeUnit(displayValue, altitudeUnit) });
                  }}
                  step={altitudeUnit === 'km' ? 0.001 : 1}
                  disabled={isRunning || isStarting}
                  className="w-full px-2 pr-10 py-1.5 text-sm bg-surface-raised text-content border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-content-secondary pointer-events-none">
                  {UNIT_LABELS.altitude[altitudeUnit]}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-content-secondary mb-1">{t('sitl.ArduPilotSitlTab.heading')}</label>
              <DraftNumberInput
                value={homeLocation.heading}
                onCommit={(v) => setHomeLocation({ ...homeLocation, heading: v })}
                disabled={isRunning || isStarting}
                min={0}
                max={359}
                className="w-full px-2 py-1.5 text-sm bg-surface-raised text-content border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-content-tertiary">{t('sitl.ArduPilotSitlTab.defaultCmacCanberraModelAircraftClub')}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void matchTerrainElevation()}
                disabled={isRunning || isStarting || isMatchingTerrain}
                data-tip={t('sitl.ArduPilotSitlTab.lookUpTheRealGroundElevation')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMatchingTerrain ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('sitl.ArduPilotSitlTab.matching')}
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 001.7-9.7 6 6 0 00-11.6-1.5A4.5 4.5 0 003 15z" />
                    </svg>
                    {t('sitl.ArduPilotSitlTab.matchTerrain')}
                  </>
                )}
              </button>
              <button
                onClick={getCurrentLocation}
                disabled={isRunning || isStarting || isGettingLocation}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGettingLocation ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('sitl.ArduPilotSitlTab.getting')}
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t('sitl.ArduPilotSitlTab.useMyLocation')}
                  </>
                )}
              </button>
            </div>
          </div>
          {locationError && (
            <p className="mt-2 text-xs text-red-400">{locationError}</p>
          )}
        </div>
      </div>

      {/* Run — mode (single / swarm) + launch settings + binary status + start/stop */}
      <div className="bg-surface-input border border-subtle rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-content">{t('sitl.ArduPilotSitlTab.run')}</h3>
              <p className="text-xs text-content-secondary">
                {runMode === 'swarm' ? t('sitl.ArduPilotSitlTab.launchAFleetOfVehicles') : t('sitl.ArduPilotSitlTab.launchSettingsAndSitlControl')}
              </p>
            </div>
          </div>

          {/* Single / Swarm mode toggle */}
          <div className="inline-flex rounded-lg border border-subtle bg-surface p-0.5">
            {(['single', 'swarm'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setRunMode(m)}
                disabled={isRunning || isStarting || swarmRunning || swarmStarting}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  runMode === m ? 'bg-green-500/20 text-green-300' : 'text-content-secondary hover:text-content'
                }`}
              >
                {m === 'single' ? t('sitl.ArduPilotSitlTab.single') : t('sitl.ArduPilotSitlTab.swarm')}
              </button>
            ))}
          </div>
        </div>

        {/* Launch settings strip — shared by both modes */}
        <div className="flex items-end gap-4 mb-4 flex-wrap">
          <div className="w-28">
            <label
              className="flex items-center gap-1 text-xs text-content-secondary mb-1 cursor-help"
              data-tip={t('sitl.ArduPilotSitlTab.howFastTheSimulationRunsVs')}
            >
              {t('sitl.ArduPilotSitlTab.simSpeed')}
              <svg className="w-3 h-3 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </label>
            <div className="relative">
              <DraftNumberInput
                value={speedup}
                integer
                onCommit={setSpeedup}
                disabled={isRunning || isStarting || swarmRunning || swarmStarting}
                min={1}
                max={10}
                className="w-full px-2 py-1.5 pr-6 text-sm bg-surface-raised text-content border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-content-tertiary pointer-events-none">x</span>
            </div>
          </div>
          <label className="flex items-center gap-2 pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={wipeOnStart}
              onChange={(e) => setWipeOnStart(e.target.checked)}
              disabled={isRunning || isStarting || swarmRunning || swarmStarting}
              className="w-4 h-4 rounded border bg-surface-raised text-blue-500 focus:ring-blue-500/50"
            />
            <span className="text-xs text-content-secondary">{t('sitl.ArduPilotSitlTab.wipeEeprom')}</span>
          </label>

          {/* Swarm-only settings */}
          {runMode === 'swarm' && (
            <>
              <div className="w-24">
                <label className="block text-xs text-content-secondary mb-1">{t('sitl.ArduPilotSitlTab.vehicles')}</label>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={swarmCountDraft}
                  onChange={(e) => setSwarmCountDraft(e.target.value)}
                  onBlur={() => {
                    const n = parseInt(swarmCountDraft, 10);
                    const committed = Number.isFinite(n) ? Math.max(2, Math.min(20, n)) : swarmCount;
                    setSwarmCount(committed);
                    setSwarmCountDraft(String(committed));
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  disabled={swarmRunning || swarmStarting}
                  className="w-full px-2 py-1.5 text-sm bg-surface-raised text-content border border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                />
              </div>
              <div className="w-24">
                <label className="block text-xs text-content-secondary mb-1">{t('sitl.ArduPilotSitlTab.spacingM')}</label>
                <input
                  type="number"
                  min={1}
                  value={swarmSpacingDraft}
                  onChange={(e) => setSwarmSpacingDraft(e.target.value)}
                  onBlur={() => {
                    const n = parseInt(swarmSpacingDraft, 10);
                    const committed = Number.isFinite(n) ? Math.max(1, n) : swarmSpacing;
                    setSwarmSpacing(committed);
                    setSwarmSpacingDraft(String(committed));
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  disabled={swarmRunning || swarmStarting}
                  className="w-full px-2 py-1.5 text-sm bg-surface-raised text-content border border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-content-secondary mb-1">{t('sitl.ArduPilotSitlTab.formation')}</label>
                <div className="grid grid-cols-3 gap-1">
                  {SWARM_FORMATIONS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setSwarmFormation(f.value)}
                      disabled={swarmRunning || swarmStarting}
                      className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                        swarmFormation === f.value
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                          : 'bg-surface border text-content-secondary hover:bg-surface'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Binary status + start/stop */}
        <div className="flex items-center justify-between rounded-lg border border-subtle bg-surface px-3 py-3">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${binaryInfo?.exists ? 'bg-green-400' : 'bg-amber-400'}`} />
            <div>
              <span className="text-sm text-content">
                {vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1)} ({releaseTrack})
              </span>
              <p className="text-xs text-content-secondary">
                {!binaryInfo?.exists
                  ? t('sitl.ArduPilotSitlTab.binaryNotDownloaded')
                  : runMode === 'swarm'
                    ? t('sitl.ArduPilotSitlTab.spawnsVehiclesOnTcp57605770', { swarmCount })
                    : t('sitl.ArduPilotSitlTab.readyAt', { v1: binaryInfo.path?.split('/').pop() })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!binaryInfo?.exists && !isDownloading && (
              <button
                onClick={download}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                {t('sitl.ArduPilotSitlTab.download')}
              </button>
            )}

            {isDownloading && downloadProgress && (
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-surface-inset rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${downloadProgress.progress}%` }}
                  />
                </div>
                <span className="text-xs text-content-secondary">{downloadProgress.progress}%</span>
              </div>
            )}

            {/* Action button — single Start/Stop or swarm Launch/Stop */}
            {runMode === 'single' ? (
              !isRunning ? (
                <button
                  onClick={start}
                  disabled={!isStatusChecked || isStarting || !binaryInfo?.exists || connectionState.isConnected}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isStarting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {t('sitl.ArduPilotSitlTab.starting2')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      </svg>
                      {t('sitl.ArduPilotSitlTab.start')}
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={stop}
                  disabled={isStopping}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isStopping ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {t('sitl.ArduPilotSitlTab.stopping')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                      {t('sitl.ArduPilotSitlTab.stop')}
                    </>
                  )}
                </button>
              )
            ) : !swarmRunning ? (
              <button
                onClick={() => { void startSwarm(); }}
                disabled={swarmStarting || !binaryInfo?.exists || connectionState.isConnected}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {swarmStarting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('sitl.ArduPilotSitlTab.launching')}
                  </>
                ) : (
                  t('sitl.ArduPilotSitlTab.launchVehicles', { swarmCount })
                )}
              </button>
            ) : (
              <button
                onClick={() => { void stopSwarm(); }}
                disabled={swarmStopping}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {swarmStopping ? t('sitl.ArduPilotSitlTab.stopping2') : t('sitl.ArduPilotSitlTab.stopSwarm')}
              </button>
            )}

          </div>
        </div>

        {/* Swarm instance status grid */}
        {runMode === 'swarm' && swarmInstances.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {swarmInstances.map((inst) => {
              const style = SWARM_STATE_STYLE[inst.state];
              return (
                <div
                  key={inst.index}
                  className="flex items-center gap-2 rounded-lg border border-subtle bg-surface px-2.5 py-2"
                  data-tip={inst.error ?? undefined}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                  <div className="min-w-0">
                    <div className="text-xs text-content font-medium">SYS {inst.sysid}</div>
                    <div className="text-[10px] text-content-tertiary font-mono truncate">
                      tcp {inst.tcpPort} · {style.label}
                    </div>
                    {inst.state === 'error' && inst.error && (
                      <div className="text-[10px] text-rose-400 truncate">{inst.error}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {runMode === 'swarm' && swarmError && (
          <div className="mt-3 text-xs text-rose-400">{swarmError}</div>
        )}
      </div>

      {/* Connection hint */}
      {isRunning && !connectionState.isConnected && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-300">
            <span className="font-medium">{t('sitl.ArduPilotSitlTab.sitlIsRunning')}</span>{' '}
            {t('sitl.ArduPilotSitlTab.connectViaTcp')} <code className="px-1.5 py-0.5 bg-blue-500/20 rounded text-blue-200 font-mono">127.0.0.1:5760</code>
          </div>
        </div>
      )}

      {/* Swarm connection hint */}
      {swarmRunning && !connectionState.isConnected && (
        <div className="flex items-center gap-3 px-4 py-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <svg className="w-5 h-5 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-purple-300">
            <span className="font-medium">{t('sitl.ArduPilotSitlTab.swarmIsRunning')}</span>{' '}
            {t('sitl.ArduPilotSitlTab.startTheMultiVehicleEngineFrom')}
          </div>
        </div>
      )}

      {/* Virtual RC Control */}
      {isRunning && (
        <div className="bg-surface-input border border-subtle rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-sm font-medium text-content">{t('sitl.ArduPilotSitlTab.virtualRcControlUdp')}</h3>
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${isRcSending || txLive ? 'bg-green-500/20 text-green-400' : 'bg-surface-raised text-content-secondary'}`}>
                {txLive ? 'USB TX' : isRcSending ? '50Hz' : t('sitl.ArduPilotSitlTab.off')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={isRcSending ? stopRcSender : startRcSender}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  isRcSending
                    ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                    : 'text-green-400 bg-green-500/10 hover:bg-green-500/20'
                }`}
              >
                {isRcSending ? t('sitl.ArduPilotSitlTab.stop') : t('sitl.ArduPilotSitlTab.start')} RC
              </button>
              <button
                onClick={resetRcState}
                className="px-2 py-1 text-xs text-content-secondary hover:text-content bg-surface-raised hover:bg-surface-raised rounded transition-colors"
              >
                {t('sitl.ArduPilotSitlTab.reset')}
              </button>
            </div>
          </div>

          {/* A USB handset drives these same channels, in place of the sliders. */}
          <div className="mb-3">
            <PseudoTxSwitch />
          </div>

          <div className={txLive ? 'opacity-40 pointer-events-none' : undefined}>
          {/* Main sticks */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            {/* Throttle */}
            <div>
              <label className="block text-xs text-content-secondary mb-1">
                {t('sitl.ArduPilotSitlTab.throttle')} <span className="text-content-tertiary">{normalizedToPWM(rcState.throttle)}</span>
              </label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={rcState.throttle}
                onChange={(e) => updateRC('throttle', parseFloat(e.target.value))}
                className="w-full h-2 bg-surface-raised rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-content-secondary mb-1">
                {t('sitl.ArduPilotSitlTab.roll')} <span className="text-content-tertiary">{normalizedToPWM(rcState.roll)}</span>
              </label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={rcState.roll}
                onChange={(e) => updateRC('roll', parseFloat(e.target.value))}
                className="w-full h-2 bg-surface-raised rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-content-secondary mb-1">
                {t('sitl.ArduPilotSitlTab.pitch')} <span className="text-content-tertiary">{normalizedToPWM(rcState.pitch)}</span>
              </label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={rcState.pitch}
                onChange={(e) => updateRC('pitch', parseFloat(e.target.value))}
                className="w-full h-2 bg-surface-raised rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-content-secondary mb-1">
                {t('sitl.ArduPilotSitlTab.yaw')} <span className="text-content-tertiary">{normalizedToPWM(rcState.yaw)}</span>
              </label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={rcState.yaw}
                onChange={(e) => updateRC('yaw', parseFloat(e.target.value))}
                className="w-full h-2 bg-surface-raised rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          {/* AUX channels */}
          <div className="grid grid-cols-4 gap-3 pt-3 border-t border-subtle">
            {(['aux1', 'aux2', 'aux3', 'aux4'] as const).map((key, idx) => (
              <div key={key}>
                <label className={`block text-xs mb-1 ${key === 'aux4' ? 'text-amber-400 font-medium' : 'text-content-secondary'}`}>
                  {key === 'aux4' ? 'AUX4 (ARM)' : `AUX${idx + 1}`}{' '}
                  <span className={key === 'aux4' ? 'text-amber-500' : 'text-content-tertiary'}>{normalizedToPWM(rcState[key])}</span>
                </label>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={rcState[key]}
                  onChange={(e) => updateRC(key, parseFloat(e.target.value))}
                  className={`w-full h-2 bg-surface-raised rounded-lg appearance-none cursor-pointer ${key === 'aux4' ? 'accent-amber-500' : 'accent-green-500'}`}
                />
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      {/* Environment Simulation & Failure Injection - shown when SITL running + connected */}
      {isRunning && connectionState.isConnected && (
        <>
          <SitlEnvironmentPanel />
          <SitlFailurePanel />
        </>
      )}

      {/* Error display */}
      {lastError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-red-300">{lastError}</div>
        </div>
      )}

      {/* Output log */}
      <div className="flex-1 flex flex-col overflow-hidden bg-surface-input border border-subtle rounded-lg min-h-[200px]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-subtle bg-surface-input">
          <span className="text-xs font-medium text-content-secondary">{t('sitl.ArduPilotSitlTab.consoleOutput')}</span>
          <div className="flex items-center gap-2">
            {lastCommand && (
              <span className="text-xs text-content-secondary font-mono truncate max-w-md" title={lastCommand}>
                {lastCommand.split('/').pop()?.slice(0, 50)}
              </span>
            )}
            <button
              onClick={clearOutput}
              disabled={output.length === 0}
              className="px-2 py-1 text-xs text-content-secondary hover:text-content transition-colors disabled:opacity-50"
            >
              {t('sitl.ArduPilotSitlTab.clear')}
            </button>
          </div>
        </div>
        <div
          ref={outputRef}
          className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed max-h-[300px]"
        >
          {output.length === 0 ? (
            <div className="text-content-tertiary italic">
              {t('sitl.ArduPilotSitlTab.noOutputYetStartSitlTo')}
            </div>
          ) : (
            output.map((line, idx) => (
              <div
                key={idx}
                className={
                  line.includes('ERROR') || line.includes('error')
                    ? 'text-red-400'
                    : line.startsWith('---')
                      ? 'text-blue-400 font-medium'
                      : line.includes('ArduPilot') || line.includes('SITL')
                        ? 'text-green-400'
                        : 'text-content'
                }
              >
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Frame catalog UI helpers
// =============================================================================

/**
 * Tiny status pill + refresh button shown next to the Frame/Model label.
 * Tells the user where the dropdown contents came from (upstream / cache /
 * fallback) and lets them force-refresh.
 */
function FrameCatalogStatus({
  source,
  fetchedAt,
  loading,
  error,
  onRefresh,
}: {
  source: 'fresh' | 'cached' | 'fallback' | undefined;
  fetchedAt: string | undefined;
  loading: boolean;
  error: string | undefined;
  onRefresh: () => void;
}) {
  const ageLabel = useMemo(() => relativeAge(fetchedAt), [fetchedAt]);

  const variant =
    loading              ? { dot: 'bg-blue-400 animate-pulse',   text: 'text-content-tertiary', label: 'syncing…' } :
    source === 'fresh'   ? { dot: 'bg-emerald-400',              text: 'text-content-tertiary', label: ageLabel ? t('sitl.ArduPilotSitlTab.syncedAgo', { age: ageLabel }) : t('sitl.ArduPilotSitlTab.synced') } :
    source === 'cached'  ? { dot: 'bg-amber-400',                text: 'text-amber-400',        label: ageLabel ? `cached · ${ageLabel}` : 'cached' } :
    source === 'fallback'? { dot: 'bg-rose-400',                 text: 'text-rose-400',         label: t('sitl.ArduPilotSitlTab.offlineDefaultList') } :
                           { dot: 'bg-content-tertiary',         text: 'text-content-tertiary', label: 'pending' };

  const tooltip = error
    ? t('sitl.ArduPilotSitlTab.couldnTReachUpstreamClickTo', { error })
    : t('sitl.ArduPilotSitlTab.frameListMirrorsArdupilotUpstreamVehicleinfo');

  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 text-[10px] ${variant.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${variant.dot}`} />
        {variant.label}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        title={tooltip}
        className="inline-flex items-center justify-center w-5 h-5 rounded text-content-tertiary hover:text-content hover:bg-surface-raised transition-colors disabled:opacity-50"
      >
        <svg
          className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-3.5M20 15a8 8 0 01-14 3.5" />
        </svg>
      </button>
    </div>
  );
}

/**
 * One-line summary under the dropdown showing which upstream `.parm` file(s)
 * will be stacked behind the ArduDeck overlay at launch. Builds confidence
 * that the frame's defaults are real (esp. for tailsitter / VTOL).
 */
function FrameDefaultsHint({ frame }: { frame: ArduPilotFrameInfo | null }) {
  if (!frame) return null;
  if (frame.defaultParamFiles.length === 0) {
    return (
      <p className="mt-1.5 text-[10px] text-content-tertiary leading-tight">
        {t('sitl.ArduPilotSitlTab.noUpstreamDefaultsArdudeckBaselineOnly')}
      </p>
    );
  }
  // Strip "default_params/" prefix for readability.
  const names = frame.defaultParamFiles.map(f => f.replace(/^default_params\//, ''));
  const list = names.length === 1
    ? names[0]
    : `${names.length} files (${names.join(' + ')})`;
  return (
    <p className="mt-1.5 text-[10px] text-content-tertiary leading-tight" title={frame.defaultParamFiles.join('\n')}>
      {t('sitl.ArduPilotSitlTab.loads')} <span className="font-mono text-content-secondary">{list}</span> {t('sitl.ArduPilotSitlTab.onStart')}
    </p>
  );
}

/** Format a relative age like "2h ago", "3d ago" — for the catalog status pill. */
function relativeAge(iso: string | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  if (ms < 60_000) return justNow();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return ago(mins, 'minute');
  const hours = Math.round(mins / 60);
  if (hours < 24) return ago(hours, 'hour');
  const days = Math.round(hours / 24);
  return ago(days, 'day');
}
