/**
 * Camera control, whichever protocol the camera speaks. The renderer asks for the
 * state of a source or applies one action; this picks the driver.
 */

import type { CameraControlAction, CameraControlState, CameraSourceConfig } from '../../shared/camera-types.js';
import { applyControl as applyHikvision, getControlState as getHikvisionState } from './hikvision-isapi.js';
import { applyDahua, getDahuaState } from './dahua-cgi.js';
import { applyOnvif, getOnvifState } from './onvif.js';
import { cameraRequest, resolveControlTarget, unreachableMessage } from './camera-http.js';
import { mt } from '../i18n';

/** The 'http' vendor has nothing to read: its state is the list of buttons. */
function httpState(source: CameraSourceConfig): CameraControlState {
  const commands = (source.control?.commands ?? []).filter((c) => c.label.trim() && c.url.trim());
  return commands.length > 0
    ? { ok: true, commands: commands.map((c) => ({ id: c.id, label: c.label })) }
    : { ok: false, error: mt('main.media_control.noCommands') };
}

async function runHttpCommand(source: CameraSourceConfig, action: CameraControlAction): Promise<CameraControlState> {
  if (action.kind !== 'command') return { ok: false, error: mt('main.media_control.notSupported') };
  const command = source.control?.commands?.find((c) => c.id === action.id);
  if (!command) return { ok: false, error: mt('main.media_control.notSupported') };
  const target = resolveControlTarget(source);
  const absolute = /^https?:\/\//i.test(command.url);
  if (!target && !absolute) return { ok: false, error: mt('main.media_hikvision.noAddress') };
  // A full url needs no control host; the account, when given, still answers a 401.
  const origin = target ?? { base: '', username: source.control?.username ?? '', password: source.control?.password ?? '', channel: 1, likelyRelay: false };
  try {
    const res = await cameraRequest(origin, command.method, absolute ? command.url : `/${command.url.replace(/^\/+/, '')}`, command.body
      ? { body: command.body, contentType: /^\s*[{[]/.test(command.body) ? 'application/json' : 'text/plain' }
      : {});
    if (res.status === 401) return { ok: false, authFailed: true, error: mt('main.media_hikvision.wrongLogin') };
    if (res.status >= 400) {
      return { ok: false, error: mt('main.media_hikvision.cameraRefused', { status: res.status, reason: res.text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) }) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: unreachableMessage(origin, err) };
  }
}

export function getCameraControlState(source: CameraSourceConfig): Promise<CameraControlState> {
  switch (source.control?.vendor) {
    case 'hikvision': return getHikvisionState(source);
    case 'dahua': return getDahuaState(source);
    case 'onvif': return getOnvifState(source);
    case 'http': return Promise.resolve(httpState(source));
    default: return Promise.resolve({ ok: false, error: mt('main.media_control.notSupported') });
  }
}

export function applyCameraControl(source: CameraSourceConfig, action: CameraControlAction): Promise<CameraControlState> {
  switch (source.control?.vendor) {
    case 'hikvision': return applyHikvision(source, action);
    case 'dahua': return applyDahua(source, action);
    case 'onvif': return applyOnvif(source, action);
    case 'http': return runHttpCommand(source, action);
    default: return Promise.resolve({ ok: false, error: mt('main.media_control.notSupported') });
  }
}
