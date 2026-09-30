/**
 * OSD Font Renderer
 *
 * Provides higher-level font rendering utilities for the OSD simulator,
 * including caching, screen buffer management, and canvas rendering.
 */

import {
  parseMcmFont,
  characterToImageData,
  OsdFont,
  OsdCharacter,
  OSD_CHAR_WIDTH,
  OSD_CHAR_HEIGHT,
} from '@ardudeck/msp-ts';
import { t } from '../../i18n';

// Re-export for convenience
export { OSD_CHAR_WIDTH, OSD_CHAR_HEIGHT };

/**
 * Supported OSD display formats.
 *
 * Analog (MAX7456) is a fixed 30-column SD grid. Digital "DisplayPort / canvas
 * mode" OSDs are still character grids but each system negotiates its own,
 * larger canvas — and the goggles render it with their OWN font (the FC only
 * streams element positions over MSP DisplayPort). The canvas sizes below are
 * the de-facto grids for each ecosystem (cross-checked against INAV/Betaflight).
 */
export type VideoType = 'PAL' | 'NTSC' | 'HDZERO' | 'AVATAR' | 'BFHD' | 'DJIWTF';

export interface OsdGridSize {
  cols: number;
  rows: number;
}

export const OSD_GRID: Record<VideoType, OsdGridSize> = {
  PAL: { cols: 30, rows: 16 },
  NTSC: { cols: 30, rows: 13 },
  HDZERO: { cols: 50, rows: 18 }, // HDZero
  AVATAR: { cols: 53, rows: 20 }, // Walksnail Avatar
  BFHD: { cols: 53, rows: 20 }, // Betaflight HD / DJI O3 (BF-HD compatible)
  DJIWTF: { cols: 60, rows: 22 }, // DJI native (WTFOS) full canvas
};

/** Human labels for the format picker. */
export const OSD_FORMAT_LABELS: Record<VideoType, string> = {
  get PAL() { return t('utils.font_renderer.analogPal3016'); },
  get NTSC() { return t('utils.font_renderer.analogNtsc3013'); },
  get HDZERO() { return t('utils.font_renderer.hdzero5018'); },
  get AVATAR() { return t('utils.font_renderer.walksnail5320'); },
  get BFHD() { return t('utils.font_renderer.betaflightHdO35320'); },
  DJIWTF: 'DJI WTFOS (60×22)',
};

const HD_FORMATS = new Set<VideoType>(['HDZERO', 'AVATAR', 'BFHD', 'DJIWTF']);

/** Legacy analog column count (kept for callers that assume SD). */
export const OSD_COLS = OSD_GRID.PAL.cols;
export const OSD_ROWS_PAL = OSD_GRID.PAL.rows;
export const OSD_ROWS_NTSC = OSD_GRID.NTSC.rows;

/** Normalize a possibly-legacy/unknown format string to a valid VideoType. */
export function normalizeVideoType(v: string | undefined): VideoType {
  if (v && v in OSD_GRID) return v as VideoType;
  if (v === 'HD') return 'BFHD'; // migrate the old single "HD"
  return 'PAL';
}

export function getOsdRows(videoType: VideoType): number {
  return (OSD_GRID[videoType] ?? OSD_GRID.PAL).rows;
}

export function getOsdCols(videoType: VideoType): number {
  return (OSD_GRID[videoType] ?? OSD_GRID.PAL).cols;
}

/** True for digital (HD) formats — rendered by the goggles, not the FC's font. */
export function isHdFormat(videoType: VideoType): boolean {
  return HD_FORMATS.has(videoType);
}

/**
 * Cached font with pre-rendered character images
 */
export interface CachedFont {
  font: OsdFont;
  /** Pre-rendered ImageData for each character */
  imageCache: Map<number, ImageData>;
  /** Pre-rendered data URLs for each character (for img src) */
  dataUrlCache: Map<number, string>;
}

/**
 * Load and cache a font from MCM content
 */
