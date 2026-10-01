/**
 * Go / no-go rules for the pre-flight weather briefing. Pure and self-contained
 * (no React, no stores) so the whole feature lifts cleanly into a cargo module
 * later. Tune the numbers in WEATHER_THRESHOLDS, everything else derives from it.
 *
 * A parameter grades GO / CAUTION / NO-GO against its own threshold, and the
 * overall verdict is the worst grade across the gating parameters. Temperature,
 * pressure and cloud cover are shown for context but never gate a launch.
 */
import type { WeatherSummary } from '../../utils/weather-api';
import { t } from '../../i18n';

export type WxStatus = 'go' | 'caution' | 'nogo';

interface WxThreshold {
  caution: number;
  nogo: number;
  /**
   * 'high': values at or above the threshold are worse (wind, precip).
   * 'low': values at or below the threshold are worse (visibility).
   */
  direction: 'high' | 'low';
}

// Defaults tuned for a typical multirotor. Deliberately conservative: these are
// the single place to retune, and later become per-vehicle profile overrides.
export const WEATHER_THRESHOLDS = {
  windGustMs: { caution: 8, nogo: 12, direction: 'high' },
  windSpeedMs: { caution: 7, nogo: 10, direction: 'high' },
  precipProbPct: { caution: 30, nogo: 60, direction: 'high' },
  precipMm: { caution: 0.2, nogo: 1.0, direction: 'high' },
  visibilityM: { caution: 5000, nogo: 1500, direction: 'low' },
} as const satisfies Record<string, WxThreshold>;

export type GatingKey = keyof typeof WEATHER_THRESHOLDS;

export function gradeValue(value: number, threshold: WxThreshold): WxStatus {
  if (threshold.direction === 'high') {
    if (value >= threshold.nogo) return 'nogo';
    if (value >= threshold.caution) return 'caution';
    return 'go';
  }
  if (value <= threshold.nogo) return 'nogo';
  if (value <= threshold.caution) return 'caution';
  return 'go';
}

const STATUS_RANK: Record<WxStatus, number> = { go: 0, caution: 1, nogo: 2 };

export function worstStatus(statuses: WxStatus[]): WxStatus {
  return statuses.reduce<WxStatus>(
    (worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst),
    'go',
  );
}

/** Grade a single gating parameter from a weather summary. */
export function gradeParameter(key: GatingKey, wx: WeatherSummary): WxStatus {
  const value =
    key === 'windGustMs' ? wx.windGustMs
    : key === 'windSpeedMs' ? wx.windSpeedMs
    : key === 'precipProbPct' ? wx.precipProbPct
    : key === 'precipMm' ? wx.precipMm
    : wx.visibilityM;
  return gradeValue(value, WEATHER_THRESHOLDS[key]);
}

/** The overall launch verdict: worst grade across every gating parameter. */
export function overallStatus(wx: WeatherSummary): WxStatus {
  const keys = Object.keys(WEATHER_THRESHOLDS) as GatingKey[];
  return worstStatus(keys.map((k) => gradeParameter(k, wx)));
}

/** Short word an operator reads at a glance. Paired with color, never alone. */
export const STATUS_WORD: Record<WxStatus, string> = {
  get go() { return t('weather.status.go'); },
  get caution() { return t('weather.status.caution'); },
  get nogo() { return t('weather.status.nogo'); },
};
