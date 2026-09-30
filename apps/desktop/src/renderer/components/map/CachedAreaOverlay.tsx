import { useEffect } from 'react';
import { Rectangle, Tooltip } from 'react-leaflet';
import { useTileCacheStore } from '../../stores/tile-cache-store';
import { t } from '../../i18n';

export function CachedAreaOverlay() {
  const { regions, fetchRegions } = useTileCacheStore();

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  if (regions.length === 0) return null;

  return (
    <>
      {regions.map((region) => (
        <Rectangle
          key={region.id}
          bounds={[
            [region.bounds.south, region.bounds.west],
            [region.bounds.north, region.bounds.east],
          ]}
          pathOptions={{
            color: '#22d3ee',
            weight: 2.5,
            dashArray: '8 5',
            fillOpacity: 0.08,
            fillColor: '#22d3ee',
          }}
        >
          <Tooltip sticky>
            {t('map.CachedAreaOverlay.cached')} {region.tileCount.toLocaleString()} {t('map.CachedAreaOverlay.tilesZ')}{region.minZoom}-{region.maxZoom})
          </Tooltip>
        </Rectangle>
      ))}
    </>
  );
}
