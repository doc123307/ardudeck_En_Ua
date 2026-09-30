/**
 * Downloads, installs, and removes EdgeTX SD-card packages.
 *
 * Install flow: resolve latest GitHub release -> download zipball (cached in
 * userData so repeat installs work offline) -> extract to temp -> merge-copy
 * the variant's mapped folders onto the SD root -> record every written file
 * in a manifest on the card. Remove deletes exactly the manifest-listed
 * files, never anything else.
 */

import AdmZip from 'adm-zip';
import { app } from 'electron';
import { mkdir, readFile, writeFile, readdir, rm, rmdir, stat } from 'fs/promises';
import path from 'path';
import { EdgeTxPackage, resolveMappings } from './package-registry.js';
import type { InstalledPackageRecord, InstallProgress } from '../../shared/edgetx-types.js';
import { mt } from '../i18n';

const MANIFEST_DIR = '.ardudeck';
const MANIFEST_NAME = 'edgetx-packages.json';
const GITHUB_HEADERS = { 'User-Agent': 'ArduDeck', Accept: 'application/vnd.github+json' };

export type { InstalledPackageRecord, InstallProgress };

export interface SdManifest {
  packages: Record<string, InstalledPackageRecord>;
}

export type ProgressFn = (p: InstallProgress) => void;

export interface ReleaseInfo {
  tag: string;
  zipUrl: string;
}

export async function readManifest(volumePath: string): Promise<SdManifest> {
  try {
    const raw = await readFile(path.join(volumePath, MANIFEST_DIR, MANIFEST_NAME), 'utf8');
    const parsed = JSON.parse(raw) as SdManifest;
    return parsed.packages ? parsed : { packages: {} };
  } catch {
    return { packages: {} };
  }
}

async function writeManifest(volumePath: string, manifest: SdManifest): Promise<void> {
  const dir = path.join(volumePath, MANIFEST_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, MANIFEST_NAME), JSON.stringify(manifest, null, 2), 'utf8');
}

/** Resolve the newest release; falls back to the default-branch snapshot. */
export async function resolveLatestRelease(repo: string): Promise<ReleaseInfo> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: GITHUB_HEADERS,
  });
  if (res.ok) {
    const body = (await res.json()) as { tag_name?: string; zipball_url?: string };
    if (body.tag_name && body.zipball_url) {
      return { tag: body.tag_name, zipUrl: body.zipball_url };
    }
  }
  // No releases published: install the default branch head, versioned by date
  // so update checks still have something monotonic to compare.
  return {
    tag: `snapshot-${new Date().toISOString().slice(0, 10)}`,
    zipUrl: `https://api.github.com/repos/${repo}/zipball`,
  };
}

async function downloadZip(pkgId: string, release: ReleaseInfo, onProgress: ProgressFn): Promise<string> {
  const cacheDir = path.join(app.getPath('userData'), 'edgetx-cache');
  await mkdir(cacheDir, { recursive: true });
  // Rolling tags (Yaapu uses "etx-otx-ethos-latest") point at moving content;
  // date-scope their cache entry so a stale zip is at most a day old.
  const cacheKey = /latest|snapshot/.test(release.tag)
    ? `${release.tag}-${new Date().toISOString().slice(0, 10)}`
    : release.tag;
  const zipPath = path.join(cacheDir, `${pkgId}-${cacheKey.replace(/[^\w.-]/g, '_')}.zip`);

  try {
    await stat(zipPath);
    return zipPath; // cached from a previous install
  } catch {
    // not cached; download below
  }

  onProgress({ phase: 'download', percent: -1, detail: release.tag });
  const res = await fetch(release.zipUrl, { headers: GITHUB_HEADERS, redirect: 'follow' });
  if (!res.ok) {
    throw new Error(mt('main.edgetx_package_installer.downloadFailedHttpFor', { status: res.status, zipUrl: release.zipUrl }));
  }
  const data = Buffer.from(await res.arrayBuffer());
  // Write via temp name so an interrupted download never poisons the cache.
  const tmpPath = `${zipPath}.part`;
  await writeFile(tmpPath, data);
  await rm(zipPath, { force: true });
  const { rename } = await import('fs/promises');
  await rename(tmpPath, zipPath);
  return zipPath;
}

/** GitHub zipballs wrap everything in a single "<owner>-<repo>-<sha>" dir. */
async function findArchiveRoot(extractDir: string): Promise<string> {
  const entries = await readdir(extractDir);
  const dirs: string[] = [];
  for (const e of entries) {
    if ((await stat(path.join(extractDir, e))).isDirectory()) dirs.push(e);
  }
  if (dirs.length === 1) return path.join(extractDir, dirs[0]!);
  return extractDir;
}

async function copyTree(
  srcDir: string,
  destDir: string,
  sdRelativeBase: string,
  written: string[],
  onFile: () => void,
): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true });
  // One listing of the destination beats two speculative unlinks per file:
  // every syscall here is a USB round trip to a slow FAT card.
  const present = new Set<string>(await readdir(destDir).catch(() => []));
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    const rel = path.posix.join(sdRelativeBase, entry.name);
    if (entry.isDirectory()) {
      await mkdir(dest, { recursive: true });
      await copyTree(src, dest, rel, written, onFile);
    } else if (entry.isFile()) {
      // Copy CONTENTS only: copyFile() carries macOS extended attributes
      // across, and on the card's FAT volume every xattr spawns a "._name"
      // AppleDouble sidecar that clutters the radio's file pickers.
      await writeFile(dest, await readFile(src));
      if (present.has(`._${entry.name}`)) {
        await rm(path.join(destDir, `._${entry.name}`), { force: true });
      }
      // EdgeTX compiles scripts to .luac on the card and runs the bytecode
      // in preference to the source: a stale twin would shadow this update.
      if (entry.name.endsWith('.lua') && present.has(`${entry.name}c`)) {
        await rm(path.join(destDir, `${entry.name}c`), { force: true });
      }
      written.push(rel);
      onFile();
    }
  }
}

