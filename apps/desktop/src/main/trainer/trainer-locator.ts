import { posix, win32 } from 'node:path';

/**
 * Joins in the style of the path it was given. Windows hands us backslashed paths and wants them
 * back that way; everything else (and the tests, which run on every OS) uses forward slashes.
 */
function join(base: string, ...parts: string[]): string {
  return (base.includes('\\') ? win32 : posix).join(base, ...parts);
}

/**
 * Where the ArduDeck Trainer is on this machine, and how to run it.
 *
 * Four legitimate answers, and they are not variants of one another: an app the Hangar installed,
 * an app the user installed themselves, a development checkout, and an explicit override. Each
 * needs a DIFFERENT spawn, because a macOS `.app` is a directory, a Windows build is an
 * executable, and a checkout is a directory that only Electron knows how to run. Returning a
 * path alone would push that decision onto every caller.
 */

/** Points ArduDeck at a Trainer somewhere else. The escape hatch for a dev checkout. */
export const TRAINER_PATH_ENV = 'ARDUDECK_TRAINER_PATH';

/**
 * The Hangar APP that delivers the Trainer.
 *
 * An app, not a cargo: a cargo is JavaScript loaded into ArduDeck, and the Trainer is a separate
 * native program with a different binary per platform. The slug is unchanged, so nothing that
 * already refers to it by name has to move.
 */
export const TRAINER_APP_SLUG = 'com.ardudeck.trainer';

export type TrainerTarget =
  /** A macOS application bundle. `exec` is the binary inside it. */
  | { kind: 'app'; path: string; exec: string }
  /** A plain executable, which is what the Windows and Linux builds are. */
  | { kind: 'binary'; path: string; exec: string }
  /**
   * A source checkout of the launcher. Run through the Electron in its own `node_modules`,
   * NOT through a global one: the launcher pins Electron 28 and a mismatched runtime fails
   * with a preload that silently loads nothing, which looks like the Trainer hanging.
   */
  | { kind: 'checkout'; path: string; electron: string };

export interface LocateOptions {
  /** `existsSync`, injected so this stays testable without a filesystem. */
  exists: (path: string) => boolean;
  platform: NodeJS.Platform;
  /** `process.env[TRAINER_PATH_ENV]`. */
  override?: string | undefined;
  /** `installPath` of the Trainer app, when the Hangar installed it. */
  installedPath?: string | undefined;
  /** `app.getPath('home')`. */
  homeDir: string;
}

export interface LocateResult {
  target: TrainerTarget | null;
  /** Every place looked, in order, for the "not found" message. Never a silent failure. */
  searched: string[];
}

const APP_NAME = 'ArduDeck Trainer';

function appBundle(path: string, exists: LocateOptions['exists']): TrainerTarget | null {
  const exec = join(path, 'Contents', 'MacOS', APP_NAME);
  return exists(exec) ? { kind: 'app', path, exec } : null;
}

function checkout(path: string, opts: LocateOptions): TrainerTarget | null {
  // `out/main/index.js` and not `package.json`: a checkout that has never been built has a
  // package.json and nothing to run, and Electron's failure there is a blank window rather
  // than an error. Requiring the built entry makes "not built yet" indistinguishable from
  // "not here", which is the right answer for a caller that can only report a path.
  if (!opts.exists(join(path, 'out', 'main', 'index.js'))) return null;
  const electron = join(
    path,
    'node_modules',
    'electron',
    'dist',
    opts.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron',
  );
  return opts.exists(electron) ? { kind: 'checkout', path, electron } : null;
}

/**
 * Resolves a path that could be any of the three shapes.
 *
 * Order matters only in that a `.app` is also a directory, so it has to be tested before the
 * checkout case, which would otherwise look inside a bundle for `out/main/index.js`.
 */
function resolveOne(path: string, opts: LocateOptions): TrainerTarget | null {
  if (path.endsWith('.app')) return appBundle(path, opts.exists);
  if (path.endsWith('.exe')) {
    return opts.exists(path) ? { kind: 'binary', path, exec: path } : null;
  }
  const asCheckout = checkout(path, opts);
  if (asCheckout) return asCheckout;
  // A directory holding the built app, which is what a cargo bundle extracts to.
  for (const candidate of bundledCandidates(path, opts.platform)) {
    const resolved = candidate.endsWith('.app')
      ? appBundle(candidate, opts.exists)
      : opts.exists(candidate)
        ? ({ kind: 'binary', path: candidate, exec: candidate } as TrainerTarget)
        : null;
    if (resolved) return resolved;
  }
  return null;
}

function bundledCandidates(dir: string, platform: NodeJS.Platform): string[] {
  if (platform === 'darwin') return [join(dir, `${APP_NAME}.app`)];
  if (platform === 'win32') return [join(dir, `${APP_NAME}.exe`), join(dir, 'ArduDeckTrainer.exe')];
  return [join(dir, 'ardudeck-trainer'), join(dir, APP_NAME)];
}

/** Where to look when nobody said, most specific first. */
function defaultRoots(opts: LocateOptions): string[] {
  const { homeDir, platform } = opts;
  const roots: string[] = [];
  if (platform === 'darwin') {
    roots.push(`/Applications/${APP_NAME}.app`, join(homeDir, 'Applications', `${APP_NAME}.app`));
  } else if (platform === 'win32') {
    roots.push(join(homeDir, 'AppData', 'Local', 'Programs', APP_NAME));
  } else {
    roots.push(join(homeDir, '.local', 'share', 'ardudeck-trainer'));
  }
  // The development checkout, so this works before anything is packaged.
  roots.push(join(homeDir, 'work', 'ardudeck-game', 'apps', 'launcher'));
  return roots;
}

export function locateTrainer(opts: LocateOptions): LocateResult {
  const searched: string[] = [];
  const candidates = [opts.override, opts.installedPath, ...defaultRoots(opts)];

  for (const path of candidates) {
    if (!path) continue;
    searched.push(path);
    const target = resolveOne(path, opts);
    if (target) return { target, searched };
  }
  return { target: null, searched };
}
