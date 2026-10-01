/**
 * Go / no-go grading for geomagnetic conditions, pure and self-contained to
 * match weather-thresholds.ts. Two independent concerns:
 *
 *  1. Transient activity (planetary Kp): a storm degrades GPS and swings the
 *     compass, and a calibration run during one is worthless. Graded on current
 *     Kp and on the forecast peak so a multi-hour survey can be postponed.
 *  2. Static field (WMM): the expected total intensity at a site, used as a
 *     yardstick to flag local ferrous interference against a live compass.
 *
 * The status vocabulary and rank mirror the weather briefing exactly so the two
 * cards read as one verdict. Tune the numbers in the constants objects.
 */

import type { GeomagneticActivity } from './geomag-activity-api';
import { gScaleFromKp, gScaleLabel } from './geomag-activity-api';
import { t } from '../i18n';

/** Same three-state grade the weather briefing uses (WxStatus). */
export type GeomagStatus = 'go' | 'caution' | 'nogo';

const STATUS_RANK: Record<GeomagStatus, number> = { go: 0, caution: 1, nogo: 2 };

/** Short word paired with color, never shown alone. Mirrors STATUS_WORD. */
export const GEOMAG_STATUS_WORD: Record<GeomagStatus, string> = {
  get go() { return t('weather.status.go'); },
  get caution() { return t('weather.status.caution'); },
  get nogo() { return t('weather.status.nogo'); },
};

export function worstGeomagStatus(statuses: GeomagStatus[]): GeomagStatus {
  return statuses.reduce<GeomagStatus>(
    (worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst),
    'go',
  );
}

export const GEOMAG_THRESHOLDS = {
  // Kp below caution is nominal (GO). Kp 4 is unsettled (CAUTION): compass and
  // GPS are usable but a fresh calibration is inadvisable. Kp 5 is the G1 storm
  // line (NO-GO): degraded compass/GPS, do not calibrate.
  kp: { caution: 4, nogo: 5 },
  // Fraction the measured total intensity may deviate from the WMM expectation
  // before local ferrous interference is likely (15 percent).
  fieldInterferenceFraction: 0.15,
} as const;

/** Grade a single Kp value against the storm thresholds. */
export function gradeKp(kp: number): GeomagStatus {
  if (kp >= GEOMAG_THRESHOLDS.kp.nogo) return 'nogo';
  if (kp >= GEOMAG_THRESHOLDS.kp.caution) return 'caution';
  return 'go';
}

/** Plain-language reason for a graded Kp, or null when nominal (GO). */
export function kpReason(kp: number, context: 'now' | 'forecast'): string | null {
  const status = gradeKp(kp);
  if (status === 'go') return null;
  const kpText = `Kp ${formatKp(kp)}`;
  const lead = context === 'forecast' ? `Forecast ${kpText}` : kpText;
  if (status === 'nogo') {
    const g = gScaleFromKp(kp);
    return t('utils.geomag_thresholds.stormCompassAndGpsAccuracyReduced', { lead, v2: gScaleLabel(g) });
  }
  return t('utils.geomag_thresholds.unsettledFieldHoldOffOnCompass', { lead });
}

export interface GeomagVerdict {
  /** Worst grade across the current Kp and the forecast peak. */
  status: GeomagStatus;
  currentStatus: GeomagStatus;
  forecastStatus: GeomagStatus;
  /** Reasons for any CAUTION/NO-GO, in order, for display. Empty when GO. */
  reasons: string[];
}

/**
 * Grade an activity snapshot: current Kp plus the 72h forecast peak (the
 * postpone-the-survey number). The overall status is the worse of the two.
 */
export function gradeGeomagneticActivity(activity: GeomagneticActivity): GeomagVerdict {
  const currentStatus = gradeKp(activity.currentKp);
  const peak = activity.peakKp72h;
  const forecastStatus = peak != null ? gradeKp(peak) : 'go';

  const reasons: string[] = [];
  const currentReason = kpReason(activity.currentKp, 'now');
  if (currentReason) reasons.push(currentReason);
  if (peak != null) {
    const forecastReason = kpReason(peak, 'forecast');
    // Avoid a duplicate line when the peak restates the current condition.
    if (forecastReason && forecastStatus !== 'go' && (currentStatus === 'go' || peak > activity.currentKp)) {
      reasons.push(forecastReason);
    }
  }

  return {
    status: worstGeomagStatus([currentStatus, forecastStatus]),
    currentStatus,
    forecastStatus,
    reasons,
  };
}

export interface FieldInterferenceCheck {
  /** Signed fractional deviation of measured from expected (measured/expected - 1). */
  deviationFraction: number;
  /** Absolute deviation as a percentage, for display. */
  deviationPct: number;
  /** True when the deviation exceeds the interference threshold. */
  likelyInterference: boolean;
}

/**
 * Compare a measured total field intensity (nT, from the live compass) against
 * the WMM-expected intensity and flag likely local ferrous interference. Not
 * wired to live telemetry yet; defined for the later pass. Returns a benign
 * zero-deviation result when the expected value is non-positive.
 */
export function checkFieldInterference(
  measuredNt: number,
  expectedNt: number,
  threshold = GEOMAG_THRESHOLDS.fieldInterferenceFraction,
): FieldInterferenceCheck {
  if (!(expectedNt > 0)) {
    return { deviationFraction: 0, deviationPct: 0, likelyInterference: false };
  }
  const deviationFraction = measuredNt / expectedNt - 1;
  return {
    deviationFraction,
    deviationPct: Math.abs(deviationFraction) * 100,
    likelyInterference: Math.abs(deviationFraction) > threshold,
  };
}

// Kp is reported in thirds; show a tidy value (integer or one decimal).
function formatKp(kp: number): string {
  return Number.isInteger(kp) ? String(kp) : kp.toFixed(1);
}
