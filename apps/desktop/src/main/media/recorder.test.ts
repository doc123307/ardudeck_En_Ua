import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { ArmedRecorder, MIN_FREE_BYTES, uniqueNameParts } from './recorder';
import { segmentRecordArgs } from './recording';

/** A stand-in for ffmpeg: records what it was started with and exits when told to. */
class FakeFfmpeg extends EventEmitter {
  stdin = { write: vi.fn((data: string) => { if (data.startsWith('q')) this.exit(); }), end: vi.fn() };
  stderr = new EventEmitter();
  killed = false;
  constructor(readonly args: string[]) { super(); }
  kill() { this.killed = true; this.exit(); return true; }
  exit(message = '') {
    if (message) this.stderr.emit('data', Buffer.from(message));
    this.emit('exit', 0);
  }
}

describe('ArmedRecorder', () => {
  let dir: string;
  let streams: Record<string, string | null>;
  let spawned: FakeFfmpeg[];
  let free: number | null;
  let ffmpeg: string | null;
  let logs: string[];
  let recorder: ArmedRecorder;

  beforeEach(() => {
    vi.useFakeTimers();
    dir = mkdtempSync(join(tmpdir(), 'stohid-rec-'));
    streams = {};
    spawned = [];
    free = 50 * MIN_FREE_BYTES;
    ffmpeg = 'ffmpeg';
    logs = [];
    recorder = new ArmedRecorder({
      ffmpegPath: () => ffmpeg,
      streamUrl: (id) => streams[id] ?? null,
      label: (id) => ({ front: 'Front', rear: 'Rear' } as Record<string, string>)[id],
      dir: () => ({ path: dir }),
      segmentSeconds: () => 900,
      freeBytes: () => free,
      log: (_, message) => logs.push(message),
      spawn: (_, args) => {
        const p = new FakeFfmpeg(args);
        spawned.push(p);
        return p as unknown as ChildProcess;
      },
    });
  });
  afterEach(() => {
    recorder.shutdown();
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  it('waits for a camera that has no video, and starts by itself when it appears', () => {
    recorder.setWanted(['front']);
    vi.advanceTimersByTime(10_000);
    expect(spawned).toHaveLength(0);
    expect(recorder.status().sources.front!.state).toBe('waiting');

    streams.front = 'rtsp://127.0.0.1:8554/cam_front';
    vi.advanceTimersByTime(2000);
    expect(spawned).toHaveLength(1);
    expect(spawned[0]!.args).toContain('rtsp://127.0.0.1:8554/cam_front');
    expect(recorder.status().sources.front!.state).toBe('waiting'); // not settled yet
    vi.advanceTimersByTime(2000);
    expect(recorder.status().sources.front!.state).toBe('recording');
  });

  it('resumes in a new run after the video drops', () => {
    streams.front = 'rtsp://hub/cam_front';
    recorder.setWanted(['front']);
    vi.advanceTimersByTime(60_000);
    expect(spawned).toHaveLength(1);
    spawned[0]!.exit('Connection reset by peer');
    expect(recorder.status().sources.front!.state).toBe('waiting');
    vi.advanceTimersByTime(4000);
    expect(spawned).toHaveLength(2);
    expect(logs.some((l) => l.includes('interrupted'))).toBe(true);
  });

  it('backs off while a stream keeps refusing, and says why only once', () => {
    streams.front = 'rtsp://hub/cam_front';
    recorder.setWanted(['front']);
    /** Fails the running attempt at once and returns how long the next one took to come. */
    const failAndWait = (): number => {
      const before = spawned.length;
      spawned[before - 1]!.exit('404 Not Found');
      let waited = 0;
      while (spawned.length === before && waited < 30_000) {
        vi.advanceTimersByTime(2000);
        waited += 2000;
      }
      return waited;
    };
    expect([failAndWait(), failAndWait(), failAndWait(), failAndWait(), failAndWait(), failAndWait()])
      .toEqual([4000, 6000, 10_000, 12_000, 16_000, 16_000]);
    expect(logs.filter((l) => l.includes('404 Not Found'))).toHaveLength(1);
  });

  it('records several cameras, each under its own name', () => {
    streams.front = 'rtsp://hub/cam_front';
    streams.rear = 'rtsp://hub/cam_rear';
    recorder.setWanted(['front', 'rear']);
    expect(spawned).toHaveLength(2);
    expect(spawned[0]!.args[spawned[0]!.args.length - 1]).toMatch(/_Front\.mp4$/);
    expect(spawned[1]!.args[spawned[1]!.args.length - 1]).toMatch(/_Rear\.mp4$/);
  });

  it('finishes the file of a camera that is no longer wanted and leaves the others', () => {
    streams.front = 'rtsp://hub/cam_front';
    streams.rear = 'rtsp://hub/cam_rear';
    recorder.setWanted(['front', 'rear']);
    recorder.setWanted(['rear']);
    expect(spawned[0]!.stdin.write).toHaveBeenCalledWith('q\n');
    expect(spawned[1]!.stdin.write).not.toHaveBeenCalled();
    expect(Object.keys(recorder.status().sources)).toEqual(['rear']);
    vi.advanceTimersByTime(10_000);
    expect(spawned).toHaveLength(2); // the dropped camera is not restarted
  });

  it('closes the file when the stream is taken down, then picks the stream up again', () => {
    streams.front = 'rtsp://hub/cam_front';
    recorder.setWanted(['front']);
    recorder.streamGone('front');
    expect(spawned[0]!.stdin.write).toHaveBeenCalledWith('q\n');
    vi.advanceTimersByTime(4000);
    expect(spawned).toHaveLength(2);
  });

  it('does not start on a full disk, and stops when it fills up', () => {
    free = MIN_FREE_BYTES / 2;
    streams.front = 'rtsp://hub/cam_front';
    recorder.setWanted(['front']);
    expect(spawned).toHaveLength(0);
    expect(recorder.status().sources.front!.state).toBe('no-space');

    free = 50 * MIN_FREE_BYTES;
    vi.advanceTimersByTime(2000);
    expect(spawned).toHaveLength(1);
    free = MIN_FREE_BYTES / 4;
    vi.advanceTimersByTime(2000);
    expect(spawned[0]!.stdin.write).toHaveBeenCalledWith('q\n');
    vi.advanceTimersByTime(20_000);
    expect(spawned).toHaveLength(1);
    expect(recorder.status().sources.front!.state).toBe('no-space');
  });

  it('says so when ffmpeg is missing', () => {
    ffmpeg = null;
    streams.front = 'rtsp://hub/cam_front';
    recorder.setWanted(['front']);
    expect(recorder.status().sources.front!.state).toBe('no-ffmpeg');
  });

  it('removes the empty file of a run that got no video', () => {
    writeFileSync(join(dir, '2026-10-02_10-00-00_Front.mp4'), '');
    writeFileSync(join(dir, '2026-10-02_09-00-00_Front.mp4'), 'video');
    writeFileSync(join(dir, '2026-10-02_10-00-00_Rear.mp4'), '');
    streams.front = 'rtsp://hub/cam_front';
    recorder.setWanted(['front']);
    spawned[0]!.exit();
    expect(readdirSync(dir).sort()).toEqual(['2026-10-02_09-00-00_Front.mp4', '2026-10-02_10-00-00_Rear.mp4']);
  });

  it('keeps the moment recording was asked for', () => {
    vi.setSystemTime(new Date('2026-10-02T10:00:00'));
    recorder.setWanted(['front']);
    vi.advanceTimersByTime(30_000);
    recorder.setWanted(['front', 'rear']);
    const { sources } = recorder.status();
    expect(sources.rear!.since - sources.front!.since).toBe(30_000);
  });

  it('stops everything on shutdown', () => {
    streams.front = 'rtsp://hub/cam_front';
    recorder.setWanted(['front']);
    recorder.shutdown();
    expect(spawned[0]!.stdin.write).toHaveBeenCalledWith('q\n');
    expect(recorder.status().sources).toEqual({});
    vi.advanceTimersByTime(10_000);
    expect(spawned).toHaveLength(1);
  });
});

describe('recording file names', () => {
  it('gives cameras with the same name different files', () => {
    const parts = uniqueNameParts([{ id: 'a', label: 'Camera' }, { id: 'b', label: 'camera' }, { id: 'c', label: undefined }, { id: 'd', label: 'Rear' }]);
    expect([...parts.values()]).toEqual(['Camera', 'camera_2', 'camera_3', 'Rear']);
  });

  it('cuts a recording into dated, crash-safe files', () => {
    const args = segmentRecordArgs('rtsp://hub/cam', join('D:', 'Videos', 'STOHID'), 'Front 100%', 900);
    expect(args.slice(0, 6)).toEqual(['-rtsp_transport', 'tcp', '-i', 'rtsp://hub/cam', '-c', 'copy']);
    expect(args).toContain('segment');
    expect(args[args.indexOf('-segment_time') + 1]).toBe('900');
    expect(args[args.indexOf('-segment_format_options') + 1]).toContain('frag_keyframe');
    expect(args[args.indexOf('-strftime') + 1]).toBe('1');
    expect(args[args.length - 1]).toMatch(/%Y-%m-%d_%H-%M-%S_Front 100%%\.mp4$/);
  });
});
