/**
 * SITL Store
 *
 * Manages state for the SITL (Software-In-The-Loop) simulator including
 * process lifecycle, profiles, and output logging.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SitlProfile, SitlConfig } from '../../shared/ipc-channels.js';
import { t } from '../i18n';

// =============================================================================
// Types
// =============================================================================

// Simulator info from detection
export interface SimulatorInfo {
  name: 'flightgear' | 'xplane';
  installed: boolean;
  path: string | null;
  version: string | null;
}

export interface SitlStore {
  // Process State
  isRunning: boolean;
  isStarting: boolean;
  isStopping: boolean;
  isStatusChecked: boolean; // True after initial status check completes
  lastCommand: string | null;

  // Output Log
  output: string[];
  maxOutputLines: number;

  // Profiles
  profiles: SitlProfile[];
  currentProfileName: string | null;

  // Errors
  lastError: string | null;

  // Visual Simulator State (FlightGear / X-Plane)
  detectedSimulators: SimulatorInfo[];
  selectedSimulator: 'flightgear' | 'xplane' | 'none';

  // FlightGear state
  isFlightGearRunning: boolean;
  isFlightGearStarting: boolean;
  flightGearError: string | null;
  customFlightGearPath: string | null;
  flightGearConfig: {
    aircraft: string;
    airport: string;
    timeOfDay: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night';
    weather: 'clear' | 'cloudy' | 'rain';
  };

  // X-Plane state
  isXPlaneRunning: boolean;
  isXPlaneStarting: boolean;
  xplaneError: string | null;
  customXPlanePath: string | null;

  // Bridge (only needed for FlightGear)
  isBridgeRunning: boolean;

  // Legacy compat (simulatorEnabled maps to selectedSimulator !== 'none')
  simulatorEnabled: boolean;

  // Actions
  startSitl: () => Promise<boolean>;
  stopSitl: () => Promise<boolean>;
  appendOutput: (text: string, isError?: boolean) => void;
  clearOutput: () => void;

  // Profile Actions
  selectProfile: (name: string) => void;
  createProfile: (name: string, description?: string) => SitlProfile | null;
  deleteProfile: (name: string) => Promise<boolean>;
  getCurrentProfile: () => SitlProfile | null;

  // Visual Simulator Actions
  detectSimulators: () => Promise<void>;
  setSelectedSimulator: (sim: 'flightgear' | 'xplane' | 'none') => void;
  setSimulatorEnabled: (enabled: boolean) => void; // Legacy compat

  // FlightGear actions
  setCustomFlightGearPath: (path: string | null) => void;
  browseFlightGear: () => Promise<string | null>;
  setFlightGearConfig: (config: Partial<SitlStore['flightGearConfig']>) => void;
  launchFlightGear: () => Promise<boolean>;
  stopFlightGear: () => Promise<boolean>;

  // X-Plane actions
  setCustomXPlanePath: (path: string | null) => void;
  browseXPlane: () => Promise<string | null>;
  launchXPlane: () => Promise<boolean>;
  stopXPlane: () => Promise<boolean>;

  // Bridge (FlightGear only)
  startBridge: () => Promise<boolean>;
  stopBridge: () => Promise<boolean>;

  // Combined launch/stop
  launchWithSimulator: () => Promise<boolean>;
  stopWithSimulator: () => Promise<boolean>;

  // Initialization
  initListeners: () => () => void;
  checkStatus: () => Promise<void>;

  // Reset
  reset: () => void;
}

// =============================================================================
// Standard Profiles (not deletable)
// =============================================================================

/**
 * Standard profiles with descriptions explaining what they're for.
 *
 * Each profile has its own EEPROM file that stores:
 * - PIDs, rates, and tuning
 * - Flight modes and aux channel config
 * - Mixer setup (motor/servo)
 * - GPS and navigation settings
 * - All other FC config
 *
 * This persists across SITL restarts, simulating a real FC's EEPROM.
 */
const STANDARD_PROFILES: SitlProfile[] = [
  {
    name: 'Default',
    get description() { return t('stores.sitl_store.freshInavInstallWithFactoryDefaults'); },
    eepromFileName: 'inav-default.bin',
    isStandard: true,
  },
  {
    name: 'Airplane',
    get description() { return t('stores.sitl_store.preConfiguredForFixedWingTesting'); },
    eepromFileName: 'inav-airplane.bin',
    isStandard: true,
  },
  {
    name: 'Quadcopter',
    get description() { return t('stores.sitl_store.preConfiguredForQuadTestingWith'); },
    eepromFileName: 'inav-quadcopter.bin',
    isStandard: true,
  },
];

