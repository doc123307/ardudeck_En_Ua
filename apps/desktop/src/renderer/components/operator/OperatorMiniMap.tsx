/**
 * The fold-out map in the bottom-left corner of the operator screen: where the vehicle
 * is and which way it points. It follows the vehicle; nothing on it can be edited.
 */

import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon, Maximize2, Minimize2, X } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { useEditModeStore } from '../../stores/edit-mode-store';
import { useOperatorUiStore } from '../../stores/operator-ui-store';
import { MAP_LAYERS } from '../../../shared/map-layers';
import { t } from '../../i18n';

/** Shown until the vehicle reports a position. */
const FALLBACK_CENTER: [number, number] = [50.45, 30.52];

function vehicleIcon(headingDeg: number): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<svg width="36" height="36" viewBox="0 0 36 36" style="transform:rotate(${headingDeg}deg)">
      <path d="M18 3 L29 31 L18 25 L7 31 Z" fill="#22d3ee" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>
    </svg>`,
  });
}

/** Keeps the vehicle in the middle and the tiles in step with the panel size. */
function Follow({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  const lat = position?.[0];
  const lon = position?.[1];
  useEffect(() => {
    if (lat !== undefined && lon !== undefined) map.setView([lat, lon], map.getZoom(), { animate: false });
  }, [map, lat, lon]);
  return null;
}

export function OperatorMiniMap() {
  const open = useOperatorUiStore((s) => s.mapOpen);
  const large = useOperatorUiStore((s) => s.mapLarge);
  const setOpen = useOperatorUiStore((s) => s.setMapOpen);
  const setLarge = useOperatorUiStore((s) => s.setMapLarge);
  const gps = useTelemetryStore((s) => s.gps);
  const heading = useTelemetryStore((s) => s.vfrHud.heading);
  const layerKey = useEditModeStore((s) => s.mapLayer);
  const layer = layerKey in MAP_LAYERS ? (layerKey as keyof typeof MAP_LAYERS) : 'googleSat';

  const hasFix = gps.fixType >= 2 && (gps.lat !== 0 || gps.lon !== 0);
  // Rounded so the marker and the view do not re-render on GPS noise.
  const lat = hasFix ? Number(gps.lat.toFixed(6)) : null;
  const lon = hasFix ? Number(gps.lon.toFixed(6)) : null;
  const position = useMemo<[number, number] | null>(() => (lat !== null && lon !== null ? [lat, lon] : null), [lat, lon]);
  const icon = useMemo(() => vehicleIcon(Math.round(heading)), [heading]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex items-center gap-2 rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-sm font-medium text-white hover:bg-black/85"
      >
        <MapIcon className="h-4 w-4" />
        {t('operator.OperatorMiniMap.map')}
      </button>
    );
  }

  const info = MAP_LAYERS[layer] as { maxZoom: number; maxNativeZoom?: number };
  return (
    <div
      className="pointer-events-auto relative overflow-hidden rounded-xl border border-white/25 bg-surface-solid shadow-xl"
      style={large ? { width: 'min(46vw, 760px)', height: 'min(56vh, 560px)' } : { width: 300, height: 210 }}
    >
      <MapContainer center={position ?? FALLBACK_CENTER} zoom={17} className="h-full w-full" zoomControl={false} attributionControl={false}>
        <TileLayer key={layer} url={`tile-cache://${layer}/{z}/{x}/{y}.png`} maxZoom={info.maxZoom} maxNativeZoom={info.maxNativeZoom ?? info.maxZoom} />
        <Follow position={position} />
        {position && <Marker position={position} icon={icon} interactive={false} />}
      </MapContainer>

      {!position && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] bg-black/70 px-2 py-1 text-center text-xs text-amber-300">
          {t('operator.OperatorMiniMap.noPosition')}
        </div>
      )}
      <div className="absolute right-1.5 top-1.5 z-[500] flex gap-1">
        <button
          onClick={() => setLarge(!large)}
          data-tip={large ? t('operator.OperatorMiniMap.smaller') : t('operator.OperatorMiniMap.larger')}
          className="flex h-7 w-7 items-center justify-center rounded bg-black/70 text-white hover:bg-black/90"
        >
          {large ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => setOpen(false)}
          data-tip={t('operator.OperatorMiniMap.hide')}
          className="flex h-7 w-7 items-center justify-center rounded bg-black/70 text-white hover:bg-black/90"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
