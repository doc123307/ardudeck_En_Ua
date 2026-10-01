import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { CameraSourceConfig } from '../../shared/camera-types';
import {
  applyControl, digestHeader, getControlState, parseChallenge, resolveTarget, xmlOptions, xmlReplace, xmlValue,
} from './hikvision-isapi';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const REALM = 'IP Camera(J12345)';
const USER = 'admin';
const PASS = 'Secr3t!';

/** A Hikvision-shaped ISAPI endpoint: digest auth (qop=auth) and read-modify-write XML. */
class FakeCamera {
  server = http.createServer((req, res) => this.handle(req, res));
  ircut = 'auto';
  light = 'irLight';
  lightSupported = true;
  lastPut = '';
  private nonce = randomBytes(8).toString('hex');

  get port(): number { return (this.server.address() as AddressInfo).port; }

  private authorized(req: http.IncomingMessage): boolean {
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Digest ')) return false;
    const f = parseChallenge(auth);
    const ha1 = md5(`${f.username}:${REALM}:${PASS}`);
    const ha2 = md5(`${req.method}:${f.uri}`);
    const expected = md5(`${ha1}:${f.nonce}:${f.nc}:${f.cnonce}:${f.qop}:${ha2}`);
    return f.username === USER && f.nonce === this.nonce && f.uri === req.url && f.response === expected;
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse) {
    if (!this.authorized(req)) {
      res.writeHead(401, { 'WWW-Authenticate': `Digest qop="auth", realm="${REALM}", nonce="${this.nonce}", stale="FALSE"` });
      res.end('<ResponseStatus><statusCode>4</statusCode><statusString>Invalid Operation</statusString></ResponseStatus>');
      return;
    }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const xml = (b: string) => { res.writeHead(200, { 'Content-Type': 'application/xml' }); res.end(b); };
      const ok = () => xml('<ResponseStatus><statusCode>1</statusCode><statusString>OK</statusString></ResponseStatus>');
      switch (`${req.method} ${req.url}`) {
        case 'GET /ISAPI/Image/channels/1/IrcutFilter':
          return xml(`<?xml version="1.0" encoding="UTF-8"?><IrcutFilter version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema"><IrcutFilterType>${this.ircut}</IrcutFilterType><nightToDayFilterLevel>4</nightToDayFilterLevel><nightToDayFilterTime>5</nightToDayFilterTime></IrcutFilter>`);
        case 'GET /ISAPI/Image/channels/1/IrcutFilter/capabilities':
          return xml('<IrcutFilter><IrcutFilterType opt="auto,day,night,schedule">auto</IrcutFilterType></IrcutFilter>');
        case 'PUT /ISAPI/Image/channels/1/IrcutFilter':
          this.lastPut = body;
          this.ircut = xmlValue(body, 'IrcutFilterType') ?? this.ircut;
          return ok();
        case 'GET /ISAPI/Image/channels/1/supplementLight':
          if (!this.lightSupported) { res.writeHead(404); res.end(); return; }
          return xml(`<SupplementLight><supplementLightMode>${this.light}</supplementLightMode><mixedLightBrightnessRegulatMode>auto</mixedLightBrightnessRegulatMode></SupplementLight>`);
        case 'GET /ISAPI/Image/channels/1/supplementLight/capabilities':
          return xml('<SupplementLight><supplementLightMode opt="eventIntelligence,irLight,colorVuWhiteLight,close">irLight</supplementLightMode></SupplementLight>');
        case 'PUT /ISAPI/Image/channels/1/supplementLight':
          this.lastPut = body;
          this.light = xmlValue(body, 'supplementLightMode') ?? this.light;
          return ok();
        default:
          res.writeHead(404); res.end();
      }
    });
  }
}

const cam = new FakeCamera();
const source = (patch: Partial<CameraSourceConfig> = {}): CameraSourceConfig => ({
  id: 's1', vehicleKey: 'v', kind: 'rtsp', label: 'Hik',
  url: `rtsp://${USER}:${encodeURIComponent(PASS)}@127.0.0.1:554/Streaming/Channels/101`,
  control: { vendor: 'hikvision', port: cam.port },
  ...patch,
});

beforeAll(() => new Promise<void>((r) => cam.server.listen(0, '127.0.0.1', r)));
afterAll(() => new Promise<void>((r) => cam.server.close(() => r())));
beforeEach(() => { cam.ircut = 'auto'; cam.light = 'irLight'; cam.lightSupported = true; cam.lastPut = ''; });