// =============================================================================
// Store Implementation
// =============================================================================

export const useSitlStore = create<SitlStore>()(
  persist(
    (set, get) => ({
      // Initial State
      isRunning: false,
      isStarting: false,
      isStopping: false,
      isStatusChecked: false,
      lastCommand: null,
      output: [],
      maxOutputLines: 1000,
      profiles: [...STANDARD_PROFILES],
      currentProfileName: STANDARD_PROFILES[0]?.name ?? null,
      lastError: null,

      // Visual Simulator Initial State
      detectedSimulators: [],
      selectedSimulator: 'none' as const,

      // FlightGear state
      isFlightGearRunning: false,
      isFlightGearStarting: false,
      flightGearError: null,
      customFlightGearPath: null,
      flightGearConfig: {
        aircraft: 'c172p',
        airport: 'KSFO',
        timeOfDay: 'noon',
        weather: 'clear',
      },

      // X-Plane state
      isXPlaneRunning: false,
      isXPlaneStarting: false,
      xplaneError: null,
      customXPlanePath: null,

      // Bridge state (FlightGear only)
      isBridgeRunning: false,

      // Legacy compat
      simulatorEnabled: false,

      // Start SITL
      startSitl: async () => {
        const { isRunning, isStarting, getCurrentProfile, appendOutput, simulatorEnabled } = get();

        if (isRunning || isStarting) {
          return false;
        }

        const profile = getCurrentProfile();
        if (!profile) {
          set({ lastError: t('stores.sitl_store.noProfileSelected') });
          return false;
        }

        set({ isStarting: true, lastError: null });
        appendOutput(`\n--- Starting SITL with profile: ${profile.name} ---\n`);

        try {
          // Use store's simulatorEnabled to determine if we should use X-Plane sim mode
          const useSimulator = simulatorEnabled || profile.simEnabled;

          const config: SitlConfig = {
            eepromFileName: profile.eepromFileName,
            simulator: useSimulator ? 'xp' : undefined,  // 'xp' for X-Plane protocol (used by bridge)
            simIp: profile.simIp || '127.0.0.1',
            // simPort is where SITL SENDS pwm/servo data TO (for control surface feedback)
            // SITL receives sensor data on port 49000 (hardcoded in iNav SITL)
            simPort: profile.simPort || 49000,
            useImu: profile.useImu,
          };

          const result = await window.electronAPI.sitlStart(config);

          if (result.success) {
            set({ isRunning: true, isStarting: false, lastCommand: result.command ?? null });
            if (result.command) {
              appendOutput(`Command: ${result.command}`);
            }
            return true;
          } else {
            set({ isStarting: false, lastError: result.error ?? t('stores.sitl_store.failedToStartSitl') });
            appendOutput(`Error: ${result.error}\n`, true);
            return false;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : t('stores.sitl_store.unknownError');
          set({ isStarting: false, lastError: message });
          appendOutput(`Error: ${message}\n`, true);
          return false;
        }
      },

      // Stop SITL
      stopSitl: async () => {
        const { isRunning, isStopping, appendOutput } = get();

        if (!isRunning || isStopping) {
          return false;
        }

        set({ isStopping: true });
        appendOutput('\n--- Stopping SITL ---\n');

        try {
          await window.electronAPI.sitlStop();
          set({ isRunning: false, isStopping: false });
          appendOutput(t('stores.sitl_store.sitlStopped'));
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : t('stores.sitl_store.unknownError');
          set({ isStopping: false, lastError: message });
          appendOutput(t('stores.sitl_store.errorStopping', { message }), true);
          return false;
        }
      },

      // Append to output log
      // Note: isError just means it came from stderr, not that it's actually an error
      appendOutput: (text: string, _isError = false) => {
        set((state) => {
          const newOutput = [...state.output];
          const lines = text.split('\n');

          for (const line of lines) {
            if (line || lines.length === 1) {
              // Don't prefix stderr as error - SITL uses stderr for normal logging
              newOutput.push(line);
            }
          }

          // Trim to max lines
          while (newOutput.length > state.maxOutputLines) {
            newOutput.shift();
          }

          return { output: newOutput };
        });
      },

      // Clear output log
      clearOutput: () => {
        set({ output: [] });
      },

      // Select profile
      selectProfile: (name: string) => {
        const { profiles } = get();
        const profile = profiles.find((p) => p.name === name);
        if (profile) {
          set({ currentProfileName: name });
        }
      },

      // Create new profile
      createProfile: (name: string, description?: string) => {
        const { profiles } = get();

        // Check for duplicate name
        if (profiles.some((p) => p.name === name)) {
          set({ lastError: t('stores.sitl_store.profileNameAlreadyExists') });
          return null;
        }

        // Generate safe EEPROM filename
        const eepromFileName = name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '') + '.bin';

        const newProfile: SitlProfile = {
          name,
          description,
          eepromFileName,
          isStandard: false,
        };

        set((state) => ({
          profiles: [...state.profiles, newProfile],
          currentProfileName: name,
        }));

        return newProfile;
      },

      // Delete profile
      deleteProfile: async (name: string) => {
        const { profiles, currentProfileName } = get();

        const profile = profiles.find((p) => p.name === name);
        if (!profile) {
          return false;
        }

        // Can't delete standard profiles
        if (profile.isStandard) {
          set({ lastError: t('stores.sitl_store.cannotDeleteStandardProfiles') });
          return false;
        }

        // Delete EEPROM file
        try {
          await window.electronAPI.sitlDeleteEeprom(profile.eepromFileName);
        } catch {
          // Ignore - file might not exist
        }

        // Remove from profiles
        const newProfiles = profiles.filter((p) => p.name !== name);
        const newCurrentName = currentProfileName === name
          ? (newProfiles[0]?.name ?? null)
          : currentProfileName;

        set({
          profiles: newProfiles,
          currentProfileName: newCurrentName,
        });

        return true;
      },

      // Get current profile
      getCurrentProfile: () => {
        const { profiles, currentProfileName } = get();
        return profiles.find((p) => p.name === currentProfileName) ?? null;
      },

      // =============================================================================
      // Visual Simulator Actions
      // =============================================================================

      // Detect installed simulators
      detectSimulators: async () => {
        try {
          const { customFlightGearPath, customXPlanePath } = get();
          const simulators = await window.electronAPI.simulatorDetect(
            customFlightGearPath ?? undefined,
            customXPlanePath ?? undefined
          );
          set({ detectedSimulators: simulators });
        } catch (error) {
          console.error('[SITL Store] Failed to detect simulators:', error);
        }
      },

      // Set selected simulator
      setSelectedSimulator: (sim: 'flightgear' | 'xplane' | 'none') => {
        set({
          selectedSimulator: sim,
          simulatorEnabled: sim !== 'none', // Legacy compat
        });
      },

      // Enable/disable simulator integration (legacy compat)
      setSimulatorEnabled: (enabled: boolean) => {
        const { selectedSimulator, detectedSimulators } = get();
        if (enabled && selectedSimulator === 'none') {
          // Auto-select first available simulator
          const fg = detectedSimulators.find(s => s.name === 'flightgear' && s.installed);
          const xp = detectedSimulators.find(s => s.name === 'xplane' && s.installed);
          if (xp) {
            set({ selectedSimulator: 'xplane', simulatorEnabled: true });
          } else if (fg) {
            set({ selectedSimulator: 'flightgear', simulatorEnabled: true });
          } else {
            set({ simulatorEnabled: false });
          }
        } else if (!enabled) {
          set({ selectedSimulator: 'none', simulatorEnabled: false });
        }
      },

      // Set custom FlightGear executable path
      setCustomFlightGearPath: (path: string | null) => {
        set({ customFlightGearPath: path });
        // Re-detect simulators with new path
        get().detectSimulators();
      },

      // Browse for FlightGear executable
      browseFlightGear: async () => {
        try {
          const result = await window.electronAPI.simulatorBrowseFlightGear();
          if (result.success && result.path) {
            set({ customFlightGearPath: result.path });
            // Re-detect with new path
            await get().detectSimulators();
            return result.path;
          }
          return null;
        } catch (error) {
          console.error('[SITL Store] Failed to browse for FlightGear:', error);
          return null;
        }
      },

      // Update FlightGear config
      setFlightGearConfig: (config) => {
        set((state) => ({
          flightGearConfig: { ...state.flightGearConfig, ...config },
        }));
      },

      // Launch FlightGear
      launchFlightGear: async () => {
        const { isFlightGearRunning, isFlightGearStarting, flightGearConfig, customFlightGearPath, appendOutput } = get();

        if (isFlightGearRunning || isFlightGearStarting) {
          return false;
        }

        set({ isFlightGearStarting: true, flightGearError: null });
        appendOutput('\n--- Launching FlightGear ---\n');

        try {
          const result = await window.electronAPI.simulatorLaunchFlightGear(flightGearConfig, customFlightGearPath ?? undefined);

          if (result.success) {
            set({ isFlightGearRunning: true, isFlightGearStarting: false });
            appendOutput(t('stores.sitl_store.flightgearLaunchedWithAircraftAirport', { aircraft: flightGearConfig.aircraft, airport: flightGearConfig.airport }));
            return true;
          } else {
            set({ isFlightGearStarting: false, flightGearError: result.error ?? t('stores.sitl_store.failedToLaunchFlightgear') });
            appendOutput(t('stores.sitl_store.flightgearError', { error: result.error }), true);
            return false;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : t('stores.sitl_store.unknownError');
          set({ isFlightGearStarting: false, flightGearError: message });
          appendOutput(t('stores.sitl_store.flightgearError2', { message }), true);
          return false;
        }
      },

      // Stop FlightGear
      stopFlightGear: async () => {
        const { isFlightGearRunning, appendOutput } = get();

        if (!isFlightGearRunning) {
          return false;
        }

        appendOutput('\n--- Stopping FlightGear ---\n');

        try {
          await window.electronAPI.simulatorStopFlightGear();
          set({ isFlightGearRunning: false });
          appendOutput(t('stores.sitl_store.flightgearStopped'));
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : t('stores.sitl_store.unknownError');
          set({ flightGearError: message });
          appendOutput(t('stores.sitl_store.flightgearStopError', { message }), true);
          return false;
        }
      },

      // =============================================================================
      // X-Plane Actions
      // =============================================================================

      // Set custom X-Plane executable path
      setCustomXPlanePath: (path: string | null) => {
        set({ customXPlanePath: path });
        // Re-detect simulators with new path
        get().detectSimulators();
      },

      // Browse for X-Plane executable
      browseXPlane: async () => {
        try {
          const result = await window.electronAPI.simulatorBrowseXPlane();
          if (result.success && result.path) {
            set({ customXPlanePath: result.path });
            // Re-detect with new path
            await get().detectSimulators();
            return result.path;
          }
          return null;
        } catch (error) {
          console.error('[SITL Store] Failed to browse for X-Plane:', error);
          return null;
        }
      },

      // Launch X-Plane
      launchXPlane: async () => {
        const { isXPlaneRunning, isXPlaneStarting, customXPlanePath, appendOutput } = get();

        if (isXPlaneRunning || isXPlaneStarting) {
          return false;
        }

        set({ isXPlaneStarting: true, xplaneError: null });
        appendOutput('\n--- Launching X-Plane ---\n');

        try {
          const config = {
            sitlHost: '127.0.0.1',
            dataOutPort: 49000,
            dataInPort: 49001,
          };

          const result = await window.electronAPI.simulatorLaunchXPlane(config, customXPlanePath ?? undefined);

          if (result.success) {
            set({ isXPlaneRunning: true, isXPlaneStarting: false });
            appendOutput(t('stores.sitl_store.xPlaneLaunchedConfigureDataOutput'));
            appendOutput('  - Settings → Data Output → Network\n');
            appendOutput(t('stores.sitl_store.sendTo127001'));
            appendOutput('  - Enable: speeds, attitudes, lat/lon/alt\n');
            return true;
          } else {
            set({ isXPlaneStarting: false, xplaneError: result.error ?? t('stores.sitl_store.failedToLaunchXPlane') });
            appendOutput(t('stores.sitl_store.xPlaneError', { error: result.error }), true);
            return false;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : t('stores.sitl_store.unknownError');
          set({ isXPlaneStarting: false, xplaneError: message });
          appendOutput(t('stores.sitl_store.xPlaneError2', { message }), true);
          return false;
        }
      },

      // Stop X-Plane
      stopXPlane: async () => {
        const { isXPlaneRunning, appendOutput } = get();

        if (!isXPlaneRunning) {
          return false;
        }

        appendOutput('\n--- Stopping X-Plane ---\n');

        try {
          await window.electronAPI.simulatorStopXPlane();
          set({ isXPlaneRunning: false });
          appendOutput(t('stores.sitl_store.xPlaneStopped'));
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : t('stores.sitl_store.unknownError');
          set({ xplaneError: message });
          appendOutput(t('stores.sitl_store.xPlaneStopError', { message }), true);
          return false;
        }
      },

      // =============================================================================
      // Bridge Actions (FlightGear only)
      // =============================================================================

      // Start protocol bridge
      startBridge: async () => {
        const { isBridgeRunning, appendOutput } = get();

        if (isBridgeRunning) {
          return false;
        }

        appendOutput(t('stores.sitl_store.startingProtocolBridge'));

        try {
          const result = await window.electronAPI.bridgeStart();

          if (result.success) {
            set({ isBridgeRunning: true });
            appendOutput('Protocol bridge started (FlightGear <-> iNav SITL)\n');
            return true;
          } else {
            appendOutput(t('stores.sitl_store.bridgeError', { error: result.error }), true);
            return false;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : t('stores.sitl_store.unknownError');
          appendOutput(t('stores.sitl_store.bridgeError2', { message }), true);
          return false;
        }
      },

      // Stop protocol bridge
      stopBridge: async () => {
        const { isBridgeRunning, appendOutput } = get();

        if (!isBridgeRunning) {
          return false;
        }

        appendOutput(t('stores.sitl_store.stoppingProtocolBridge'));

        try {
          await window.electronAPI.bridgeStop();
          set({ isBridgeRunning: false });
          appendOutput(t('stores.sitl_store.protocolBridgeStopped'));
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : t('stores.sitl_store.unknownError');
          appendOutput(t('stores.sitl_store.bridgeStopError', { message }), true);
          return false;
        }
      },

      // Launch everything with simulator (one-click experience)
      launchWithSimulator: async () => {
        const {
          selectedSimulator,
          detectedSimulators,
          customFlightGearPath,
          customXPlanePath,
          launchFlightGear,
          launchXPlane,
          startBridge,
          startSitl,
          appendOutput,
        } = get();

        // If no simulator selected, just start SITL
        if (selectedSimulator === 'none') {
          return await startSitl();
        }

        appendOutput('\n========== LAUNCHING SIMULATION ==========\n');

        if (selectedSimulator === 'xplane') {
          // X-Plane flow: X-Plane → SITL (direct, no bridge needed)
          const xplane = detectedSimulators.find((s) => s.name === 'xplane');
          const hasXPlane = xplane?.installed || !!customXPlanePath;
          if (!hasXPlane) {
            set({ xplaneError: t('stores.sitl_store.xPlaneIsNotInstalledSet') });
            appendOutput(t('stores.sitl_store.xPlaneIsNotInstalledPlease'), true);
            return false;
          }

          // Step 1: Launch X-Plane
          const xpSuccess = await launchXPlane();
          if (!xpSuccess) {
            return false;
          }

          // Wait for X-Plane to initialize
          appendOutput(t('stores.sitl_store.waitingForXPlaneToInitialize'));
          await new Promise((resolve) => setTimeout(resolve, 10000));

          // Step 2: Start SITL with X-Plane simulator mode
          appendOutput(t('stores.sitl_store.startingInavSitl'));
          const sitlSuccess = await startSitl();
          if (!sitlSuccess) {
            await get().stopXPlane();
            return false;
          }

          appendOutput('========== SIMULATION READY ==========\n');
          appendOutput(t('stores.sitl_store.xPlaneIsNowControlledBy'));
          appendOutput(t('stores.sitl_store.makeSureXPlaneDataOutput'));
          appendOutput(t('stores.sitl_store.connectArdudeckToTcp1270'));

        } else {
          // FlightGear flow: FlightGear → Bridge → SITL
          const flightGear = detectedSimulators.find((s) => s.name === 'flightgear');
          const hasFlightGear = flightGear?.installed || !!customFlightGearPath;
          if (!hasFlightGear) {
            set({ flightGearError: t('stores.sitl_store.flightgearIsNotInstalledSetA') });
            appendOutput(t('stores.sitl_store.flightgearIsNotInstalledPleaseInstall'), true);
            return false;
          }

          // Step 1: Launch FlightGear
          const fgSuccess = await launchFlightGear();
          if (!fgSuccess) {
            return false;
          }

          // Step 2: Start protocol bridge
          const bridgeSuccess = await startBridge();
          if (!bridgeSuccess) {
            await get().stopFlightGear();
            return false;
          }

          // Wait for FlightGear to initialize
          appendOutput(t('stores.sitl_store.waitingForFlightgearToInitialize15'));
          await new Promise((resolve) => setTimeout(resolve, 15000));

          // Step 3: Start SITL
          appendOutput(t('stores.sitl_store.startingInavSitl'));
          const sitlSuccess = await startSitl();
          if (!sitlSuccess) {
            await get().stopBridge();
            await get().stopFlightGear();
            return false;
          }

          appendOutput('========== SIMULATION READY ==========\n');
          appendOutput(t('stores.sitl_store.flightgearIsNowControlledByInav'));
          appendOutput(t('stores.sitl_store.connectArdudeckToTcp1270'));
        }

        return true;
      },

      // Stop everything
      stopWithSimulator: async () => {
        const {
          selectedSimulator,
          stopSitl,
          stopBridge,
          stopFlightGear,
          stopXPlane,
          appendOutput,
        } = get();

        appendOutput('\n========== STOPPING SIMULATION ==========\n');

        // Stop in reverse order
        await stopSitl();

        if (selectedSimulator === 'xplane') {
          await stopXPlane();
        } else if (selectedSimulator === 'flightgear') {
          await stopBridge();
          await stopFlightGear();
        }

        appendOutput('========== SIMULATION STOPPED ==========\n');
        return true;
      },

      // Initialize IPC listeners
      initListeners: () => {
        const { appendOutput } = get();

        // Listen for stdout
        const unsubStdout = window.electronAPI.onSitlStdout((data) => {
          appendOutput(data);
        });

        // Listen for stderr
        const unsubStderr = window.electronAPI.onSitlStderr((data) => {
          appendOutput(data, true);
        });

        // Listen for errors
        const unsubError = window.electronAPI.onSitlError((error) => {
          set({ lastError: error, isRunning: false, isStarting: false });
          appendOutput(t('stores.sitl_store.processError', { error }), true);
        });

        // Listen for exit
        const unsubExit = window.electronAPI.onSitlExit((data) => {
          set({ isRunning: false, isStarting: false, isStopping: false });
          if (data.code !== null) {
            appendOutput(t('stores.sitl_store.sitlExitedWithCode', { code: data.code }));
          } else if (data.signal) {
            appendOutput(t('stores.sitl_store.sitlKilledBySignal', { signal: data.signal }));
          }
        });

        // Return cleanup function
        return () => {
          unsubStdout();
          unsubStderr();
          unsubError();
          unsubExit();
        };
      },

      // Check SITL status (on mount)
      checkStatus: async () => {
        try {
          // Check SITL process status
          const sitlStatus = await window.electronAPI.sitlGetStatus();
          set({ isRunning: sitlStatus.isRunning });

          // Check FlightGear status
          const fgStatus = await window.electronAPI.simulatorFlightGearStatus();
          set({ isFlightGearRunning: fgStatus.running });

          // Check bridge status
          const bridgeStatus = await window.electronAPI.bridgeStatus();
          set({ isBridgeRunning: bridgeStatus.running });

          // Detect simulators
          get().detectSimulators();
        } catch {
          // Ignore errors
        } finally {
          // Mark status as checked even if there were errors
          set({ isStatusChecked: true });
        }
      },

      // Reset store
      reset: () => {
        set({
          isRunning: false,
          isStarting: false,
          isStopping: false,
          isStatusChecked: false,
          lastCommand: null,
          output: [],
          lastError: null,
          isFlightGearRunning: false,
          isBridgeRunning: false,
          isFlightGearStarting: false,
          flightGearError: null,
        });
      },
    }),
    {
      name: 'sitl-storage',
      // Persist profiles, selection, and simulator config (NOT simulatorEnabled - should default off each session)
      partialize: (state) => ({
        profiles: state.profiles,
        currentProfileName: state.currentProfileName,
        // NOTE: simulatorEnabled is NOT persisted - user must explicitly enable FlightGear each session
        // This prevents accidental launches when just wanting to test SITL
        flightGearConfig: state.flightGearConfig,
        // Custom FlightGear path IS persisted - user shouldn't have to re-enter it
        customFlightGearPath: state.customFlightGearPath,
      }),
    }
  )
);
