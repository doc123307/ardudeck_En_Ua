/**
 * ONVIF camera control: day/night (imaging), continuous pan/tilt/zoom and presets.
 * Works with any camera that has its ONVIF service switched on - Uniview, Bitrek,
 * Hikvision and Dahua included.
 *
 * Three things real cameras need that the specification's examples skip:
 * - The password digest covers a timestamp, and a camera with a wrong clock rejects a
 *   correct password. So the camera is asked for its own time first, and that is used.
 * - The service addresses the camera hands back carry its own LAN address. Behind a
 *   port-forward that address is unreachable, so only their paths are kept.
 * - Some cameras want HTTP digest instead of (or on top of) the WS-Security header;
 *   the request helper answers that challenge too.
 */

import { createHash, randomBytes } from 'node:crypto';
import type {
  CameraControlAction, CameraControlState, CameraPtzPreset, CameraSourceConfig, DayNightMode,
} from '../../shared/camera-types.js';
import { cameraRequest, resolveControlTarget, unreachableMessage, type ControlTarget } from './camera-http.js';
import { mt } from '../i18n';

const DEVICE_PATH = '/onvif/device_service';
const NS = {
  device: 'http://www.onvif.org/ver10/device/wsdl',
  media: 'http://www.onvif.org/ver10/media/wsdl',
  ptz: 'http://www.onvif.org/ver20/ptz/wsdl',
  imaging: 'http://www.onvif.org/ver20/imaging/wsdl',
  schema: 'http://www.onvif.org/ver10/schema',
};

// ---- XML helpers (namespace prefixes differ from camera to camera) -------------------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Text of the first `<prefix:tag>` element. */
export function tagText(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${tag}>`).exec(xml);
  return m ? unesc(m[1]!.trim()) : undefined;
}

/** Every `<prefix:tag ...>...</prefix:tag>` element: its attributes and inner xml. */
export function tagBlocks(xml: string, tag: string): Array<{ attrs: string; inner: string }> {
  const out: Array<{ attrs: string; inner: string }> = [];
  const re = new RegExp(`<((?:[\\w-]+:)?${tag})(\\s[^>]*)?>([\\s\\S]*?)</\\1>`, 'g');
  for (let m = re.exec(xml); m; m = re.exec(xml)) out.push({ attrs: m[2] ?? '', inner: m[3] ?? '' });
  return out;
}

export function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs);
  return m ? unesc(m[1]!) : undefined;
}

// ---- SOAP ----------------------------------------------------------------------------

/** WS-Security UsernameToken with a password digest: Base64(SHA1(nonce + created + password)). */
export function securityHeader(username: string, password: string, created: Date, nonce: Buffer = randomBytes(16)): string {
  const createdText = created.toISOString();
  const digest = createHash('sha1').update(Buffer.concat([nonce, Buffer.from(createdText), Buffer.from(password)])).digest('base64');
  return '<s:Header><Security s:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">'
    + '<UsernameToken>'
    + `<Username>${esc(username)}</Username>`
    + `<Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</Password>`
    + `<Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce.toString('base64')}</Nonce>`
    + `<Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${createdText}</Created>`
    + '</UsernameToken></Security></s:Header>';
}

export function envelope(body: string, header = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tt="${NS.schema}">${header}<s:Body>${body}</s:Body></s:Envelope>`;
}

/** The services of one camera, found once and reused: a PTZ move must not cost four round trips. */
interface Device {
  /** Camera clock minus ours, in ms. */
  clockOffsetMs: number;
  media: string;
  ptz?: string;
  imaging?: string;
  profileToken?: string;
  videoSourceToken?: string;
  /** The chosen profile can be steered. */
  ptzProfile: boolean;
  foundAt: number;
}

const DEVICE_TTL_MS = 5 * 60_000;
const devices = new Map<string, Device>();
const deviceKey = (t: ControlTarget) => `${t.base}|${t.username}|${t.channel}`;

/** Clears the cache (tests, and after a settings change). */
export function forgetOnvifDevices(): void {
  devices.clear();
}

/** 'auth': the account was rejected. 'disabled': the camera has ONVIF switched off. */
class OnvifError extends Error {
  constructor(message: string, readonly kind: 'auth' | 'disabled' | 'refused' = 'refused') {
    super(message);
  }

  get authFailed(): boolean {
    return this.kind === 'auth';
  }
}

/** Keeps the path of a service address the camera reported, on the address we can reach. */
export function reachable(xaddr: string | undefined, target: ControlTarget, fallback: string): string {
  if (!xaddr) return target.base + fallback;
  try {
    const u = new URL(xaddr);
    return target.base + u.pathname + u.search;
  } catch {
    return target.base + fallback;
  }
}

