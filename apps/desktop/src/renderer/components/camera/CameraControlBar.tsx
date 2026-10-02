/**
 * Controls for one IP camera: HD/SD stream, day/night, supplement light, pan/tilt/zoom,
 * presets, and the administrator's own HTTP commands. Only what the camera actually
 * reports is shown, so an IR-only fixed camera never offers a white light or arrows.
 */

import { useEffect, useRef, useState } from 'react';
import { controlKey, useCameraControlStore } from '../../stores/camera-control-store';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Loader2, Moon, Save, Sun, SunMoon, Trash2, ZoomIn, ZoomOut,
} from 'lucide-react';
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

/** Readable name for a supplement light mode; unknown modes show as the camera names them. */
export function lightLabel(mode: SupplementLightMode): string {
  const known: Record<string, string> = {
    irLight: t('camera.CameraControlBar.lightIr'),
    colorVuWhiteLight: t('camera.CameraControlBar.lightWhite'),
    eventIntelligence: t('camera.CameraControlBar.lightSmart'),
    mixed: t('camera.CameraControlBar.lightMixed'),
    close: t('camera.CameraControlBar.lightOff'),
    auto: t('camera.CameraControlBar.lightAuto'),
    on: t('camera.CameraControlBar.lightOn'),
  };
  return known[mode] ?? mode;
}

/** True when the feed has anything to control: a camera API, or an url that names its HD/SD stream. */
export function hasCameraControls(source: CameraSourceConfig): boolean {
  return !!source.control || (source.kind === 'rtsp' && streamQuality(source.url) !== null);
}

/** Speed of a button-driven move, as a share of the camera's maximum. */
const PTZ_SPEED = 0.5;

const BTN = 'px-2 py-0.5 text-[11px] transition-colors disabled:opacity-40';
const ON = 'bg-blue-600 text-white';
const OFF = 'text-content-secondary hover:bg-surface-raised';

interface CameraControlBarProps {
  source: CameraSourceConfig;
  compact?: boolean;
  /** Also offer storing and removing presets (the source settings; not the operator screen). */
  editable?: boolean;
}

