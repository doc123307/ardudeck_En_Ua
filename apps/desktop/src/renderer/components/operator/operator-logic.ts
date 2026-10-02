/** Pure helpers of the operator screen: no React, no stores. */

import type { ConnectOptions } from '../../../shared/ipc-channels';
import type { ConnectionMemory } from '../../stores/settings-store';

/** MAV_TYPE of the vehicles the operator screen drives: ground rover and surface boat. */
export function isRoverLike(mavType: number | undefined): boolean {
  return mavType === 10 || mavType === 11;
}

export type TiltLevel = 'ok' | 'warn' | 'danger';

/** How close a roll or pitch angle is to tipping the vehicle over. */
export function tiltLevel(deg: number, warnDeg: number, limitDeg: number): TiltLevel {
  const a = Math.abs(deg);
  if (a >= limitDeg) return 'danger';
  if (a >= warnDeg) return 'warn';
  return 'ok';
}

/** 754000 -> "12:34", 5025000 -> "1:23:45". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export type FixKind = 'none' | '2d' | '3d' | 'dgps' | 'rtk';

/** GPS_FIX_TYPE -> what the operator needs to know. */
export function fixKind(fixType: number | undefined): FixKind {
  if (fixType === undefined || fixType < 2) return 'none';
  if (fixType === 2) return '2d';
  if (fixType === 3) return '3d';
  if (fixType === 4) return 'dgps';
  return 'rtk';
}

/** The link the connection panel used last, as a connect request; null when nothing was ever used. */
export function connectOptionsFromMemory(memory: ConnectionMemory | undefined): ConnectOptions | null {
  if (!memory?.lastConnectionType) return null;
  if (memory.lastConnectionType === 'serial') {
    return memory.lastSerialPort
      ? { type: 'serial', port: memory.lastSerialPort, baudRate: memory.lastBaudRate ?? 115200 }
      : null;
  }
  if (memory.lastConnectionType === 'tcp') {
    return memory.lastTcpHost && memory.lastTcpPort
      ? { type: 'tcp', host: memory.lastTcpHost, tcpPort: memory.lastTcpPort, protocol: memory.lastTcpProtocol }
      : null;
  }
  const mode = memory.lastUdpMode ?? 'listen';
  if (mode === 'client') {
    return memory.lastUdpRemoteHost && memory.lastUdpRemotePort
      ? {
        type: 'udp',
        udpMode: 'client',
        udpPort: memory.lastUdpPort,
        udpRemoteHost: memory.lastUdpRemoteHost,
        udpRemotePort: memory.lastUdpRemotePort,
        udpClientLocalPort: memory.lastUdpClientLocalPort,
        protocol: memory.lastUdpProtocol,
      }
      : null;
  }
  return memory.lastUdpPort ? { type: 'udp', udpMode: 'listen', udpPort: memory.lastUdpPort, protocol: memory.lastUdpProtocol } : null;
}

/** "UDP 100.67.0.245:14550", "TCP 127.0.0.1:5760", "COM5 @ 115200". */
export function describeConnection(options: ConnectOptions | null): string {
  if (!options) return '';
  if (options.type === 'serial') return `${options.port ?? '?'} @ ${options.baudRate ?? 115200}`;
  if (options.type === 'tcp') return `TCP ${options.host ?? '?'}:${options.tcpPort ?? '?'}`;
  return options.udpMode === 'client'
    ? `UDP ${options.udpRemoteHost ?? '?'}:${options.udpRemotePort ?? '?'}`
    : `UDP :${options.udpPort ?? '?'}`;
}

/** Progress (0..1) of a press that must be held for `holdMs`. */
export function holdProgress(startedAt: number | null, now: number, holdMs: number): number {
  if (startedAt === null) return 0;
  return Math.min(1, Math.max(0, (now - startedAt) / holdMs));
}
