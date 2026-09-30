import { t } from '../../i18n';
/**
 * RubyFPV ground-side OSD - clean-room model of RubyFPV's OSD configuration.
 *
 * RubyFPV renders its OSD on the ground unit (a Linux SBC running RubyFPV), not
 * in the flight controller. Its built-in OSD elements are NOT free-positioned:
 * each is a bit in one of three per-screen u32 masks (osd_flags / osd_flags2 /
 * osd_flags3) plus an instruments mask, and RubyFPV auto-arranges them from a
 * layout preset and font/transparency preferences. Free X/Y placement exists
 * only for widgets and plugins (separate config files, not modelled here).
 *
 * The config lives in a per-vehicle model file (ctrl-N.mdl), ASCII text, parsed
 * positionally (v12). This module reimplements the OSD block's read/write from
 * the format alone - no RubyFPV code or assets are used (see the license-clean
 * decision). The bit numbers below are transcribed from RubyFPV's flags_osd.h.
 */

export const MODEL_MAX_OSD_SCREENS = 5;

export type RubyFlagField = 'flags' | 'flags2' | 'flags3' | 'instruments';

export type RubyOsdCategory =
  | 'Flight'
  | 'Power'
  | 'GPS'
  | 'Navigation'
  | 'Link'
  | 'Video'
  | 'System'
  | 'Instruments'
  | 'Grid';

export interface RubyOsdElement {
  id: string;
  label: string;
  category: RubyOsdCategory;
  field: RubyFlagField;
  /** Bit position within `field` (mask = 1 << shift, unsigned). */
  shift: number;
}

