/**
 * The product's wordmark: «ТУНЕЛЬ» drawn letter by letter in straight, even strokes, after
 * a tunnel portal in the accent colour. It is a drawing, not text in a font, so it looks
 * the same on every computer; the letters take the colour of the text around them.
 */

import { t } from '../../i18n';

/** Stroke width of the letters, in the drawing's own units (the letters are 100 high). */
const STROKE = 17;
/** Letter shapes on a 100-high line, each starting at x = 0, and how wide each one is. */
const LETTERS: { d: string; width: number }[] = [
  // Т
  { d: 'M0,8.5 H72 M36,0 V100', width: 72 },
  // У
  { d: 'M2,-8 L39,63 M73,-10 L16,110', width: 74 },
  // Н
  { d: 'M8.5,0 V100 M63.5,0 V100 M8.5,50 H63.5', width: 72 },
  // Е
  { d: 'M8.5,0 V100 M8.5,8.5 H64 M8.5,50 H56 M8.5,91.5 H64', width: 64 },
  // Л
  { d: 'M3,112 L29,8.5 H63.5 V100', width: 72 },
  // Ь
  { d: 'M8.5,0 V91.5 H54 L63.5,82 V59.5 L54,50 H8.5', width: 70 },
];
const GAP = 22;
/** The portal: an arch with the road's vanishing mark inside. */
const PORTAL_WIDTH = 92;
const PORTAL_GAP = 34;

export const BRAND_ACCENT = '#f59e0b';

export function BrandMark({ className = 'h-5', portal = true }: { className?: string; portal?: boolean }) {
  let x = portal ? PORTAL_WIDTH + PORTAL_GAP : 0;
  const placed = LETTERS.map((letter) => {
    const at = x;
    x += letter.width + GAP;
    return { ...letter, at };
  });
  const width = x - GAP;
  return (
    <svg viewBox={`0 0 ${width} 100`} className={`${className} w-auto shrink-0`} role="img" aria-label={t('brand.name')}>
      <defs>
        <clipPath id="brand-mark-line"><rect x="-10" y="0" width={width + 20} height="100" /></clipPath>
      </defs>
      <g clipPath="url(#brand-mark-line)" fill="none" strokeLinecap="butt" strokeLinejoin="miter">
        {portal && (
          <g stroke={BRAND_ACCENT}>
            <path d={`M${STROKE / 2},100 V46 A37.5,37.5 0 0 1 ${PORTAL_WIDTH - STROKE / 2},46 V100`} strokeWidth={STROKE} />
            <path d={`M${PORTAL_WIDTH / 2},100 V58`} strokeWidth={STROKE * 0.7} />
          </g>
        )}
        <g stroke="currentColor" strokeWidth={STROKE}>
          {placed.map((letter, i) => <path key={i} d={letter.d} transform={`translate(${letter.at} 0)`} />)}
        </g>
      </g>
    </svg>
  );
}