export function loadFont(mcmContent: string, name: string): CachedFont {
  const font = parseMcmFont(mcmContent, name);
  const imageCache = new Map<number, ImageData>();
  const dataUrlCache = new Map<number, string>();

  // Pre-render all characters
  for (const char of font.characters) {
    const imageData = characterToImageData(char);
    imageCache.set(char.index, imageData);
  }

  return {
    font,
    imageCache,
    dataUrlCache, // Lazily populated
  };
}

/**
 * Get or create a data URL for a character (lazy caching)
 */
export function getCharacterDataUrl(
  cachedFont: CachedFont,
  charIndex: number,
  scale: number = 1
): string {
  const cacheKey = charIndex * 100 + scale; // Simple composite key

  if (cachedFont.dataUrlCache.has(cacheKey)) {
    return cachedFont.dataUrlCache.get(cacheKey)!;
  }

  const imageData = cachedFont.imageCache.get(charIndex);
  if (!imageData) {
    // Return transparent placeholder for missing characters
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }

  // Create canvas and render
  const canvas = document.createElement('canvas');
  canvas.width = OSD_CHAR_WIDTH * scale;
  canvas.height = OSD_CHAR_HEIGHT * scale;

  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  if (scale === 1) {
    ctx.putImageData(imageData, 0, 0);
  } else {
    // Render at 1x then scale up for crisp pixels
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = OSD_CHAR_WIDTH;
    tempCanvas.height = OSD_CHAR_HEIGHT;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
  }

  const dataUrl = canvas.toDataURL('image/png');
  cachedFont.dataUrlCache.set(cacheKey, dataUrl);

  return dataUrl;
}

/**
 * OSD Screen Buffer - represents the character grid
 */
export class OsdScreenBuffer {
  readonly width: number;
  readonly height: number;
  private buffer: Uint16Array; // 16-bit to support 512 characters

  constructor(videoType: VideoType = 'PAL') {
    this.width = getOsdCols(videoType);
    this.height = getOsdRows(videoType);
    this.buffer = new Uint16Array(this.width * this.height);
    this.clear();
  }

  /** Clear buffer to blank (space character = 0x20) */
  clear(): void {
    this.buffer.fill(0x20);
  }

  /** Set character at position */
  setChar(x: number, y: number, charIndex: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.buffer[y * this.width + x] = charIndex;
  }

  /** Get character at position */
  getChar(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0x20;
    return this.buffer[y * this.width + x]!;
  }

  /** Draw a string starting at position.
   *  Auto-converts to uppercase because MCM fonts don't have lowercase —
   *  positions 0x61-0x7A contain OSD symbols, not letters. */
  drawString(x: number, y: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      let charCode = str.charCodeAt(i);
      // Convert lowercase a-z to uppercase A-Z (MCM fonts have no lowercase)
      if (charCode >= 0x61 && charCode <= 0x7a) {
        charCode -= 0x20;
      }
      this.setChar(x + i, y, charCode);
    }
  }

  /** Draw a string using symbol mapping */
  drawSymbols(x: number, y: number, symbols: number[]): void {
    for (let i = 0; i < symbols.length; i++) {
      this.setChar(x + i, y, symbols[i]!);
    }
  }

  /** Get raw buffer for iteration */
  getBuffer(): Uint16Array {
    return this.buffer;
  }

  /** Resize buffer (changes video format, including HD column count) */
  resize(videoType: VideoType): void {
    const newWidth = getOsdCols(videoType);
    const newHeight = getOsdRows(videoType);
    if (newWidth !== this.width || newHeight !== this.height) {
      (this as { width: number }).width = newWidth;
      (this as { height: number }).height = newHeight;
      this.buffer = new Uint16Array(newWidth * newHeight);
      this.clear();
    }
  }
}

/**
 * Render entire OSD screen to a canvas
 */
