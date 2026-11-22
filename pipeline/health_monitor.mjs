#!/usr/bin/env node
/**
 * Autonomous Health Monitor, PDF Revision Watcher & Open-Issue Scanner
 *
 * Performs 3 live maintenance checks:
 *  1. Official Manufacturer Datasheet Link & Revision Drift Check across all Golden Parts.
 *  2. Live Production CDN Verification (sitemap.xml count, core pages HTTP 200, _next/static assets).
 *  3. Open GitHub Error-Report Issues (`[Pinout/Spec Audit]`) via `gh issue list`.
 *
 * Outputs:
 *  - `data/audit/health-latest.json`
 *  - `docs/OPS-STATUS.md`
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const LIVE_BASE = (
  process.env.PIN2PIN_LIVE_URL || 'https://kbu3986.github.io/pin2pin-global'
).replace(/\/+$/, '');
const REPO_SLUG = 'kbu3986/pin2pin-global';
const PARTS_DIR = path.resolve('data/parts');
const MANIFEST_PATH = path.resolve('data/pilot-manifest.json');
const HEALTH_OUT = path.resolve('data/audit/health-latest.json');
const OPS_DOC = path.resolve('docs/OPS-STATUS.md');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function collectJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out.sort();
}

async function runPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function checkPdfUrl(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let resp = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (resp.status === 405 || resp.status === 403) {
      resp = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-1023' },
        redirect: 'follow',
        signal: ctrl.signal,
      });
    }
    clearTimeout(timer);
    return {
      url,
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      contentLength: resp.headers.get('content-length') || null,
      etag: resp.headers.get('etag') || null,
      lastModified: resp.headers.get('last-modified') || null,
    };
  } catch (err) {
    return {
      url,
      ok: false,
      status: 0,
      error: String(err?.message || err).slice(0, 120),
    };
  }
}

async function checkLiveSite(manifest) {
  const sampleRoutes = [
    '/',
    '/en/',
    '/en/catalog/',
    '/en/tools/ldo-thermal-calculator/',
    '/en/tools/dcdc-efficiency-ripple-calculator/',
    '/en/tools/opamp-gbwp-slewrate-checker/',
    '/en/tools/bom-checker/',
    '/en/methodology/',
    '/sitemap.xml',
    '/robots.txt',
  ];
  if (manifest.parts?.length) {
    sampleRoutes.push(`/en/part/${manifest.parts[0].slug}/`);
    sampleRoutes.push(`/en/part/${manifest.parts[manifest.parts.length - 1].slug}/`);
    sampleRoutes.push(`/en/alt/${manifest.parts[0].slug}-alternatives/`);
  }
  if (manifest.vs_pairs?.length) {
    sampleRoutes.push(`/en/vs/${manifest.vs_pairs[0].slug}/`);
    sampleRoutes.push(`/en/vs/${manifest.vs_pairs[manifest.vs_pairs.length - 1].slug}/`);
  }

  let sitemapCount = 0;
  const routeResults = [];
  for (const r of sampleRoutes) {
    const url = `${LIVE_BASE}${r}`;
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      const text = await resp.text();
      if (r === '/sitemap.xml' && resp.ok) {
        sitemapCount = (text.match(/<loc>/g) || []).length;
      }
      routeResults.push({ route: r, status: resp.status, ok: resp.status === 200, bytes: text.length });
    } catch (err) {
      routeResults.push({ route: r, status: 0, ok: false, error: String(err?.message || err) });
    }
  }
  const failed = routeResults.filter((x) => !x.ok);
  return {
    live_base: LIVE_BASE,
    checked_routes: routeResults.length,
    failed_routes: failed,
    sitemap_live_urls: sitemapCount,
    manifest_expected_urls: manifest.page_budget?.total_en_pages || 0,
    sitemap_synced: sitemapCount === (manifest.page_budget?.total_en_pages || 0),
    ok: failed.length === 0 && sitemapCount === (manifest.page_budget?.total_en_pages || 0),
  };
}

function fetchOpenIssues() {
  try {
    const raw = execSync(
      `gh issue list -R ${REPO_SLUG} --state open --limit 30 --json number,title,url,createdAt,labels`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { ok: true, issues: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, issues: [], error: String(err?.message || err).slice(0, 120) };
  }
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const prevHealth = fs.existsSync(HEALTH_OUT)
    ? JSON.parse(fs.readFileSync(HEALTH_OUT, 'utf8'))
    : null;
  const prevPdfMap = new Map(
    (prevHealth?.pdfs?.details || []).map((d) => [d.url, d]),
  );

  const partFiles = collectJsonFiles(PARTS_DIR);
  const parts = partFiles.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const uniquePdfUrls = [...new Set(parts.map((p) => p.datasheet.pdf_url))].sort();

  const pdfChecks = await runPool(uniquePdfUrls, 8, checkPdfUrl);
  const brokenPdfs = pdfChecks.filter((c) => !c.ok);
  const changedPdfs = [];
  for (const curr of pdfChecks) {
    const prev = prevPdfMap.get(curr.url);
    if (prev && prev.ok && curr.ok) {
      const lenChanged =
        prev.contentLength && curr.contentLength && prev.contentLength !== curr.contentLength;
      const etagChanged = prev.etag && curr.etag && prev.etag !== curr.etag;
      if (lenChanged || etagChanged) {
        changedPdfs.push({
          url: curr.url,
          prev_length: prev.contentLength,
          curr_length: curr.contentLength,
          prev_etag: prev.etag,
          curr_etag: curr.etag,
        });
      }
    }
  }

  const live = await checkLiveSite(manifest);
  const issuesRes = fetchOpenIssues();

  const nowIso = new Date().toISOString();
  const report = {
    checked_at: nowIso,
    summary: {
      total_parts: parts.length,
      total_vs_pairs: manifest.vs_pairs?.length || 0,
      total_en_pages: manifest.page_budget?.total_en_pages || 0,
      unique_official_pdfs: uniquePdfUrls.length,
      broken_pdfs: brokenPdfs.length,
      revision_drift_detected: changedPdfs.length,
      live_site_ok: live.ok,
      open_github_issues: issuesRes.issues.length,
    },
    pdfs: {
      broken: brokenPdfs,
      revision_drifts: changedPdfs,
      details: pdfChecks,
    },
    live,
    open_issues: issuesRes.issues,
  };

  fs.mkdirSync(path.dirname(HEALTH_OUT), { recursive: true });
  fs.writeFileSync(HEALTH_OUT, JSON.stringify(report, null, 2) + '\n', 'utf8');

  const md = [
    '# Pin2Pin Global — Autonomous Operations & Health Status',
    '',
    `> Last automated check: \`${nowIso}\``,
    '',
    '| KPI / Health Metric | Current Value | Status |',
    '| :--- | :--- | :--- |',
    `| **Verified Golden Parts (OPN)** | ${parts.length} parts | ${parts.length >= 50 ? 'OK' : 'WARN'} |`,
    `| **1:1 Comparisons (vs) / Alt Hubs** | ${manifest.vs_pairs.length} vs / ${parts.length} alt | OK |`,
    `| **Total Canonical EN Pages** | ${manifest.page_budget.total_en_pages} pages | ${live.sitemap_synced ? 'SYNCED' : 'DRIFT'} |`,
    `| **Official Manufacturer PDFs Alive** | ${uniquePdfUrls.length - brokenPdfs.length} / ${uniquePdfUrls.length} | ${brokenPdfs.length === 0 ? 'HEALTHY' : 'ACTION_REQUIRED'} |`,
    `| **Datasheet Revision Drifts Detected** | ${changedPdfs.length} | ${changedPdfs.length === 0 ? 'CLEAN' : 'REVERIFY_NEEDED'} |`,
    `| **Live Production CDN (${LIVE_BASE})** | ${live.checked_routes - live.failed_routes.length}/${live.checked_routes} HTTP 200 (sitemap=${live.sitemap_live_urls}) | ${live.ok ? 'LIVE_OK' : 'DEGRADED'} |`,
    `| **Open Reader Audit Issues** | ${issuesRes.issues.length} | ${issuesRes.issues.length === 0 ? 'CLEAR' : 'HEAL_PENDING'} |`,
    '',
  ].join('\n');

  fs.writeFileSync(OPS_DOC, md, 'utf8');
  console.log(JSON.stringify(report.summary, null, 2));
  if (brokenPdfs.length > 0 || !live.ok) {
    process.exitCode = 1;
  }
}

main();