async function call(target: ControlTarget, url: string, body: string, clockOffsetMs: number, withAuth = true): Promise<string> {
  const header = withAuth && target.username
    ? securityHeader(target.username, target.password, new Date(Date.now() + clockOffsetMs))
    : '';
  const res = await cameraRequest(target, 'POST', url, { body: envelope(body, header), contentType: 'application/soap+xml; charset=utf-8' });
  const fault = /<(?:[\w-]+:)?Fault[\s>]/.test(res.text);
  if (res.status === 401 || (fault && /NotAuthorized|Unauthorized|FailedAuthentication|Sender not authorized/i.test(res.text))) {
    throw new OnvifError(mt('main.media_hikvision.wrongLogin'), 'auth');
  }
  if (res.status >= 400 || fault) {
    const reason = tagText(res.text, 'Text') ?? tagText(res.text, 'faultstring') ?? '';
    // A camera with ONVIF switched off answers with a plain web page, not a SOAP fault.
    if (!fault && res.status === 404) throw new OnvifError(mt('main.media_control.onvifDisabled'), 'disabled');
    throw new OnvifError(mt('main.media_hikvision.cameraRefused', { status: res.status, reason }));
  }
  return res.text;
}

async function discover(target: ControlTarget): Promise<Device> {
  const cached = devices.get(deviceKey(target));
  if (cached && Date.now() - cached.foundAt < DEVICE_TTL_MS) return cached;

  const deviceUrl = target.base + DEVICE_PATH;
  let clockOffsetMs = 0;
  try {
    const time = await call(target, deviceUrl, `<GetSystemDateAndTime xmlns="${NS.device}"/>`, 0, false);
    const utc = tagBlocks(time, 'UTCDateTime')[0]?.inner;
    if (utc) {
      const n = (tag: string) => Number(tagText(utc, tag));
      const camera = Date.UTC(n('Year'), n('Month') - 1, n('Day'), n('Hour'), n('Minute'), n('Second'));
      if (Number.isFinite(camera)) clockOffsetMs = camera - Date.now();
    }
  } catch (err) {
    // No clock is survivable (our own time is used); a camera that is not there is not.
    if (!(err instanceof OnvifError) || err.kind === 'disabled') throw err;
  }

  const caps = await call(target, deviceUrl, `<GetCapabilities xmlns="${NS.device}"><Category>All</Category></GetCapabilities>`, clockOffsetMs);
  const xaddr = (section: string) => {
    const block = tagBlocks(caps, section)[0]?.inner;
    return block ? tagText(block, 'XAddr') : undefined;
  };
  const device: Device = {
    clockOffsetMs,
    media: reachable(xaddr('Media'), target, '/onvif/Media'),
    ptz: xaddr('PTZ') ? reachable(xaddr('PTZ'), target, '/onvif/PTZ') : undefined,
    imaging: xaddr('Imaging') ? reachable(xaddr('Imaging'), target, '/onvif/Imaging') : undefined,
    ptzProfile: false,
    foundAt: Date.now(),
  };

  const profiles = tagBlocks(await call(target, device.media, `<GetProfiles xmlns="${NS.media}"/>`, clockOffsetMs), 'Profiles');
  // Channel N is the Nth video source; its first profile is the main stream.
  const sources = [...new Set(profiles.map((p) => tagText(p.inner, 'SourceToken')).filter((t): t is string => !!t))];
  const wanted = sources[target.channel - 1] ?? sources[0];
  const profile = profiles.find((p) => tagText(p.inner, 'SourceToken') === wanted) ?? profiles[0];
  if (profile) {
    device.profileToken = attr(profile.attrs, 'token');
    device.videoSourceToken = wanted;
    device.ptzProfile = /<(?:[\w-]+:)?PTZConfiguration[\s>]/.test(profile.inner);
  }
  devices.set(deviceKey(target), device);
  return device;
}

const IRCUT_TO_MODE: Record<string, DayNightMode> = { ON: 'day', OFF: 'night', AUTO: 'auto' };
const MODE_TO_IRCUT: Record<DayNightMode, string> = { day: 'ON', night: 'OFF', auto: 'AUTO' };

function failure(target: ControlTarget, err: unknown): CameraControlState {
  if (err instanceof OnvifError) return { ok: false, error: err.message, ...(err.authFailed ? { authFailed: true } : {}) };
  return { ok: false, error: unreachableMessage(target, err) };
}

async function presetsOf(target: ControlTarget, device: Device): Promise<CameraPtzPreset[]> {
  if (!device.ptz || !device.profileToken) return [];
  const xml = await call(target, device.ptz, `<GetPresets xmlns="${NS.ptz}"><ProfileToken>${esc(device.profileToken)}</ProfileToken></GetPresets>`, device.clockOffsetMs);
  return tagBlocks(xml, 'Preset')
    .map((p) => ({ id: attr(p.attrs, 'token') ?? '', name: tagText(p.inner, 'Name') ?? '' }))
    .filter((p) => p.id !== '')
    .map((p) => ({ id: p.id, name: p.name || `#${p.id}` }));
}

