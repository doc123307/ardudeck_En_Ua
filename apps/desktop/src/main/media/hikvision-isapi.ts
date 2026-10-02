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
  CameraControlAction, CameraControlState, CameraPtzPreset, CameraSourceConfig, DayNightMode,
} from '../../shared/camera-types.js';
import { mt } from '../i18n';
import { controlBase } from './control-address.js';

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
  const base = controlBase(control.host, control.port, control.https, rtsp?.hostname);
  if (!base) return null;
  return {
    base,
    username: control.username ?? decodeURIComponent(rtsp?.username ?? ''),
    password: control.password ?? decodeURIComponent(rtsp?.password ?? ''),
    channel: control.channel ?? 1,
    likelyRelay: !control.host?.trim() && !!rtsp && RELAY_RTSP_PORTS.has(rtsp.port),
  };
}

/** Parses one `Digest realm="..", nonce="..", qop="auth"` challenge into its fields. */
export function parseChallenge(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of header.replace(/^\s*Digest\s+/i, '').matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g)) {
    out[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? '';
  }
  return out;
}

/**
 * Newer firmware sends several challenges at once (Digest MD5, Digest SHA-256, sometimes
 * Basic), and fetch joins them into one header. Mixing their fields - one's nonce with
 * another's algorithm - is rejected as a wrong password, so take exactly one.
 */
export function pickChallenge(header: string): { scheme: 'digest' | 'basic'; fields: Record<string, string> } {
  const parts = header.split(/,\s*(?=(?:Digest|Basic)\s)/i).map((p) => p.trim()).filter(Boolean);
  const digests = parts.filter((p) => /^digest\s/i.test(p)).map(parseChallenge);
  const md5 = digests.find((d) => !d.algorithm || /^md5$/i.test(d.algorithm));
  const chosen = md5 ?? digests.find((d) => /^sha-256$/i.test(d.algorithm ?? '')) ?? digests[0];
  return chosen ? { scheme: 'digest', fields: chosen } : { scheme: 'basic', fields: {} };
}

/** RFC 7616 digest response for the challenge's algorithm (MD5 or SHA-256), qop=auth or none. */
export function digestHeader(
  challenge: Record<string, string>, method: string, uri: string, username: string, password: string,
  cnonce = randomBytes(8).toString('hex'), nc = '00000001',
): string {
  const algorithm = challenge.algorithm ?? 'MD5';
  const hash = (s: string) => createHash(/^sha-256/i.test(algorithm) ? 'sha256' : 'md5').update(s).digest('hex');
  const ha1 = hash(`${username}:${challenge.realm ?? ''}:${password}`);
  const ha2 = hash(`${method}:${uri}`);
  const qop = (challenge.qop ?? '').split(',').map((q) => q.trim()).includes('auth') ? 'auth' : '';
  const response = qop
    ? hash(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : hash(`${ha1}:${challenge.nonce}:${ha2}`);
  const parts = [
    `username="${username}"`, `realm="${challenge.realm ?? ''}"`, `nonce="${challenge.nonce ?? ''}"`,
    `uri="${uri}"`, `response="${response}"`, `algorithm=${algorithm}`,
  ];
  if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`);
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  return `Digest ${parts.join(', ')}`;
}

/** One ISAPI request, answering a digest (or basic) challenge when the camera sends one. */
export async function isapiRequest(
  target: IsapiTarget, method: 'GET' | 'PUT' | 'DELETE', path: string, body?: string,
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
    const challenge = pickChallenge(res.headers.get('www-authenticate') ?? '');
    await res.arrayBuffer().catch(() => undefined);
    const auth = challenge.scheme === 'basic'
      ? `Basic ${Buffer.from(`${target.username}:${target.password}`).toString('base64')}`
      : digestHeader(challenge.fields, method, path, target.username, target.password);
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

/**
 * A 401 after answering the challenge: a wrong account, or the camera's illegal-login
 * lock. The body says which, and how many tries are left - worth showing, because every
 * further try with the same password brings the lock closer.
 */
function authFailure(text: string): CameraControlState {
  const unlock = Number(xmlValue(text, 'unlockTime') ?? 0);
  if (xmlValue(text, 'lockStatus') === 'lock' || unlock > 0) {
    return { ok: false, authFailed: true, error: mt('main.media_hikvision.locked', { minutes: Math.max(1, Math.ceil(unlock / 60)) }) };
  }
  const retries = xmlValue(text, 'retryLoginTime');
  const message = mt('main.media_hikvision.wrongLogin');
  return {
    ok: false,
    authFailed: true,
    error: retries ? `${message} ${mt('main.media_hikvision.retriesLeft', { n: retries })}` : message,
  };
}

function refusal(what: string, status: number, text: string): string {
  const reason = xmlValue(text, 'subStatusCode') ?? xmlValue(text, 'statusString');
  return `${what}: HTTP ${status}${reason ? ` ${reason}` : ''}`;
}

function networkError(target: IsapiTarget, err: unknown): string {
  const detail = err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err);
  const message = mt('main.media_hikvision.unreachable', { address: target.base, detail });
  return target.likelyRelay ? `${message} ${mt('main.media_hikvision.relayHint')}` : message;
}

const ircutPath = (ch: number) => `/ISAPI/Image/channels/${ch}/IrcutFilter`;
const lightPath = (ch: number) => `/ISAPI/Image/channels/${ch}/supplementLight`;
const ptzPath = (ch: number) => `/ISAPI/PTZCtrl/channels/${ch}`;

/** `<PTZPreset><id>1</id><presetName>Gate</presetName></PTZPreset>` entries of a presets document. */
export function parsePresets(xml: string): CameraPtzPreset[] {
  const out: CameraPtzPreset[] = [];
  for (const m of xml.matchAll(/<PTZPreset(?:\s[^>]*)?>([\s\S]*?)<\/PTZPreset>/g)) {
    const id = xmlValue(m[1]!, 'id');
    // A camera lists every slot; the ones in use are marked enabled (older firmware omits the flag).
    if (id && xmlValue(m[1]!, 'enabled') !== 'false') out.push({ id, name: xmlValue(m[1]!, 'presetName') || `#${id}` });
  }
  return out;
}

