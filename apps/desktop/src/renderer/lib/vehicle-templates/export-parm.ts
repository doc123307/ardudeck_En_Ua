import type { VehicleProfile } from '../../stores/settings-store.js';
import type { VehicleTemplate } from './types.js';

/**
 * Generate an ArduPilot-standard `.parm` file from a profile + its template.
 * Format:
 *
 *   # Header comments...
 *   NAME,VALUE
 *
 * Includes core params; SIM_* is appended when `includeSim` is true.
 */
export function exportParm(
  profile: VehicleProfile,
  template: VehicleTemplate,
  opts: { includeSim?: boolean } = {},
): string {
  const lines: string[] = [];
  lines.push(`# STOHID vehicle profile export`);
  lines.push(`# Profile: ${profile.name}`);
  lines.push(`# Template: ${template.name} (${template.slug})`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');

  const core = template.toParams(profile);
  for (const spec of core) {
    lines.push(`${spec.name},${spec.value}`);
  }

  if (opts.includeSim) {
    const sim = template.toSimParams(profile);
    if (sim.length > 0) {
      lines.push('');
      lines.push('# SITL physics params');
      for (const spec of sim) {
        lines.push(`${spec.name},${spec.value}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Trigger a native save dialog with the generated .parm text.
 * Runs in the renderer via the Electron preload-exposed download helper.
 */
export async function saveParmToFile(
  profile: VehicleProfile,
  template: VehicleTemplate,
  opts: { includeSim?: boolean } = {},
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const text = exportParm(profile, template, opts);
  const filename = `${profile.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.parm`;
  const api = (window as unknown as {
    electronAPI?: {
      saveTextFile?: (filename: string, text: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
    };
  }).electronAPI;
  if (api?.saveTextFile) {
    return api.saveTextFile(filename, text);
  }
  // Fallback: download via anchor tag if IPC not wired.
  try {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
