/**
 * Bring `turbo run dev` down when the desktop app exits.
 *
 * Turbo starts every task in its own process group, so closing ArduDeck ends
 * one task and leaves turbo plus a watcher per package holding the terminal.
 * Run from the desktop dev script after electron-vite returns. A no-op when
 * turbo is not an ancestor, so `pnpm start` is unaffected.
 */

import { execSync } from 'node:child_process';

// Relies on ps and POSIX process groups; neither exists on Windows.
if (process.platform === 'win32') process.exit(0);

function snapshot() {
  const out = execSync('ps -ax -o pid=,ppid=,pgid=,command=', { encoding: 'utf8' });
  return out
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map((m) => ({ pid: +m[1], ppid: +m[2], pgid: +m[3], cmd: m[4] }));
}

const procs = snapshot();
const byPid = new Map(procs.map((p) => [p.pid, p]));

let turbo = byPid.get(process.ppid);
while (turbo && turbo.pid > 1 && !/turbo.*\brun\b.*\bdev\b/.test(turbo.cmd)) {
  turbo = byPid.get(turbo.ppid);
}
if (!turbo || turbo.pid <= 1) process.exit(0);

const descendants = new Set([turbo.pid]);
let grew = true;
while (grew) {
  grew = false;
  for (const p of procs) {
    if (!descendants.has(p.pid) && descendants.has(p.ppid)) {
      descendants.add(p.pid);
      grew = true;
    }
  }
}

const ownGroup = procs.find((p) => p.pid === process.pid)?.pgid;
const groups = new Set();
for (const pid of descendants) {
  const pgid = byPid.get(pid)?.pgid;
  if (pgid) groups.add(pgid);
}
groups.delete(turbo.pgid);
if (ownGroup) groups.delete(ownGroup);

for (const pgid of groups) {
  try {
    process.kill(-pgid, 'SIGTERM');
  } catch {
    // already gone
  }
}
try {
  process.kill(-turbo.pgid, 'SIGTERM');
} catch {
  // already gone
}
