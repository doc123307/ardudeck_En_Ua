import { t } from '../i18n';
/**
 * Space-weather (planetary K-index) client for the pre-flight briefing. A
 * geomagnetic storm degrades GPS and swings the compass, and a compass
 * calibration run during one is worthless, so the briefing surfaces both the
 * current Kp and the forecast peak: the number that decides whether a
 * multi-hour survey should be postponed.
 *
 * Data: NOAA SWPC free JSON products, no API key. SWPC serves permissive CORS
 * (Access-Control-Allow-Origin: *), same as the Open-Meteo client, so this
 * fetches directly from the renderer. Mirrors weather-api.ts: a short per-
 * endpoint TTL cache and a null return on any failure so callers degrade.
 *
 * Kp is the planetary index (0-9 in thirds). The NOAA G-scale is derived from
 * it: Kp 5 = G1 up to Kp 9 = G5, below 5 is no storm.
 */

const SWPC_KP_NOW_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const SWPC_KP_FORECAST_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';

const ACTIVITY_TTL_MS = 15 * 60 * 1000;

/** Horizon (hours) for the "should I postpone" peak. */
const DEFAULT_PEAK_HOURS = 72;

export interface KpForecastPoint {
  /** Forecast valid time, ISO 8601 UTC. */
  timeIso: string;
  kp: number;
  gScale: number;
}

export interface GeomagneticActivity {
  /** Most recent observed planetary Kp. */
  currentKp: number;
  /** Observation time of currentKp, ISO 8601 UTC. */
  currentTimeIso: string;
  /** NOAA G-scale of the current Kp: 0 (none) to 5 (G5, extreme). */
  currentGScale: number;
  /** Plain-language label for the current conditions. */
  conditionLabel: string;
  /** Future predicted Kp points (past/observed rows filtered out). */
  forecast: KpForecastPoint[];
  /** Highest forecast Kp within the next 24h, or null if none forecast. */
  peakKp24h: number | null;
  peakTime24hIso: string | null;
  /** Highest forecast Kp within the next 72h: the survey-postpone number. */
  peakKp72h: number | null;
  peakTime72hIso: string | null;
  fetchedAtMs: number;
}

const activityCache = new Map<string, GeomagneticActivity>();

/** NOAA G-scale (0-5) from a planetary Kp value. Below Kp 5 there is no storm. */
export function gScaleFromKp(kp: number): number {
  if (kp >= 9) return 5;
  if (kp >= 8) return 4;
  if (kp >= 7) return 3;
  if (kp >= 6) return 2;
  if (kp >= 5) return 1;
  return 0;
}

/** "G1".."G5" for a storm level, or "G0" when there is no storm. */
export function gScaleLabel(gScale: number): string {
  return `G${gScale}`;
}

/** One-word-ish description an operator reads at a glance. */
export function kpConditionLabel(kp: number): string {
  const g = gScaleFromKp(kp);
  if (g === 0) {
    if (kp < 3) return t('utils.geomag_activity_api.quiet');
    if (kp < 4) return t('utils.geomag_activity_api.unsettled');
    return t('utils.geomag_activity_api.active');
  }
  const severity = ['', t('utils.geomag_activity_api.minor'), t('utils.geomag_activity_api.moderate'), t('utils.geomag_activity_api.strong'), t('utils.geomag_activity_api.severe'), t('utils.geomag_activity_api.extreme')][g] ?? 'Storm';
  return `${severity} storm (${gScaleLabel(g)})`;
}

// SWPC time_tags are UTC without a zone suffix; append Z before parsing.
function parseSwpcTime(timeTag: string): Date {
  return new Date(`${timeTag}Z`);
}

interface KpNowRow {
  time_tag: string;
  Kp: number;
}

interface KpForecastRow {
  time_tag: string;
  kp: number;
  observed: string;
}

/**
 * Fetch current Kp plus the multi-day forecast. Returns null on any failure so
 * the briefing can omit the space-weather card. A caller may pass a reference
 * "now" (defaults to the current clock) so the forecast window is deterministic
 * in tests.
 */
export async function getGeomagneticActivity(now: Date = new Date()): Promise<GeomagneticActivity | null> {
  const cached = activityCache.get('planetary');
  if (cached && Date.now() - cached.fetchedAtMs < ACTIVITY_TTL_MS) {
    return cached;
  }

  try {
    const [nowRes, forecastRes] = await Promise.all([
      fetch(SWPC_KP_NOW_URL),
      fetch(SWPC_KP_FORECAST_URL),
    ]);
    if (!nowRes.ok || !forecastRes.ok) {
      console.warn('SWPC Kp API error:', nowRes.status, forecastRes.status);
      return null;
    }

    const nowRows = (await nowRes.json()) as KpNowRow[];
    const forecastRows = (await forecastRes.json()) as KpForecastRow[];

    const latest = Array.isArray(nowRows) ? nowRows[nowRows.length - 1] : undefined;
    if (!latest) return null;
    const currentKp = Number(latest.Kp);
    const currentTimeIso = parseSwpcTime(latest.time_tag).toISOString();

    const nowMs = now.valueOf();
    const forecast: KpForecastPoint[] = [];
    for (const row of Array.isArray(forecastRows) ? forecastRows : []) {
      if (row?.observed !== 'predicted') continue;
      const when = parseSwpcTime(row.time_tag);
      if (when.valueOf() < nowMs) continue;
      const kp = Number(row.kp);
      forecast.push({ timeIso: when.toISOString(), kp, gScale: gScaleFromKp(kp) });
    }

    const peak24 = peakWithin(forecast, nowMs, 24);
    const peak72 = peakWithin(forecast, nowMs, DEFAULT_PEAK_HOURS);

    const activity: GeomagneticActivity = {
      currentKp,
      currentTimeIso,
      currentGScale: gScaleFromKp(currentKp),
      conditionLabel: kpConditionLabel(currentKp),
      forecast,
      peakKp24h: peak24?.kp ?? null,
      peakTime24hIso: peak24?.timeIso ?? null,
      peakKp72h: peak72?.kp ?? null,
      peakTime72hIso: peak72?.timeIso ?? null,
      fetchedAtMs: Date.now(),
    };
    activityCache.set('planetary', activity);
    return activity;
  } catch (error) {
    console.warn('Failed to fetch geomagnetic activity:', error);
    return null;
  }
}

function peakWithin(
  forecast: KpForecastPoint[],
  nowMs: number,
  hours: number,
): KpForecastPoint | null {
  const horizon = nowMs + hours * 3600 * 1000;
  let best: KpForecastPoint | null = null;
  for (const p of forecast) {
    if (new Date(p.timeIso).valueOf() > horizon) continue;
    if (!best || p.kp > best.kp) best = p;
  }
  return best;
}
