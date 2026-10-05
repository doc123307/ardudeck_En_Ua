/**
 * Draws the application icon and writes it in the sizes the packages need:
 * resources/icon.png (1024) and resources/icon.ico (16..256).
 *
 *   pnpm exec electron scripts/make-icons.cjs [--preview out.png]
 *
 * The icon is the tunnel portal of the wordmark (src/renderer/components/ui/BrandMark.tsx)
 * with the letter «Т» in it. It is drawn by Chromium from the SVG below, so no image
 * library is needed. The macOS icon.icns is not regenerated here.
 */

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const ACCENT = '#f59e0b';

function iconSvg(size) {
  // Small sizes drop the fine details: the border and the ground line would only blur.
  const small = size <= 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b2433"/><stop offset="1" stop-color="#0a0e15"/>
    </linearGradient>
    <clipPath id="ground"><rect x="0" y="0" width="512" height="408"/></clipPath>
  </defs>
  <rect x="${small ? 0 : 8}" y="${small ? 0 : 8}" width="${small ? 512 : 496}" height="${small ? 512 : 496}" rx="${small ? 96 : 104}" fill="url(#bg)"${small ? '' : ' stroke="#334155" stroke-width="6"'}/>
  <g fill="none" stroke-linecap="butt" stroke-linejoin="miter" clip-path="url(#ground)">
    <path d="M106,420 V236 A150,150 0 0 1 406,236 V420" stroke="${ACCENT}" stroke-width="${small ? 64 : 54}"/>
    <path d="M186,214 H326 M256,214 V420" stroke="#f8fafc" stroke-width="${small ? 62 : 50}"/>
  </g>
  ${small ? '' : '<rect x="74" y="408" width="364" height="16" fill="#f8fafc" opacity="0.9"/>'}
</svg>`;
}

/** An .ico file whose entries are PNG images (valid since Windows Vista). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

/** One hidden window draws every size: the page is rewritten and captured in turn. */
async function render(win, page, size) {
  fs.writeFileSync(page, `<html><body style="margin:0;background:transparent;overflow:hidden">${iconSvg(size)}</body></html>`, 'utf8');
  win.setContentSize(Math.max(size, 64), Math.max(size, 64));
  await win.loadFile(page);
  await new Promise((r) => setTimeout(r, 250));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  // The capture follows the display's scale factor; bring it to the exact size asked for.
  return image.resize({ width: size, height: size, quality: 'best' }).toPNG();
}

async function main() {
  const resources = path.join(__dirname, '..', 'resources');
  const page = path.join(app.getPath('temp'), 'stohid-icon.html');
  const win = new BrowserWindow({ width: 1024, height: 1024, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = [];
  for (const size of sizes) images.push({ size, png: await render(win, page, size) });
  const big = await render(win, page, 1024);
  fs.writeFileSync(path.join(resources, 'icon.ico'), ico(images));
  fs.writeFileSync(path.join(resources, 'icon.png'), big);
  const preview = process.argv.indexOf('--preview');
  if (preview > 0 && process.argv[preview + 1]) fs.writeFileSync(process.argv[preview + 1], images.find((i) => i.size === 256).png);
  fs.rmSync(page, { force: true });
  win.destroy();
  console.log('icons written:', sizes.join(', '), '+ 1024');
}

app.disableHardwareAcceleration();
app.whenReady().then(main).then(() => app.quit(), (e) => { console.error('FAILED', e); app.exit(1); });
