/**
 * One-shot SEO asset generator (run manually: `node web/scripts/generate-seo-assets.mjs`).
 * Produces: og-image.png (1200x630), apple-touch-icon.png (180x180), favicon.ico (32+48 PNG-wrapped ICO).
 * Requires `sharp` (already installed under web/node_modules).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const FONT = "'Segoe UI', 'DejaVu Sans', Arial, Helvetica, sans-serif";
const MONO = "Consolas, 'DejaVu Sans Mono', 'Courier New', monospace";

function chipMotif(cx, cy) {
  // SOT-23-5 style pinout motif: body + 3 left pins + 2 right pins
  const w = 210;
  const h = 150;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const pinsL = [1, 2, 3].map((n, i) => {
    const py = y + 22 + i * 53;
    return `<rect x="${x - 52}" y="${py - 8}" width="52" height="16" rx="3" fill="#334155"/>
    <text x="${x - 62}" y="${py + 5}" text-anchor="end" font-family="${MONO}" font-size="20" fill="#94a3b8">${n}</text>`;
  });
  const pinsR = [5, 4].map((n, i) => {
    const py = y + 48 + i * 53;
    return `<rect x="${x + w}" y="${py - 8}" width="52" height="16" rx="3" fill="#334155"/>
    <text x="${x + w + 62}" y="${py + 5}" text-anchor="start" font-family="${MONO}" font-size="20" fill="#94a3b8">${n}</text>`;
  });
  return `
  <g>
    ${pinsL.join('\n')}
    ${pinsR.join('\n')}
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#0f172a" stroke="#10b981" stroke-width="3"/>
    <circle cx="${x + 26}" cy="${y + 26}" r="8" fill="#10b981"/>
    <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="${MONO}" font-size="40" font-weight="700" fill="#f8fafc">P2P</text>
    <text x="${cx}" y="${cy + 40}" text-anchor="middle" font-family="${MONO}" font-size="16" fill="#38bdf8">SOT-23-5</text>
  </g>`;
}

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#020617"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="#1e293b" stroke-width="1"/>
    </pattern>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#10b981"/>
      <stop offset="1" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)" opacity="0.7"/>
  <rect x="0" y="0" width="14" height="630" fill="url(#bar)"/>

  <text x="72" y="104" font-family="${MONO}" font-size="24" font-weight="700" letter-spacing="4" fill="#10b981">PIN2PIN GLOBAL</text>
  <text x="72" y="186" font-family="${FONT}" font-size="58" font-weight="700" fill="#f8fafc">Datasheet-Verified</text>
  <text x="72" y="254" font-family="${FONT}" font-size="58" font-weight="700" fill="#f8fafc">Semiconductor Pinout</text>
  <text x="72" y="322" font-family="${FONT}" font-size="58" font-weight="700" fill="#34d399">&amp; Cross-Reference DB</text>
  <text x="72" y="380" font-family="${FONT}" font-size="26" fill="#cbd5e1">LDO · DC-DC · Op-Amp · OPN-exact pin-diff &amp; drop-in checks</text>

  ${chipMotif(930, 250)}

  <rect x="72" y="450" width="520" height="52" rx="10" fill="#064e3b" stroke="#10b981" stroke-width="2"/>
  <text x="96" y="484" font-family="${MONO}" font-size="22" font-weight="700" fill="#a7f3d0">300 DPI Vision Audited</text>
  <rect x="612" y="450" width="516" height="52" rx="10" fill="#0c4a6e" stroke="#38bdf8" stroke-width="2"/>
  <text x="636" y="484" font-family="${MONO}" font-size="22" font-weight="700" fill="#bae6fd">Zero-Upload BOM Checker</text>

  <text x="72" y="568" font-family="${MONO}" font-size="20" fill="#64748b">Official manufacturer PDFs only · No distributor scraping · Verify before production</text>
</svg>`;

function iconSvg(size) {
  const r = Math.round(size * 0.22);
  const pad = size * 0.28;
  const body = size - pad * 2;
  const pin = (i, side) => {
    const gap = body / 4;
    const py = pad + gap * (i + 1) - size * 0.025;
    const px = side === 'L' ? pad - size * 0.14 : pad + body;
    return `<rect x="${px}" y="${py}" width="${size * 0.14}" height="${size * 0.05}" rx="${size * 0.012}" fill="#94a3b8"/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${r}" fill="#0f172a"/>
    ${[0, 1, 2].map((i) => pin(i, 'L')).join('')}
    ${[0, 1, 2].map((i) => pin(i, 'R')).join('')}
    <rect x="${pad}" y="${pad}" width="${body}" height="${body}" rx="${size * 0.06}" fill="#1e293b" stroke="#10b981" stroke-width="${Math.max(2, size * 0.04)}"/>
    <circle cx="${pad + size * 0.08}" cy="${pad + size * 0.08}" r="${size * 0.035}" fill="#34d399"/>
    <text x="${size / 2}" y="${size / 2 + size * 0.07}" text-anchor="middle" font-family="${MONO}" font-size="${size * 0.2}" font-weight="700" fill="#f8fafc">P2P</text>
  </svg>`;
}

async function pngFromSvg(svg) {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

function buildIco(images) {
  // images: [{ size, buf }]
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const dirs = [];
  for (const { size, buf } of images) {
    const d = Buffer.alloc(16);
    d.writeUInt8(size >= 256 ? 0 : size, 0);
    d.writeUInt8(size >= 256 ? 0 : size, 1);
    d.writeUInt8(0, 2);
    d.writeUInt8(0, 3);
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(buf.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += buf.length;
    dirs.push(d);
  }
  return Buffer.concat([header, ...dirs, ...images.map((i) => i.buf)]);
}

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'og-image.png'), await pngFromSvg(ogSvg));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), await pngFromSvg(iconSvg(180)));
const ico32 = await pngFromSvg(iconSvg(32));
const ico48 = await pngFromSvg(iconSvg(48));
fs.writeFileSync(
  path.join(publicDir, 'favicon.ico'),
  buildIco([
    { size: 32, buf: ico32 },
    { size: 48, buf: ico48 },
  ]),
);
console.log('[Pin2Pin] Generated og-image.png (1200x630), apple-touch-icon.png (180x180), favicon.ico (32+48) in web/public/');