/** -1..1 -> the -100..100 ISAPI takes. */
const isapiSpeed = (v: number) => Math.round(Math.min(1, Math.max(-1, v)) * 100);

/** Current day/night and supplement light settings, plus what the camera allows. */
export async function getControlState(source: CameraSourceConfig): Promise<CameraControlState> {
  const target = resolveTarget(source);
  if (!target) return { ok: false, error: mt('main.media_hikvision.noAddress') };
  try {
    // The login is checked on its own first: a model without one of the image endpoints
    // answers 403 there, which must not read as a wrong password.
    const login = await isapiRequest(target, 'GET', '/ISAPI/Security/userCheck');
    if (login.status === 401) return authFailure(login.text);

    const state: CameraControlState = { ok: true };
    const missing: string[] = [];
    const ircut = await isapiRequest(target, 'GET', ircutPath(target.channel));
    if (ircut.status === 401) return authFailure(ircut.text);
    if (ircut.status === 200) {
      const mode = xmlValue(ircut.text, 'IrcutFilterType');
      if (mode && (DAY_NIGHT_MODES as string[]).includes(mode)) state.dayNight = mode as DayNightMode;
      const caps = await isapiRequest(target, 'GET', `${ircutPath(target.channel)}/capabilities`).catch(() => null);
      const opts = caps?.status === 200 ? xmlOptions(caps.text, 'IrcutFilterType') : undefined;
      state.dayNightOptions = (opts?.filter((o) => (DAY_NIGHT_MODES as string[]).includes(o)) as DayNightMode[] | undefined) ?? DAY_NIGHT_MODES;
    } else {
      missing.push(refusal('IrcutFilter', ircut.status, ircut.text));
    }
    const light = await isapiRequest(target, 'GET', lightPath(target.channel));
    if (light.status === 200) {
      state.light = xmlValue(light.text, 'supplementLightMode');
      const caps = await isapiRequest(target, 'GET', `${lightPath(target.channel)}/capabilities`).catch(() => null);
      state.lightOptions = (caps?.status === 200 ? xmlOptions(caps.text, 'supplementLightMode') : undefined)
        ?? (state.light ? [state.light, ...(state.light === 'close' ? [] : ['close'])] : undefined);
    } else {
      missing.push(refusal('supplementLight', light.status, light.text));
    }
    // A fixed camera answers the PTZ endpoint with 403/404: it simply has nothing to steer.
    const ptz = await isapiRequest(target, 'GET', `${ptzPath(target.channel)}/capabilities`).catch(() => null);
    if (ptz?.status === 200) {
      state.ptz = { move: true, zoom: true };
      const presets = await isapiRequest(target, 'GET', `${ptzPath(target.channel)}/presets`).catch(() => null);
      state.presets = presets?.status === 200 ? parsePresets(presets.text) : [];
    }
    if (!state.dayNight && !state.light && !state.ptz) {
      return { ok: false, error: `${mt('main.media_hikvision.noImageControls')} (${missing.join('; ')})` };
    }
    return state;
  } catch (err) {
    return { ok: false, error: networkError(target, err) };
  }
}

