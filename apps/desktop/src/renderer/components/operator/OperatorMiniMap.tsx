/**
 * The operator's map: where the vehicle is and which way it points. It follows the
 * vehicle; nothing on it can be edited. Shown in a movable window on the operator
 * screen, or in a window of its own on another monitor.
 */

import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, Map as MapIcon, X } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { useEditModeStore } from '../../stores/edit-mode-store';
import { MAP_FLOAT_KEY, useOperatorUiStore } from '../../stores/operator-ui-store';
import { useIsDetached } from '../../stores/workspace-store';
import { MAP_LAYERS } from '../../../shared/map-layers';
import { FloatingWindow } from './FloatingWindow';
import { defaultMapRect, type Size } from './float-layout';
import { t } from '../../i18n';

/** Component id of the map popped out into its own window (see detached/component-registry). */
export const OPERATOR_MAP_WINDOW = 'operator-map';

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

/** The map itself, filling whatever it is put in. */
export function OperatorMap() {
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
  const info = MAP_LAYERS[layer] as { maxZoom: number; maxNativeZoom?: number };

  return (
    <div className="relative h-full w-full bg-surface-solid">
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
    </div>
  );
}

const HEADER_BTN = 'flex h-5 w-5 items-center justify-center rounded text-content-secondary hover:bg-surface-raised hover:text-content';

/** The map as a movable, resizable window over the cameras; a button when it is hidden. */
export function OperatorMiniMap({ area, allowPopOut = true }: { area: Size; allowPopOut?: boolean }) {
  const open = useOperatorUiStore((s) => s.mapOpen);
  const setOpen = useOperatorUiStore((s) => s.setMapOpen);
  const rect = useOperatorUiStore((s) => s.floats[MAP_FLOAT_KEY]);
  const setFloat = useOperatorUiStore((s) => s.setFloat);
  const front = useOperatorUiStore((s) => s.front);
  const bringToFront = useOperatorUiStore((s) => s.bringToFront);
  const poppedOut = useIsDetached(OPERATOR_MAP_WINDOW);

  if (poppedOut) return null;
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-3 left-3 z-[15] flex items-center gap-2 rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-sm font-medium text-white hover:bg-black/85"
      >
        <MapIcon className="h-4 w-4" />
        {t('operator.OperatorMiniMap.map')}
      </button>
    );
  }

  return (
    <FloatingWindow
      area={area}
      rect={rect}
      fallback={defaultMapRect(area)}
      onChange={(next) => setFloat(MAP_FLOAT_KEY, next)}
      onFocus={() => bringToFront(MAP_FLOAT_KEY)}
      front={front === MAP_FLOAT_KEY}
      title={t('operator.OperatorMiniMap.map')}
      tip={t('operator.OperatorCameras.dragTip')}
      actions={(
        <>
          {allowPopOut && <button
            onClick={() => void window.electronAPI.openDetachedWindow({
              componentId: OPERATOR_MAP_WINDOW,
              title: t('operator.OperatorMiniMap.map'),
              initialBounds: { width: 900, height: 700 },
            })}
            className={HEADER_BTN}
            data-tip={t('operator.OperatorCameras.popOut')}
          >
            <ExternalLink className="h-3 w-3" />
          </button>}
          <button onClick={() => setOpen(false)} className={HEADER_BTN} data-tip={t('operator.OperatorMiniMap.hide')}>
            <X className="h-3 w-3" />
          </button>
        </>
      )}
    >
      <OperatorMap />
    </FloatingWindow>
  );
}
