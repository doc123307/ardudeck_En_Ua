/**
 * Links manager - add and remove extra vehicle connections beyond the primary.
 *
 * The primary connection (the main Connect button) carries its vehicles already.
 * This adds *additional* links: a background MAVLink link (a second UDP/TCP feed)
 * or an orchestration server (channel-framed WebSocket with MAVLink passthrough).
 * Vehicles discovered on any link appear in the fleet automatically.
 *
 * Shown in the connection panel once a primary connection exists.
 */

import { useEffect, useState, useCallback } from 'react';
import type { TransportInfoIpc } from '../../../shared/ipc-channels';
import { OrchestrationPanel } from './OrchestrationPanel';
import { t as tr } from '../../i18n';

type AddKind = 'udp' | 'tcp' | 'orchestration';

const KINDS: { id: AddKind; label: string }[] = [
  { id: 'udp', label: 'UDP' },
  { id: 'tcp', label: 'TCP' },
  { id: 'orchestration', get label() { return tr('connection.LinksManager.server'); } },
];

export function LinksManager() {
  const [transports, setTransports] = useState<TransportInfoIpc[]>([]);
  const [kind, setKind] = useState<AddKind>('udp');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('14551');
  const [url, setUrl] = useState('wss://');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    window.electronAPI?.listTransports?.().then(setTransports).catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const offD = window.electronAPI?.onVehicleDiscovered?.(() => refresh());
    const offL = window.electronAPI?.onVehicleLost?.(() => refresh());
    const interval = setInterval(refresh, 3000);
    return () => { offD?.(); offL?.(); clearInterval(interval); };
  }, [refresh]);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      if (kind === 'orchestration') {
        await window.electronAPI?.addOrchestrationLink?.(url, token || undefined);
      } else {
        const p = parseInt(port, 10);
        await window.electronAPI?.addTransport?.(
          kind === 'tcp'
            ? { type: 'tcp', host, tcpPort: p }
            : { type: 'udp', udpPort: p },
        );
      }
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('connection.LinksManager.failedToAddLink'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await window.electronAPI?.removeTransport?.(id);
      refresh();
    } catch {
      // primary refuses removal; ignore
    }
  };

  return (
    <div>
      <span className="text-[11px] uppercase tracking-wide text-content-secondary">{tr('connection.LinksManager.connectionSources')}</span>

      {/* Existing transports */}
      {transports.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {transports.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-lg border border-subtle bg-surface px-3 py-2"
            >
              <span className="font-mono text-xs text-content truncate flex-1">{t.label}</span>
              <span className="text-[11px] text-content-tertiary shrink-0">
                {t.vehicleCount} veh
              </span>
              {t.isPrimary ? (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-raised text-content-tertiary shrink-0">
                  {tr('connection.LinksManager.primary')}
                </span>
              ) : (
                <button
                  onClick={() => remove(t.id)}
                  className="text-[11px] text-red-400 hover:text-red-300 transition-colors shrink-0"
                >
                  {tr('connection.LinksManager.remove')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add a link */}
      <div className="mt-3 rounded-xl border border-subtle bg-surface p-3 space-y-3">
        <div className="text-[11px] uppercase tracking-wide text-content-secondary">{tr('connection.LinksManager.addASource')}</div>

        {/* Kind selector - segmented control matching the single-vehicle protocol toggle */}
        <div className="flex rounded-lg overflow-hidden border border-subtle">
          {KINDS.map((k, i) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                kind === k.id
                  ? 'bg-blue-600/30 text-blue-300'
                  : 'text-content-secondary hover:text-content hover:bg-surface-raised'
              } ${i < KINDS.length - 1 ? 'border-r border-subtle' : ''}`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {kind === 'orchestration' ? (
          <>
            <div>
              <label className="label">{tr('connection.LinksManager.serverUrl')}</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="wss://server.example.com"
                className="input"
              />
            </div>
            <div>
              <label className="label">{tr('connection.LinksManager.tokenOptional')}</label>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={tr('connection.LinksManager.accessToken')}
                className="input"
              />
            </div>
          </>
        ) : (
          <div className="flex gap-2">
            {kind === 'tcp' && (
              <div className="flex-1">
                <label className="label">{tr('connection.LinksManager.host')}</label>
                <input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="127.0.0.1"
                  className="input"
                />
              </div>
            )}
            <div className={kind === 'tcp' ? 'w-24' : 'flex-1'}>
              <label className="label">{tr('connection.LinksManager.port')}</label>
              <input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="14551"
                className="input"
                inputMode="numeric"
              />
            </div>
          </div>
        )}

        <button onClick={add} disabled={busy} className="btn btn-primary w-full">
          {busy ? tr('connection.LinksManager.adding') : tr('connection.LinksManager.addSource')}
        </button>

        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </div>

      <OrchestrationPanel />
    </div>
  );
}
