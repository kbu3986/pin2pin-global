import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function extractLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url.startsWith('https://')) locs.push(url);
  }
  return locs;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'Pin2Pin-IndexNow-Submitter/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function main() {
  const cfgPath = path.join(REPO_ROOT, 'config', 'site-config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

  const liveSiteUrl = (process.env.INDEXNOW_SITE_URL || cfg.live_site_url || '').trim().replace(/\/+$/, '');
  const key = (process.env.INDEXNOW_KEY || cfg.indexnow_key || '').trim();
  if (!liveSiteUrl || !key) {
    throw new Error('Missing live_site_url or indexnow_key in config/site-config.json');
  }

  const parsed = new URL(liveSiteUrl);
  const host = parsed.host;
  const keyLocation = `${liveSiteUrl}/${key}.txt`;
  const sitemapUrl = `${liveSiteUrl}/sitemap.xml`;

  const liveKeyBody = (await fetchText(keyLocation)).trim();
  if (liveKeyBody !== key) {
    throw new Error(`Key verification mismatch at ${keyLocation}`);
  }
  console.log(`[indexnow] Verified live key file: ${keyLocation}`);

  const sitemapXml = await fetchText(sitemapUrl);
  const urlList = Array.from(
    new Set(
      extractLocs(sitemapXml).filter((u) => {
        try {
          return u.startsWith(`${liveSiteUrl}/`) && new URL(u).host === host;
        } catch {
          return false;
        }
      }),
    ),
  );

  if (urlList.length === 0) {
    throw new Error(`No URLs found in ${sitemapUrl}`);
  }
  console.log(`[indexnow] Collected ${urlList.length} URLs from ${sitemapUrl}`);

  const payload = { host, key, keyLocation, urlList };
  const endpoints = [
    'https://api.indexnow.org/indexnow',
    'https://www.bing.com/indexnow',
    'https://searchadvisor.naver.com/indexnow',
  ];

  let successCount = 0;
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const text = (await res.text()).trim();
      const ok = res.status === 200 || res.status === 202;
      if (ok) successCount += 1;
      console.log(
        `[indexnow] POST ${endpoint} -> HTTP ${res.status} (${ok ? 'ACCEPTED' : 'FAILED'}) ${text ? text.slice(0, 140) : ''}`.trim(),
      );
    } catch (err) {
      console.warn(`[indexnow] POST ${endpoint} -> ERROR: ${err.message}`);
    }
  }

  if (successCount === 0) {
    throw new Error('All IndexNow endpoints failed');
  }
  console.log(`[indexnow] Done (${successCount}/${endpoints.length} endpoints accepted ${urlList.length} URLs).`);
}

main().catch((err) => {
  console.error(`[indexnow] Failed: ${err.message}`);
  process.exit(1);
});