/** Applies one change, then reads the settings back so the UI shows what the camera took. */
export async function applyControl(source: CameraSourceConfig, action: CameraControlAction): Promise<CameraControlState> {
  const target = resolveTarget(source);
  if (!target) return { ok: false, error: mt('main.media_hikvision.noAddress') };
  if (action.kind === 'command') return { ok: false, error: mt('main.media_control.notSupported') };
  if (action.kind !== 'dayNight' && action.kind !== 'light') return applyPtz(source, target, action);
  const [path, tag] = action.kind === 'dayNight'
    ? [ircutPath(target.channel), 'IrcutFilterType']
    : [lightPath(target.channel), 'supplementLightMode'];
  const refused = (res: { status: number; text: string }): CameraControlState => (res.status === 401
    ? authFailure(res.text)
    : {
      ok: false,
      error: mt('main.media_hikvision.cameraRefused', {
        status: res.status,
        reason: xmlValue(res.text, 'subStatusCode') ?? xmlValue(res.text, 'statusString') ?? '',
      }),
    });
  try {
    const current = await isapiRequest(target, 'GET', path);
    if (current.status !== 200) return refused(current);
    const res = await isapiRequest(target, 'PUT', path, xmlReplace(current.text, tag, action.mode));
    if (res.status !== 200) return refused(res);
  } catch (err) {
    return { ok: false, error: networkError(target, err) };
  }
  return getControlState(source);
}

type PtzAction = Exclude<CameraControlAction, { kind: 'dayNight' } | { kind: 'light' } | { kind: 'command' }>;

/** Steering and presets. A move or a recall answers at once; a stored or removed preset re-reads the list. */
async function applyPtz(source: CameraSourceConfig, target: IsapiTarget, action: PtzAction): Promise<CameraControlState> {
  const base = ptzPath(target.channel);
  const done = (res: { status: number; text: string }, reread: boolean): CameraControlState | Promise<CameraControlState> => {
    if (res.status === 401) return authFailure(res.text);
    if (res.status !== 200) {
      return { ok: false, error: mt('main.media_hikvision.cameraRefused', { status: res.status, reason: xmlValue(res.text, 'subStatusCode') ?? xmlValue(res.text, 'statusString') ?? '' }) };
    }
    return reread ? getControlState(source) : { ok: true };
  };
  try {
    switch (action.kind) {
      case 'ptz':
        return await done(await isapiRequest(target, 'PUT', `${base}/continuous`,
          `<PTZData><pan>${isapiSpeed(action.pan)}</pan><tilt>${isapiSpeed(action.tilt)}</tilt><zoom>${isapiSpeed(action.zoom)}</zoom></PTZData>`), false);
      case 'preset-goto':
        return await done(await isapiRequest(target, 'PUT', `${base}/presets/${encodeURIComponent(action.id)}/goto`), false);
      case 'preset-remove':
        return await done(await isapiRequest(target, 'DELETE', `${base}/presets/${encodeURIComponent(action.id)}`), true);
      case 'preset-save': {
        let id = action.id;
        if (!id) {
          const list = await isapiRequest(target, 'GET', `${base}/presets`);
          const used = new Set(list.status === 200 ? parsePresets(list.text).map((p) => Number(p.id)) : []);
          let free = 1;
          while (used.has(free)) free += 1;
          id = String(free);
        }
        const name = (action.name.trim() || `Preset ${id}`).replace(/[<>&]/g, ' ');
        return await done(await isapiRequest(target, 'PUT', `${base}/presets/${encodeURIComponent(id)}`,
          `<PTZPreset><id>${id}</id><presetName>${name}</presetName></PTZPreset>`), true);
      }
    }
  } catch (err) {
    return { ok: false, error: networkError(target, err) };
  }
}