/** The built-in OSD elements RubyFPV can toggle, from code/base/flags_osd.h. */
export const RUBY_OSD_ELEMENTS: RubyOsdElement[] = [
  // osd_flags
  { id: 'video_mbps', get label() { return t('utils.ruby_osd.videoMbps'); }, category: 'Video', field: 'flags', shift: 0 },
  { id: 'total_distance', get label() { return t('utils.ruby_osd.totalDistance'); }, category: 'Flight', field: 'flags', shift: 1 },
  { id: 'efficiency', get label() { return t('utils.ruby_osd.efficiency'); }, category: 'Power', field: 'flags', shift: 5 },
  { id: 'ahi_heading', get label() { return t('utils.ruby_osd.ahiHeading'); }, category: 'Instruments', field: 'flags', shift: 9 },
  { id: 'time_lower', get label() { return t('utils.ruby_osd.timeLower'); }, category: 'System', field: 'flags', shift: 11 },
  { id: 'signal_bars', get label() { return t('utils.ruby_osd.signalBars'); }, category: 'Link', field: 'flags', shift: 13 },
  { id: 'distance', get label() { return t('utils.ruby_osd.distance'); }, category: 'Flight', field: 'flags', shift: 16 },
  { id: 'altitude', get label() { return t('utils.ruby_osd.altitude'); }, category: 'Flight', field: 'flags', shift: 17 },
  { id: 'gps_info', get label() { return t('utils.ruby_osd.gpsInfo'); }, category: 'GPS', field: 'flags', shift: 18 },
  { id: 'radio_links', get label() { return t('utils.ruby_osd.radioLinks'); }, category: 'Link', field: 'flags', shift: 19 },
  { id: 'vehicle_radio_links', get label() { return t('utils.ruby_osd.vehicleRadioLinks'); }, category: 'Link', field: 'flags', shift: 20 },
  { id: 'home', get label() { return t('utils.ruby_osd.home'); }, category: 'Navigation', field: 'flags', shift: 21 },
  { id: 'battery', get label() { return t('utils.ruby_osd.battery'); }, category: 'Power', field: 'flags', shift: 22 },
  { id: 'video_mode', get label() { return t('utils.ruby_osd.videoMode'); }, category: 'Video', field: 'flags', shift: 23 },
  { id: 'cpu_info', get label() { return t('utils.ruby_osd.cpuInfo'); }, category: 'System', field: 'flags', shift: 25 },
  { id: 'pitch', get label() { return t('utils.ruby_osd.pitch'); }, category: 'Flight', field: 'flags', shift: 26 },
  { id: 'throttle', get label() { return t('utils.ruby_osd.throttle'); }, category: 'Flight', field: 'flags', shift: 27 },
  { id: 'flight_mode', get label() { return t('utils.ruby_osd.flightMode'); }, category: 'Flight', field: 'flags', shift: 28 },
  { id: 'time', get label() { return t('utils.ruby_osd.time'); }, category: 'System', field: 'flags', shift: 29 },
  { id: 'radio_interfaces', get label() { return t('utils.ruby_osd.radioInterfaces'); }, category: 'Link', field: 'flags', shift: 30 },
  { id: 'flight_mode_change', get label() { return t('utils.ruby_osd.flightModeChange'); }, category: 'Flight', field: 'flags', shift: 31 },
  // osd_flags2
  { id: 'battery_cells', get label() { return t('utils.ruby_osd.batteryCells'); }, category: 'Power', field: 'flags2', shift: 1 },
  { id: 'gps_position', get label() { return t('utils.ruby_osd.gpsPosition'); }, category: 'GPS', field: 'flags2', shift: 3 },
  { id: 'tx_power', get label() { return t('utils.ruby_osd.txPower'); }, category: 'Link', field: 'flags2', shift: 10 },
  { id: 'vertical_speed', get label() { return t('utils.ruby_osd.verticalSpeed'); }, category: 'Flight', field: 'flags2', shift: 11 },
  { id: 'ground_speed', get label() { return t('utils.ruby_osd.groundSpeed'); }, category: 'Flight', field: 'flags2', shift: 14 },
  { id: 'air_speed', get label() { return t('utils.ruby_osd.airSpeed'); }, category: 'Flight', field: 'flags2', shift: 15 },
  { id: 'rc_rssi', label: 'RC RSSI', category: 'Link', field: 'flags2', shift: 16 },
  { id: 'link_quality_numbers', get label() { return t('utils.ruby_osd.linkQualityNumbers'); }, category: 'Link', field: 'flags2', shift: 17 },
  { id: 'link_quality_bars', get label() { return t('utils.ruby_osd.linkQualityBars'); }, category: 'Link', field: 'flags2', shift: 18 },
  // osd_flags3
  { id: 'grid_crosshair', get label() { return t('utils.ruby_osd.crosshair'); }, category: 'Grid', field: 'flags3', shift: 1 },
  { id: 'grid_diagonal', get label() { return t('utils.ruby_osd.diagonalGrid'); }, category: 'Grid', field: 'flags3', shift: 2 },
  { id: 'grid_squares', get label() { return t('utils.ruby_osd.squareGrid'); }, category: 'Grid', field: 'flags3', shift: 3 },
  { id: 'wind', get label() { return t('utils.ruby_osd.wind'); }, category: 'Flight', field: 'flags3', shift: 4 },
  { id: 'fc_temperature', get label() { return t('utils.ruby_osd.fcTemperature'); }, category: 'System', field: 'flags3', shift: 5 },
  { id: 'grid_thirds', get label() { return t('utils.ruby_osd.ruleOfThirds'); }, category: 'Grid', field: 'flags3', shift: 7 },
  { id: 'video_bitrate_history', get label() { return t('utils.ruby_osd.videoBitrateHistory'); }, category: 'Video', field: 'flags3', shift: 8 },
  // instruments_flags
  { id: 'speed_to_sides', get label() { return t('utils.ruby_osd.speedToSides'); }, category: 'Instruments', field: 'instruments', shift: 0 },
  { id: 'horizon', get label() { return t('utils.ruby_osd.horizon'); }, category: 'Instruments', field: 'instruments', shift: 1 },
  { id: 'speed_alt', get label() { return t('utils.ruby_osd.speedAltitude'); }, category: 'Instruments', field: 'instruments', shift: 2 },
  { id: 'heading', get label() { return t('utils.ruby_osd.heading'); }, category: 'Instruments', field: 'instruments', shift: 3 },
  { id: 'alt_graph', get label() { return t('utils.ruby_osd.altitudeGraph'); }, category: 'Instruments', field: 'instruments', shift: 4 },
  { id: 'instruments', get label() { return t('utils.ruby_osd.instruments'); }, category: 'Instruments', field: 'instruments', shift: 5 },
];

const ELEMENT_BY_ID: Record<string, RubyOsdElement> = Object.fromEntries(
  RUBY_OSD_ELEMENTS.map((e) => [e.id, e]),
);

export const RUBY_OSD_PRESET = { NONE: 0, MINIMAL: 1, COMPACT: 2, DEFAULT: 3, CUSTOM: 4 } as const;

