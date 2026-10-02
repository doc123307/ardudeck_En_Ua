// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// Enough of an RTCPeerConnection for the hook: events, state, stats, close.
class FakePeer extends EventTarget {
  connectionState: RTCPeerConnectionState = 'connected';
  close = vi.fn(() => { this.connectionState = 'closed'; });
  getStats = vi.fn(async () => new Map());
  fail() {
    this.connectionState = 'failed';
    this.dispatchEvent(new Event('connectionstatechange'));
  }
}
const peers: FakePeer[] = [];
const newPeer = async () => {
  const pc = new FakePeer();
  peers.push(pc);
  return pc as unknown as RTCPeerConnection;
};

vi.mock('./whep', () => ({ playWhep: vi.fn() }));

import { useCameraStream, type CameraStreamStatus } from './useCameraStream';
import { FIRST_FRAME_TIMEOUT_MS, STALL_AFTER_MS, RECONNECT_MS, RECHECK_SESSION_EVERY } from './stream-stall';
import { playWhep } from './whep';
import type { CameraSourceConfig } from '../../../shared/camera-types';
import { useCameraStore } from '../../stores/camera-store';

const source: CameraSourceConfig = { id: 'cam1', vehicleKey: 'v1', kind: 'rtsp', label: 'cam', url: 'rtsp://10.0.0.5/main' };

let status: CameraStreamStatus = 'starting';
let frameCallbacks: Array<() => void> = [];
const onError = vi.fn();
const onLive = vi.fn();
const onSignalLost = vi.fn();

function Player() {
  const videoRef = useRef<HTMLVideoElement>(null);
  status = useCameraStream(source, videoRef, onError, onLive, onSignalLost).status;
  return <video ref={videoRef} />;
}

const showFrame = () => {
  const pending = frameCallbacks;
  frameCallbacks = [];
  pending.forEach((cb) => cb());
};

describe('useCameraStream retry and first-frame gating', () => {
  let root: Root;
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    frameCallbacks = [];
    onError.mockReset();
    onLive.mockReset();
    onSignalLost.mockReset();
    peers.length = 0;
    vi.mocked(playWhep).mockReset().mockImplementation(newPeer);
    HTMLVideoElement.prototype.requestVideoFrameCallback = function (cb: VideoFrameRequestCallback) {
      frameCallbacks.push(() => cb(0, {} as VideoFrameCallbackMetadata));
      return frameCallbacks.length;
    };
    HTMLVideoElement.prototype.cancelVideoFrameCallback = () => {};
    api = {
      cameraStart: vi.fn(async () => ({ ok: true, session: { sourceId: 'cam1', vehicleKey: 'v1', status: 'live', playback: { kind: 'webrtc', whepUrl: 'http://hub/cam1/whep' } } })),
      cameraStop: vi.fn(async () => {}),
    };
    (window as unknown as { electronAPI: unknown }).electronAPI = api;
    root = createRoot(document.createElement('div'));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  const mount = async () => {
    await act(async () => { root.render(<Player />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  };

  it('stays starting after connecting and goes live on the first frame', async () => {
    await mount();
    expect(status).toBe('starting');
    expect(onLive).not.toHaveBeenCalled();
    await act(async () => { showFrame(); });
    expect(status).toBe('live');
    expect(onLive).toHaveBeenCalledTimes(1);
  });

  it('fails when a connected feed shows no frame, then tries again', async () => {
    await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(FIRST_FRAME_TIMEOUT_MS); });
    expect(status).toBe('error');
    expect(onError).toHaveBeenCalledTimes(1);
    const starts = api.cameraStart!.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(api.cameraStart!.mock.calls.length).toBe(starts + 1);
  });

  const goLive = async () => {
    await mount();
    await act(async () => { showFrame(); });
    expect(status).toBe('live');
  };

  it('keeps the hub pipeline up through a link dropout and recovers on the next frame', async () => {
    await goLive();
    // Frames stop: the stall check runs once a second.
    await act(async () => { await vi.advanceTimersByTimeAsync(STALL_AFTER_MS + 1000); });
    expect(status).toBe('stalled');
    expect(onSignalLost).toHaveBeenCalledTimes(1);
    expect(api.cameraStop).not.toHaveBeenCalled();
    expect(peers[0]!.close).toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(RECONNECT_MS); });
    expect(vi.mocked(playWhep)).toHaveBeenCalledTimes(2);
    // The first reconnect asks the engine whether the session still stands (it hands the live
    // one back untouched): a hub that lost the path must be noticed now, not ten tries later.
    expect(api.cameraStart).toHaveBeenCalledTimes(2);

    await act(async () => { showFrame(); });
    expect(status).toBe('live');
    expect(onLive).toHaveBeenCalledTimes(2);
    expect(api.cameraStop).not.toHaveBeenCalled();
  });

  it('treats the hub ending the session as a dropout at once', async () => {
    await goLive();
    await act(async () => { peers[0]!.fail(); });
    expect(status).toBe('stalled');
    expect(onSignalLost).toHaveBeenCalledTimes(1);
  });

  it('reconnects at a steady pace through a long outage and re-checks the session', async () => {
    await goLive();
    vi.mocked(playWhep).mockRejectedValue(new Error('WHEP 404 path not found'));
    await act(async () => { peers[0]!.fail(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RECONNECT_MS * RECHECK_SESSION_EVERY); });
    // One attempt per second, no growing backoff.
    expect(vi.mocked(playWhep)).toHaveBeenCalledTimes(1 + RECHECK_SESSION_EVERY);
    // The initial start, the check on the first reconnect, and the periodic one.
    expect(api.cameraStart).toHaveBeenCalledTimes(3);
    expect(status).toBe('stalled');
    expect(api.cameraStop).not.toHaveBeenCalled();
  });

  it('reconnects at once when the user asks, without waiting out the backoff', async () => {
    api.cameraStart!.mockResolvedValue({ ok: false, error: 'Source did not start streaming' });
    await mount();
    // Let the backoff grow past its first step.
    await act(async () => { await vi.advanceTimersByTimeAsync(1000 + 2000); });
    const before = api.cameraStart!.mock.calls.length;
    await act(async () => { useCameraStore.getState().requestReconnect('cam1'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(api.cameraStart!.mock.calls.length).toBe(before + 1);
    expect(api.cameraStop).toHaveBeenCalled();
  });

  it('retries a failed start on its own and recovers when the camera comes up', async () => {
    api.cameraStart!.mockResolvedValueOnce({ ok: false, error: 'Source did not start streaming' });
    await mount();
    expect(status).toBe('error');
    expect(onError).toHaveBeenCalledWith('Source did not start streaming');
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(api.cameraStart!).toHaveBeenCalledTimes(2);
    await act(async () => { showFrame(); });
    expect(status).toBe('live');
    expect(onLive).toHaveBeenCalledTimes(1);
  });
});
