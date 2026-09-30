import AdmZip from 'adm-zip';
import { rm, mkdir } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { mt } from '../i18n';

export async function extractBundle(zipPath: string, targetDir: string): Promise<void> {
  const absTarget = resolve(targetDir);
  await rm(absTarget, { recursive: true, force: true });
  await mkdir(absTarget, { recursive: true });

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  for (const entry of entries) {
    const name = entry.entryName;
    const dest = resolve(absTarget, name);
    const rel = relative(absTarget, dest);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(mt('main.modules_module_extract.unsafeZipEntryPathTraversal', { name }));
    }
  }

  zip.extractAllTo(absTarget, true);
}