describe('hikvision isapi', () => {
  it('takes host and account from the RTSP url unless overridden', () => {
    const t = resolveTarget(source())!;
    expect(t.base).toBe(`http://127.0.0.1:${cam.port}`);
    expect(t.username).toBe(USER);
    expect(t.password).toBe(PASS);
    expect(t.channel).toBe(1);
    const o = resolveTarget(source({ control: { vendor: 'hikvision', host: '10.0.0.9', username: 'op', password: 'x', channel: 2 } }))!;
    expect(o.base).toBe('http://10.0.0.9');
    expect([o.username, o.password, o.channel]).toEqual(['op', 'x', 2]);
    expect(resolveTarget(source({ control: undefined }))).toBeNull();
  });

  it('answers a digest challenge the way RFC 7616 computes it', () => {
    const ch = parseChallenge('Digest qop="auth", realm="r", nonce="n", stale="FALSE"');
    const header = digestHeader(ch, 'GET', '/x', 'u', 'p', 'c', '00000001');
    const ha1 = md5('u:r:p');
    const ha2 = md5('GET:/x');
    expect(header).toContain(`response="${md5(`${ha1}:n:00000001:c:auth:${ha2}`)}"`);
    expect(header).toContain('qop=auth');
  });

  it('reads and edits XML elements without touching the rest', () => {
    const xml = '<a><IrcutFilterType>auto</IrcutFilterType><b>4</b></a>';
    expect(xmlValue(xml, 'IrcutFilterType')).toBe('auto');
    expect(xmlReplace(xml, 'IrcutFilterType', 'night')).toBe('<a><IrcutFilterType>night</IrcutFilterType><b>4</b></a>');
    expect(xmlOptions('<x><m opt="a, b,c">a</m></x>', 'm')).toEqual(['a', 'b', 'c']);
  });

  it('reports day/night and light state with the options the camera allows', async () => {
    const state = await getControlState(source());
    expect(state).toEqual({
      ok: true,
      dayNight: 'auto',
      dayNightOptions: ['auto', 'day', 'night'], // 'schedule' is not offered
      light: 'irLight',
      lightOptions: ['eventIntelligence', 'irLight', 'colorVuWhiteLight', 'close'],
    });
  });

  it('switches to night and keeps the thresholds the installer set', async () => {
    const state = await applyControl(source(), { kind: 'dayNight', mode: 'night' });
    expect(cam.ircut).toBe('night');
    expect(state.dayNight).toBe('night');
    expect(cam.lastPut).toContain('<nightToDayFilterLevel>4</nightToDayFilterLevel>');
  });

  it('turns on the white light and off again', async () => {
    expect((await applyControl(source(), { kind: 'light', mode: 'colorVuWhiteLight' })).light).toBe('colorVuWhiteLight');
    expect(cam.lastPut).toContain('<mixedLightBrightnessRegulatMode>auto</mixedLightBrightnessRegulatMode>');
    expect((await applyControl(source(), { kind: 'light', mode: 'close' })).light).toBe('close');
  });

  it('offers no light control on a camera without a supplement light', async () => {
    cam.lightSupported = false;
    const state = await getControlState(source());
    expect(state.ok).toBe(true);
    expect(state.light).toBeUndefined();
    expect(state.lightOptions).toBeUndefined();
  });

  it('says the login is wrong rather than failing silently', async () => {
    const state = await getControlState(source({ control: { vendor: 'hikvision', port: cam.port, password: 'nope' } }));
    expect(state.ok).toBe(false);
    expect(state.error).toMatch(/login or password/);
  });

  it('points at the camera address when the RTSP url is a relay', async () => {
    const relayed = source({ url: 'rtsp://127.0.0.1:8554/frontsub', control: { vendor: 'hikvision', port: 1 } });
    expect(resolveTarget(relayed)!.likelyRelay).toBe(true);
    const state = await getControlState(relayed);
    expect(state.error).toMatch(/relay/);
    // an explicit camera address is not second-guessed
    expect(resolveTarget(source({ url: 'rtsp://127.0.0.1:8554/frontsub', control: { vendor: 'hikvision', host: '192.168.4.102' } }))!.likelyRelay).toBe(false);
  });

  it('names the address when the camera cannot be reached', async () => {
    const state = await getControlState(source({ control: { vendor: 'hikvision', host: '127.0.0.1', port: 1 } }));
    expect(state.ok).toBe(false);
    expect(state.error).toContain('http://127.0.0.1:1');
  });
});