export function CameraControlBar({ source, compact = false, editable = false }: CameraControlBarProps) {
  const updateSource = useCameraStore((s) => s.updateSource);
  const hasControl = !!source.control;
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
  const sendAction = useCameraControlStore((s) => s.send);
  const [sendError, setSendError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetId, setPresetId] = useState('');
  const moving = useRef(false);

  useEffect(() => {
    if (hasControl) ensure(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasControl, key]);

  const apply = (action: CameraControlAction) => applyAction(source, action);

  /** A momentary action: nothing to re-read, only a failure worth showing. */
  const send = async (action: CameraControlAction, mark?: string) => {
    const result = await sendAction(source, action);
    setSendError(result.ok ? null : result.error ?? t('camera.CameraControlBar.controlUnavailable'));
    if (result.ok && mark) {
      setDone(mark);
      setTimeout(() => setDone((d) => (d === mark ? null : d)), 1200);
    }
  };

  const stopMove = () => {
    if (!moving.current) return;
    moving.current = false;
    void send({ kind: 'ptz', pan: 0, tilt: 0, zoom: 0 });
  };
  // A button released outside the window, or the bar going away mid-move, must still stop the camera.
  useEffect(() => {
    window.addEventListener('blur', stopMove);
    return () => {
      window.removeEventListener('blur', stopMove);
      stopMove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /** Moves while the button is held. */
  const hold = (pan: number, tilt: number, zoom: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      moving.current = true;
      void send({ kind: 'ptz', pan: pan * PTZ_SPEED, tilt: tilt * PTZ_SPEED, zoom: zoom * PTZ_SPEED });
    },
    onPointerUp: stopMove,
    onPointerLeave: stopMove,
    onPointerCancel: stopMove,
  });

  const setQuality = (q: StreamQuality) => {
    if (source.url && q !== quality) updateSource(source.id, { url: withStreamQuality(source.url, q) });
  };

  if (!hasControl && !quality) return null;

  const ok = hasControl && state?.ok === true;
  const presets = ok ? state.presets ?? [] : [];

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

      {ok && state.dayNightOptions && (
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

      {ok && state.lightOptions && state.lightOptions.length > 0 && (
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

      {ok && state.ptz && (
        <Segment compact={compact} label={t('camera.CameraControlBar.ptz')}>
          {state.ptz.move && ([
            [ArrowLeft, -1, 0, 'ptzLeft'], [ArrowUp, 0, 1, 'ptzUp'], [ArrowDown, 0, -1, 'ptzDown'], [ArrowRight, 1, 0, 'ptzRight'],
          ] as const).map(([Icon, pan, tilt, tip]) => (
            <button key={tip} {...hold(pan, tilt, 0)} className={`${BTN} ${OFF} select-none`} data-tip={t(`camera.CameraControlBar.${tip}`)}>
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
          {state.ptz.zoom && (
            <>
              <button {...hold(0, 0, -1)} className={`${BTN} ${OFF} select-none`} data-tip={t('camera.CameraControlBar.ptzZoomOut')}>
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button {...hold(0, 0, 1)} className={`${BTN} ${OFF} select-none`} data-tip={t('camera.CameraControlBar.ptzZoomIn')}>
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </Segment>
      )}

      {ok && state.ptz && (presets.length > 0 || editable) && (
        <div className="flex items-center gap-1">
          <select
            value={presetId}
            onChange={(e) => {
              const id = e.target.value;
              // On the operator screen picking a preset goes there at once; in the settings it is picked first.
              if (editable) { setPresetId(id); return; }
              if (id) void send({ kind: 'preset-goto', id });
            }}
            className="max-w-[9rem] rounded-md border border-subtle bg-surface-input px-1 py-0.5 text-[11px] text-content"
            data-tip={t('camera.CameraControlBar.presetTip')}
          >
            <option value="">{t('camera.CameraControlBar.preset')}</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {editable && (
            <>
              <button
                disabled={!presetId}
                onClick={() => void send({ kind: 'preset-goto', id: presetId })}
                className="rounded border border-subtle px-1.5 py-0.5 text-[11px] text-content-secondary hover:text-content disabled:opacity-40"
              >{t('camera.CameraControlBar.presetGo')}</button>
              <button
                disabled={!presetId || busy}
                onClick={() => { void apply({ kind: 'preset-remove', id: presetId }); setPresetId(''); }}
                className="rounded border border-subtle p-1 text-content-tertiary hover:text-red-400 disabled:opacity-40"
                data-tip={t('camera.CameraControlBar.presetRemove')}
              ><Trash2 className="h-3 w-3" /></button>
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder={t('camera.CameraControlBar.presetName')}
                className="w-28 rounded-md border border-subtle bg-surface-input px-1.5 py-0.5 text-[11px] text-content"
              />
              <button
                disabled={busy || !presetName.trim()}
                onClick={() => { void apply({ kind: 'preset-save', name: presetName.trim() }); setPresetName(''); }}
                className="flex items-center gap-1 rounded border border-subtle px-1.5 py-0.5 text-[11px] text-content-secondary hover:text-content disabled:opacity-40"
                data-tip={t('camera.CameraControlBar.presetSaveTip')}
              ><Save className="h-3 w-3" />{t('camera.CameraControlBar.presetSave')}</button>
            </>
          )}
        </div>
      )}

      {ok && state.commands && state.commands.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {state.commands.map((c) => (
            <button
              key={c.id}
              onClick={() => void send({ kind: 'command', id: c.id }, c.id)}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
                done === c.id ? 'border-emerald-500/60 bg-emerald-600/30 text-emerald-200' : 'border-subtle text-content-secondary hover:bg-surface-raised hover:text-content'
              }`}
            >{c.label}</button>
          ))}
        </div>
      )}

      {hasControl && busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-content-tertiary" />}
      {ok && sendError && (
        <span className="max-w-full select-text text-[10px] text-amber-400" title={sendError}>
          {compact ? t('camera.CameraControlBar.commandFailed') : sendError}
        </span>
      )}
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
