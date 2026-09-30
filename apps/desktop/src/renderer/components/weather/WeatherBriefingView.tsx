/**
 * Pre-Flight Weather Briefing. Fetches an Open-Meteo point forecast at the
 * vehicle's position (falling back to home, then the map center) and renders a
 * single GO / CAUTION / NO-GO verdict plus the drone-relevant parameters, each
 * graded against WEATHER_THRESHOLDS.
 *
 * Read-only. All gating logic lives in weather-thresholds.ts and the position /
 * fetch state in weather-store.ts, so this file is purely presentation: the
 * full-page sibling of the compact weather card in Vehicle & Status settings,
 * scaled up to a state-washed hero, a wind-rose instrument, and graded stat
 * tiles with threshold tracks.
 */
import { useEffect } from 'react';
import {
  CloudSun, RefreshCw, Wind, CloudRain, Eye, MapPin, Thermometer, Gauge, Cloud,
  Droplets, ArrowUp, CheckCircle2, AlertTriangle, XCircle, CloudOff, type LucideIcon,
} from 'lucide-react';
import { useWeatherStore, type WeatherLocationSource, type ResolvedWeatherLocation } from '../../stores/weather-store';
import { compassPoint, type WeatherSummary } from '../../utils/weather-api';
import {
  WEATHER_THRESHOLDS, gradeParameter, overallStatus, worstStatus, type WxStatus, type GatingKey,
} from './weather-thresholds';
import { gradeGeomagneticActivity } from '../../utils/geomag-thresholds';
import { GeomagSection } from './GeomagSection';
import { LocationPicker } from './LocationPicker';
import { useSettingsStore } from '../../stores/settings-store';
import {
  formatWindSpeedFromMetersPerSecond,
  windSpeedValueFromMetersPerSecond,
  UNIT_LABELS,
  UNIT_PRECISION,
} from '../../../shared/user-units.js';
import {
  GRADE_COLOR, STATUS_PILL_WORD, STATUS_SUMMARY, washStyle, tintStyle, pillStyle,
  deriveCondition, type Grade,
} from './weather-visuals';
import { WindRose } from './WindRose';
import { MetricTile, type TrackConfig } from './MetricTile';
import { type TrackZone } from './ThresholdTrack';
import { useReducedMotion, useCountUp } from './weather-motion';
import { t as tr } from '../../i18n';

// Re-query on a calm cadence while the panel is open. Conditions move slowly and
// the fetch is cheap-cached; this just keeps a long-lived briefing from going stale.
const AUTO_REFRESH_MS = 5 * 60 * 1000;

const STATUS_COLOR: Record<WxStatus, string> = {
  go: 'var(--gauge-green)',
  caution: 'var(--gauge-amber)',
  nogo: 'var(--gauge-red)',
};
const STATUS_ICON: Record<WxStatus, LucideIcon> = {
  go: CheckCircle2,
  caution: AlertTriangle,
  nogo: XCircle,
};
const SOURCE_LABEL: Record<WeatherLocationSource, string> = {
  vehicle: 'Vehicle position',
  home: 'Home position',
  map: 'Map center',
  override: 'Picked location',
};

/** Picked locations read as their place name; auto sources read as their origin. */
function locationLabel(loc: ResolvedWeatherLocation): string {
  return loc.source === 'override' ? (loc.name ?? SOURCE_LABEL.override) : SOURCE_LABEL[loc.source];
}

const GREEN = 'var(--gauge-green)';
const AMBER = 'var(--gauge-amber)';
const RED = 'var(--gauge-red)';

function formatClock(iso: string | null): string {
  if (!iso) return '--:--';
  // Open-Meteo current.time is site-local, "YYYY-MM-DDTHH:MM".
  return iso.slice(11, 16);
}

