import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { CameraSourceConfig } from '../../shared/camera-types';
import { applyCameraControl, getCameraControlState } from './camera-control';
import { parsePresets } from './hikvision-isapi';

/** A small control service like the one an integrator runs next to the cameras. */
const requests: string[] = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    requests.push(`${req.method} ${req.url} [${req.headers['content-type'] ?? ''}] ${body}`);
    if (req.url === '/front/broken') { res.writeHead(500); res.end('<h1>Internal Server Error</h1>'); return; }
    res.writeHead(200);
    res.end('ok');
  });
});
const port = () => (server.address() as AddressInfo).port;
beforeAll(() => new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); }));
afterAll(() => new Promise<void>((resolve) => { server.close(() => resolve()); }));
beforeEach(() => { requests.length = 0; });

const source = (): CameraSourceConfig => ({
  id: 'cam', vehicleKey: 'v', kind: 'rtsp', label: 'Front', url: 'rtsp://10.0.0.9:8554/frontmain',
  control: {
    vendor: 'http', host: '127.0.0.1', port: port(),
    commands: [
      { id: 'ir-on', label: 'IR on', method: 'POST', url: '/front/ir/on' },
      { id: 'mode', label: 'Night', method: 'PUT', url: 'front/mode', body: '{"mode":"night"}' },
      { id: 'abs', label: 'Absolute', method: 'GET', url: `http://127.0.0.1:${port()}/rear/white?on=1` },
      { id: 'bad', label: 'Broken', method: 'POST', url: '/front/broken' },
      { id: 'empty', label: '', method: 'GET', url: '' },
    ],
  },
});

describe('custom HTTP commands', () => {
  it('lists the buttons that are filled in', async () => {
    const state = await getCameraControlState(source());
    expect(state.ok).toBe(true);
    expect(state.commands?.map((c) => c.id)).toEqual(['ir-on', 'mode', 'abs', 'bad']);
  });

  it('sends each command as configured: path on the control host, or a full url', async () => {
    expect(await applyCameraControl(source(), { kind: 'command', id: 'ir-on' })).toEqual({ ok: true });
    expect(await applyCameraControl(source(), { kind: 'command', id: 'mode' })).toEqual({ ok: true });
    expect(await applyCameraControl(source(), { kind: 'command', id: 'abs' })).toEqual({ ok: true });
    expect(requests).toEqual([
      'POST /front/ir/on [] ',
      'PUT /front/mode [application/json] {"mode":"night"}',
      'GET /rear/white?on=1 [] ',
    ]);
  });

  it('reports a refused command with the service\'s answer, tags stripped', async () => {
    const result = await applyCameraControl(source(), { kind: 'command', id: 'bad' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('500');
    expect(result.error).toContain('Internal Server Error');
    expect(result.error).not.toContain('<h1>');
  });

  it('refuses a command that is not configured, and other kinds of action', async () => {
    expect((await applyCameraControl(source(), { kind: 'command', id: 'nope' })).ok).toBe(false);
    expect((await applyCameraControl(source(), { kind: 'dayNight', mode: 'day' })).ok).toBe(false);
    expect(requests).toEqual([]);
  });

  it('says there is nothing to press when no command is filled in', async () => {
    const empty: CameraSourceConfig = { ...source(), control: { vendor: 'http', commands: [] } };
    expect((await getCameraControlState(empty)).ok).toBe(false);
  });
});

describe('Hikvision presets document', () => {
  it('lists the presets in use', () => {
    const xml = '<PTZPresetList><PTZPreset><enabled>true</enabled><id>1</id><presetName>Gate</presetName></PTZPreset>'
      + '<PTZPreset><enabled>false</enabled><id>2</id><presetName>Preset 2</presetName></PTZPreset>'
      + '<PTZPreset><id>5</id><presetName></presetName></PTZPreset></PTZPresetList>';
    expect(parsePresets(xml)).toEqual([{ id: '1', name: 'Gate' }, { id: '5', name: '#5' }]);
  });
});
