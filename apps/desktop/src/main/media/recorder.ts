/**
 * Recording that does not depend on the video being there at this moment.
 *
 * The operator screen says which cameras are to be recorded; this keeps an ffmpeg per
 * camera going for as long as that holds. A camera with no picture is simply waited for:
 * the recording starts when the stream appears and resumes after every dropout, each time
 * in a new file. Nothing has to be pressed again.
 */

import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { CameraRecordState, CameraRecordStatus } from '../../shared/camera-types.js';
import { fileNamePart, recordArgs, recordingFileName, segmentRecordArgs, stopRecording } from './recording.js';

const TICK_MS = 2000;
/** A recording younger than this is still "starting": a stream ffmpeg cannot open fails at once. */
const SETTLE_MS = 1500;
const RETRY_BASE_MS = 3000;
const RETRY_MAX_MS = 15000;
/** A run shorter than this did not really record; the next attempt waits longer. */
const SHORT_RUN_MS = 5000;
/** Recording does not start below this much free disk space, and stops at half of it. */
export const MIN_FREE_BYTES = 1024 ** 3;

export interface RecorderDeps {
  ffmpegPath: () => string | null;
  /** RTSP url of a camera's stream on the hub; null while the camera has no session. */
  streamUrl: (sourceId: string) => string | null;
  label: (sourceId: string) => string | undefined;
  /** Where the files go; `error` says the chosen folder could not be used and this one stands in. */
  dir: () => { path: string; error?: string };
  segmentSeconds: () => number;
  freeBytes: (dir: string) => number | null;
  log?: (level: 'info' | 'warn' | 'error', message: string) => void;
  spawn?: (command: string, args: string[]) => ChildProcess;
  now?: () => number;
}

interface Armed {
  since: number;
  /** Camera name as it appears in the file names; distinct among the cameras recorded together. */
  part: string;
  proc?: ChildProcess;
  procStartedAt?: number;
  nextTryAt: number;
  failures: number;
  blocked?: Extract<CameraRecordState, 'no-space' | 'no-ffmpeg'>;
  /** The last reason said in the log, so a camera that stays down is not reported every 3 s. */
  lastReason?: string;
}

/** File-name parts for cameras recorded together: two cameras called "Camera" become "Camera" and "Camera_2". */
export function uniqueNameParts(sources: { id: string; label: string | undefined }[]): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set<string>();
  for (const s of sources) {
    const base = fileNamePart(s.label);
    let part = base;
    for (let n = 2; taken.has(part.toLowerCase()); n++) part = `${base}_${n}`;
    taken.add(part.toLowerCase());
    out.set(s.id, part);
  }
  return out;
}

export class ArmedRecorder {
  private armed = new Map<string, Armed>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly now: () => number;
  private readonly spawn: (command: string, args: string[]) => ChildProcess;

  constructor(private readonly deps: RecorderDeps) {
    this.now = deps.now ?? Date.now;
    this.spawn = deps.spawn ?? ((command, args) => nodeSpawn(command, args, { stdio: ['pipe', 'ignore', 'pipe'] }));
  }

  has(sourceId: string): boolean {
    return this.armed.has(sourceId);
  }

