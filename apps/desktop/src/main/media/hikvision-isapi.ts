/**
 * Image controls for Hikvision IP cameras over ISAPI (HTTP + digest auth).
 *
 * Read-modify-write on purpose: ISAPI PUTs replace the whole settings object, and the
 * object carries thresholds and timings this code knows nothing about. Taking the
 * camera's own XML, changing the one element and sending it back leaves the rest as
 * the installer set it.
 */

import { createHash, randomBytes } from 'node:crypto';
import type {
  CameraControlAction, CameraControlState, CameraSourceConfig, DayNightMode,
} from '../../shared/camera-types.js';
import { mt } from '../i18n';

const TIMEOUT_MS = 5000;
const DAY_NIGHT_MODES: DayNightMode[] = ['auto', 'day', 'night'];

export interface IsapiTarget {
  base: string;
  username: string;
  password: string;
  channel: number;
  /** The host came from an RTSP url on a relay port, which is rarely the camera itself. */
  likelyRelay?: boolean;
}

/** RTSP ports used by relays (mediamtx, go2rtc), not by IP cameras (554). */
const RELAY_RTSP_PORTS = new Set(['8554', '8555']);

/** Where the API is: explicit control settings first, then whatever the RTSP url says. */
export function resolveTarget(source: CameraSourceConfig): IsapiTarget | null {
  const control = source.control;
  if (!control || control.vendor !== 'hikvision') return null;
  let rtsp: URL | null = null;
  try {
    rtsp = source.url ? new URL(source.url) : null;
  } catch {
    rtsp = null;
  }
  const host = control.host?.trim() || rtsp?.hostname;
  if (!host) return null;
  const scheme = control.https ? 'https' : 'http';
  const port = control.port ?? (control.https ? 443 : 80);
  const defaultPort = control.https ? 443 : 80;
  return {
    base: `${scheme}://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}${port === defaultPort ? '' : `:${port}`}`,
    username: control.username ?? decodeURIComponent(rtsp?.username ?? ''),
    password: control.password ?? decodeURIComponent(rtsp?.password ?? ''),
    channel: control.channel ?? 1,
    likelyRelay: !control.host?.trim() && !!rtsp && RELAY_RTSP_PORTS.has(rtsp.port),
  };
}

/** Parses `Digest realm="..", nonce="..", qop="auth"` into its fields. */
export function parseChallenge(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of header.replace(/^\s*Digest\s+/i, '').matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g)) {
    out[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? '';
  }
  return out;
}

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

/** RFC 7616 digest response (MD5, qop=auth or none), which is what Hikvision firmware asks for. */
export function digestHeader(
  challenge: Record<string, string>, method: string, uri: string, username: string, password: string,
  cnonce = randomBytes(8).toString('hex'), nc = '00000001',
): string {
  const ha1 = md5(`${username}:${challenge.realm ?? ''}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const qop = (challenge.qop ?? '').split(',').map((q) => q.trim()).includes('auth') ? 'auth' : '';
  const response = qop
    ? md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${challenge.nonce}:${ha2}`);
  const parts = [
    `username="${username}"`, `realm="${challenge.realm ?? ''}"`, `nonce="${challenge.nonce ?? ''}"`,
    `uri="${uri}"`, `response="${response}"`, 'algorithm=MD5',
  ];
  if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`);
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  return `Digest ${parts.join(', ')}`;
}

/** One ISAPI request, answering a digest (or basic) challenge when the camera sends one. */
export async function isapiRequest(
  target: IsapiTarget, method: 'GET' | 'PUT', path: string, body?: string,
): Promise<{ status: number; text: string }> {
  const url = target.base + path;
  const send = (authorization?: string) => fetch(url, {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/xml' } : {}),
    },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let res = await send();
  if (res.status === 401) {
    const challenge = res.headers.get('www-authenticate') ?? '';
    await res.arrayBuffer().catch(() => undefined);
    const auth = /^\s*basic/i.test(challenge)
      ? `Basic ${Buffer.from(`${target.username}:${target.password}`).toString('base64')}`
      : digestHeader(parseChallenge(challenge), method, path, target.username, target.password);
    res = await send(auth);
  }
  return { status: res.status, text: await res.text() };
}

/** Text of the first `<tag>` element, ignoring namespaces. */
export function xmlValue(xml: string, tag: string): string | undefined {
  return new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`).exec(xml)?.[1]?.trim();
}

