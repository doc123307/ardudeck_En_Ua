import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { CameraSourceConfig } from '../../shared/camera-types';
import {
  applyControl, digestHeader, getControlState, parseChallenge, pickChallenge, resolveTarget, xmlOptions, xmlReplace, xmlValue,
} from './hikvision-isapi';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const REALM = 'IP Camera(J12345)';
const USER = 'admin';
const PASS = 'Secr3t!';

/** A Hikvision-shaped ISAPI endpoint: digest auth (qop=auth) and read-modify-write XML. */
class FakeCamera {
  server = http.createServer((req, res) => this.handle(req, res));
  ircut = 'auto';
  light = 'irLight';
  lightSupported = true;
  /** 2024+ firmware: offers MD5 and SHA-256 digests at once, each with its own nonce. */
  dualChallenge = false;
  /** Illegal-login lock: every login is refused, with the time left in the body. */
  locked = false;
  /** A model whose day/night endpoint answers 403 notSupport. */
  ircutForbidden = false;
  logins = 0;
  lastPut = '';
  private nonce256 = randomBytes(8).toString('hex');
  private nonce = randomBytes(8).toString('hex');

  get port(): number { return (this.server.address() as AddressInfo).port; }

  private authorized(req: http.IncomingMessage): boolean {
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Digest ')) return false;
    const f = parseChallenge(auth);
    this.logins += 1;
    if (this.locked) return false;
    // The nonce must be the one issued for the algorithm the client says it used.
    const sha = /^sha-256$/i.test(f.algorithm ?? '');
    const hash = sha ? sha256 : md5;
    const ha1 = hash(`${f.username}:${REALM}:${PASS}`);
    const ha2 = hash(`${req.method}:${f.uri}`);
    const expected = hash(`${ha1}:${f.nonce}:${f.nc}:${f.cnonce}:${f.qop}:${ha2}`);
    return f.username === USER && f.nonce === (sha ? this.nonce256 : this.nonce) && f.uri === req.url && f.response === expected;
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse) {
    if (!this.authorized(req)) {
      const md5Challenge = `Digest qop="auth", realm="${REALM}", nonce="${this.nonce}", stale="FALSE"`;
      res.writeHead(401, {
        'WWW-Authenticate': this.dualChallenge
          ? [`${md5Challenge}, algorithm=MD5`, `Digest qop="auth", realm="${REALM}", nonce="${this.nonce256}", stale="FALSE", algorithm=SHA-256`]
          : md5Challenge,
      });
      res.end(`<userCheck><statusValue>401</statusValue><statusString>Unauthorized</statusString><lockStatus>${this.locked ? 'lock' : 'unlock'}</lockStatus><unlockTime>${this.locked ? 1680 : 0}</unlockTime><retryLoginTime>4</retryLoginTime></userCheck>`);
      return;
    }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const xml = (b: string) => { res.writeHead(200, { 'Content-Type': 'application/xml' }); res.end(b); };
      const ok = () => xml('<ResponseStatus><statusCode>1</statusCode><statusString>OK</statusString></ResponseStatus>');
      switch (`${req.method} ${req.url}`) {
        case 'GET /ISAPI/Security/userCheck':
          return xml('<userCheck><statusValue>200</statusValue><statusString>OK</statusString></userCheck>');
        case 'GET /ISAPI/Image/channels/1/IrcutFilter':
          if (this.ircutForbidden) {
            res.writeHead(403, { 'Content-Type': 'application/xml' });
            res.end('<ResponseStatus><statusCode>4</statusCode><statusString>Invalid Operation</statusString><subStatusCode>notSupport</subStatusCode></ResponseStatus>');
            return;
          }
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
beforeEach(() => {
  cam.ircut = 'auto'; cam.light = 'irLight'; cam.lightSupported = true; cam.lastPut = '';
  cam.dualChallenge = false; cam.locked = false; cam.ircutForbidden = false; cam.logins = 0;
});

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

  it('says the login is wrong, how many tries are left, and tries it only once', async () => {
    const state = await getControlState(source({ control: { vendor: 'hikvision', port: cam.port, password: 'nope' } }));
    expect(state.ok).toBe(false);
    expect(state.authFailed).toBe(true);
    expect(state.error).toMatch(/login or password/);
    expect(state.error).toMatch(/4/);
    // one failed login, not one per endpoint: each one brings the camera's lock closer
    expect(cam.logins).toBe(1);
  });

  it('says the camera locked the login instead of blaming the password', async () => {
    cam.locked = true;
    const state = await getControlState(source());
    expect(state.authFailed).toBe(true);
    expect(state.error).toMatch(/locked/);
    expect(state.error).toMatch(/28 min/);
  });

  it('logs in to firmware that offers MD5 and SHA-256 digests together', async () => {
    cam.dualChallenge = true;
    expect((await getControlState(source())).ok).toBe(true);
    const header = `Digest qop="auth", realm="r", nonce="a", algorithm=MD5, Digest qop="auth", realm="r", nonce="b", algorithm=SHA-256, Basic realm="r"`;
    expect(pickChallenge(header).fields.nonce).toBe('a');
    expect(pickChallenge('Digest realm="r", nonce="b", algorithm=SHA-256').fields.algorithm).toBe('SHA-256');
    expect(pickChallenge('Basic realm="r"').scheme).toBe('basic');
  });

  it('answers a SHA-256-only challenge with SHA-256', () => {
    const header = digestHeader({ realm: 'r', nonce: 'n', qop: 'auth', algorithm: 'SHA-256' }, 'GET', '/x', 'u', 'p', 'c', '00000001');
    expect(header).toContain(`response="${sha256(`${sha256('u:r:p')}:n:00000001:c:auth:${sha256('GET:/x')}`)}"`);
    expect(header).toContain('algorithm=SHA-256');
  });

  it('keeps the light control on a model that refuses the day/night endpoint', async () => {
    cam.ircutForbidden = true;
    const state = await getControlState(source());
    expect(state.ok).toBe(true); // a 403 there is a missing feature, not a wrong password
    expect(state.dayNight).toBeUndefined();
    expect(state.light).toBe('irLight');
    cam.lightSupported = false;
    const none = await getControlState(source());
    expect(none.ok).toBe(false);
    expect(none.authFailed).toBeUndefined();
    expect(none.error).toMatch(/IrcutFilter: HTTP 403 notSupport/);
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
