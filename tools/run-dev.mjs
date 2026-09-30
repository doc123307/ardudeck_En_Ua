// "a; b" as Node, so the dev script runs the same in cmd, PowerShell and sh.
import { spawnSync } from 'node:child_process';

spawnSync('electron-vite', ['dev', ...process.argv.slice(2)], { stdio: 'inherit', shell: true });
await import('./stop-dev-tree.mjs');
