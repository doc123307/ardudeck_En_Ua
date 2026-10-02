/**
 * What every camera control protocol needs first: where the camera's API is, and an
 * HTTP request that answers a digest (or basic) challenge.
 */

import type { CameraSourceConfig } from '../../shared/camera-types.js';
import { digestHeader, pickChallenge } from './hikvision-isapi.js';
import { mt } from '../i18n';

export const CONTROL_TIMEOUT_MS = 5000;

export interface ControlTarget {
  /** scheme://host[:port], no trailing slash. */
  base: string;
  username: string;
  password: string;
  /** 1-based video channel. */
  channel: number;
  /** The host came from an RTSP url on a relay port, which is rarely the camera itself. */
  likelyRelay: boolean;
}

/** RTSP ports used by relays (mediamtx, go2rtc), not by IP cameras (554). */
const RELAY_RTSP_PORTS = new Set(['8554', '8555']);

/** Where the API is: explicit control settings first, then whatever the RTSP url says. */
export function resolveControlTarget(source: CameraSourceConfig): ControlTarget | null {
  const control = source.control;
  if (!control) return null;
  let rtsp: URL | null = null;
  try {
    rtsp = source.url ? new URL(source.url) : null;
  } catch {
    rtsp = null;
  }
  const host = control.host?.trim() || rtsp?.hostname;
  if (!host) return null;
  const scheme = control.https ? 'https' : 'http';
  const defaultPort = control.https ? 443 : 80;
  const port = control.port ?? defaultPort;
  return {
    base: `${scheme}://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}${port === defaultPort ? '' : `:${port}`}`,
    username: control.username ?? decodeURIComponent(rtsp?.username ?? ''),
    password: control.password ?? decodeURIComponent(rtsp?.password ?? ''),
    channel: control.channel ?? 1,
    likelyRelay: !control.host?.trim() && !!rtsp && RELAY_RTSP_PORTS.has(rtsp.port),
  };
}

export interface HttpAnswer {
  status: number;
  text: string;
}

/**
 * One request to the camera. `pathOrUrl` is a path on the target, or a full url (a
 * service address a protocol handed back). A 401 is answered once with the account.
 */
export async function cameraRequest(
  target: ControlTarget,
  method: string,
  pathOrUrl: string,
  options: { body?: string; contentType?: string; headers?: Record<string, string> } = {},
): Promise<HttpAnswer> {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : target.base + pathOrUrl;
  const parsed = new URL(url);
  // Digest signs the request target exactly as sent: path plus query.
  const uri = parsed.pathname + parsed.search;
  const send = (authorization?: string) => fetch(url, {
    method,
    headers: {
      ...(options.headers ?? {}),
      ...(authorization ? { Authorization: authorization } : {}),
      ...(options.body !== undefined ? { 'Content-Type': options.contentType ?? 'application/xml' } : {}),
    },
    body: options.body,
    signal: AbortSignal.timeout(CONTROL_TIMEOUT_MS),
  });
  let res = await send();
  const challengeHeader = res.headers.get('www-authenticate');
  if (res.status === 401 && challengeHeader && target.username) {
    const challenge = pickChallenge(challengeHeader);
    await res.arrayBuffer().catch(() => undefined);
    const auth = challenge.scheme === 'basic'
      ? `Basic ${Buffer.from(`${target.username}:${target.password}`).toString('base64')}`
      : digestHeader(challenge.fields, method, uri, target.username, target.password);
    res = await send(auth);
  }
  return { status: res.status, text: await res.text() };
}

/** "Camera does not answer at ...", with the relay hint when the address is a guess. */
export function unreachableMessage(target: ControlTarget, err: unknown): string {
  const detail = err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err);
  const message = mt('main.media_hikvision.unreachable', { address: target.base, detail });
  return target.likelyRelay ? `${message} ${mt('main.media_hikvision.relayHint')}` : message;
}
