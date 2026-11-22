import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..');

const manifestPath = path.join(repoRoot, 'data', 'pilot-manifest.json');
const siteConfigPath = path.join(repoRoot, 'config', 'site-config.json');
const publicDir = path.join(webRoot, 'public');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const siteConfig = JSON.parse(fs.readFileSync(siteConfigPath, 'utf8'));
const baseUrl = String(siteConfig.site_url || 'https://pin2pin.dev').replace(/\/+$/, '');
const today = new Date().toISOString().slice(0, 10);

const urlEntries = [];
const seen = new Set();

function pushRoute(routePath, priority, changefreq) {
  const normalized = routePath.startsWith('/') ? routePath : `/${routePath}`;
  if (seen.has(normalized)) {
    throw new Error(`Duplicate route detected while building sitemap: ${normalized}`);
  }
  seen.add(normalized);
  urlEntries.push({
    loc: `${baseUrl}${normalized}`,
    lastmod: today,
    changefreq,
    priority,
  });
}

// 1. Static hubs (2)
for (const route of manifest.static_routes.hubs) {
  pushRoute(route, route === '/en' ? '1.0' : '0.9', 'weekly');
}

// 2. Interactive calculators / tools (3)
for (const route of manifest.static_routes.tools) {
  pushRoute(route, '0.9', 'monthly');
}

// 3. Engineering field guides (5)
for (const route of manifest.static_routes.guides) {
  pushRoute(route, '0.85', 'monthly');
}

// 4. Trust & policy pages (5)
for (const route of manifest.static_routes.trust_pages) {
  pushRoute(route, '0.6', 'monthly');
}

// 5. Part datasheet pages (50)
for (const part of manifest.parts) {
  pushRoute(`/en/part/${part.slug}`, '0.9', 'monthly');
}

// 6. Ranked alternatives hub pages (50)
for (const part of manifest.parts) {
  pushRoute(`/en/alt/${part.slug}-alternatives`, '0.85', 'monthly');
}

// 7. 1:1 Pin-diff VS comparison pages (85) — verify canonical alphabetical ordering (AUD-06)
for (const pair of manifest.vs_pairs) {
  if (pair.part_a >= pair.part_b) {
    throw new Error(
      `VS pair slug violates canonical alphabetical ordering (a < b): ${pair.slug} (${pair.part_a} vs ${pair.part_b})`,
    );
  }
  const expectedSlug = `${pair.part_a}-vs-${pair.part_b}`;
  if (pair.slug !== expectedSlug) {
    throw new Error(`VS pair slug mismatch: got ${pair.slug}, expected ${expectedSlug}`);
  }
  pushRoute(`/en/vs/${pair.slug}`, '0.8', 'monthly');
}

const expectedTotal = manifest.page_budget?.total_en_pages ?? 200;
if (urlEntries.length !== expectedTotal) {
  throw new Error(
    `Sitemap URL count mismatch: generated ${urlEntries.length}, expected ${expectedTotal}`,
  );
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const xmlLines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urlEntries.map(
    (entry) =>
      `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`,
  ),
  '</urlset>',
  '',
];

const robotsTxt = [
  'User-agent: *',
  'Allow: /en',
  'Disallow: /_next/',
  '',
  `Sitemap: ${baseUrl}/sitemap.xml`,
  '',
].join('\n');

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xmlLines.join('\n'), 'utf8');
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8');

console.log(
  `[Pin2Pin] Generated sitemap.xml (${urlEntries.length} canonical EN URLs) and robots.txt in web/public/`,
);