// A gated metric sits on a rail whose green/amber/red zones come straight from
// WEATHER_THRESHOLDS; the marker's grade is decided by the same grader.
function highTrack(value: number, key: GatingKey, grade: Grade, tip: string, hardMax?: number): TrackConfig {
  const t = WEATHER_THRESHOLDS[key];
  const max = hardMax ?? Math.max(t.nogo * 1.5, value * 1.1);
  const zones: TrackZone[] = [
    { from: 0, to: t.caution, color: GREEN },
    { from: t.caution, to: t.nogo, color: AMBER },
    { from: t.nogo, to: max, color: RED },
  ];
  return { min: 0, max, value, zones, markerColor: GRADE_COLOR[grade], tip };
}

// Visibility is inverted: low is bad, so the red zone sits at the origin.
function lowTrack(value: number, key: GatingKey, grade: Grade, tip: string): TrackConfig {
  const t = WEATHER_THRESHOLDS[key];
  const max = Math.max(t.caution * 1.7, value * 1.05);
  const zones: TrackZone[] = [
    { from: 0, to: t.nogo, color: RED },
    { from: t.nogo, to: t.caution, color: AMBER },
    { from: t.caution, to: max, color: GREEN },
  ];
  return { min: 0, max, value, zones, markerColor: GRADE_COLOR[grade], tip };
}

// Plain-language reason for the worst gating parameter, for the bottom strip.
// Reads WEATHER_THRESHOLDS but never regrades: the caller passes the verdict.
const REASON_PRIORITY: GatingKey[] = ['windGustMs', 'windSpeedMs', 'visibilityM', 'precipMm', 'precipProbPct'];

function worstReason(wx: WeatherSummary, windUnit: Parameters<typeof formatWindSpeedFromMetersPerSecond>[1]): string {
  const wind = (ms: number) => formatWindSpeedFromMetersPerSecond(ms, windUnit);
  const graded = REASON_PRIORITY.map((k) => ({ k, g: gradeParameter(k, wx) }));
  const driver = graded.find((x) => x.g === 'nogo') ?? graded.find((x) => x.g === 'caution');
  if (!driver) return '';
  const nogo = driver.g === 'nogo';
  switch (driver.k) {
    case 'windGustMs':
      return nogo
        ? `Gusts of ${wind(wx.windGustMs)} exceed the safe limit (${wind(WEATHER_THRESHOLDS.windGustMs.nogo)}). Risk of loss of control.`
        : `Gusts of ${wind(wx.windGustMs)} are approaching the limit (${wind(WEATHER_THRESHOLDS.windGustMs.nogo)}). Monitor closely.`;
    case 'windSpeedMs':
      return nogo
        ? `Sustained wind of ${wind(wx.windSpeedMs)} exceeds the safe limit (${wind(WEATHER_THRESHOLDS.windSpeedMs.nogo)}).`
        : `Sustained wind of ${wind(wx.windSpeedMs)} is approaching the limit (${wind(WEATHER_THRESHOLDS.windSpeedMs.nogo)}).`;
    case 'visibilityM':
      return nogo
        ? `Low visibility of ${(wx.visibilityM / 1000).toFixed(1)} km, below the ${(WEATHER_THRESHOLDS.visibilityM.nogo / 1000).toFixed(1)} km minimum.`
        : `Reduced visibility of ${(wx.visibilityM / 1000).toFixed(1)} km. Maintain visual line of sight.`;
    case 'precipMm':
      return nogo
        ? `Precipitation of ${wx.precipMm.toFixed(1)} mm. Electronics at risk, do not launch.`
        : `Light precipitation of ${wx.precipMm.toFixed(1)} mm detected. Protect the airframe.`;
    case 'precipProbPct':
      return nogo
        ? `High chance of precipitation (${Math.round(wx.precipProbPct)}%). Expect rain within the hour.`
        : `Rising chance of precipitation (${Math.round(wx.precipProbPct)}%). Watch the sky.`;
  }
}

function StateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 text-content-secondary wx-rise">
      {children}
    </div>
  );
}