  /** The cameras to record from now on. Ones no longer listed are finished and saved. */
  setWanted(sourceIds: string[]): void {
    const wanted = [...new Set(sourceIds)];
    for (const [id, entry] of this.armed) {
      if (wanted.includes(id)) continue;
      if (entry.proc) stopRecording(entry.proc);
      this.armed.delete(id);
    }
    const parts = uniqueNameParts(wanted.map((id) => ({ id, label: this.deps.label(id) })));
    for (const id of wanted) {
      const entry = this.armed.get(id);
      // The name is fixed while a file is being written; it follows a rename at the next file.
      if (entry) { if (!entry.proc) entry.part = parts.get(id)!; continue; }
      this.armed.set(id, { since: this.now(), part: parts.get(id)!, nextTryAt: 0, failures: 0 });
    }
    if (this.armed.size > 0) {
      this.timer ??= setInterval(() => this.tick(), TICK_MS);
      this.tick();
    } else if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** The camera's stream is being taken down: close the file properly instead of letting it break off. */
  streamGone(sourceId: string): void {
    const entry = this.armed.get(sourceId);
    if (entry?.proc) stopRecording(entry.proc);
  }

  shutdown(): void {
    this.setWanted([]);
  }

  tick(): void {
    const now = this.now();
    for (const [id, entry] of this.armed) {
      if (entry.proc) {
        const free = this.deps.freeBytes(this.deps.dir().path);
        if (free !== null && free < MIN_FREE_BYTES / 2) {
          this.deps.log?.('error', 'Recording stopped: the disk is almost full.');
          stopRecording(entry.proc);
          entry.blocked = 'no-space';
        }
        continue;
      }
      const url = this.deps.streamUrl(id);
      if (!url || now < entry.nextTryAt) continue;
      const ffmpeg = this.deps.ffmpegPath();
      if (!ffmpeg) { entry.blocked = 'no-ffmpeg'; continue; }
      const dir = this.deps.dir().path;
      const free = this.deps.freeBytes(dir);
      if (free !== null && free < MIN_FREE_BYTES) { entry.blocked = 'no-space'; continue; }
      delete entry.blocked;
      this.start(id, entry, ffmpeg, url, dir);
    }
  }

  private start(id: string, entry: Armed, ffmpeg: string, url: string, dir: string): void {
    const seconds = this.deps.segmentSeconds();
    const args = seconds > 0
      ? segmentRecordArgs(url, dir, entry.part, seconds)
      : recordArgs(url, join(dir, recordingFileName(entry.part, new Date(this.now()), (name) => existsSync(join(dir, name)))));
    let proc: ChildProcess;
    try {
      proc = this.spawn(ffmpeg, ['-y', ...args]);
    } catch (e) {
      this.ended(id, entry, undefined, e instanceof Error ? e.message : String(e), dir);
      return;
    }
    const startedAt = this.now();
    entry.proc = proc;
    entry.procStartedAt = startedAt;
    // ffmpeg's output has to be read (a full pipe would stall it); the tail says why it stopped.
    let tail = '';
    proc.stderr?.on('data', (d: Buffer) => { tail = (tail + d.toString()).slice(-1500); });
    let done = false;
    const finish = (reason: string) => {
      if (done) return;
      done = true;
      this.ended(id, entry, proc, reason, dir, startedAt);
    };
    proc.once('exit', () => finish(lastLine(tail)));
    proc.once('error', (e: Error) => finish(e.message));
  }

  private ended(id: string, entry: Armed, proc: ChildProcess | undefined, reason: string, dir: string, startedAt?: number): void {
    removeEmptyFiles(dir, entry.part);
    // Disarmed meanwhile, or already replaced: nothing to schedule.
    if (this.armed.get(id) !== entry || (proc && entry.proc !== proc)) return;
    const now = this.now();
    const ranFor = startedAt === undefined ? 0 : now - startedAt;
    delete entry.proc;
    delete entry.procStartedAt;
    entry.failures = ranFor < SHORT_RUN_MS ? entry.failures + 1 : 0;
    entry.nextTryAt = now + Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.max(1, entry.failures));
    if (ranFor >= SHORT_RUN_MS) {
      this.deps.log?.('warn', `Recording of "${entry.part}" was interrupted; it resumes when the video is back.`);
      delete entry.lastReason;
    } else if (reason && reason !== entry.lastReason) {
      entry.lastReason = reason;
      this.deps.log?.('warn', `Recording of "${entry.part}" is waiting for video: ${reason}`);
    }
  }

  status(): CameraRecordStatus {
    const dir = this.deps.dir();
    const now = this.now();
    const sources: CameraRecordStatus['sources'] = {};
    for (const [id, entry] of this.armed) {
      const writing = entry.proc !== undefined && now - (entry.procStartedAt ?? now) >= SETTLE_MS;
      sources[id] = { state: writing ? 'recording' : entry.blocked ?? 'waiting', since: entry.since };
    }
    return { dir: dir.path, ...(dir.error ? { dirError: dir.error } : {}), freeBytes: this.deps.freeBytes(dir.path), sources };
  }
}

function lastLine(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? '';
}

/** A recording that never got a frame leaves a 0-byte file: do not litter the folder with them. */
function removeEmptyFiles(dir: string, part: string): void {
  try {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(`_${part}.mp4`)) continue;
      const path = join(dir, name);
      if (statSync(path).size === 0) unlinkSync(path);
    }
  } catch {
    /* folder gone or file in use: nothing to tidy */
  }
}
