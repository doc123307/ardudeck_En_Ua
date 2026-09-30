/**
 * area-editor-layers-store — base map layer + data overlay state for the Area
 * Editor's MapLibre surface. Kept separate from the geometry store so the
 * heavily-tested polygon model stays focused; this is purely view state.
 *
 * Mirrors the main app's map layer system (see shared/map-layers.ts and the
 * overlay set in components/map/overlays): the same base layers, plus the
 * raster/WMS overlays a pilot expects (Aviation = OpenAIP, Zones = DIPUL).
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { LayerKey } from '../../shared/map-layers';
import { t } from '../i18n';

/** Base layers offered in the editor — the planning-relevant subset of MAP_LAYERS. */
export const AREA_EDITOR_BASE_LAYERS: { key: LayerKey; label: string }[] = [
  { key: 'googleSat', get label() { return t('area_editor.area_editor_layers_store.satellite'); } },
  { key: 'googleHybrid', get label() { return t('area_editor.area_editor_layers_store.hybrid'); } },
  { key: 'bingSat', get label() { return t('area_editor.area_editor_layers_store.bingSat'); } },
  { key: 'bingHybrid', get label() { return t('area_editor.area_editor_layers_store.bingHybrid'); } },
  { key: 'osm', get label() { return t('area_editor.area_editor_layers_store.street'); } },
  { key: 'terrain', get label() { return t('area_editor.area_editor_layers_store.terrain'); } },
  { key: 'dark', get label() { return t('area_editor.area_editor_layers_store.dark'); } },
];

export type AreaEditorOverlayId = 'aviation' | 'zones' | 'wind' | 'traffic' | 'gliders';

export const AREA_EDITOR_OVERLAYS: { id: AreaEditorOverlayId; label: string; hint: string }[] = [
  { id: 'aviation', get label() { return t('area_editor.area_editor_layers_store.aviation'); }, get hint() { return t('area_editor.area_editor_layers_store.openaipAirfieldsNavaidsAndAirspaceNeeds'); } },
  { id: 'zones', get label() { return t('area_editor.area_editor_layers_store.zones'); }, get hint() { return t('area_editor.area_editor_layers_store.dipulGermanUasGeoZonesGermany'); } },
  { id: 'wind', get label() { return t('area_editor.area_editor_layers_store.wind'); }, get hint() { return t('area_editor.area_editor_layers_store.animatedForecastWindOpenMeteo'); } },
  { id: 'traffic', get label() { return t('area_editor.area_editor_layers_store.traffic'); }, get hint() { return t('area_editor.area_editor_layers_store.liveAdsBAircraft'); } },
  { id: 'gliders', get label() { return t('area_editor.area_editor_layers_store.gliders'); }, get hint() { return t('area_editor.area_editor_layers_store.liveOgnFlarmGliders'); } },
];

interface LayersState {
  baseLayer: LayerKey;
  overlays: Record<AreaEditorOverlayId, boolean>;
  setBaseLayer: (key: LayerKey) => void;
  toggleOverlay: (id: AreaEditorOverlayId) => void;
}

export const useAreaEditorLayersStore = create<LayersState>()(
  subscribeWithSelector((set) => ({
    baseLayer: 'googleSat',
    overlays: { aviation: false, zones: false, wind: false, traffic: false, gliders: false },
    setBaseLayer: (key) => set({ baseLayer: key }),
    toggleOverlay: (id) =>
      set((s) => ({ overlays: { ...s.overlays, [id]: !s.overlays[id] } })),
  })),
);
