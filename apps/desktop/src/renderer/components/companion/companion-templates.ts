import { t } from '../../i18n';
/**
 * Companion board templates — pre-configured firmware/software for popular boards.
 * Each template includes board info, use case, flash method, and setup instructions.
 */

export type BoardFamily = 'esp32' | 'raspberry-pi' | 'jetson' | 'orange-pi';
export type FlashMethod = 'serial' | 'image' | 'script';

export interface CompanionTemplate {
  id: string;
  name: string;
  description: string;
  board: BoardFamily;
  boardVariants: string[]; // e.g. ['ESP32', 'ESP32-S3', 'ESP32-C3']
  category: string;
  flashMethod: FlashMethod;
  firmwareUrl?: string; // URL to download firmware binary
  installCommand?: string; // One-liner install script
  imageUrl?: string; // URL to download SD card image
  features: string[];
  requirements: string[];
  projectUrl?: string; // Link to upstream project
  projectName?: string; // Name of upstream project
}

// ── Board family metadata ──────────────────────────────────────

export const BOARD_FAMILIES: Record<BoardFamily, {
  name: string;
  description: string;
  icon: string; // SVG path for the board icon
}> = {
  'esp32': {
    name: 'ESP32',
    get description() { return t('companion.companion_templates.lightweightMicrocontrollerForTelemetryBridgesAnd'); },
    icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
  },
  'raspberry-pi': {
    name: 'Raspberry Pi',
    get description() { return t('companion.companion_templates.fullCompanionComputerForVideoAutonomy'); },
    icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01',
  },
  'jetson': {
    name: 'NVIDIA Jetson',
    get description() { return t('companion.companion_templates.gpuAcceleratedCompanionForAiComputer'); },
    icon: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
  },
  'orange-pi': {
    name: 'Orange Pi',
    get description() { return t('companion.companion_templates.budgetFriendlyPiAlternativeWithSimilar'); },
    icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01',
  },
};

// ── Category styling ───────────────────────────────────────────

export const CATEGORY_STYLE: Record<string, { accent: string; bg: string; text: string; badge: string }> = {
  Telemetry: {
    accent: 'border-t-blue-500/70',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  },
  Video: {
    accent: 'border-t-purple-500/70',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    badge: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  },
  Autonomy: {
    accent: 'border-t-emerald-500/70',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  },
  'Full Stack': {
    accent: 'border-t-amber-500/70',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  },
  RTK: {
    accent: 'border-t-cyan-500/70',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  },
};

export const FALLBACK_STYLE = {
  accent: 'border-t-gray-500/70',
  bg: 'bg-gray-500/10',
  text: 'text-gray-400',
  badge: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
};

// ── Templates ──────────────────────────────────────────────────

