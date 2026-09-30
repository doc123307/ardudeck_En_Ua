import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { CanvasStreamSnapshot } from './useCanvasStream';
import type { PublishStats } from './whip-publish';
import { streamReadUrls } from '../../../shared/camera-types';
import { t } from '../../i18n';

export function StreamPopover({ stream, path, installing, onStart, onStop, onInstall, onClose, className, hud }: {
  stream: CanvasStreamSnapshot;
  path: string;
  installing: boolean;
  onStart: () => void;
  onStop: () => void;
  onInstall: () => void;
  onClose: () => void;
  className: string;
  /** Offered where the view has overlays worth sending; absent means canvas only. */
  hud?: { value: boolean; onChange: (v: boolean) => void };
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const live = stream.state === 'live';
  const busy = stream.state === 'starting' || installing;
  const urls = streamReadUrls(path);
  const rtsp = urls[0]!.url;
  const snippet = `cv2.VideoCapture("${rtsp}")`;

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied((c) => (c === text ? null : c)), 1500);
    });
  };

  const statusLine = live
    ? `Live, ${stream.codec ?? 'video'}, ${stream.readers} reader${stream.readers === 1 ? '' : 's'}`
    : installing
      ? 'Installing engine...'
      : stream.state === 'starting'
        ? 'Starting...'
        : 'Off';

  const what = !hud
    ? 'Sends the 3D view only, without HUD or controls.'
    : hud.value
      ? 'Sends the followed vehicle\'s view with HUD and OSD, rendered on its own so nothing on screen covers it.'
      : 'Sends the terrain only, without HUD or OSD.';

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className={`absolute right-0 z-40 w-80 max-w-[calc(100vw-1.5rem)] rounded-lg border border-default bg-surface-solid p-2 shadow-xl ${className}`}>
        <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
          <div className="text-[10px] uppercase tracking-wide text-content-tertiary">{t('camera.StreamPopover.videoStream')}</div>
          <div className={`truncate text-[11px] ${live ? 'text-emerald-400' : 'text-content-secondary'}`}>{statusLine}</div>
        </div>

        {hud && (
          <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[11px] text-content hover:bg-surface-raised">
            <input
              type="checkbox"
              checked={hud.value}
              onChange={(e) => hud.onChange(e.target.checked)}
              className="accent-blue-500"
            />
            {t('camera.StreamPopover.includeHudAndOsd')}
          </label>
        )}
        <div className="px-1 pb-1.5 text-[10px] leading-snug text-content-tertiary">
          {what} {t('camera.StreamPopover.upTo30FpsAnd1920')}
        </div>

        {stream.needsInstall && !live ? (
          <button
            onClick={onInstall}
            disabled={busy}
            className="w-full rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {installing ? t('camera.StreamPopover.installing') : t('camera.StreamPopover.installVideoEngine95mb')}
          </button>
        ) : (
          <button
            onClick={live ? onStop : onStart}
            disabled={busy}
            className={`w-full rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
              live ? 'border border-subtle bg-surface-raised text-content hover:bg-surface-base' : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {live ? t('camera.StreamPopover.stopStream') : busy ? t('camera.StreamPopover.starting') : t('camera.StreamPopover.startStream')}
          </button>
        )}

        {live && stream.stats && <StatsLine stats={stream.stats} />}

        {stream.error && (
          <div className="mt-1.5 break-words rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300">
            {stream.error}
          </div>
        )}

        <div className="mt-2 border-t border-subtle pt-1.5">
          <div className="px-1 pb-1 text-[10px] uppercase tracking-wide text-content-tertiary">{t('camera.StreamPopover.readItOnThisComputer')}</div>
          <div className="flex flex-col gap-1">
            {urls.map((u) => (
              <CopyRow key={u.id} label={u.label} text={u.url} hint={u.hint} copied={copied === u.url} onCopy={() => copy(u.url)} />
            ))}
            <CopyRow label="OpenCV" text={snippet} copied={copied === snippet} onCopy={() => copy(snippet)} />
          </div>
          <div className="break-words px-1 pt-1.5 text-[10px] leading-snug text-content-tertiary">
            {t('camera.StreamPopover.rtspIsServedOverTcpFor')} <code className="break-all font-mono">OPENCV_FFMPEG_CAPTURE_OPTIONS=rtsp_transport;tcp</code> {t('camera.StreamPopover.toSkipTheUdpAttempt')}
          </div>
        </div>
      </div>
    </>
  );
}

function CopyRow({ label, text, hint, copied, onCopy }: {
  label: string;
  text: string;
  hint?: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-start gap-1.5 rounded-md border border-subtle bg-surface-base px-2 py-1">
      <span className="mt-px w-12 shrink-0 text-[10px] font-medium text-content-secondary">{label}</span>
      <div className="min-w-0 flex-1">
        <code className="block break-all font-mono text-[11px] leading-snug text-content">{text}</code>
        {hint && <div className="text-[10px] leading-snug text-content-tertiary">{hint}</div>}
      </div>
      <button
        onClick={onCopy}
        data-tip={t('camera.StreamPopover.copy')}
        className="shrink-0 rounded p-0.5 text-content-tertiary transition-colors hover:text-content"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function StatsLine({ stats }: { stats: PublishStats }) {
  const cpuBound = stats.limitedBy === 'cpu';
  const software = stats.hardware === false;
  const parts = [
    stats.width && stats.height ? `${stats.width}x${stats.height}` : null,
    stats.fps !== null ? `${Math.round(stats.fps)} fps` : null,
    stats.encoder ? `${stats.encoder}${software ? ' (CPU)' : stats.hardware ? ' (hardware)' : ''}` : null,
  ].filter(Boolean);
  return (
    <div className={`mt-1.5 break-words px-1 font-mono text-[10px] ${cpuBound ? 'text-amber-300' : 'text-content-tertiary'}`}>
      {parts.join(' \u00b7 ')}
      {cpuBound && <div className="font-sans">{t('camera.StreamPopover.encoderIsCpuLimitedUntickHud')}</div>}
    </div>
  );
}
