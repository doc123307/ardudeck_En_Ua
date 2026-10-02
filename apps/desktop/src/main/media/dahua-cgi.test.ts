import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { CameraSourceConfig } from '../../shared/camera-types';
import { applyDahua, dahuaMoveCode, getDahuaState, parseDahuaTable } from './dahua-cgi';
import { parseChallenge } from './hikvision-isapi';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const REALM = 'Login to 4F0A1B2PAG9E3C1';
// Test-only account of the fake camera below.
const USER = 'admin';
const PASS = 'bench-dahua-1';

/** A Dahua-shaped HTTP API: digest auth, configManager tables, ptz.cgi. */
class FakeDahua {
  server = http.createServer((req, res) => this.handle(req, res));
  dayNight = ['Color', 'BlackWhite', 'Brightness'];
  lighting: string | null = 'Auto';
  hasPtz = true;
  presets = new Map<number, string>([[1, 'Gate'], [3, 'Yard']]);
  ptzLog: string[] = [];
  private nonce = randomBytes(8).toString('hex');

  get port(): number { return (this.server.address() as AddressInfo).port; }

  private authorized(req: http.IncomingMessage): boolean {
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Digest ')) return false;
    const f = parseChallenge(auth);
    const expected = md5(`${md5(`${f.username}:${REALM}:${PASS}`)}:${f.nonce}:${f.nc}:${f.cnonce}:${f.qop}:${md5(`${req.method}:${f.uri}`)}`);
    // The signed uri must be the full request target, query included.
    return f.username === USER && f.nonce === this.nonce && f.uri === req.url && f.response === expected;
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse) {
    if (!this.authorized(req)) {
      res.writeHead(401, { 'WWW-Authenticate': `Digest realm="${REALM}", qop="auth", nonce="${this.nonce}", opaque="abc"` });
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://x');
    const q = url.searchParams;
    const text = (body: string, status = 200) => { res.writeHead(status, { 'Content-Type': 'text/plain' }); res.end(body); };

    if (url.pathname === '/cgi-bin/magicBox.cgi') return text('type=IPC-HFW2431S\r\n');
    if (url.pathname === '/cgi-bin/configManager.cgi' && q.get('action') === 'getConfig') {
      if (q.get('name') === 'VideoInDayNight') return text(this.dayNight.map((m, i) => `table.VideoInDayNight[0][${i}].Mode=${m}\r\ntable.VideoInDayNight[0][${i}].Sensitivity=3`).join('\r\n'));
      if (q.get('name') === 'Lighting' && this.lighting) return text(`table.Lighting[0][0].Mode=${this.lighting}\r\ntable.Lighting[0][0].MiddleLight[0].Light=50`);
      return text('Error\r\nBad Request!', 400);
    }
    if (url.pathname === '/cgi-bin/configManager.cgi' && q.get('action') === 'setConfig') {
      for (const [key, value] of q) {
        const dn = /^VideoInDayNight\[0\]\[(\d)\]\.Mode$/.exec(key);
        if (dn) this.dayNight[Number(dn[1])] = value;
        if (key === 'Lighting[0][0].Mode') this.lighting = value;
      }
      return text('OK');
    }
    if (url.pathname === '/cgi-bin/ptz.cgi') {
      if (!this.hasPtz) return text('Error\r\nBad Request!', 400);
      const action = q.get('action');
      if (action === 'getCurrentProtocolCaps') return text('caps.Pan=true\r\ncaps.Tile=true\r\ncaps.Zoom=true\r\n');
      if (action === 'getPresets') return text([...this.presets].map(([index, name], i) => `presets[${i}].Index=${index}\r\npresets[${i}].Name=${name}`).join('\r\n'));
      const code = q.get('code') ?? '';
      this.ptzLog.push(`${action} ${code} ${q.get('arg1')},${q.get('arg2')},${q.get('arg3')}`);
      if (code === 'SetPreset') this.presets.set(Number(q.get('arg2')), `Preset${q.get('arg2')}`);
      if (code === 'ClearPreset') this.presets.delete(Number(q.get('arg2')));
      return text('OK');
    }
    return text('Error', 404);
  }
}

const camera = new FakeDahua();
beforeAll(() => new Promise<void>((resolve) => { camera.server.listen(0, '127.0.0.1', resolve); }));
afterAll(() => new Promise<void>((resolve) => { camera.server.close(() => resolve()); }));
beforeEach(() => {
  camera.dayNight = ['Color', 'BlackWhite', 'Brightness'];
  camera.lighting = 'Auto';
  camera.hasPtz = true;
  camera.presets = new Map([[1, 'Gate'], [3, 'Yard']]);
  camera.ptzLog = [];
});

const source = (password = PASS): CameraSourceConfig => ({
  id: 'cam', vehicleKey: 'v', kind: 'rtsp', label: 'Front', url: 'rtsp://10.0.0.9:554/cam/realmonitor?channel=1&subtype=0',
  control: { vendor: 'dahua', host: '127.0.0.1', port: camera.port, username: USER, password },
});

describe('parsing', () => {
  it('reads configManager tables', () => {
    expect(parseDahuaTable('table.A[0][1].Mode=Color\r\ntable.A[0][1].X=a=b\r\n\r\n')).toEqual({ 'A[0][1].Mode': 'Color', 'A[0][1].X': 'a=b' });
  });

  it('maps a direction to a move code', () => {
    expect(dahuaMoveCode(1, 0)).toBe('Right');
    expect(dahuaMoveCode(-1, 1)).toBe('LeftUp');
    expect(dahuaMoveCode(0, -0.5)).toBe('Down');
    expect(dahuaMoveCode(0, 0)).toBeNull();
  });
});

describe('Dahua state', () => {
  it('reads day/night, light, PTZ and presets', async () => {
    expect(await getDahuaState(source())).toEqual({
      ok: true,
      dayNight: 'auto',
      dayNightOptions: ['auto', 'day', 'night'],
      light: 'auto',
      lightOptions: ['auto', 'on', 'close'],
      ptz: { move: true, zoom: true },
      presets: [{ id: '1', name: 'Gate' }, { id: '3', name: 'Yard' }],
    });
  });

  it('offers only what a fixed camera without a light has', async () => {
    camera.hasPtz = false;
    camera.lighting = null;
    const state = await getDahuaState(source());
    expect(state).toEqual({ ok: true, dayNight: 'auto', dayNightOptions: ['auto', 'day', 'night'] });
  });

  it('says so when the password is wrong', async () => {
    expect(await getDahuaState(source('not-it'))).toMatchObject({ ok: false, authFailed: true });
  });
});

describe('Dahua actions', () => {
  it('writes day/night to every profile and reads it back', async () => {
    const state = await applyDahua(source(), { kind: 'dayNight', mode: 'night' });
    expect(camera.dayNight).toEqual(['BlackWhite', 'BlackWhite', 'BlackWhite']);
    expect(state.dayNight).toBe('night');
  });

  it('switches the light', async () => {
    const state = await applyDahua(source(), { kind: 'light', mode: 'close' });
    expect(camera.lighting).toBe('Off');
    expect(state.light).toBe('close');
  });

  it('starts a move, changes direction by stopping the old one, and stops', async () => {
    await applyDahua(source(), { kind: 'ptz', pan: 1, tilt: 0, zoom: 0 });
    await applyDahua(source(), { kind: 'ptz', pan: 0, tilt: 0, zoom: 1 });
    await applyDahua(source(), { kind: 'ptz', pan: 0, tilt: 0, zoom: 0 });
    expect(camera.ptzLog).toEqual([
      'start Right 0,8,0',
      'stop Right 0,0,0',
      'start ZoomTele 0,0,0',
      'stop ZoomTele 0,0,0',
    ]);
  });

  it('recalls a preset, stores into the first free slot and removes', async () => {
    expect(await applyDahua(source(), { kind: 'preset-goto', id: '3' })).toEqual({ ok: true });
    expect(camera.ptzLog).toEqual(['start GotoPreset 0,3,0']);

    const saved = await applyDahua(source(), { kind: 'preset-save', name: 'Bridge' });
    expect(saved.presets?.map((p) => p.id)).toEqual(['1', '3', '2']);

    const removed = await applyDahua(source(), { kind: 'preset-remove', id: '1' });
    expect(removed.presets?.map((p) => p.id)).toEqual(['3', '2']);
  });
});
