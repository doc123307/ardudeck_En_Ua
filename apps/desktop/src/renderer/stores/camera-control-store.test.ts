// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CameraControlState, CameraSourceConfig } from '../../shared/camera-types';

const cameraControlState = vi.fn<(s: CameraSourceConfig) => Promise<CameraControlState>>();
const cameraControlSet = vi.fn<(s: CameraSourceConfig, a: unknown) => Promise<CameraControlState>>();
(window as unknown as { electronAPI: unknown }).electronAPI = { cameraControlState, cameraControlSet };

const { useCameraControlStore, controlKey } = await import('./camera-control-store');

const source = (patch: Partial<CameraSourceConfig> = {}): CameraSourceConfig => ({
  id: 'front', vehicleKey: 'v', kind: 'rtsp', label: 'Front',
  url: 'rtsp://100.67.0.245:8554/frontsub',
  control: { vendor: 'hikvision', port: 3002, username: 'admin', password: 'right' },
  ...patch,
});
const entry = () => useCameraControlStore.getState().entries.front;
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  cameraControlState.mockReset().mockResolvedValue({ ok: true, dayNight: 'auto' });
  cameraControlSet.mockReset().mockResolvedValue({ ok: true, dayNight: 'night' });
  useCameraControlStore.setState({ entries: {} });
});

describe('camera control state', () => {
  it('asks the camera once however many widgets show it', async () => {
    const { ensure } = useCameraControlStore.getState();
    ensure(source()); ensure(source()); ensure(source());
    await settle();
    ensure(source());
    expect(cameraControlState).toHaveBeenCalledTimes(1);
    expect(entry()!.state).toEqual({ ok: true, dayNight: 'auto' });
  });

  it('never retries a rejected login on its own', async () => {
    cameraControlState.mockResolvedValue({ ok: false, authFailed: true, error: 'wrong' });
    const { ensure, refresh } = useCameraControlStore.getState();
    ensure(source());
    await settle();
    ensure(source()); ensure(source()); // re-renders, other widgets mounting
    expect(cameraControlState).toHaveBeenCalledTimes(1);
    await refresh(source()); // the operator pressed Retry
    expect(cameraControlState).toHaveBeenCalledTimes(2);
  });

  it('asks again when the saved address or account changes, but not for a HD/SD switch', async () => {
    const { ensure } = useCameraControlStore.getState();
    ensure(source());
    await settle();
    ensure(source({ url: 'rtsp://100.67.0.245:8554/frontmain' }));
    expect(cameraControlState).toHaveBeenCalledTimes(1);
    ensure(source({ control: { vendor: 'hikvision', port: 3002, username: 'admin', password: 'other' } }));
    expect(cameraControlState).toHaveBeenCalledTimes(2);
    expect(controlKey(source())).not.toBe(controlKey(source({ url: 'rtsp://10.0.0.1:554/frontsub' })));
  });

  it('drops an answer that arrives after the settings changed', async () => {
    let finish: (s: CameraControlState) => void = () => {};
    cameraControlState.mockImplementationOnce(() => new Promise((r) => { finish = r; }));
    const { ensure } = useCameraControlStore.getState();
    ensure(source());
    ensure(source({ control: { vendor: 'hikvision', port: 3003 } }));
    await settle();
    finish({ ok: false, error: 'stale' });
    await settle();
    expect(entry()!.state).toEqual({ ok: true, dayNight: 'auto' });
  });

  it('shows what the camera took after a change', async () => {
    await useCameraControlStore.getState().apply(source(), { kind: 'dayNight', mode: 'night' });
    expect(entry()!.state!.dayNight).toBe('night');
    expect(entry()!.busy).toBe(false);
  });

  it('does nothing for a feed without camera control', () => {
    useCameraControlStore.getState().ensure(source({ control: undefined }));
    expect(cameraControlState).not.toHaveBeenCalled();
  });
});