/** The `opt="a,b,c"` list a capabilities document gives for `<tag>`. */
export function xmlOptions(xml: string, tag: string): string[] | undefined {
  const opt = new RegExp(`<${tag}\\s[^>]*opt="([^"]*)"`).exec(xml)?.[1];
  return opt ? opt.split(',').map((o) => o.trim()).filter(Boolean) : undefined;
}

/** `xml` with the first `<tag>` element's text replaced. */
export function xmlReplace(xml: string, tag: string, value: string): string {
  return xml.replace(new RegExp(`(<${tag}(?:\\s[^>]*)?>)[^<]*(</${tag}>)`), `$1${value}$2`);
}

function describeFailure(status: number, text: string): string {
  if (status === 401 || status === 403) return mt('main.media_hikvision.wrongLogin');
  const reason = xmlValue(text, 'subStatusCode') ?? xmlValue(text, 'statusString');
  return mt('main.media_hikvision.cameraRefused', { status, reason: reason ?? '' });
}

function networkError(target: IsapiTarget, err: unknown): string {
  const detail = err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err);
  const message = mt('main.media_hikvision.unreachable', { address: target.base, detail });
  return target.likelyRelay ? `${message} ${mt('main.media_hikvision.relayHint')}` : message;
}

const ircutPath = (ch: number) => `/ISAPI/Image/channels/${ch}/IrcutFilter`;
const lightPath = (ch: number) => `/ISAPI/Image/channels/${ch}/supplementLight`;

/** Current day/night and supplement light settings, plus what the camera allows. */
export async function getControlState(source: CameraSourceConfig): Promise<CameraControlState> {
  const target = resolveTarget(source);
  if (!target) return { ok: false, error: mt('main.media_hikvision.noAddress') };
  try {
    const state: CameraControlState = { ok: true };
    const ircut = await isapiRequest(target, 'GET', ircutPath(target.channel));
    if (ircut.status === 401 || ircut.status === 403) return { ok: false, error: describeFailure(ircut.status, ircut.text) };
    if (ircut.status === 200) {
      const mode = xmlValue(ircut.text, 'IrcutFilterType');
      if (mode && (DAY_NIGHT_MODES as string[]).includes(mode)) state.dayNight = mode as DayNightMode;
      const caps = await isapiRequest(target, 'GET', `${ircutPath(target.channel)}/capabilities`).catch(() => null);
      const opts = caps?.status === 200 ? xmlOptions(caps.text, 'IrcutFilterType') : undefined;
      state.dayNightOptions = (opts?.filter((o) => (DAY_NIGHT_MODES as string[]).includes(o)) as DayNightMode[] | undefined) ?? DAY_NIGHT_MODES;
    }
    const light = await isapiRequest(target, 'GET', lightPath(target.channel));
    if (light.status === 200) {
      state.light = xmlValue(light.text, 'supplementLightMode');
      const caps = await isapiRequest(target, 'GET', `${lightPath(target.channel)}/capabilities`).catch(() => null);
      state.lightOptions = (caps?.status === 200 ? xmlOptions(caps.text, 'supplementLightMode') : undefined)
        ?? (state.light ? [state.light, ...(state.light === 'close' ? [] : ['close'])] : undefined);
    }
    if (!state.dayNight && !state.light) return { ok: false, error: mt('main.media_hikvision.noImageControls') };
    return state;
  } catch (err) {
    return { ok: false, error: networkError(target, err) };
  }
}

/** Applies one change, then reads the settings back so the UI shows what the camera took. */
export async function applyControl(source: CameraSourceConfig, action: CameraControlAction): Promise<CameraControlState> {
  const target = resolveTarget(source);
  if (!target) return { ok: false, error: mt('main.media_hikvision.noAddress') };
  const [path, tag] = action.kind === 'dayNight'
    ? [ircutPath(target.channel), 'IrcutFilterType']
    : [lightPath(target.channel), 'supplementLightMode'];
  try {
    const current = await isapiRequest(target, 'GET', path);
    if (current.status !== 200) return { ok: false, error: describeFailure(current.status, current.text) };
    const res = await isapiRequest(target, 'PUT', path, xmlReplace(current.text, tag, action.mode));
    if (res.status !== 200) return { ok: false, error: describeFailure(res.status, res.text) };
  } catch (err) {
    return { ok: false, error: networkError(target, err) };
  }
  return getControlState(source);
}
