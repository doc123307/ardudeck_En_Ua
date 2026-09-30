// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SerializedDockview } from 'dockview-react';
import {
  BUILTIN_LAYOUTS,
  applyWorkspaceExtras,
  captureWorkspace,
  descriptionOf,
  dockOf,
  exportPayload,
  isWorkspaceV2,
  parseImport,
  uniqueLayoutName,
  withDescription,
} from './workspace-layouts';
import { useMapInstrumentsStore } from '../../stores/map-instruments-store';
import { useMapSplitStore } from '../../stores/map-split-store';
import { useCameraStore } from '../../stores/camera-store';
import { PRESET_INSTRUMENT_LAYOUTS } from '../map/instruments/preset-layouts';

const grid = { grid: { root: { type: 'branch', data: [], size: 1 }, width: 1, height: 1, orientation: 'VERTICAL' }, panels: {} } as unknown as SerializedDockview;
const preset = (name: string) => PRESET_INSTRUMENT_LAYOUTS.find((p) => p.name === name)!.layout;

// The registry module pulls in the whole map stack, so read its id -> component table as text.
const registrySource = readFileSync(resolve(process.cwd(), 'src/renderer/components/panels/index.ts'), 'utf8');
const PANEL_COMPONENTS: Record<string, string> = Object.fromEntries(
  [...registrySource.matchAll(/^\s{2}(\w+): \{ component: '(\w+)'/gm)].map((m) => [m[1], m[2]]),
);

describe('workspace layouts', () => {
  beforeEach(() => {
    localStorage.clear();
    useMapSplitStore.setState({ target: null, ratio: 0.6, layoutApplyPending: false });
    useMapInstrumentsStore.getState().restoreWorkspace(preset('Minimal'), null, null);
    useCameraStore.getState().setRenderMode('live');
  });

  it('round-trips the cockpit, preset, split and render mode with the grid', () => {
    useMapInstrumentsStore.getState().applyLayout(preset('Pilot cockpit'), 'Pilot cockpit');
    useMapSplitStore.getState().applyFromLayout('camera', 0.45);
    useMapSplitStore.getState().consumeLayoutApply();
    useCameraStore.getState().setRenderMode('synthetic');
    const saved = captureWorkspace(grid);

    useMapInstrumentsStore.getState().applyLayout(preset('Rover'), 'Rover');
    useMapSplitStore.getState().applyFromLayout(null, 0.7);
    useCameraStore.getState().setRenderMode('live');

    applyWorkspaceExtras(saved.extras);
    const inst = useMapInstrumentsStore.getState();
    expect(inst.activePreset).toBe('Pilot cockpit');
    expect(inst.captureLayoutSnapshot().visible).toEqual(saved.extras.instruments.visible);
    expect(useMapSplitStore.getState()).toMatchObject({ target: 'camera', ratio: 0.45 });
    expect(useCameraStore.getState().renderMode).toBe('synthetic');
    expect(dockOf(saved)).toBe(grid);
  });

  it('keeps an unsaved custom cockpit exactly, not just a preset name', () => {
    useMapInstrumentsStore.getState().applyLayout(preset('Pilot cockpit'), 'Pilot cockpit');
    useMapInstrumentsStore.getState().setOpacity(0.5);
    const saved = captureWorkspace(grid);
    useMapInstrumentsStore.getState().setOpacity(1);
    applyWorkspaceExtras(saved.extras);
    expect(useMapInstrumentsStore.getState().opacity).toBe(0.5);
  });

  it('stores an optional description with the layout', () => {
    expect(descriptionOf(captureWorkspace(grid, '  Survey monitor  '))).toBe('Survey monitor');
    expect(descriptionOf(captureWorkspace(grid, '   '))).toBeUndefined();
    expect(descriptionOf(grid)).toBeUndefined();
  });

  it('edits a description without inventing a cockpit for an older grid-only layout', () => {
    const old = withDescription(grid, 'From before');
    expect(dockOf(old)).toBe(grid);
    expect(old.extras).toBeUndefined();
    expect(descriptionOf(old)).toBe('From before');

    const full = captureWorkspace(grid, 'first');
    const edited = withDescription(full, 'second');
    expect(edited.extras).toBe(full.extras);
    expect(descriptionOf(edited)).toBe('second');
    expect(descriptionOf(withDescription(edited, '  '))).toBeUndefined();
  });

  it('round-trips an exported layout through import', () => {
    const saved = captureWorkspace(grid, 'Shared');
    const result = parseImport(exportPayload('Night ops', saved));
    if ('error' in result) throw new Error(result.error);
    expect(result.name).toBe('Night ops');
    expect(dockOf(result.layout)).toEqual(grid);
    expect(result.layout.extras?.instruments.visible).toEqual(saved.extras.instruments.visible);
    expect(descriptionOf(result.layout)).toBe('Shared');
  });

  it('refuses files that are not a workspace layout', () => {
    expect(parseImport('not json')).toEqual({ error: 'That file is not valid JSON.' });
    expect(parseImport(JSON.stringify({ app: 'ardudeck', kind: 'instrument-layout', layout: {} }))).toMatchObject({ error: expect.stringContaining('not an ArduDeck workspace') });
    expect(parseImport(JSON.stringify({ app: 'ardudeck', kind: 'workspace-layout', name: 'x', layout: { v: 2, dock: {} } }))).toMatchObject({ error: expect.stringContaining('no panel arrangement') });
  });

  it('keeps only the grid when the shared cockpit is broken', () => {
    const raw = JSON.stringify({ app: 'ardudeck', kind: 'workspace-layout', name: 'x', layout: { v: 2, dock: grid, extras: { instruments: 'garbage' } } });
    const result = parseImport(raw);
    if ('error' in result) throw new Error(result.error);
    expect(result.layout.extras).toBeUndefined();
  });

  it('picks a free name for an import', () => {
    expect(uniqueLayoutName('Ops', [])).toBe('Ops');
    expect(uniqueLayoutName('Ops', ['Ops', 'Ops (2)'])).toBe('Ops (3)');
    expect(uniqueLayoutName('pilotView', [])).toBe('pilotView (2)');
  });

  it('loads older grid-only layouts as they are', () => {
    expect(isWorkspaceV2(grid)).toBe(false);
    expect(dockOf(grid)).toBe(grid);
  });

  it('only flags a layout split apply when the split actually opens or closes', () => {
    const split = useMapSplitStore.getState();
    split.applyFromLayout(null, 0.5);
    expect(useMapSplitStore.getState().consumeLayoutApply()).toBe(false);
    split.applyFromLayout('camera', 0.5);
    expect(useMapSplitStore.getState().consumeLayoutApply()).toBe(true);
    expect(useMapSplitStore.getState().consumeLayoutApply()).toBe(false);
  });

  it('builds every built-in layout from real panels and instrument presets', () => {
    for (const [key, layout] of Object.entries(BUILTIN_LAYOUTS)) {
      const data = layout.data();
      const panels = Object.values((data.dock as unknown as { panels: Record<string, { id: string; contentComponent: string }> }).panels);
      expect(panels.length, key).toBeGreaterThan(0);
      for (const p of panels) {
        expect(PANEL_COMPONENTS[p.id], `${key}: ${p.id}`).toBe(p.contentComponent);
      }
      expect(PRESET_INSTRUMENT_LAYOUTS.some((p) => p.name === data.extras.instrumentPreset), key).toBe(true);
    }
  });
});