export interface RubyOsdScreen {
  flags: number;
  flags2: number;
  flags3: number;
  instruments: number;
  preferences: number;
  layoutPreset: number;
}

/** Mirrors osd_parameters_t's serialized fields (models.cpp v12). */
export interface RubyOsdParams {
  currentScreen: number;
  voltageAlarmEnabled: boolean;
  voltageAlarm: number;
  batteryShowPerCell: number;
  batteryCellCount: number;
  batteryCapacityPercentAlarm: number;
  altitudeRelative: boolean;
  showGpsPosition: boolean;
  invertHomeArrow: boolean;
  homeArrowRotate: number;
  radioGraphRefreshMs: number;
  showOverloadAlarm: boolean;
  showStatsRxDetailed: boolean;
  showStatsDecode: boolean;
  showStatsRc: boolean;
  showFullStats: boolean;
  showInstruments: boolean;
  ahiWarningAngle: number;
  screens: RubyOsdScreen[];
  uFlags: number;
}

function emptyScreen(): RubyOsdScreen {
  return { flags: 0, flags2: 0, flags3: 0, instruments: 0, preferences: 0, layoutPreset: RUBY_OSD_PRESET.DEFAULT };
}

export function defaultRubyOsdParams(): RubyOsdParams {
  return {
    currentScreen: 0,
    voltageAlarmEnabled: false,
    voltageAlarm: 3.3,
    batteryShowPerCell: 0,
    batteryCellCount: 0,
    batteryCapacityPercentAlarm: 0,
    altitudeRelative: true,
    showGpsPosition: false,
    invertHomeArrow: false,
    homeArrowRotate: 0,
    radioGraphRefreshMs: 200,
    showOverloadAlarm: false,
    showStatsRxDetailed: false,
    showStatsDecode: false,
    showStatsRc: false,
    showFullStats: false,
    showInstruments: true,
    ahiWarningAngle: 0,
    screens: Array.from({ length: MODEL_MAX_OSD_SCREENS }, emptyScreen),
    uFlags: 0,
  };
}

const maskOf = (shift: number): number => (1 << shift) >>> 0;

export function isElementEnabled(p: RubyOsdParams, screen: number, id: string): boolean {
  const el = ELEMENT_BY_ID[id];
  const s = p.screens[screen];
  if (!el || !s) return false;
  return ((s[el.field] >>> 0) & maskOf(el.shift)) !== 0;
}

export function withElementEnabled(p: RubyOsdParams, screen: number, id: string, on: boolean): RubyOsdParams {
  const el = ELEMENT_BY_ID[id];
  if (!el) return p;
  const screens = p.screens.map((s, i) => {
    if (i !== screen) return { ...s };
    const cur = s[el.field] >>> 0;
    const m = maskOf(el.shift);
    return { ...s, [el.field]: (on ? cur | m : cur & ~m) >>> 0 };
  });
  return { ...p, screens };
}

/** osd_preferences byte 0 = element font size (0-6). */
export const getFontSize = (preferences: number): number => (preferences >>> 0) & 0xff;
/** osd_preferences byte 1 = transparency (0 max .. 4 none). */
export const getTransparency = (preferences: number): number => ((preferences >>> 0) >>> 8) & 0xff;

const bit = (b: boolean): string => (b ? '1' : '0');
const u32 = (n: number): string => (n >>> 0).toString();

/** Serialize the OSD block exactly as models.cpp saveVersion12 writes it. */
export function serializeOsdBlock(p: RubyOsdParams): string {
  const lines: string[] = [];
  lines.push(
    `osd: ${MODEL_MAX_OSD_SCREENS} ${p.currentScreen} ${bit(p.voltageAlarmEnabled)} ${p.voltageAlarm.toFixed(6)} ${bit(p.altitudeRelative)} ${bit(p.showGpsPosition)}`,
  );
  lines.push(
    `${p.batteryShowPerCell} ${p.batteryCellCount} ${p.batteryCapacityPercentAlarm} ${bit(p.invertHomeArrow)} ${p.homeArrowRotate} ${p.radioGraphRefreshMs}`,
  );
  lines.push(
    `${bit(p.showOverloadAlarm)} ${bit(p.showStatsRxDetailed)} ${bit(p.showStatsDecode)} ${bit(p.showStatsRc)} ${bit(p.showFullStats)} ${bit(p.showInstruments)} ${p.ahiWarningAngle}`,
  );
  for (const s of p.screens) {
    lines.push(`${u32(s.flags)} ${u32(s.flags2)} ${u32(s.flags3)} ${u32(s.instruments)} ${u32(s.preferences)} ${s.layoutPreset}`);
  }
  lines.push(u32(p.uFlags));
  return lines.join('\n');
}

