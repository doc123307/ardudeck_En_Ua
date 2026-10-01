/**
 * Field-map generator for the Radio HUD widget.
 *
 * Stitches satellite tiles (via the app's tile-cache:// protocol, so cached
 * tiles work offline) into one fixed image per zoom span, centered on the
 * field. The widget draws the image as-is and moves the vehicle marker
 * across it - no tile logic on the radio.
 */

export interface FieldMapImage {
  name: string;
  base64: string;
  lat: number;
  lon: number;
  /** meters per pixel of the produced image */
  mpp: number;
  w: number;
  h: number;
}

/** Fallback image size when no map tile is placed: the full 480x320 screen
 * minus the widget's chrome. */
const IMG_W = 480;
const IMG_H = 272;
const TILE = 256;

/** Half-spans of the zoom levels, in meters. The tightest is for machines that
 * work inside a field rather than cross one: a rover or a small quad spends the
 * whole flight inside 200 m, where the next level up is a single pixel of
 * movement. */
export const FIELD_MAP_SPANS = [100, 500, 2000, 8000];

function lonToWorldX(lon: number, z: number): number {
  return ((lon + 180) / 360) * TILE * 2 ** z;
}

function latToWorldY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * TILE * 2 ** z;
}

function loadTile(layer: string, z: number, xTile: number, yTile: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const n = 2 ** z;
    const wrappedX = ((xTile % n) + n) % n;
    if (yTile < 0 || yTile >= n) { resolve(null); return; }
    // Bytes over IPC into a blob: URL. An <img> straight from tile-cache:// is cross-origin
    // and taints the canvas, so toDataURL would throw.
    void window.electronAPI.tileCacheGetTile(`tile-cache://${layer}/${z}/${wrappedX}/${yTile}.png`)
      .then((bytes) => {
        if (!bytes) { resolve(null); return; }
        const url = URL.createObjectURL(new Blob([bytes]));
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      })
      .catch(() => resolve(null));
  });
}

/**
 * Generate one field image per span, centered on (lat, lon).
 * Returns images plus a count of tiles that failed to load (offline gaps).
 */
/**
 * `size` is the map tile's own pixel size. Generating at the tile's shape is
 * what lets the widget fill it: a fixed 480x272 image letterboxes inside any
 * tile with a different aspect, and that dead band is the height the map never
 * used.
 */
export async function generateFieldMaps(
  lat: number,
  lon: number,
  size?: { w: number; h: number },
  onProgress?: (done: number, total: number) => void,
): Promise<{ maps: FieldMapImage[]; missingTiles: number }> {
  const maps: FieldMapImage[] = [];
  let missingTiles = 0;
  let done = 0;
  // Bounded: these are decoded into RAM on a radio, and stored as PNGs on its
  // card.
  const imgW = Math.max(64, Math.min(480, Math.round(size?.w ?? IMG_W)));
  const imgH = Math.max(64, Math.min(320, Math.round(size?.h ?? IMG_H)));

  for (let i = 0; i < FIELD_MAP_SPANS.length; i++) {
    const halfSpan = FIELD_MAP_SPANS[i]!;
    const mppTarget = (2 * halfSpan) / imgW;
    const latRad = (lat * Math.PI) / 180;
    const z = Math.max(3, Math.min(19, Math.round(Math.log2((156543.03 * Math.cos(latRad)) / mppTarget))));
    const mpp = (156543.03 * Math.cos(latRad)) / 2 ** z;

    const cx = lonToWorldX(lon, z);
    const cy = latToWorldY(lat, z);
    const left = cx - imgW / 2;
    const top = cy - imgH / 2;

    const canvas = document.createElement('canvas');
    canvas.width = imgW;
    canvas.height = imgH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#16181d'; // gauge-face for offline gaps
    ctx.fillRect(0, 0, imgW, imgH);

    const x0 = Math.floor(left / TILE);
    const x1 = Math.floor((left + imgW) / TILE);
    const y0 = Math.floor(top / TILE);
    const y1 = Math.floor((top + imgH) / TILE);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const img = await loadTile('satellite', z, tx, ty);
        if (img) {
          ctx.drawImage(img, Math.round(tx * TILE - left), Math.round(ty * TILE - top));
        } else {
          missingTiles++;
        }
      }
    }

    done++;
    onProgress?.(done, FIELD_MAP_SPANS.length);

    maps.push({
      name: `field${i + 1}`,
      base64: canvas.toDataURL('image/png').split(',')[1]!,
      lat, lon, mpp, w: imgW, h: imgH,
    });
  }

  return { maps, missingTiles };
}