export function renderOsdToCanvas(
  ctx: CanvasRenderingContext2D,
  buffer: OsdScreenBuffer,
  cachedFont: CachedFont,
  scale: number = 2,
  backgroundColor: string = 'rgba(0, 0, 0, 0.7)'
): void {
  const width = buffer.width * OSD_CHAR_WIDTH * scale;
  const height = buffer.height * OSD_CHAR_HEIGHT * scale;

  // Draw background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // Disable smoothing for pixel-perfect rendering
  ctx.imageSmoothingEnabled = false;

  // Draw each character
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      const charIndex = buffer.getChar(x, y);
      const imageData = cachedFont.imageCache.get(charIndex);

      if (imageData) {
        // Create temporary canvas for this character
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = OSD_CHAR_WIDTH;
        tempCanvas.height = OSD_CHAR_HEIGHT;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.putImageData(imageData, 0, 0);

        // Draw scaled
        ctx.drawImage(
          tempCanvas,
          x * OSD_CHAR_WIDTH * scale,
          y * OSD_CHAR_HEIGHT * scale,
          OSD_CHAR_WIDTH * scale,
          OSD_CHAR_HEIGHT * scale
        );
      }
    }
  }
}

/**
 * Optimized batch renderer - renders to offscreen canvas first
 */
export class OsdRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private charCanvases: Map<number, HTMLCanvasElement> = new Map();
  private scale: number;
  private cachedFont: CachedFont | null = null;

  private cols: number;

  constructor(videoType: VideoType = 'PAL', scale: number = 2) {
    this.scale = scale;
    this.cols = getOsdCols(videoType);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.cols * OSD_CHAR_WIDTH * scale;
    this.canvas.height = getOsdRows(videoType) * OSD_CHAR_HEIGHT * scale;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }

  setFont(cachedFont: CachedFont): void {
    this.cachedFont = cachedFont;
    this.charCanvases.clear(); // Clear char canvas cache on font change
  }

  setScale(scale: number): void {
    if (scale !== this.scale) {
      const rows = this.canvas.height / (OSD_CHAR_HEIGHT * this.scale);
      this.scale = scale;
      this.canvas.width = this.cols * OSD_CHAR_WIDTH * scale;
      this.canvas.height = rows * OSD_CHAR_HEIGHT * scale;
      this.charCanvases.clear();
    }
  }

  resize(videoType: VideoType): void {
    this.cols = getOsdCols(videoType);
    this.canvas.width = this.cols * OSD_CHAR_WIDTH * this.scale;
    this.canvas.height = getOsdRows(videoType) * OSD_CHAR_HEIGHT * this.scale;
  }

  /** Get or create a pre-rendered canvas for a character */
  private getCharCanvas(charIndex: number): HTMLCanvasElement | null {
    if (!this.cachedFont) return null;

    if (this.charCanvases.has(charIndex)) {
      return this.charCanvases.get(charIndex)!;
    }

    const imageData = this.cachedFont.imageCache.get(charIndex);
    if (!imageData) return null;

    const canvas = document.createElement('canvas');
    canvas.width = OSD_CHAR_WIDTH * this.scale;
    canvas.height = OSD_CHAR_HEIGHT * this.scale;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    // Render at 1x
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = OSD_CHAR_WIDTH;
    tempCanvas.height = OSD_CHAR_HEIGHT;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    // Scale up
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

    this.charCanvases.set(charIndex, canvas);
    return canvas;
  }

  /** Render buffer to internal canvas and return it */
  render(buffer: OsdScreenBuffer, backgroundColor?: string): HTMLCanvasElement {
    // Clear with background
    if (backgroundColor) {
      this.ctx.fillStyle = backgroundColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Draw characters
    for (let y = 0; y < buffer.height; y++) {
      for (let x = 0; x < buffer.width; x++) {
        const charIndex = buffer.getChar(x, y);
        const charCanvas = this.getCharCanvas(charIndex);

        if (charCanvas) {
          this.ctx.drawImage(
            charCanvas,
            x * OSD_CHAR_WIDTH * this.scale,
            y * OSD_CHAR_HEIGHT * this.scale
          );
        }
      }
    }

    return this.canvas;
  }

  /** Get the internal canvas dimensions */
  getDimensions(): { width: number; height: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }
}
