import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { CameraSourceConfig } from '../../shared/camera-types';
import { applyOnvif, attr, forgetOnvifDevices, getOnvifState, reachable, securityHeader, tagBlocks, tagText } from './onvif';

// Test-only account of the fake camera below.
const USER = 'onvif';
const PASS = 'bench-onvif-1';

/**
 * An ONVIF-shaped camera: WS-Security password digest checked against ITS clock, service
 * addresses reported with a LAN address the test cannot reach, one PTZ profile.
 */
class FakeOnvifCamera {
  server = http.createServer((req, res) => this.handle(req, res));
  /** The camera's clock runs this far from ours (an unsynced camera sits in 1970). */
  clockOffsetMs = 0;
  disabled = false;
  /** Reads are answered without an account; only changes ask for one (Ajax). */
  openReads = false;
  hasPtz = true;
  ircut = 'AUTO';
  presets = new Map<string, string>([['1', 'Gate'], ['2', 'Yard']]);
  calls: string[] = [];
  lastMove = '';

  get port(): number { return (this.server.address() as AddressInfo).port; }

  private authorized(xml: string): boolean {
    const user = tagText(xml, 'Username');
    const digest = tagText(xml, 'Password');
    const nonce = tagText(xml, 'Nonce');
    const created = tagText(xml, 'Created');
    if (!user || !digest || !nonce || !created) return false;
    // A real camera refuses a timestamp far from its own clock.
    if (Math.abs(new Date(created).getTime() - (Date.now() + this.clockOffsetMs)) > 10_000) return false;
    const expected = createHash('sha1').update(Buffer.concat([Buffer.from(nonce, 'base64'), Buffer.from(created), Buffer.from(PASS)])).digest('base64');
    return user === USER && digest === expected;
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (this.disabled) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Access Error: 404 -- Not Found</h2><p>ONVIF integrate function is disabled.</p></body></html>');
        return;
      }
      const soap = (inner: string, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/soap+xml' });
        res.end(`<?xml version="1.0"?><env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope" xmlns:tt="http://www.onvif.org/ver10/schema" xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl" xmlns:timg="http://www.onvif.org/ver20/imaging/wsdl"><env:Body>${inner}</env:Body></env:Envelope>`);
      };
      const action = /<s:Body><(\w+)/.exec(body)?.[1] ?? '?';
      this.calls.push(`${req.url} ${action}`);

