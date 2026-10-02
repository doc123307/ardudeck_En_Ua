/**
 * Recording a camera feed to a file with ffmpeg (stream copy, no re-encode).
 *
 * Two things make the file usable:
 * - It is written as fragmented MP4. A plain MP4 keeps its index (moov) for the very
 *   end, so a recording cut short - a crash, a power loss, a killed process - is an
 *   unplayable stub. Fragments are playable up to the last one written.
 * - It is stopped by asking ffmpeg to quit ("q" on stdin), not by killing it. On
 *   Windows a kill is immediate, so the old "SIGTERM" stop left 48-byte files.
 */

import type { ChildProcess } from 'node:child_process';

const pad = (n: number) => String(n).padStart(2, '0');

/** Camera name as a file-name part: no characters Windows or Linux refuse, not too long. */
export function fileNamePart(label: string | undefined): string {
  const clean = (label ?? '')
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 40);
  return clean || 'camera';
}

/**
 * "2026-10-02_09-11-00_Front.mp4": sorts by time in any file manager and says which
 * camera it is. `taken` reports names already in use, so two starts within the same
 * second (record all cameras, same label) still get separate files.
 */
export function recordingFileName(label: string | undefined, at: Date, taken: (name: string) => boolean = () => false): string {
  const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}_${pad(at.getHours())}-${pad(at.getMinutes())}-${pad(at.getSeconds())}`;
  const base = `${stamp}_${fileNamePart(label)}`;
  let name = `${base}.mp4`;
  for (let n = 2; taken(name); n++) name = `${base}_${n}.mp4`;
  return name;
}

/** ffmpeg arguments: copy the hub's RTSP stream into a fragmented MP4. */
export function recordArgs(rtspUrl: string, filePath: string): string[] {
  return [
    '-rtsp_transport', 'tcp', '-i', rtspUrl,
    '-c', 'copy',
    '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4', filePath,
  ];
}

/** Ask ffmpeg to finish the file and exit; kill it only if it does not. */
export function stopRecording(p: ChildProcess, graceMs = 4000): void {
  let exited = false;
  p.once('exit', () => { exited = true; });
  try {
    p.stdin?.write('q\n');
    p.stdin?.end();
  } catch {
    /* stdin already closed: the kill below still ends it */
  }
  setTimeout(() => {
    if (exited) return;
    try {
      p.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }, graceMs);
}