export async function getOnvifState(source: CameraSourceConfig): Promise<CameraControlState> {
  const target = resolveControlTarget(source);
  if (!target) return { ok: false, error: mt('main.media_hikvision.noAddress') };
  try {
    const device = await discover(target);
    const state: CameraControlState = { ok: true };
    if (device.imaging && device.videoSourceToken) {
      try {
        const xml = await call(target, device.imaging,
          `<GetImagingSettings xmlns="${NS.imaging}"><VideoSourceToken>${esc(device.videoSourceToken)}</VideoSourceToken></GetImagingSettings>`,
          device.clockOffsetMs);
        const mode = IRCUT_TO_MODE[(tagText(xml, 'IrCutFilter') ?? '').toUpperCase()];
        if (mode) {
          state.dayNight = mode;
          state.dayNightOptions = ['auto', 'day', 'night'];
        }
      } catch (err) {
        if (err instanceof OnvifError && err.authFailed) throw err;
        // A camera without imaging settings still has PTZ worth offering.
      }
    }
    if (device.ptz && device.ptzProfile) {
      state.ptz = { move: true, zoom: true };
      state.presets = await presetsOf(target, device).catch(() => []);
    }
    if (!state.dayNight && !state.ptz) return { ok: false, error: mt('main.media_control.nothingToControl') };
    return state;
  } catch (err) {
    devices.delete(deviceKey(target));
    return failure(target, err);
  }
}

/** -1..1, two decimals: what ONVIF's generic velocity space takes. */
const vel = (v: number) => (Math.round(Math.min(1, Math.max(-1, v)) * 100) / 100).toFixed(2);

export async function applyOnvif(source: CameraSourceConfig, action: CameraControlAction): Promise<CameraControlState> {
  const target = resolveControlTarget(source);
  if (!target) return { ok: false, error: mt('main.media_hikvision.noAddress') };
  try {
    const device = await discover(target);
    const profile = `<ProfileToken>${esc(device.profileToken ?? '')}</ProfileToken>`;
    const ptzCall = (body: string) => {
      if (!device.ptz || !device.profileToken) throw new OnvifError(mt('main.media_control.notSupported'));
      return call(target, device.ptz, body, device.clockOffsetMs);
    };

    switch (action.kind) {
      case 'dayNight': {
        if (!device.imaging || !device.videoSourceToken) return { ok: false, error: mt('main.media_control.notSupported') };
        await call(target, device.imaging,
          `<SetImagingSettings xmlns="${NS.imaging}"><VideoSourceToken>${esc(device.videoSourceToken)}</VideoSourceToken>`
          + `<ImagingSettings><tt:IrCutFilter>${MODE_TO_IRCUT[action.mode]}</tt:IrCutFilter></ImagingSettings>`
          + '<ForcePersistence>true</ForcePersistence></SetImagingSettings>',
          device.clockOffsetMs);
        return await getOnvifState(source);
      }
      case 'ptz': {
        const still = Math.abs(action.pan) < 0.05 && Math.abs(action.tilt) < 0.05 && Math.abs(action.zoom) < 0.05;
        await ptzCall(still
          ? `<Stop xmlns="${NS.ptz}">${profile}<PanTilt>true</PanTilt><Zoom>true</Zoom></Stop>`
          : `<ContinuousMove xmlns="${NS.ptz}">${profile}<Velocity>`
            + `<tt:PanTilt x="${vel(action.pan)}" y="${vel(action.tilt)}"/><tt:Zoom x="${vel(action.zoom)}"/>`
            + '</Velocity></ContinuousMove>');
        return { ok: true };
      }
      case 'preset-goto':
        await ptzCall(`<GotoPreset xmlns="${NS.ptz}">${profile}<PresetToken>${esc(action.id)}</PresetToken></GotoPreset>`);
        return { ok: true };
      case 'preset-save':
        await ptzCall(`<SetPreset xmlns="${NS.ptz}">${profile}<PresetName>${esc(action.name.trim() || 'Preset')}</PresetName>`
          + `${action.id ? `<PresetToken>${esc(action.id)}</PresetToken>` : ''}</SetPreset>`);
        return await getOnvifState(source);
      case 'preset-remove':
        await ptzCall(`<RemovePreset xmlns="${NS.ptz}">${profile}<PresetToken>${esc(action.id)}</PresetToken></RemovePreset>`);
        return await getOnvifState(source);
      default:
        return { ok: false, error: mt('main.media_control.notSupported') };
    }
  } catch (err) {
    return failure(target, err);
  }
}
