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
const envSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
const baseUrl = String(envSiteUrl || siteConfig.site_url || 'https://pin2pin.dev').replace(/\/+$/, '');
const rawBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').trim().replace(/\/+$/, '');
const basePath = rawBasePath && rawBasePath !== '/' ? (rawBasePath.startsWith('/') ? rawBasePath : `/${rawBasePath}`) : '';
const today = new Date().toISOString().slice(0, 10);

// ---- Real per-record dates (no blanket "today" lastmod) ----
function collectJson(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJson(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function toDate(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

function maxDate(values, fallback = today) {
  const valid = values.map(toDate).filter(Boolean).sort();
  return valid.length ? valid[valid.length - 1] : fallback;
}

const verifiedBySlug = new Map();
for (const file of collectJson(path.join(repoRoot, 'data', 'parts'))) {
  try {
    const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
    const d = toDate(rec?.datasheet?.verified_at);
    if (rec?.slug && d) verifiedBySlug.set(rec.slug, d);
  } catch {
    /* ignore malformed file; falls back below */
  }
}
const globalVerified = maxDate([...verifiedBySlug.values()]);

const guideUpdatedBySlug = new Map();
for (const file of collectJson(path.join(repoRoot, 'data', 'guides'))) {
  try {
    const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
    const d = toDate(rec?.updated_at) ?? toDate(rec?.published_at);
    if (rec?.slug && d) guideUpdatedBySlug.set(rec.slug, d);
  } catch {
    /* ignore */
  }
}
const guidesHubDate = maxDate([...guideUpdatedBySlug.values()], globalVerified);

const trustUpdatedBySlug = new Map();
for (const file of collectJson(path.join(repoRoot, 'data', 'trust'))) {
  try {
    const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
    const d = toDate(rec?.updated_at);
    if (rec?.slug && d) trustUpdatedBySlug.set(rec.slug, d);
  } catch {
    /* ignore */
  }
}

const urlEntries = [];
const seen = new Set();

function pushRoute(routePath, priority, changefreq, lastmod) {
  const clean = routePath.replace(/^\/+|\/+$/g, '');
  const normalized = `/${clean}/`;
  if (seen.has(normalized)) {
    throw new Error(`Duplicate route detected while building sitemap: ${normalized}`);
  }
  seen.add(normalized);
  urlEntries.push({
    loc: `${baseUrl}${normalized}`,
    lastmod: lastmod || globalVerified,
    changefreq,
    priority,
  });
}

// New hub routes added in Track 4 (not yet part of data/pilot-manifest.json)
const EXTRA_HUBS = [
  { route: '/en/compare', priority: '0.9', date: globalVerified },
  { route: '/en/packages', priority: '0.9', date: globalVerified },
  { route: '/en/tools', priority: '0.9', date: globalVerified },
  { route: '/en/guides', priority: '0.9', date: guidesHubDate },
  { route: '/en/vs', priority: '0.85', date: globalVerified },
];
const manifestStatic = new Set(
  [
    ...manifest.static_routes.hubs,
    ...manifest.static_routes.tools,
    ...manifest.static_routes.guides,
    ...manifest.static_routes.trust_pages,
  ].map((r) => r.replace(/\/+$/g, '')),
);
const extraHubsToAdd = EXTRA_HUBS.filter((h) => !manifestStatic.has(h.route));

// 1. Static hubs
for (const route of manifest.static_routes.hubs) {
  pushRoute(route, route === '/en' ? '1.0' : '0.9', 'weekly', globalVerified);
}
for (const hub of extraHubsToAdd) {
  pushRoute(hub.route, hub.priority, 'weekly', hub.date);
}

// 2. Interactive calculators / tools
for (const route of manifest.static_routes.tools) {
  pushRoute(route, '0.9', 'monthly', globalVerified);
}

// 3. Engineering field guides (updated_at per guide)
for (const route of manifest.static_routes.guides) {
  const slug = route.replace(/^\/en\/guides\//, '').replace(/\/+$/g, '');
  pushRoute(route, '0.85', 'monthly', guideUpdatedBySlug.get(slug) ?? guidesHubDate);
}

// 4. Trust & policy pages (updated_at per page)
for (const route of manifest.static_routes.trust_pages) {
  const slug = route.replace(/^\/en\//, '').replace(/\/+$/g, '');
  pushRoute(route, '0.6', 'monthly', trustUpdatedBySlug.get(slug) ?? globalVerified);
}

// 5. Part datasheet pages (verified_at per part)
for (const part of manifest.parts) {
  pushRoute(`/en/part/${part.slug}`, '0.9', 'monthly', verifiedBySlug.get(part.slug) ?? globalVerified);
}

// 6. Ranked alternatives hub pages (verified_at of the target part)
for (const part of manifest.parts) {
  pushRoute(`/en/alt/${part.slug}-alternatives`, '0.85', 'monthly', verifiedBySlug.get(part.slug) ?? globalVerified);
}

// 7. 1:1 Pin-diff VS comparison pages - verify canonical alphabetical ordering (AUD-06)
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
  const vsDate = maxDate([verifiedBySlug.get(pair.part_a), verifiedBySlug.get(pair.part_b)], globalVerified);
  pushRoute(`/en/vs/${pair.slug}`, '0.8', 'monthly', vsDate);
}

const expectedTotal = (manifest.page_budget?.total_en_pages ?? 200) + extraHubsToAdd.length;
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
  'Allow: /',
  '',
  `Sitemap: ${baseUrl}/sitemap.xml`,
  '',
].join('\n');

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xmlLines.join('\n'), 'utf8');
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8');
fs.writeFileSync(path.join(publicDir, '.nojekyll'), '', 'utf8');

console.log(
  `[Pin2Pin] Generated sitemap.xml (${urlEntries.length} canonical EN URLs at ${baseUrl}), robots.txt, and .nojekyll in web/public/`,
);