      if (action === 'GetSystemDateAndTime') {
        const d = new Date(Date.now() + this.clockOffsetMs);
        return soap(`<tds:GetSystemDateAndTimeResponse><tds:SystemDateAndTime><tt:UTCDateTime><tt:Time><tt:Hour>${d.getUTCHours()}</tt:Hour><tt:Minute>${d.getUTCMinutes()}</tt:Minute><tt:Second>${d.getUTCSeconds()}</tt:Second></tt:Time><tt:Date><tt:Year>${d.getUTCFullYear()}</tt:Year><tt:Month>${d.getUTCMonth() + 1}</tt:Month><tt:Day>${d.getUTCDate()}</tt:Day></tt:Date></tt:UTCDateTime></tds:SystemDateAndTime></tds:GetSystemDateAndTimeResponse>`);
      }
      if (!(this.openReads && action.startsWith('Get')) && !this.authorized(body)) {
        return soap('<env:Fault><env:Code><env:Value>env:Sender</env:Value><env:Subcode><env:Value>ter:NotAuthorized</env:Value></env:Subcode></env:Code><env:Reason><env:Text xml:lang="en">Sender not authorized</env:Text></env:Reason></env:Fault>', 400);
      }
      switch (action) {
        case 'GetCapabilities':
          // The camera's own LAN address: unreachable through the port-forward the test stands in for.
          return soap(`<tds:GetCapabilitiesResponse><tds:Capabilities><tt:Imaging><tt:XAddr>http://192.168.4.102/onvif/Imaging</tt:XAddr></tt:Imaging><tt:Media><tt:XAddr>http://192.168.4.102/onvif/Media</tt:XAddr></tt:Media>${this.hasPtz ? '<tt:PTZ><tt:XAddr>http://192.168.4.102/onvif/PTZ</tt:XAddr></tt:PTZ>' : ''}</tds:Capabilities></tds:GetCapabilitiesResponse>`);
        case 'GetProfiles':
          return soap(`<trt:GetProfilesResponse><trt:Profiles token="Profile_1" fixed="true"><tt:Name>mainStream</tt:Name><tt:VideoSourceConfiguration token="VSC_1"><tt:SourceToken>VideoSource_1</tt:SourceToken></tt:VideoSourceConfiguration>${this.hasPtz ? '<tt:PTZConfiguration token="PTZ_1"><tt:NodeToken>PTZNODE_1</tt:NodeToken></tt:PTZConfiguration>' : ''}</trt:Profiles><trt:Profiles token="Profile_2"><tt:Name>subStream</tt:Name><tt:VideoSourceConfiguration token="VSC_1"><tt:SourceToken>VideoSource_1</tt:SourceToken></tt:VideoSourceConfiguration></trt:Profiles></trt:GetProfilesResponse>`);
        case 'GetImagingSettings':
          return soap(`<timg:GetImagingSettingsResponse><timg:ImagingSettings><tt:Brightness>50</tt:Brightness><tt:IrCutFilter>${this.ircut}</tt:IrCutFilter></timg:ImagingSettings></timg:GetImagingSettingsResponse>`);
        case 'SetImagingSettings':
          this.ircut = tagText(body, 'IrCutFilter') ?? this.ircut;
          return soap('<timg:SetImagingSettingsResponse/>');
        case 'GetPresets':
          return soap(`<tptz:GetPresetsResponse>${[...this.presets].map(([token, name]) => `<tptz:Preset token="${token}"><tt:Name>${name}</tt:Name></tptz:Preset>`).join('')}</tptz:GetPresetsResponse>`);
        case 'ContinuousMove': {
          const pt = /<tt:PanTilt x="([^"]*)" y="([^"]*)"/.exec(body);
          const zoom = /<tt:Zoom x="([^"]*)"/.exec(body);
          this.lastMove = `${tagText(body, 'ProfileToken')} pan=${pt?.[1]} tilt=${pt?.[2]} zoom=${zoom?.[1]}`;
          return soap('<tptz:ContinuousMoveResponse/>');
        }
        case 'Stop':
          this.lastMove = 'stopped';
          return soap('<tptz:StopResponse/>');
        case 'GotoPreset':
          this.lastMove = `goto ${tagText(body, 'PresetToken')}`;
          return soap('<tptz:GotoPresetResponse/>');
        case 'SetPreset': {
          const token = tagText(body, 'PresetToken') ?? String(this.presets.size + 1);
          this.presets.set(token, tagText(body, 'PresetName') ?? '');
          return soap(`<tptz:SetPresetResponse><tptz:PresetToken>${token}</tptz:PresetToken></tptz:SetPresetResponse>`);
        }
        case 'RemovePreset':
          this.presets.delete(tagText(body, 'PresetToken') ?? '');
          return soap('<tptz:RemovePresetResponse/>');
        default:
          return soap('<env:Fault><env:Reason><env:Text>Action not supported</env:Text></env:Reason></env:Fault>', 500);
      }
    });
  }
}

const camera = new FakeOnvifCamera();
beforeAll(() => new Promise<void>((resolve) => { camera.server.listen(0, '127.0.0.1', resolve); }));
afterAll(() => new Promise<void>((resolve) => { camera.server.close(() => resolve()); }));
beforeEach(() => {
  forgetOnvifDevices();
  camera.clockOffsetMs = 0;
  camera.disabled = false;
  camera.openReads = false;
  camera.hasPtz = true;
  camera.ircut = 'AUTO';
  camera.presets = new Map([['1', 'Gate'], ['2', 'Yard']]);
  camera.calls = [];
  camera.lastMove = '';
});

const source = (password = PASS): CameraSourceConfig => ({
  id: 'cam', vehicleKey: 'v', kind: 'rtsp', label: 'Front', url: 'rtsp://10.0.0.9:554/stream',
  control: { vendor: 'onvif', host: '127.0.0.1', port: camera.port, username: USER, password },
});

describe('xml helpers', () => {
  it('read elements whatever prefix the camera uses', () => {
    expect(tagText('<tt:IrCutFilter>AUTO</tt:IrCutFilter>', 'IrCutFilter')).toBe('AUTO');
    expect(tagText('<IrCutFilter xmlns="x"> ON </IrCutFilter>', 'IrCutFilter')).toBe('ON');
    expect(tagText('<tt:Name>A &amp; B</tt:Name>', 'Name')).toBe('A & B');
    const [preset] = tagBlocks('<tptz:Preset token="7"><tt:Name>Door</tt:Name></tptz:Preset><tptz:PresetToken>9</tptz:PresetToken>', 'Preset');
    expect(attr(preset!.attrs, 'token')).toBe('7');
    expect(tagText(preset!.inner, 'Name')).toBe('Door');
  });

  it('keep only the path of a service address the camera reports', () => {
    const target = { base: 'http://100.67.0.245:3002', username: '', password: '', channel: 1, likelyRelay: false };
    expect(reachable('http://192.168.4.102/onvif/PTZ', target, '/x')).toBe('http://100.67.0.245:3002/onvif/PTZ');
    expect(reachable(undefined, target, '/onvif/Media')).toBe('http://100.67.0.245:3002/onvif/Media');
  });

  it('build the standard password digest', () => {
    const header = securityHeader('u', 'p', new Date('2026-01-02T03:04:05.000Z'), Buffer.from('nonce'));
    const expected = createHash('sha1').update(Buffer.concat([Buffer.from('nonce'), Buffer.from('2026-01-02T03:04:05.000Z'), Buffer.from('p')])).digest('base64');
    expect(header).toContain(expected);
    expect(header).toContain(Buffer.from('nonce').toString('base64'));
  });
});

