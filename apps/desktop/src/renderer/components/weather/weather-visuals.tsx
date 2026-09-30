/**
 * Shared visual language for the pre-flight weather briefing. Colours are the
 * theme-aware instrument status vars (--gauge-green / amber / red), so every
 * accent reads in both light and dark; the state wash and pill are built with
 * color-mix off those same vars, never an opacity-suffixed semantic token.
 *
 * This is the scaled-up sibling of the compact weather card in the Vehicle &
 * Status settings section: same state-wash + pill + small-caps stat language.
 */
import {
  Sun, Moon, Cloud, CloudSun, CloudRain, CloudFog, type LucideIcon,
} from 'lucide-react';
import type { WeatherSummary } from '../../utils/weather-api';
import { STATUS_WORD, type WxStatus } from './weather-thresholds';
import { t } from '../../i18n';

export type Grade = WxStatus | 'info';

/** Vivid, theme-aware accent per grade. 'info' is a neutral (non-gating) tone. */
export const GRADE_COLOR: Record<Grade, string> = {
  go: 'var(--gauge-green)',
  caution: 'var(--gauge-amber)',
  nogo: 'var(--gauge-red)',
  info: 'var(--gauge-text-dim)',
};

export const STATUS_PILL_WORD: Record<WxStatus, string> = {
  go: STATUS_WORD.go,
  caution: STATUS_WORD.caution,
  nogo: 'NO GO',
};

export const STATUS_SUMMARY: Record<WxStatus, string> = {
  go: 'Conditions are within limits for launch.',
  caution: 'Conditions are marginal. Review the flagged parameters before launch.',
  nogo: 'One or more parameters exceed safe limits. Do not launch.',
};

/**
 * Soft diagonal wash + border for the whole briefing surface, tied to the
 * verdict. Fades the status colour into the solid surface then the page base
 * so on NO-GO the surface itself reads red, in either theme.
 */
export function washStyle(color: string): { background: string; borderColor: string; boxShadow: string } {
  return {
    background: `linear-gradient(158deg,
      color-mix(in srgb, ${color} 22%, var(--bg-surface-solid)) 0%,
      color-mix(in srgb, ${color} 9%, var(--bg-base)) 46%,
      var(--bg-base) 100%)`,
    borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
    boxShadow: `0 18px 48px -24px color-mix(in srgb, ${color} 60%, transparent)`,
  };
}

/** Tinted inset panel (wind block, warning strip) built off a status colour. */
export function tintStyle(color: string, fill = 12, border = 34): { background: string; borderColor: string } {
  return {
    background: `color-mix(in srgb, ${color} ${fill}%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} ${border}%, transparent)`,
  };
}

export function pillStyle(color: string): { background: string; borderColor: string; color: string } {
  return {
    background: `color-mix(in srgb, ${color} 18%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 42%, transparent)`,
    color,
  };
}

export interface Condition {
  label: string;
  Icon: LucideIcon;
  isNight: boolean;
}

// Open-Meteo local ISO times share the site timezone, so a lexical compare of
// "YYYY-MM-DDTHH:MM" against sunrise/sunset is a correct day/night test.
function isNight(wx: WeatherSummary): boolean {
  const now = wx.currentTimeIso;
  if (!now || !wx.sunriseIso || !wx.sunsetIso) return false;
  return now < wx.sunriseIso || now >= wx.sunsetIso;
}

/**
 * Plain-language condition from the fields the briefing already fetches (no
 * weather_code in this endpoint): precipitation and visibility first, then
 * cloud cover, with a day/night glyph for clear skies.
 */
export function deriveCondition(wx: WeatherSummary): Condition {
  const night = isNight(wx);
  if (wx.precipMm >= 0.1 || wx.precipProbPct >= 60) {
    return { label: t('weather.weather_visuals.rain'), Icon: CloudRain, isNight: night };
  }
  if (wx.visibilityM > 0 && wx.visibilityM < 1000) {
    return { label: t('weather.weather_visuals.fog'), Icon: CloudFog, isNight: night };
  }
  if (wx.cloudCoverPct >= 85) {
    return { label: t('weather.weather_visuals.overcast'), Icon: Cloud, isNight: night };
  }
  if (wx.cloudCoverPct >= 40) {
    return { label: t('weather.weather_visuals.partlyCloudy'), Icon: CloudSun, isNight: night };
  }
  return { label: t('weather.weather_visuals.clear'), Icon: night ? Moon : Sun, isNight: night };
}