/** The number of whitespace tokens after the `osd:` marker in a v12 block. */
const OSD_BLOCK_TOKEN_COUNT = 6 + 6 + 7 + MODEL_MAX_OSD_SCREENS * 6 + 1; // 50

/** Parse the OSD block out of a v12 model (or a bare block). */
export function parseOsdBlock(text: string): RubyOsdParams {
  const toks = text.split(/\s+/).filter(Boolean);
  const i0 = toks.indexOf('osd:');
  if (i0 < 0) throw new Error(t('utils.ruby_osd.rubyOsdNoOsdBlockFound'));
  let k = i0 + 1;
  const num = (): number => Number(toks[k++]);
  const boolean = (): boolean => num() !== 0;

  const screenCount = num();
  if (screenCount !== MODEL_MAX_OSD_SCREENS) {
    throw new Error(`ruby-osd: expected ${MODEL_MAX_OSD_SCREENS} screens, got ${screenCount}`);
  }
  const currentScreen = num();
  const voltageAlarmEnabled = boolean();
  const voltageAlarm = num();
  const altitudeRelative = boolean();
  const showGpsPosition = boolean();

  const batteryShowPerCell = num();
  const batteryCellCount = num();
  const batteryCapacityPercentAlarm = num();
  const invertHomeArrow = boolean();
  const homeArrowRotate = num();
  const radioGraphRefreshMs = num();

  const showOverloadAlarm = boolean();
  const showStatsRxDetailed = boolean();
  const showStatsDecode = boolean();
  const showStatsRc = boolean();
  const showFullStats = boolean();
  const showInstruments = boolean();
  const ahiWarningAngle = num();

  const screens: RubyOsdScreen[] = [];
  for (let i = 0; i < MODEL_MAX_OSD_SCREENS; i++) {
    screens.push({
      flags: num() >>> 0,
      flags2: num() >>> 0,
      flags3: num() >>> 0,
      instruments: num() >>> 0,
      preferences: num() >>> 0,
      layoutPreset: num(),
    });
  }
  const uFlags = num() >>> 0;

  return {
    currentScreen, voltageAlarmEnabled, voltageAlarm, altitudeRelative, showGpsPosition,
    batteryShowPerCell, batteryCellCount, batteryCapacityPercentAlarm, invertHomeArrow,
    homeArrowRotate, radioGraphRefreshMs, showOverloadAlarm, showStatsRxDetailed,
    showStatsDecode, showStatsRc, showFullStats, showInstruments, ahiWarningAngle,
    screens, uFlags,
  };
}

/**
 * Replace only the OSD block inside a whole model file, preserving every other
 * section verbatim. Loading is strictly positional, so a writer must round-trip
 * the entire file and touch only these lines.
 */
// Raw flag bits used by the preset builder (transcribed from flags_osd.h). Kept
// separate from the UI catalog so a preset writes the exact bits RubyFPV does,
// including elements ArduDeck does not expose as toggles.
const B = (n: number): number => (1 << n) >>> 0;
const PB = {
  // osd_flags
  BATTERY: B(22), RADIO_LINKS: B(19), ALTITUDE: B(17), FLIGHT_MODE: B(28), FLIGHT_MODE_CHANGE: B(31),
  VIDEO_MODE: B(23), VIDEO_MBPS: B(0), VIDEO_MODE_EXT: B(24), VEHICLE_RADIO_LINKS: B(20), RADIO_INTERFACES: B(30),
  DISTANCE: B(16), HOME: B(21), GPS_INFO: B(18), CPU_INFO: B(25),
  // osd_flags2
  LAYOUT_ENABLED: B(13), RELATIVE_ALT: B(2), BG_ON_TEXT: B(20), BGBARS: B(0), TX_POWER: B(10),
  LQ_BARS: B(18), LQ_NUMBERS: B(17), GROUND_SPEED: B(14), RC_RSSI: B(16), VIDEO_FRAMES_STATS: B(28),
  STATS_RADIO_IFACE: B(7), MIN_RADIO_IFACE_STATS: B(27), VEH_RADIO_IFACE_STATS: B(23), MIN_VIDEO_STATS: B(26),
  // osd_flags3
  HIGHLIGHT: B(13), RENDER_MSP: B(17), LQ_DBM: B(18), LQ_SNR: B(19),
  // preferences / uFlags
  ARANGE_RIGHT: B(28), MUST_CHOOSE: B(5),
};