describe('ONVIF state', () => {
  it('reads day/night, PTZ and presets through a port-forward', async () => {
    const state = await getOnvifState(source());
    expect(state).toEqual({
      ok: true,
      dayNight: 'auto',
      dayNightOptions: ['auto', 'day', 'night'],
      ptz: { move: true, zoom: true },
      presets: [{ id: '1', name: 'Gate' }, { id: '2', name: 'Yard' }],
    });
    // Every service call went to the reachable address, on the path the camera named.
    expect(camera.calls).toContain('/onvif/Media GetProfiles');
    expect(camera.calls).toContain('/onvif/Imaging GetImagingSettings');
    expect(camera.calls).toContain('/onvif/PTZ GetPresets');
  });

  it('logs in to a camera whose clock is far off', async () => {
    camera.clockOffsetMs = -Date.now() + 86_400_000 * 2; // 3 January 1970
    expect((await getOnvifState(source())).ok).toBe(true);
  });

  it('offers no PTZ on a fixed camera', async () => {
    camera.hasPtz = false;
    const state = await getOnvifState(source());
    expect(state.ok).toBe(true);
    expect(state.ptz).toBeUndefined();
    expect(state.presets).toBeUndefined();
    expect(state.dayNight).toBe('auto');
  });

  it('says so when the password is wrong', async () => {
    const state = await getOnvifState(source('not-it'));
    expect(state).toMatchObject({ ok: false, authFailed: true });
  });

  it('says so when ONVIF is switched off on the camera', async () => {
    camera.disabled = true;
    const state = await getOnvifState(source());
    expect(state.ok).toBe(false);
    expect(state.authFailed).toBeUndefined();
    expect(state.error).toMatch(/ONVIF/);
  });

  it('reports a camera that is not there', async () => {
    const gone: CameraSourceConfig = { ...source(), control: { vendor: 'onvif', host: '127.0.0.1', port: 9, username: USER, password: PASS } };
    const state = await getOnvifState(gone);
    expect(state.ok).toBe(false);
    expect(state.error).toContain('127.0.0.1:9');
  });
});

describe('ONVIF actions', () => {
  it('switches day/night and reads the result back', async () => {
    const state = await applyOnvif(source(), { kind: 'dayNight', mode: 'night' });
    expect(camera.ircut).toBe('OFF');
    expect(state.dayNight).toBe('night');
  });

  it('names the account when a camera that shows its settings refuses to change them', async () => {
    camera.openReads = true;
    expect((await getOnvifState(source('not-it'))).ok).toBe(true);
    const state = await applyOnvif(source('not-it'), { kind: 'dayNight', mode: 'night' });
    expect(state).toMatchObject({ ok: false, authFailed: true });
    expect(state.error).toMatch(/ONVIF/);
    expect(camera.ircut).toBe('AUTO');
  });

  it('moves, zooms and stops', async () => {
    expect(await applyOnvif(source(), { kind: 'ptz', pan: 0.5, tilt: -0.25, zoom: 0 })).toEqual({ ok: true });
    expect(camera.lastMove).toBe('Profile_1 pan=0.50 tilt=-0.25 zoom=0.00');
    await applyOnvif(source(), { kind: 'ptz', pan: 0, tilt: 0, zoom: 1 });
    expect(camera.lastMove).toBe('Profile_1 pan=0.00 tilt=0.00 zoom=1.00');
    await applyOnvif(source(), { kind: 'ptz', pan: 0, tilt: 0, zoom: 0 });
    expect(camera.lastMove).toBe('stopped');
  });

  it('does not rediscover the camera for every move', async () => {
    await applyOnvif(source(), { kind: 'ptz', pan: 1, tilt: 0, zoom: 0 });
    camera.calls = [];
    await applyOnvif(source(), { kind: 'ptz', pan: 0, tilt: 0, zoom: 0 });
    expect(camera.calls).toEqual(['/onvif/PTZ Stop']);
  });

  it('recalls, stores and removes presets', async () => {
    expect(await applyOnvif(source(), { kind: 'preset-goto', id: '2' })).toEqual({ ok: true });
    expect(camera.lastMove).toBe('goto 2');

    const saved = await applyOnvif(source(), { kind: 'preset-save', name: 'Bridge' });
    expect(saved.presets).toContainEqual({ id: '3', name: 'Bridge' });

    const removed = await applyOnvif(source(), { kind: 'preset-remove', id: '1' });
    expect(removed.presets?.map((p) => p.id)).toEqual(['2', '3']);
  });
});
