/**
 * Panels modules contribute to the mission planning dock (host.missionWorkspace).
 * The workspace owns docking, sizing and the tab strip, as it does for the
 * built-in Survey and Waypoints panels.
 */

import type { ComponentType } from 'react';
import type { MissionPanelRegistration } from '@ardudeck/module-sdk';
import { t } from '../i18n';

export interface ModuleMissionPanel {
  key: string;
  slug: string;
  /** The module's own id, so callers never reconstruct it from the key. */
  id: string;
  title: string;
  openOnLoad: boolean;
  component: ComponentType<unknown>;
}

const registry = new Map<string, ModuleMissionPanel>();
const bySlug = new Map<string, Set<string>>();
const listeners = new Set<() => void>();
/** Panels asked to come to the front since the workspace last looked. */
const wanted = new Set<string>();

function emit(): void {
  for (const l of listeners) l();
}

export function panelKey(slug: string, id: string): string {
  return `module:${slug}:${id}`;
}

export function subscribeModuleMissionPanels(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function registerModuleMissionPanel(slug: string, reg: MissionPanelRegistration): void {
  if (!reg?.id) throw new Error(`[module:${slug}] mission panel needs an id`);
  if (typeof reg.component !== 'function') {
    throw new Error(t('modules.module_mission_panel_registry.moduleMissionPanelNeedsAComponent', { slug, id: reg.id }));
  }
  const key = panelKey(slug, reg.id);
  registry.set(key, {
    key,
    slug,
    id: reg.id,
    title: reg.title || reg.id,
    openOnLoad: reg.openOnLoad ?? false,
    component: reg.component as ComponentType<unknown>,
  });
  let ids = bySlug.get(slug);
  if (!ids) {
    ids = new Set();
    bySlug.set(slug, ids);
  }
  ids.add(reg.id);
  if (reg.openOnLoad) wanted.add(key);
  emit();
}

export function unregisterModuleMissionPanel(slug: string, id: string): void {
  if (!bySlug.get(slug)?.has(id)) return;
  const key = panelKey(slug, id);
  registry.delete(key);
  wanted.delete(key);
  bySlug.get(slug)?.delete(id);
  emit();
}

export function unregisterModuleMissionPanelsFor(slug: string): void {
  const ids = bySlug.get(slug);
  if (!ids) return;
  for (const id of [...ids]) unregisterModuleMissionPanel(slug, id);
  bySlug.delete(slug);
}

export function openModuleMissionPanel(slug: string, id: string): void {
  const key = panelKey(slug, id);
  if (!registry.has(key)) return;
  wanted.add(key);
  emit();
}

export function getModuleMissionPanels(): ModuleMissionPanel[] {
  return [...registry.values()];
}

/** Keys the workspace should open now, cleared as it consumes them. */
export function takeWantedPanels(): string[] {
  const out = [...wanted];
  wanted.clear();
  return out;
}