export const COMPANION_TEMPLATES: CompanionTemplate[] = [
  // ── ESP32 Templates ──────────────────────────────────────────
  {
    id: 'dronebridge-wifi',
    name: 'DroneBridge WiFi Telemetry',
    get description() { return t('companion.companion_templates.replaceSikRadioWithWifiTelemetry'); },
    board: 'esp32',
    boardVariants: ['ESP32', 'ESP32-S2', 'ESP32-S3', 'ESP32-C3', 'ESP32-C6'],
    category: 'Telemetry',
    flashMethod: 'serial',
    features: [t('companion.companion_templates.wifiApStationMode'), t('companion.companion_templates.mavlinkTransparentBridge'), t('companion.companion_templates.udpTcpTelemetry'), t('companion.companion_templates.webConfigurationUi'), t('companion.companion_templates.aes256Encryption')],
    requirements: [t('companion.companion_templates.esp32DevBoard'), t('companion.companion_templates.uartConnectionToFcTxRx'), t('companion.companion_templates.n33vOr5vPower')],
    projectUrl: 'https://github.com/DroneBridge/ESP32',
    get projectName() { return t('companion.companion_templates.dronebridgeForEsp32'); },
  },
  {
    id: 'dronebridge-espnow',
    name: 'DroneBridge ESP-NOW Long Range',
    get description() { return t('companion.companion_templates.connectionlessEncryptedTelemetryUpTo1km'); },
    board: 'esp32',
    boardVariants: ['ESP32', 'ESP32-S2', 'ESP32-S3', 'ESP32-C3'],
    category: 'Telemetry',
    flashMethod: 'serial',
    features: [t('companion.companion_templates.espNowProtocolNoWifiAssociation'), t('companion.companion_templates.upTo1kmRangeWithExt'), t('companion.companion_templates.aesGcmEncryption'), t('companion.companion_templates.lowLatency'), t('companion.companion_templates.noRouterNeeded')],
    requirements: ['2x ESP32 boards (air + ground)', t('companion.companion_templates.externalAntennaRecommended'), t('companion.companion_templates.uartConnectionToFc')],
    projectUrl: 'https://github.com/DroneBridge/ESP32',
    get projectName() { return t('companion.companion_templates.dronebridgeForEsp32'); },
  },
  {
    id: 'esp32-mavlink-bridge',
    name: 'MAVLink WiFi Bridge (Minimal)',
    get description() { return t('companion.companion_templates.lightweightSerialToWifiBridgeMinimal'); },
    board: 'esp32',
    boardVariants: ['ESP32', 'ESP32-S3', 'ESP32-C3'],
    category: 'Telemetry',
    flashMethod: 'serial',
    features: [t('companion.companion_templates.wifiApMode'), t('companion.companion_templates.serialToUdpBridge'), t('companion.companion_templates.autoBaudDetection'), t('companion.companion_templates.minimalResourceUsage')],
    requirements: [t('companion.companion_templates.esp32DevBoard'), t('companion.companion_templates.uartConnectionToFc'), t('companion.companion_templates.n33vOr5vPower')],
    projectName: 'mavesp8266 (ESP32 fork)',
  },
  {
    id: 'esp32-xbee-ntrip',
    name: 'RTK Corrections Bridge',
    get description() { return t('companion.companion_templates.ntripServerClientAndCasterOn'); },
    board: 'esp32',
    boardVariants: ['ESP32', 'ESP32-S3'],
    category: 'RTK',
    flashMethod: 'serial',
    features: [t('companion.companion_templates.ntripServerClientAndCasterModes'), t('companion.companion_templates.wifiApStationMode2'), t('companion.companion_templates.uartToTcpUdpBridging'), t('companion.companion_templates.webConfigurationUi'), t('companion.companion_templates.sameFirmwareForBaseOrVehicle')],
    requirements: [t('companion.companion_templates.esp32DevBoard'), t('companion.companion_templates.n33vUartToTheGnss'), t('companion.companion_templates.wifiNetworkOrPhoneHotspot')],
    projectUrl: 'https://github.com/nebkat/esp32-xbee',
    get projectName() { return t('companion.companion_templates.esp32Xbee'); },
  },

  // ── Raspberry Pi Templates ───────────────────────────────────
  {
    id: 'pi-telemetry-bridge',
    name: 'Telemetry Bridge',
    get description() { return t('companion.companion_templates.mavlinkRouterWifiApConnectsGround'); },
    board: 'raspberry-pi',
    boardVariants: [t('companion.companion_templates.piZero2W'), 'Pi 3B+', 'Pi 4', 'Pi 5'],
    category: 'Telemetry',
    flashMethod: 'image',
    installCommand: 'curl -fsSL https://ardudeck.com/companion/pi-telemetry.sh | bash',
    features: ['mavlink-router daemon', t('companion.companion_templates.wifiAccessPoint'), t('companion.companion_templates.multipleGcsConnections'), t('companion.companion_templates.ardudeckAgentPreInstalled'), t('companion.companion_templates.autoStartOnBoot')],
    requirements: [t('companion.companion_templates.raspberryPiWithWifi'), t('companion.companion_templates.microsdCard8gb'), t('companion.companion_templates.uartOrUsbConnectionToFc'), '5V 3A BEC'],
    projectName: 'mavlink-router + hostapd',
  },
  {
    id: 'pi-video-telemetry',
    name: 'Video + Telemetry',
    get description() { return t('companion.companion_templates.cameraStreamingWithGstreamerMavlinkRouting'); },
    board: 'raspberry-pi',
    boardVariants: ['Pi 4', 'Pi 5'],
    category: 'Video',
    flashMethod: 'image',
    installCommand: 'curl -fsSL https://ardudeck.com/companion/pi-video.sh | bash',
    features: [t('companion.companion_templates.piCameraH264Streaming'), t('companion.companion_templates.gstreamerRtspUdpPipeline'), t('companion.companion_templates.mavlinkRouting'), t('companion.companion_templates.wifiAp'), t('companion.companion_templates.ardudeckAgent'), t('companion.companion_templates.webPreview')],
    requirements: [t('companion.companion_templates.raspberryPi4Or5'), t('companion.companion_templates.piCameraModuleV2V3Hq'), t('companion.companion_templates.microsdCard16gb'), t('companion.companion_templates.uartOrUsbToFc'), '5V 3A BEC'],
    get projectName() { return t('companion.companion_templates.gstreamerMavlinkRouter'); },
  },
  {
    id: 'rpanion-server',
    name: 'Rpanion Server',
    get description() { return t('companion.companion_templates.fullFeaturedCompanionWithWebUi'); },
    board: 'raspberry-pi',
    boardVariants: ['Pi 3B+', 'Pi 4', 'Pi 5'],
    category: 'Full Stack',
    flashMethod: 'image',
    imageUrl: 'https://github.com/stephendade/Rpanion-server/releases',
    features: [t('companion.companion_templates.webBasedConfigUi'), t('companion.companion_templates.mavlinkRouting'), t('companion.companion_templates.videoStreaming'), t('companion.companion_templates.ntripClientRtkGps'), t('companion.companion_templates.flightControllerManagement'), t('companion.companion_templates.networkConfig')],
    requirements: [t('companion.companion_templates.raspberryPi3bOrLater'), t('companion.companion_templates.microsdCard16gb'), t('companion.companion_templates.uartOrUsbToFc'), '5V 3A BEC'],
    projectUrl: 'https://github.com/stephendade/Rpanion-server',
    get projectName() { return t('companion.companion_templates.rpanionServer'); },
  },
  {
    id: 'blueos',
    name: 'BlueOS',
    get description() { return t('companion.companion_templates.dockerBasedCompanionOsWithExtension'); },
    board: 'raspberry-pi',
    boardVariants: ['Pi 3B+', 'Pi 4', 'Pi 5'],
    category: 'Full Stack',
    flashMethod: 'image',
    imageUrl: 'https://github.com/bluerobotics/BlueOS/releases',
    features: [t('companion.companion_templates.dockerContainerArchitecture'), t('companion.companion_templates.extensionMarketplace'), t('companion.companion_templates.mavlinkRouting'), t('companion.companion_templates.videoStreaming'), t('companion.companion_templates.webUi'), t('companion.companion_templates.otaUpdates'), t('companion.companion_templates.logManagement')],
    requirements: [t('companion.companion_templates.raspberryPi3bOrLater'), t('companion.companion_templates.microsdCard16gb'), t('companion.companion_templates.uartOrUsbToFc'), '5V 3A BEC'],
    projectUrl: 'https://github.com/bluerobotics/BlueOS',
    get projectName() { return t('companion.companion_templates.blueosByBlueRobotics'); },
  },
  {
    id: 'pi-mavsdk-autonomy',
    name: 'Autonomous Mission Runner',
    get description() { return t('companion.companion_templates.pythonEnvironmentWithMavsdkForOnboard'); },
    board: 'raspberry-pi',
    boardVariants: ['Pi 4', 'Pi 5'],
    category: 'Autonomy',
    flashMethod: 'image',
    installCommand: 'curl -fsSL https://ardudeck.com/companion/pi-autonomy.sh | bash',
    features: [t('companion.companion_templates.mavsdkPython'), t('companion.companion_templates.mavlinkRouting'), t('companion.companion_templates.missionScriptExamples'), t('companion.companion_templates.geofenceIntegration'), t('companion.companion_templates.ardudeckAgent'), t('companion.companion_templates.autoStartOnBoot')],
    requirements: [t('companion.companion_templates.raspberryPi4Or5'), t('companion.companion_templates.microsdCard16gb'), t('companion.companion_templates.uartOrUsbToFc'), '5V 3A BEC'],
    get projectName() { return t('companion.companion_templates.mavsdkMavlinkRouter'); },
  },
  {
    id: 'openhd-air',
    name: 'OpenHD Air Unit',
    get description() { return t('companion.companion_templates.digitalFpvSystemHdVideoTelemetry'); },
    board: 'raspberry-pi',
    boardVariants: [t('companion.companion_templates.piZero2W'), 'Pi 3B+', 'Pi 4'],
    category: 'Video',
    flashMethod: 'image',
    features: [t('companion.companion_templates.hdVideoStreamingH264H'), t('companion.companion_templates.integratedTelemetryOverlay'), t('companion.companion_templates.rcControlLink'), t('companion.companion_templates.upTo50kmRange'), t('companion.companion_templates.dualBandSupport'), 'Recording'],
    requirements: [t('companion.companion_templates.raspberryPiAirGround'), t('companion.companion_templates.compatibleWifiAdapterRtl8812au'), t('companion.companion_templates.piCamera'), t('companion.companion_templates.microsdCard16gb')],
    projectUrl: 'https://github.com/OpenHD/OpenHD',
    projectName: 'OpenHD',
  },
  {
    id: 'pi-str2str-base',
    name: 'RTK Base Streamer',
    get description() { return t('companion.companion_templates.baseSideReadsRtcm3OffThe'); },
    board: 'raspberry-pi',
    boardVariants: [t('companion.companion_templates.piZero2W'), 'Pi 3B+', 'Pi 4', 'Pi 5'],
    category: 'RTK',
    flashMethod: 'script',
    installCommand: 'sudo apt install -y build-essential git && git clone https://github.com/rtklibexplorer/RTKLIB && make -C RTKLIB/app/consapp/str2str/gcc',
    features: [t('companion.companion_templates.str2strSerialToNtripServer'), t('companion.companion_templates.feedsRtk2goOrAPrivateCaster'), t('companion.companion_templates.logsRawRtcmToDisk'), t('companion.companion_templates.reconnectsAfterADropout'), t('companion.companion_templates.runsAsASystemdUnit')],
    requirements: [t('companion.companion_templates.raspberryPiWithNetworkOrLte'), t('companion.companion_templates.baseReceiverOnUsbOr3'), t('companion.companion_templates.casterMountpointCredentials')],
    projectUrl: 'https://github.com/rtklibexplorer/RTKLIB',
    get projectName() { return t('companion.companion_templates.rtklibDemo5Str2str'); },
  },
  {
    id: 'pi-mavproxy-ntrip',
    name: 'RTK Injector',
    get description() { return t('companion.companion_templates.vehicleSidePullsCorrectionsFromA'); },
    board: 'raspberry-pi',
    boardVariants: [t('companion.companion_templates.piZero2W'), 'Pi 3B+', 'Pi 4', 'Pi 5'],
    category: 'RTK',
    flashMethod: 'script',
    installCommand: 'pip3 install MAVProxy',
    features: [t('companion.companion_templates.injectsGpsRtcmDataOverMavlink'), t('companion.companion_templates.startedWithLoadModuleNtrip'), t('companion.companion_templates.sendsVehiclePositionUpstreamForVrs'), t('companion.companion_templates.worksOnLteOrAPhone'), t('companion.companion_templates.autoStartAsAService')],
    requirements: [t('companion.companion_templates.raspberryPiWithLteOrWifi'), t('companion.companion_templates.serialOrUsbLinkToThe'), t('companion.companion_templates.casterMountpointCredentials')],
    projectUrl: 'https://github.com/ArduPilot/MAVProxy',
    get projectName() { return t('companion.companion_templates.mavproxyNtripModule'); },
  },

  // ── Jetson Templates ─────────────────────────────────────────
  {
    id: 'jetson-cv-companion',
    name: 'Computer Vision Companion',
    get description() { return t('companion.companion_templates.gpuAcceleratedObjectDetectionAndTracking'); },
    board: 'jetson',
    boardVariants: [t('companion.companion_templates.jetsonNano'), t('companion.companion_templates.orinNano')],
    category: 'Autonomy',
    flashMethod: 'script',
    installCommand: 'curl -fsSL https://ardudeck.com/companion/jetson-cv.sh | bash',
    features: [t('companion.companion_templates.yoloObjectDetectionGpu'), t('companion.companion_templates.mavsdkIntegration'), t('companion.companion_templates.mavlinkRouting'), t('companion.companion_templates.cameraPipeline'), t('companion.companion_templates.ardudeckAgent'), t('companion.companion_templates.ros2Optional')],
    requirements: [t('companion.companion_templates.nvidiaJetsonNanoOrOrinNano'), t('companion.companion_templates.jetpackSdkInstalled'), t('companion.companion_templates.usbCameraOrCsiCamera'), t('companion.companion_templates.uartOrUsbToFc')],
    get projectName() { return t('companion.companion_templates.mavsdkTensorrt'); },
  },
];
