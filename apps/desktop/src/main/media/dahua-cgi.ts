/**
 * Dahua IP cameras over their HTTP API (configManager.cgi, ptz.cgi) with digest auth.
 * The same API is spoken by the many cameras built on Dahua firmware.
 *
 * Config values come back as `table.Name[ch][profile].Key=value` lines. A setting is
 * written to every profile the camera listed (day / night / general), because which
 * one is in force depends on a profile switch this code does not own.
 */

import type {
  CameraControlAction, CameraControlState, CameraPtzPreset, CameraSourceConfig, DayNightMode, SupplementLightMode,
} from '../../shared/camera-types.js';
import { cameraRequest, resolveControlTarget, unreachableMessage, type ControlTarget, type HttpAnswer } from './camera-http.js';
import { mt } from '../i18n';

/** `table.A[0][1].Mode=Color` lines -> { 'A[0][1].Mode': 'Color' }. */
export function parseDahuaTable(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    out[line.slice(0, eq).trim().replace(/^table\./, '')] = line.slice(eq + 1).trim();
  }
  return out;
}

const DAY_NIGHT_FROM: Record<string, DayNightMode> = { Color: 'day', BlackWhite: 'night', Brightness: 'auto' };
const DAY_NIGHT_TO: Record<DayNightMode, string> = { day: 'Color', night: 'BlackWhite', auto: 'Brightness' };
const LIGHT_FROM: Record<string, SupplementLightMode> = { Auto: 'auto', Manual: 'on', Off: 'close', ZoomPrio: 'auto' };
const LIGHT_TO: Record<string, string> = { auto: 'Auto', on: 'Manual', close: 'Off' };

const get = (target: ControlTarget, path: string) => cameraRequest(target, 'GET', path);
const getConfig = (target: ControlTarget, name: string) => get(target, `/cgi-bin/configManager.cgi?action=getConfig&name=${name}`);

/** Keys of `name` for this channel that end in `.Mode`, e.g. "VideoInDayNight[0][2].Mode". */
function modeKeys(table: Record<string, string>, name: string, channelIndex: number): string[] {
  const prefix = `${name}[${channelIndex}]`;
  return Object.keys(table).filter((k) => k.startsWith(prefix) && k.endsWith('.Mode'));
}

function refused(res: HttpAnswer): CameraControlState {
  if (res.status === 401) return { ok: false, authFailed: true, error: mt('main.media_hikvision.wrongLogin') };
  return { ok: false, error: mt('main.media_hikvision.cameraRefused', { status: res.status, reason: res.text.trim().slice(0, 80) }) };
}

/** The code last started on each camera: Dahua stops a move by naming the same code again. */
const moving = new Map<string, string>();

/** Direction code for a pan/tilt pair, or null when both are zero. */
export function dahuaMoveCode(pan: number, tilt: number): string | null {
  const h = pan > 0.05 ? 'Right' : pan < -0.05 ? 'Left' : '';
  const v = tilt > 0.05 ? 'Up' : tilt < -0.05 ? 'Down' : '';
  return h || v ? `${h}${v}` : null;
}

/** 1..8, the range ptz.cgi takes. */
const speed = (v: number) => Math.min(8, Math.max(1, Math.round(Math.abs(v) * 8)));

const ptz = (target: ControlTarget, action: 'start' | 'stop', code: string, arg1 = 0, arg2 = 0, arg3 = 0) =>
  get(target, `/cgi-bin/ptz.cgi?action=${action}&channel=${target.channel}&code=${code}&arg1=${arg1}&arg2=${arg2}&arg3=${arg3}`);

export async function getDahuaState(source: CameraSourceConfig): Promise<CameraControlState> {
  const target = resolveControlTarget(source);
  if (!target) return { ok: false, error: mt('main.media_hikvision.noAddress') };
  const channelIndex = target.channel - 1;
  try {
    const login = await get(target, '/cgi-bin/magicBox.cgi?action=getDeviceType');
    if (login.status === 401) return refused(login);

    const state: CameraControlState = { ok: true };
    const dayNight = await getConfig(target, 'VideoInDayNight');
    if (dayNight.status === 200) {
      const table = parseDahuaTable(dayNight.text);
      // The last profile is the "general" one, which is what an unscheduled camera uses.
      const key = modeKeys(table, 'VideoInDayNight', channelIndex).pop();
      const mode = key ? DAY_NIGHT_FROM[table[key]!] : undefined;
      if (mode) {
        state.dayNight = mode;
        state.dayNightOptions = ['auto', 'day', 'night'];
      }
    }
    const lighting = await getConfig(target, 'Lighting');
    if (lighting.status === 200) {
      const table = parseDahuaTable(lighting.text);
      const key = modeKeys(table, 'Lighting', channelIndex)[0];
      const mode = key ? LIGHT_FROM[table[key]!] : undefined;
      if (mode) {
        state.light = mode;
        state.lightOptions = ['auto', 'on', 'close'];
      }
    }
    const caps = await get(target, `/cgi-bin/ptz.cgi?action=getCurrentProtocolCaps&channel=${target.channel}`);
    if (caps.status === 200) {
      const table = parseDahuaTable(caps.text);
      const move = table['caps.Pan'] === 'true' || table['caps.Tile'] === 'true' || table['caps.Tilt'] === 'true';
      const zoom = table['caps.Zoom'] === 'true';
      if (move || zoom) {
        state.ptz = { move, zoom };
        state.presets = await dahuaPresets(target);
      }
    }
    if (!state.dayNight && !state.light && !state.ptz) return { ok: false, error: mt('main.media_control.nothingToControl') };
    return state;
  } catch (err) {
    return { ok: false, error: unreachableMessage(target, err) };
  }
}