export function WeatherBriefingView() {
  const weather = useWeatherStore((s) => s.weather);
  const loading = useWeatherStore((s) => s.loading);
  const error = useWeatherStore((s) => s.error);
  const location = useWeatherStore((s) => s.location);
  const lastFetchMs = useWeatherStore((s) => s.lastFetchMs);
  const geomag = useWeatherStore((s) => s.geomag);
  const geomagUnavailable = useWeatherStore((s) => s.geomagUnavailable);
  const geomagField = useWeatherStore((s) => s.geomagField);
  const geomagModelValid = useWeatherStore((s) => s.geomagModelValid);
  const refresh = useWeatherStore((s) => s.refresh);
  const windSpeedUnit = useSettingsStore((s) => s.unitPreferences.windSpeed);
  const reduced = useReducedMotion();
  const animate = !reduced;

  // Fetch on open, then keep it fresh while the panel is mounted.
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // The launch verdict is the worst of the weather grade and the geomagnetic
  // grade, so a quiet-sky storm can still gate a flight (and vice versa). Space
  // weather being unavailable never blocks the weather verdict.
  const geomagVerdict = geomag ? gradeGeomagneticActivity(geomag) : null;
  const weatherStatus = weather ? overallStatus(weather) : null;
  const status = weatherStatus
    ? (geomagVerdict ? worstStatus([weatherStatus, geomagVerdict.status]) : weatherStatus)
    : null;
  const grade = (key: GatingKey): Grade => (weather ? gradeParameter(key, weather) : 'info');

  // Hero temperature counts up; hooks must run unconditionally, so this sits
  // above the early-return branches with a harmless 0 when there is no data.
  const tempDisplay = useCountUp(weather?.tempC ?? 0);

  const windUnitLabel = UNIT_LABELS.windSpeed[windSpeedUnit];
  const windVal = (ms: number) =>
    String(Number(windSpeedValueFromMetersPerSecond(ms, windSpeedUnit).toFixed(UNIT_PRECISION.windSpeed[windSpeedUnit])));
  const windLimitTip = (key: 'windSpeedMs' | 'windGustMs') =>
    `Caution ${windVal(WEATHER_THRESHOLDS[key].caution)}, no-go ${windVal(WEATHER_THRESHOLDS[key].nogo)} ${windUnitLabel}`;

  return (
    <div className="h-full flex flex-col bg-surface-base text-content">
      {/* Header */}
      {/* relative z-40: backdrop-blur creates a stacking context, so the
          location popover's own z-index was trapped inside this header and
          the scrolling content painted straight over it. */}
      <div className="relative z-40 px-4 py-3 border-b border-subtle bg-surface-nav backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
            <CloudSun className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-content">{tr('weather.WeatherBriefingView.preFlightWeatherBriefing')}</h2>
            <LocationPicker />
          </div>
          <button
            onClick={() => { void refresh(); }}
            disabled={loading}
            className="px-2.5 py-1.5 text-xs rounded-md bg-surface border border-subtle text-content-secondary hover:bg-surface-raised hover:text-content transition-colors flex items-center gap-1.5 disabled:opacity-50"
            data-tip={tr('weather.WeatherBriefingView.refreshForecast')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {tr('weather.WeatherBriefingView.refresh')}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto">
          {!location ? (
            <StateShell>
              <MapPin className="w-10 h-10 mb-3 text-content-tertiary" />
              <p className="text-sm font-medium mb-1 text-content">{tr('weather.WeatherBriefingView.noPositionToBrief')}</p>
              <p className="text-xs text-content-tertiary max-w-xs">
                {tr('weather.WeatherBriefingView.connectAVehicleSetAHome')}
              </p>
            </StateShell>
          ) : error && !weather ? (
            <StateShell>
              <CloudOff className="w-10 h-10 mb-3 text-content-tertiary" />
              <p className="text-sm font-medium mb-1 text-content">{tr('weather.WeatherBriefingView.forecastUnavailable')}</p>
              <p className="text-xs text-content-tertiary max-w-xs mb-4">{error}</p>
              <button
                onClick={() => { void refresh(); }}
                className="px-3 py-1.5 text-xs rounded-md bg-surface border border-subtle text-content-secondary hover:bg-surface-raised hover:text-content transition-colors"
              >
                {tr('weather.WeatherBriefingView.tryAgain')}
              </button>
            </StateShell>
          ) : loading && !weather ? (
            <StateShell>
              <RefreshCw className="w-8 h-8 mb-3 text-content-tertiary animate-spin" />
              <p className="text-sm text-content-secondary">{tr('weather.WeatherBriefingView.fetchingForecast')}</p>
            </StateShell>
          ) : weather && status ? (
            (() => {
              const color = STATUS_COLOR[status];
              const StatusGlyph = STATUS_ICON[status];
              const condition = deriveCondition(weather);
              const ConditionGlyph = condition.Icon;
              const gustGrade = grade('windGustMs');
              const speedGrade = grade('windSpeedMs');
              const pulse = status === 'go' ? '' : 'wx-accent-pulse';

              return (
                <div className="space-y-4">
                  {/* Hero verdict band: the ONLY state-washed surface. Everything
                      below sits on the normal app background with solid tiles, so
                      severity reads through value colour and tracks, not a page tint. */}
                  <div className="rounded-2xl border p-5 sm:p-6 space-y-4" style={washStyle(color)}>
                  {/* Verdict header: temperature + condition left, state pill right. */}
                  <div className="flex items-start justify-between gap-4 wx-rise">
                    <div className="flex items-center gap-3 min-w-0">
                      <ConditionGlyph className="w-11 h-11 shrink-0" style={{ color }} strokeWidth={1.75} />
                      <div className="min-w-0">
                        <div className="text-4xl font-bold leading-none text-content tabular-nums">
                          {Math.round(tempDisplay)}
                          <span className="text-xl font-semibold text-content-secondary">&deg;C</span>
                        </div>
                        <div className="text-sm text-content-secondary mt-1">{condition.label}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-content-secondary mb-1">
                        {tr('weather.WeatherBriefingView.flightConditions')}
                      </div>
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-lg font-bold tracking-wide"
                        style={pillStyle(color)}
                      >
                        <StatusGlyph className="w-5 h-5" />
                        {STATUS_PILL_WORD[status]}
                      </span>
                      <div className="text-[10px] text-content-tertiary mt-1.5 flex items-center justify-end gap-1 tabular-nums">
                        <MapPin className="w-3 h-3" />
                        {locationLabel(location)} · {formatClock(weather.currentTimeIso)} {tr('weather.WeatherBriefingView.local')}
                      </div>
                    </div>
                  </div>

                  {/* One-line plain-language verdict with a state accent bar. */}
                  <div className="flex items-stretch gap-3 wx-rise" style={{ animationDelay: '60ms' }}>
                    <span className={`w-1.5 rounded-full shrink-0 ${pulse}`} style={{ background: color }} />
                    <p className="text-sm text-content-secondary self-center">{STATUS_SUMMARY[status]}</p>
                  </div>
                  </div>

                  {/* Wind instrument + launch-gate tiles, on the normal background. */}
                  <div className="grid gap-4 lg:grid-cols-[auto_1fr] items-start wx-rise" style={{ animationDelay: '120ms' }}>
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-default bg-surface-solid p-4 shadow-sm">
                      <WindRose
                        dirDeg={weather.windDirDeg}
                        speedMs={weather.windSpeedMs}
                        gustMs={weather.windGustMs}
                        speedGrade={speedGrade}
                        gustGrade={gustGrade}
                        unit={windSpeedUnit}
                        animate={animate}
                      />
                      <div className="flex items-center gap-2 text-xs text-content-secondary">
                        {/* Points INTO the wind (the FROM bearing), same convention
                            as the rose vane, so the two never disagree. */}
                        <ArrowUp
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color, transform: `rotate(${weather.windDirDeg}deg)` }}
                        />
                        {tr('weather.WeatherBriefingView.windFrom')} <span className="font-semibold text-content">{compassPoint(weather.windDirDeg)}</span>
                        <span className="text-content-tertiary tabular-nums">{Math.round(weather.windDirDeg)}&deg;</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-content-tertiary mb-2">
                        {tr('weather.WeatherBriefingView.launchGates')}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <MetricTile
                          icon={<Wind className="w-3.5 h-3.5" />}
                          label={tr('weather.WeatherBriefingView.gusts')}
                          value={windVal(weather.windGustMs)}
                          unit={windUnitLabel}
                          valueColor={GRADE_COLOR[gustGrade]}
                          track={highTrack(weather.windGustMs, 'windGustMs', gustGrade, windLimitTip('windGustMs'))}
                          animate={animate}
                        />
                        <MetricTile
                          icon={<Wind className="w-3.5 h-3.5" />}
                          label={tr('weather.WeatherBriefingView.wind')}
                          value={windVal(weather.windSpeedMs)}
                          unit={windUnitLabel}
                          valueColor={GRADE_COLOR[speedGrade]}
                          track={highTrack(weather.windSpeedMs, 'windSpeedMs', speedGrade, windLimitTip('windSpeedMs'))}
                          animate={animate}
                        />
                        <MetricTile
                          icon={<CloudRain className="w-3.5 h-3.5" />}
                          label={tr('weather.WeatherBriefingView.precip')}
                          value={weather.precipMm.toFixed(1)}
                          unit="mm"
                          valueColor={GRADE_COLOR[grade('precipMm')]}
                          track={highTrack(weather.precipMm, 'precipMm', grade('precipMm'),
                            `Caution ${WEATHER_THRESHOLDS.precipMm.caution} mm, no-go ${WEATHER_THRESHOLDS.precipMm.nogo} mm`)}
                          animate={animate}
                        />
                        <MetricTile
                          icon={<Droplets className="w-3.5 h-3.5" />}
                          label={tr('weather.WeatherBriefingView.precipChance')}
                          value={`${Math.round(weather.precipProbPct)}`}
                          unit="%"
                          valueColor={GRADE_COLOR[grade('precipProbPct')]}
                          track={highTrack(weather.precipProbPct, 'precipProbPct', grade('precipProbPct'),
                            `Caution ${WEATHER_THRESHOLDS.precipProbPct.caution}%, no-go ${WEATHER_THRESHOLDS.precipProbPct.nogo}%`, 100)}
                          animate={animate}
                        />
                        <MetricTile
                          icon={<Eye className="w-3.5 h-3.5" />}
                          label={tr('weather.WeatherBriefingView.visibility')}
                          value={(weather.visibilityM / 1000).toFixed(1)}
                          unit="km"
                          valueColor={GRADE_COLOR[grade('visibilityM')]}
                          track={lowTrack(weather.visibilityM, 'visibilityM', grade('visibilityM'),
                            `Caution below ${(WEATHER_THRESHOLDS.visibilityM.caution / 1000).toFixed(1)} km, no-go below ${(WEATHER_THRESHOLDS.visibilityM.nogo / 1000).toFixed(1)} km`)}
                          animate={animate}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Context metrics: shown for awareness, never gate a launch. */}
                  <div className="wx-rise" style={{ animationDelay: '200ms' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-content-tertiary mb-2">
                      {tr('weather.WeatherBriefingView.context')}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <MetricTile
                        icon={<Thermometer className="w-3.5 h-3.5" />}
                        label={tr('weather.WeatherBriefingView.temp')}
                        value={`${Math.round(weather.tempC)}`}
                        unit="degC"
                        animate={animate}
                      />
                      <MetricTile
                        icon={<Cloud className="w-3.5 h-3.5" />}
                        label={tr('weather.WeatherBriefingView.clouds')}
                        value={`${Math.round(weather.cloudCoverPct)}`}
                        unit="%"
                        animate={animate}
                      />
                      <MetricTile
                        icon={<Gauge className="w-3.5 h-3.5" />}
                        label={tr('weather.WeatherBriefingView.pressure')}
                        value={`${Math.round(weather.pressureHpa)}`}
                        unit="hPa"
                        animate={animate}
                      />
                    </div>
                  </div>

                  {/* Geomagnetic section: current Kp + forecast peak (gating) and
                      the offline WMM field (context). Folds into the hero verdict. */}
                  <GeomagSection
                    activity={geomag}
                    unavailable={geomagUnavailable}
                    field={geomagField}
                    modelValid={geomagModelValid}
                    verdict={geomagVerdict}
                    animate={animate}
                  />

                  {/* Plain-language reason strip when marginal or unsafe. Combines
                      the worst weather driver with any geomagnetic reasons. */}
                  {status !== 'go' && (() => {
                    const reasonLines: string[] = [];
                    if (weatherStatus && weatherStatus !== 'go') {
                      const wr = worstReason(weather, windSpeedUnit);
                      if (wr) reasonLines.push(wr);
                    }
                    if (geomagVerdict) reasonLines.push(...geomagVerdict.reasons);
                    if (reasonLines.length === 0) return null;
                    return (
                      <div
                        className="rounded-xl border p-3 flex items-start gap-2.5 wx-rise"
                        style={{ ...tintStyle(color, 10, 26), animationDelay: '300ms' }}
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} />
                        <div className="space-y-1">
                          {reasonLines.map((line) => (
                            <p key={line} className="text-xs leading-relaxed" style={{ color }}>{line}</p>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Provenance and the reference limits, so grading is auditable. */}
                  <div
                    className="pt-1 text-[10px] text-content-tertiary text-center space-y-1 wx-rise"
                    style={{ animationDelay: '320ms' }}
                  >
                    <div className="tabular-nums">
                      {tr('weather.WeatherBriefingView.forecastValid')} {formatClock(weather.currentTimeIso)} {tr('weather.WeatherBriefingView.localAtSiteOpenMeteo')}
                      {lastFetchMs && <> {tr('weather.WeatherBriefingView.updated')} {new Date(lastFetchMs).toLocaleTimeString()}</>}
                    </div>
                    <div className="leading-relaxed tabular-nums">
                      {tr('weather.WeatherBriefingView.limitsGusts')} {WEATHER_THRESHOLDS.windGustMs.caution} / {WEATHER_THRESHOLDS.windGustMs.nogo} m/s,
                      {' '}{tr('weather.WeatherBriefingView.wind2')} {WEATHER_THRESHOLDS.windSpeedMs.caution} / {WEATHER_THRESHOLDS.windSpeedMs.nogo} m/s,
                      {' '}{tr('weather.WeatherBriefingView.precipChance2')} {WEATHER_THRESHOLDS.precipProbPct.caution} / {WEATHER_THRESHOLDS.precipProbPct.nogo}%,
                      {' '}{tr('weather.WeatherBriefingView.precip2')} {WEATHER_THRESHOLDS.precipMm.caution} / {WEATHER_THRESHOLDS.precipMm.nogo} {tr('weather.WeatherBriefingView.mm')}
                      {' '}{tr('weather.WeatherBriefingView.visibilityBelow')} {(WEATHER_THRESHOLDS.visibilityM.caution / 1000).toFixed(1)} / {(WEATHER_THRESHOLDS.visibilityM.nogo / 1000).toFixed(1)} {tr('weather.WeatherBriefingView.km')}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : null}
        </div>
      </div>
    </div>
  );
}
