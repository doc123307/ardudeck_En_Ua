/**
 * Image controls for one IP camera: day/night, supplement light (IR / white) and
 * HD/SD stream. Only the controls the camera actually reports are shown, so an IR-only
 * camera never offers a white light it does not have.
 */

import { useEffect } from 'react';
import { controlKey, useCameraControlStore } from '../../stores/camera-control-store';
import { Loader2, Moon, Sun, SunMoon } from 'lucide-react';
import type {
  CameraControlAction, CameraControlState, CameraSourceConfig, DayNightMode, SupplementLightMode,
} from '../../../shared/camera-types';
import { useCameraStore } from '../../stores/camera-store';
import { streamQuality, withStreamQuality, type StreamQuality } from './stream-quality';
import { t } from '../../i18n';

const DAY_NIGHT_ICON: Record<DayNightMode, typeof Sun> = { auto: SunMoon, day: Sun, night: Moon };

export function dayNightLabel(mode: DayNightMode): string {
  return t(`camera.CameraControlBar.dayNight_${mode}`);
}

/** Readable name for an ISAPI supplement light mode; unknown modes show as the camera names them. */
export function lightLabel(mode: SupplementLightMode): string {
  const known: Record<string, string> = {
    irLight: t('camera.CameraControlBar.lightIr'),
    colorVuWhiteLight: t('camera.CameraControlBar.lightWhite'),
    eventIntelligence: t('camera.CameraControlBar.lightSmart'),
    mixed: t('camera.CameraControlBar.lightMixed'),
    close: t('camera.CameraControlBar.lightOff'),
  };
  return known[mode] ?? mode;
}

/** True when the feed has anything to control: a camera API, or an url that names its HD/SD stream. */
export function hasCameraControls(source: CameraSourceConfig): boolean {
  return source.control?.vendor === 'hikvision' || (source.kind === 'rtsp' && streamQuality(source.url) !== null);
}

const BTN = 'px-2 py-0.5 text-[11px] transition-colors disabled:opacity-40';
const ON = 'bg-blue-600 text-white';
const OFF = 'text-content-secondary hover:bg-surface-raised';

export function CameraControlBar({ source, compact = false }: { source: CameraSourceConfig; compact?: boolean }) {
  const updateSource = useCameraStore((s) => s.updateSource);
  const hasControl = source.control?.vendor === 'hikvision';
  const quality = source.kind === 'rtsp' ? streamQuality(source.url) : null;
  // Shared with every other view of this camera, so it is asked once, not once per widget.
  const key = controlKey(source);
  const entry = useCameraControlStore((s) => s.entries[source.id]);
  const current = entry?.key === key ? entry : undefined;
  const state: CameraControlState | null = current?.state ?? null;
  const busy = current?.busy ?? false;
  const ensure = useCameraControlStore((s) => s.ensure);
  const refresh = useCameraControlStore((s) => s.refresh);
  const applyAction = useCameraControlStore((s) => s.apply);

  useEffect(() => {
    if (hasControl) ensure(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasControl, key]);

  const apply = (action: CameraControlAction) => applyAction(source, action);

  const setQuality = (q: StreamQuality) => {
    if (source.url && q !== quality) updateSource(source.id, { url: withStreamQuality(source.url, q) });
  };

  if (!hasControl && !quality) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${compact ? 'text-[10px]' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {quality && (
        <Segment compact={compact} label={t('camera.CameraControlBar.quality')}>
          {(['hd', 'sd'] as const).map((q) => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={`${BTN} ${quality === q ? ON : OFF}`}
              data-tip={q === 'hd' ? t('camera.CameraControlBar.hdTip') : t('camera.CameraControlBar.sdTip')}
            >{q.toUpperCase()}</button>
          ))}
        </Segment>
      )}

      {hasControl && state?.ok && state.dayNightOptions && (
        <Segment compact={compact} label={t('camera.CameraControlBar.dayNight')}>
          {state.dayNightOptions.map((m) => {
            const Icon = DAY_NIGHT_ICON[m];
            return (
              <button
                key={m}
                disabled={busy}
                onClick={() => void apply({ kind: 'dayNight', mode: m })}
                className={`${BTN} flex items-center gap-1 ${state.dayNight === m ? ON : OFF}`}
                data-tip={dayNightLabel(m)}
              >
                <Icon className="h-3 w-3" />
                {!compact && dayNightLabel(m)}
              </button>
            );
          })}
        </Segment>
      )}

      {hasControl && state?.ok && state.lightOptions && state.lightOptions.length > 0 && (
        <Segment compact={compact} label={t('camera.CameraControlBar.light')}>
          {state.lightOptions.map((m) => (
            <button
              key={m}
              disabled={busy}
              onClick={() => void apply({ kind: 'light', mode: m })}
              className={`${BTN} ${state.light === m ? ON : OFF}`}
            >{lightLabel(m)}</button>
          ))}
        </Segment>
      )}

      {hasControl && busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-content-tertiary" />}
      {hasControl && state && !state.ok && (
        <>
          <span className="max-w-full select-text text-[10px] text-amber-400" title={state.error}>
            {compact ? t('camera.CameraControlBar.controlUnavailable') : state.error}
          </span>
          {!busy && (
            <button
              onClick={() => void refresh(source)}
              className="rounded border border-subtle px-1.5 py-0.5 text-[10px] text-content-secondary hover:text-content"
            >{t('camera.CameraControlBar.retry')}</button>
          )}
        </>
      )}
    </div>
  );
}

function Segment({ label, compact, children }: { label: string; compact: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1" data-tip={compact ? label : undefined}>
      {!compact && <span className="text-[10px] uppercase tracking-wide text-content-tertiary">{label}</span>}
      <div className="flex overflow-hidden rounded-md border border-subtle">{children}</div>
    </div>
  );
}
