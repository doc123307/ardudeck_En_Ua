import { describe, it, expect } from 'vitest';
import { HubApi } from './hub-api';

/** A stand-in hub that behaves like MediaMTX's control API for path configuration. */
function fakeHub() {
  const paths = new Map<string, unknown>();
  const calls: string[] = [];
  const reply = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const fetchImpl = async (url: string, init?: { method?: string; body?: string }) => {
    const method = init?.method ?? 'GET';
    const path = new URL(url).pathname;
    calls.push(`${method} ${path}`);
    const name = decodeURIComponent(path.split('/').pop() ?? '');
    if (path === '/v3/paths/list') return reply(200);
    if (path === '/v3/config/paths/list') return reply(200, { items: [...paths.keys()].map((n) => ({ name: n })) });
    if (path.startsWith('/v3/config/paths/replace/') && method === 'POST') { paths.set(name, JSON.parse(init?.body ?? '{}')); return reply(200); }
    if (path.startsWith('/v3/config/paths/get/') && method === 'GET') return paths.has(name) ? reply(200) : reply(404);
    // MediaMTX removes a path on DELETE only; any other method is a 404.
    if (path.startsWith('/v3/config/paths/delete/') && method === 'DELETE') return paths.delete(name) ? reply(200) : reply(404);
    return reply(404);
  };
  return { api: new HubApi('http://127.0.0.1:9997', fetchImpl), paths, calls };
}

describe('HubApi', () => {
  it('adds a path with its source and transport, and can re-point it', async () => {
    const { api, paths } = fakeHub();
    expect(await api.setPath('cam_a', 'rtsp://cam/main', 'tcp')).toBe(true);
    expect(paths.get('cam_a')).toEqual({ source: 'rtsp://cam/main', sourceOnDemand: false, rtspTransport: 'tcp' });
    expect(await api.setPath('cam_a', 'rtsp://cam/sub', 'tcp')).toBe(true);
    expect(paths.get('cam_a')).toMatchObject({ source: 'rtsp://cam/sub' });
  });

  it('really removes a path, so a closed feed stops being pulled', async () => {
    const { api, paths, calls } = fakeHub();
    await api.setPath('cam_a', 'rtsp://cam/main');
    await api.setPath('cam_b', 'rtsp://cam2/main');
    await api.removePath('cam_a');
    expect(calls).toContain('DELETE /v3/config/paths/delete/cam_a');
    expect([...paths.keys()]).toEqual(['cam_b']);
    expect(await api.hasPath('cam_a')).toBe(false);
    expect(await api.hasPath('cam_b')).toBe(true);
  });

  it('lists what a previous run left configured', async () => {
    const { api } = fakeHub();
    await api.setPath('cam_a', 'rtsp://cam/main');
    await api.setPath('other', 'rtsp://x');
    expect(await api.configuredPaths()).toEqual(['cam_a', 'other']);
  });

  it('tells a missing path from a hub that does not answer', async () => {
    const down = new HubApi('http://127.0.0.1:9997', async () => { throw new Error('ECONNREFUSED'); });
    expect(await down.alive()).toBe(false);
    expect(await down.hasPath('cam_a')).toBeNull();
    expect(await down.setPath('cam_a', 'rtsp://cam/main')).toBe(false);
    expect(await down.configuredPaths()).toEqual([]);
    await expect(down.removePath('cam_a')).resolves.toBeUndefined();
  });
});
