import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { fileNamePart, recordArgs, recordingFileName, stopRecording } from './recording';

afterEach(() => vi.useRealTimers());

describe('recordingFileName', () => {
  const at = new Date(2026, 9, 2, 9, 11, 5);

  it('names the file by local time and camera', () => {
    expect(recordingFileName('Front', at)).toBe('2026-10-02_09-11-05_Front.mp4');
    expect(recordingFileName('Задня камера', at)).toBe('2026-10-02_09-11-05_Задня_камера.mp4');
  });

  it('keeps two recordings started in the same second apart', () => {
    const used = new Set(['2026-10-02_09-11-05_Front.mp4', '2026-10-02_09-11-05_Front_2.mp4']);
    expect(recordingFileName('Front', at, (n) => used.has(n))).toBe('2026-10-02_09-11-05_Front_3.mp4');
  });

  it('drops what a file name cannot hold', () => {
    expect(fileNamePart('rtsp://cam/1?x=1')).toBe('rtsp_cam_1_x=1');
    expect(fileNamePart('  ..  ')).toBe('camera');
    expect(fileNamePart(undefined)).toBe('camera');
    expect(fileNamePart('x'.repeat(100))).toHaveLength(40);
  });
});

describe('recordArgs', () => {
  it('writes fragmented MP4, playable even when the recording is cut short', () => {
    const args = recordArgs('rtsp://127.0.0.1:8554/cam', 'out.mp4');
    expect(args[args.indexOf('-movflags') + 1]).toContain('frag_keyframe');
    expect(args[args.indexOf('-movflags') + 1]).toContain('empty_moov');
    expect(args.slice(-3)).toEqual(['-f', 'mp4', 'out.mp4']);
    expect(args[args.indexOf('-c') + 1]).toBe('copy');
  });
});

describe('stopRecording', () => {
  function fakeFfmpeg() {
    const p = new EventEmitter() as EventEmitter & { stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }; kill: ReturnType<typeof vi.fn> };
    p.stdin = { write: vi.fn(), end: vi.fn() };
    p.kill = vi.fn();
    return p;
  }

  it('asks ffmpeg to quit and does not kill a process that exits by itself', () => {
    vi.useFakeTimers();
    const p = fakeFfmpeg();
    stopRecording(p as unknown as ChildProcess, 4000);
    expect(p.stdin.write).toHaveBeenCalledWith('q\n');
    p.emit('exit', 0);
    vi.advanceTimersByTime(5000);
    expect(p.kill).not.toHaveBeenCalled();
  });

  it('kills a process that ignores the request', () => {
    vi.useFakeTimers();
    const p = fakeFfmpeg();
    stopRecording(p as unknown as ChildProcess, 4000);
    vi.advanceTimersByTime(3999);
    expect(p.kill).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(p.kill).toHaveBeenCalledWith('SIGKILL');
  });
});
