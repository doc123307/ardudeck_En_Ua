import { describe, it, expect } from 'vitest';
import { controlBase, parseControlAddress } from './control-address';
import { resolveControlTarget } from './camera-http';
import { resolveTarget } from './hikvision-isapi';
import type { CameraSourceConfig } from '../../shared/camera-types';

describe('parseControlAddress', () => {
  it('takes a bare host', () => {
    expect(parseControlAddress('192.168.88.117')).toEqual({ host: '192.168.88.117' });
    expect(parseControlAddress('  cam.local  ')).toEqual({ host: 'cam.local' });
  });

  it('takes host:port, the way people type a forwarded port', () => {
    expect(parseControlAddress('192.168.88.117:3002')).toEqual({ host: '192.168.88.117', port: 3002 });
    expect(parseControlAddress('cam.local:8080')).toEqual({ host: 'cam.local', port: 8080 });
  });

  it('takes a url pasted from the browser', () => {
    expect(parseControlAddress('http://192.168.88.117:3002/doc/page/login.asp?x=1')).toEqual({ host: '192.168.88.117', port: 3002, https: false });
    expect(parseControlAddress('https://admin:secret@cam.local/')).toEqual({ host: 'cam.local', https: true });
  });

  it('keeps IPv6 addresses whole', () => {
    expect(parseControlAddress('fe80::1')).toEqual({ host: '[fe80::1]' });
    expect(parseControlAddress('[fe80::1]:8080')).toEqual({ host: '[fe80::1]', port: 8080 });
  });

  it('gives nothing for an empty field and ignores an impossible port', () => {
    expect(parseControlAddress('')).toBeNull();
    expect(parseControlAddress(undefined)).toBeNull();
    expect(parseControlAddress('cam.local:99999')).toEqual({ host: 'cam.local' });
  });
});

describe('controlBase', () => {
  it('builds the address the camera is reached at', () => {
    expect(controlBase('192.168.88.117:3002', undefined, undefined)).toBe('http://192.168.88.117:3002');
    expect(controlBase('192.168.88.117', 3002, undefined)).toBe('http://192.168.88.117:3002');
    expect(controlBase('192.168.88.117', undefined, undefined)).toBe('http://192.168.88.117');
    expect(controlBase('https://cam.local', undefined, undefined)).toBe('https://cam.local');
    expect(controlBase('cam.local', 443, true)).toBe('https://cam.local');
  });

  it('lets the port field win over a port typed with the address', () => {
    expect(controlBase('192.168.88.117:3002', 3003, undefined)).toBe('http://192.168.88.117:3003');
  });

  it('falls back to the RTSP host when the address field is empty', () => {
    expect(controlBase('', 3002, undefined, '100.67.0.245')).toBe('http://100.67.0.245:3002');
    expect(controlBase(undefined, undefined, undefined, undefined)).toBeNull();
  });
});

describe('the camera drivers', () => {
  const source = (host: string, port?: number): CameraSourceConfig => ({
    id: 'c', vehicleKey: 'v', kind: 'rtsp', label: 'Front', url: 'rtsp://192.168.88.117:8554/frontsub',
    control: { vendor: 'hikvision', host, ...(port !== undefined ? { port } : {}), username: 'admin' },
  });

  it('accept host:port in the address field (the reported case)', () => {
    expect(resolveTarget(source('192.168.88.117:3002'))?.base).toBe('http://192.168.88.117:3002');
    expect(resolveControlTarget(source('192.168.88.117:3002'))?.base).toBe('http://192.168.88.117:3002');
    // every request url built from it is valid
    expect(() => new URL(`${resolveTarget(source('192.168.88.117:3002'))!.base}/ISAPI/Security/userCheck`)).not.toThrow();
  });

  it('still take the port from its own field', () => {
    expect(resolveTarget(source('192.168.88.117', 3002))?.base).toBe('http://192.168.88.117:3002');
    expect(resolveControlTarget(source('192.168.88.117', 3002))?.base).toBe('http://192.168.88.117:3002');
  });
});