function applyPresetToScreen(s: RubyOsdScreen, iScreen: number, preset: number): RubyOsdScreen {
  // Custom keeps the user's current element selection.
  if (preset === RUBY_OSD_PRESET.CUSTOM) return { ...s, layoutPreset: RUBY_OSD_PRESET.CUSTOM };

  let flags = 0;
  let flags2 = PB.LAYOUT_ENABLED | PB.RELATIVE_ALT | PB.BG_ON_TEXT;
  let flags3 = PB.HIGHLIGHT | PB.RENDER_MSP;
  const preferences = ((s.preferences >>> 0) | PB.ARANGE_RIGHT) >>> 0;

  if (preset <= RUBY_OSD_PRESET.NONE) {
    return { ...s, flags: 0, flags2: flags2 >>> 0, flags3: flags3 >>> 0, preferences, layoutPreset: preset };
  }
  if (iScreen === 3 || iScreen === 4) flags2 |= PB.BGBARS;

  if (preset >= RUBY_OSD_PRESET.MINIMAL) {
    flags |= PB.BATTERY | PB.RADIO_LINKS;
    flags2 |= PB.TX_POWER | PB.LQ_BARS;
  }
  if (preset >= RUBY_OSD_PRESET.COMPACT) {
    flags |= PB.ALTITUDE | PB.FLIGHT_MODE | PB.FLIGHT_MODE_CHANGE;
    flags2 |= PB.TX_POWER | PB.LQ_NUMBERS;
    flags3 |= PB.LQ_DBM | PB.LQ_SNR;
    if (iScreen < 3) flags |= PB.VIDEO_MODE | PB.VIDEO_MBPS | PB.VIDEO_MODE_EXT;
  }
  if (preset >= RUBY_OSD_PRESET.DEFAULT) {
    flags |= PB.VEHICLE_RADIO_LINKS | PB.RADIO_INTERFACES;
    flags2 |= PB.TX_POWER | PB.LQ_NUMBERS | PB.LQ_BARS | PB.GROUND_SPEED | PB.RC_RSSI | PB.VIDEO_FRAMES_STATS;
    flags2 |= PB.STATS_RADIO_IFACE | PB.MIN_RADIO_IFACE_STATS | PB.VEH_RADIO_IFACE_STATS;
    flags3 |= PB.LQ_DBM | PB.LQ_SNR;
    flags |= PB.DISTANCE | PB.HOME | PB.GPS_INFO;
    if (iScreen < 3) {
      flags |= PB.CPU_INFO;
      flags2 |= PB.MIN_VIDEO_STATS;
    }
  }
  return { ...s, flags: flags >>> 0, flags2: flags2 >>> 0, flags3: flags3 >>> 0, preferences, layoutPreset: preset };
}

/**
 * Apply a layout preset to one screen - sets the element flags exactly as
 * RubyFPV's own "reset to preset" does (models.cpp), cumulatively (Minimal <
 * Compact < Default). CUSTOM leaves the current selection untouched.
 */
export function applyPreset(p: RubyOsdParams, screen: number, preset: number): RubyOsdParams {
  const screens = p.screens.map((s, i) => (i === screen ? applyPresetToScreen({ ...s }, i, preset) : { ...s }));
  return { ...p, screens, uFlags: ((p.uFlags >>> 0) & ~PB.MUST_CHOOSE) >>> 0 };
}

export function spliceOsdBlock(modelText: string, params: RubyOsdParams): string {
  const lines = modelText.split('\n');
  const start = lines.findIndex((l) => l.trim().startsWith('osd:'));
  if (start < 0) throw new Error(t('utils.ruby_osd.rubyOsdNoOsdBlockTo'));
  let count = 0;
  let end = start;
  for (let li = start; li < lines.length; li++) {
    const nums = lines[li]!.trim().replace(/^osd:\s*/, '').split(/\s+/).filter(Boolean);
    count += nums.length;
    end = li;
    if (count >= OSD_BLOCK_TOKEN_COUNT) break;
  }
  const block = serializeOsdBlock(params).split('\n');
  return [...lines.slice(0, start), ...block, ...lines.slice(end + 1)].join('\n');
}