async function dahuaPresets(target: ControlTarget): Promise<CameraPtzPreset[]> {
  const res = await get(target, `/cgi-bin/ptz.cgi?action=getPresets&channel=${target.channel}`);
  if (res.status !== 200) return [];
  const table = parseDahuaTable(res.text);
  const presets: CameraPtzPreset[] = [];
  for (const [key, value] of Object.entries(table)) {
    const m = /^presets\[(\d+)\]\.Index$/.exec(key);
    if (m) presets.push({ id: value, name: table[`presets[${m[1]}].Name`] || `#${value}` });
  }
  return presets;
}

/** Applies one change. Settings are read back; moves and preset recalls are not. */
export async function applyDahua(source: CameraSourceConfig, action: CameraControlAction): Promise<CameraControlState> {
  const target = resolveControlTarget(source);
  if (!target) return { ok: false, error: mt('main.media_hikvision.noAddress') };
  const channelIndex = target.channel - 1;
  try {
    if (action.kind === 'dayNight' || action.kind === 'light') {
      const name = action.kind === 'dayNight' ? 'VideoInDayNight' : 'Lighting';
      const value = action.kind === 'dayNight' ? DAY_NIGHT_TO[action.mode] : LIGHT_TO[action.mode];
      if (!value) return { ok: false, error: mt('main.media_control.notSupported') };
      const current = await getConfig(target, name);
      if (current.status !== 200) return refused(current);
      const keys = modeKeys(parseDahuaTable(current.text), name, channelIndex);
      if (keys.length === 0) return { ok: false, error: mt('main.media_control.notSupported') };
      const query = keys.map((k) => `${k}=${encodeURIComponent(value)}`).join('&');
      const res = await get(target, `/cgi-bin/configManager.cgi?action=setConfig&${query}`);
      if (res.status !== 200 || !/^OK/i.test(res.text.trim())) return refused(res);
      return await getDahuaState(source);
    }
    if (action.kind === 'ptz') {
      const previous = moving.get(target.base);
      const code = dahuaMoveCode(action.pan, action.tilt) ?? (action.zoom > 0.05 ? 'ZoomTele' : action.zoom < -0.05 ? 'ZoomWide' : null);
      if (previous && previous !== code) await ptz(target, 'stop', previous);
      if (!code) {
        moving.delete(target.base);
        return { ok: true };
      }
      moving.set(target.base, code);
      // Diagonals take the vertical speed in arg1 and the horizontal in arg2; straight moves use arg2.
      const diagonal = /^(Left|Right)(Up|Down)$/.test(code);
      const res = await ptz(target, 'start', code, diagonal ? speed(action.tilt) : 0, code.startsWith('Zoom') ? 0 : speed(diagonal ? action.pan : action.pan || action.tilt), 0);
      return res.status === 200 ? { ok: true } : refused(res);
    }
    if (action.kind === 'preset-goto') {
      const res = await ptz(target, 'start', 'GotoPreset', 0, Number(action.id), 0);
      return res.status === 200 ? { ok: true } : refused(res);
    }
    if (action.kind === 'preset-save' || action.kind === 'preset-remove') {
      let id = action.kind === 'preset-remove' ? Number(action.id) : action.id ? Number(action.id) : NaN;
      if (!Number.isFinite(id)) {
        const used = new Set((await dahuaPresets(target)).map((p) => Number(p.id)));
        id = 1;
        while (used.has(id)) id += 1;
      }
      const res = await ptz(target, 'start', action.kind === 'preset-save' ? 'SetPreset' : 'ClearPreset', 0, id, 0);
      // The name is not sent: the camera keeps its own ("Preset3"), shown in the list as reported.
      if (res.status !== 200) return refused(res);
      return await getDahuaState(source);
    }
    return { ok: false, error: mt('main.media_control.notSupported') };
  } catch (err) {
    return { ok: false, error: unreachableMessage(target, err) };
  }
}