async function countFiles(dir: string): Promise<number> {
  const entries = await readdir(dir, { withFileTypes: true });
  let n = 0;
  for (const entry of entries) {
    if (entry.isDirectory()) n += await countFiles(path.join(dir, entry.name));
    else if (entry.isFile()) n++;
  }
  return n;
}

export async function installPackage(
  volumePath: string,
  pkg: EdgeTxPackage,
  variantId: string,
  freeBytes: number,
  onProgress: ProgressFn,
): Promise<InstalledPackageRecord> {
  const mappings = resolveMappings(pkg, variantId);
  if (mappings.length === 0) {
    throw new Error(mt('main.edgetx_package_installer.hasNoFilesForRadioVariant', { name: pkg.name, variantId }));
  }

  onProgress({ phase: 'resolve', percent: -1 });

  let root: string;
  let versionTag: string;
  let extractDir: string | null = null;

  if (pkg.source.kind === 'bundled') {
    // Shipped inside the app; no network, no archive.
    root = path.join(app.getAppPath(), 'resources', 'edgetx', pkg.source.dir);
    versionTag = pkg.source.version;
  } else {
    const release = await resolveLatestRelease(pkg.source.repo);
    versionTag = release.tag;
    const zipPath = await downloadZip(pkg.id, release, onProgress);

    onProgress({ phase: 'extract', percent: -1 });
    extractDir = path.join(app.getPath('temp'), `ardudeck-edgetx-${Date.now()}`);
    await mkdir(extractDir, { recursive: true });

    const zip = new AdmZip(zipPath);
    const uncompressed = zip.getEntries().reduce((sum, e) => sum + e.header.size, 0);
    if (freeBytes > 0 && uncompressed > freeBytes) {
      throw new Error(
        `Not enough space on SD card: need ~${Math.ceil(uncompressed / 1e6)}MB, ` +
        `${Math.floor(freeBytes / 1e6)}MB free`,
      );
    }
    zip.extractAllTo(extractDir, true);
    root = await findArchiveRoot(extractDir);
  }

  try {

    const manifest = await readManifest(volumePath);
    const previous = manifest.packages[pkg.id];

    const written: string[] = [];
    let total = 0;
    const sources: Array<{ src: string }> = [];
    for (const m of mappings) {
      const src = path.join(root, m.archivePath);
      try {
        await stat(src);
      } catch {
        throw new Error(mt('main.edgetx_package_installer.archiveLayoutChangedNotFoundIn', { archivePath: m.archivePath, versionTag }));
      }
      sources.push({ src });
      total += await countFiles(src);
    }

    let copied = 0;
    for (const { src } of sources) {
      await copyTree(src, volumePath, '', written, () => {
        copied++;
        onProgress({ phase: 'copy', percent: Math.round((copied / total) * 100) });
      });
    }

    // Overwriting in place means only what the previous install left behind
    // and this one does not write (a variant switch, a dropped file) still
    // needs deleting - that is a handful of unlinks instead of every file.
    if (previous) {
      const fresh = new Set(written);
      const stale = previous.files.filter((f) => !fresh.has(f));
      if (stale.length > 0) await deleteManifestFiles(volumePath, stale);
    }

    const record: InstalledPackageRecord = {
      version: versionTag,
      variantId,
      installedAt: new Date().toISOString(),
      files: written,
    };
    manifest.packages[pkg.id] = record;
    await writeManifest(volumePath, manifest);
    onProgress({ phase: 'done', percent: 100 });
    return record;
  } finally {
    if (extractDir) await rm(extractDir, { recursive: true, force: true });
  }
}

async function deleteManifestFiles(volumePath: string, files: string[]): Promise<void> {
  const dirs = new Set<string>();
  for (const rel of files) {
    // Manifest paths are SD-relative; refuse anything that escapes the card.
    const abs = path.join(volumePath, rel);
    if (!abs.startsWith(volumePath)) continue;
    await rm(abs, { force: true });
    let parent = path.dirname(rel);
    while (parent && parent !== '.' && parent !== '/') {
      dirs.add(parent);
      parent = path.dirname(parent);
    }
  }
  // Prune now-empty directories, deepest first. rmdir refuses non-empty
  // dirs, which is exactly the safety we want for shared folders like
  // WIDGETS or SCRIPTS.
  const sorted = [...dirs].sort((a, b) => b.length - a.length);
  for (const rel of sorted) {
    try {
      await rmdir(path.join(volumePath, rel));
    } catch {
      // non-empty or already gone; leave it
    }
  }
}

export async function removePackage(volumePath: string, pkgId: string): Promise<void> {
  const manifest = await readManifest(volumePath);
  const record = manifest.packages[pkgId];
  if (!record) return;
  await deleteManifestFiles(volumePath, record.files);
  delete manifest.packages[pkgId];
  await writeManifest(volumePath, manifest);
}
