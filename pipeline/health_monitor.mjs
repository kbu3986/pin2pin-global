#!/usr/bin/env node
/**
 * Autonomous Health Monitor, PDF Revision Watcher & Open-Issue Scanner
 *
 * Performs 3 live maintenance checks:
 *  1. Official Manufacturer Datasheet Link, `%PDF` Magic/Content-Type & Revision Drift Check
 *     across all Golden Parts (separate 15s timeout per request; parses Content-Range total size).
 *  2. Live Production CDN Verification (sitemap.xml count, core pages HTTP 200, `_next/static/`
 *     CSS/JS assets referenced by `/en/` HTML).
 *  3. Open GitHub Error-Report Issues (`[Pinout/Spec Audit]`) via `gh issue list`, surfacing
 *     CLI/auth failures explicitly instead of masking them as `0 | CLEAR`.
 *
 * Outputs:
 *  - `data/audit/health-latest.json`
 *  - `docs/OPS-STATUS.md`
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_SLUG = 'kbu3986/pin2pin-global';
const PARTS_DIR = path.resolve('data/parts');
const MANIFEST_PATH = path.resolve('data/pilot-manifest.json');
const SITE_CONFIG_PATH = path.resolve('config/site-config.json');
const HEALTH_OUT = path.resolve('data/audit/health-latest.json');
const OPS_DOC = path.resolve('docs/OPS-STATUS.md');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function resolveLiveBase() {
  const envUrl = (process.env.LIVE_SITE_URL || process.env.PIN2PIN_LIVE_URL || '').trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  if (fs.existsSync(SITE_CONFIG_PATH)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(SITE_CONFIG_PATH, 'utf8'));
      const candidate = cfg.live_site_url || cfg.site_url;
      if (candidate) return String(candidate).trim().replace(/\/+$/, '');
    } catch {
      /* fallback below */
    }
  }
  return 'https://kbu3986.github.io/pin2pin-global';
}

const LIVE_BASE = resolveLiveBase();

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

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseTotalLength(headers) {
  const contentRange = headers.get('content-range');
  if (contentRange) {
    const m = contentRange.match(/\/(\d+)$/);
    if (m) return m[1];
  }
  return headers.get('content-length') || null;
}

function isPdfContentType(ct) {
  const lower = String(ct || '').toLowerCase();
  return (
    lower.includes('application/pdf') ||
    lower.includes('application/octet-stream') ||
    lower.includes('binary/octet-stream')
  );
}

async function checkPdfUrl(url) {
  try {
    // 1. Try HEAD with its own 15s timeout
    let resp = await fetchWithTimeout(
      url,
      {
        method: 'HEAD',
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
      },
      15000,
    );

    const headCt = resp.headers.get('content-type') || '';
    let pdfVerified = false;

    // 2. Fallback to Range GET (separate 15s timeout) if HEAD rejected or Content-Type ambiguous
    if (!resp.ok || !isPdfContentType(headCt)) {
      resp = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-1023' },
          redirect: 'follow',
        },
        15000,
      );
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer()).subarray(0, 1024);
        pdfVerified = buf.includes(Buffer.from('%PDF'));
      }
    } else {
      pdfVerified = true;
    }

    const finalCt = resp.headers.get('content-type') || null;
    const statusOk = resp.status >= 200 && resp.status < 300;
    const ok = statusOk && pdfVerified;

    return {
      url,
      ok,
      status: resp.status,
      contentType: finalCt,
      pdfVerified,
      contentLength: parseTotalLength(resp.headers),
      etag: resp.headers.get('etag') || null,
      lastModified: resp.headers.get('last-modified') || null,
      ...(statusOk && !pdfVerified
        ? { error: `Non-PDF payload (Content-Type=${finalCt}, missing %PDF header)` }
        : {}),
    };
  } catch (err) {
    return {
      url,
      ok: false,
      status: 0,
      pdfVerified: false,
      error: String(err?.message || err).slice(0, 120),
    };
  }
}

async function checkLiveSite(manifest) {
  const sampleRoutes = [
    '/',
    '/en/',
    '/en/catalog/',
    '/en/tools/',
    '/en/tools/compare/',
    '/en/tools/pinout-finder/',
    '/en/tools/feedback-divider/',
    '/en/tools/bom-checker/',
    '/en/tools/ldo-thermal-calculator/',
    '/en/tools/dcdc-efficiency-ripple-calculator/',
    '/en/tools/opamp-gbwp-slewrate-checker/',
    '/en/guides/',
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
  let enHtml = '';
  const routeResults = [];

  for (const r of sampleRoutes) {
    const url = `${LIVE_BASE}${r}`;
    try {
      const resp = await fetchWithTimeout(
        url,
        { headers: { 'User-Agent': USER_AGENT } },
        15000,
      );
      const text = await resp.text();
      if (r === '/sitemap.xml' && resp.ok) {
        sitemapCount = (text.match(/<loc>/g) || []).length;
      }
      if (r === '/en/' && resp.ok) {
        enHtml = text;
      }
      routeResults.push({ route: r, status: resp.status, ok: resp.status === 200, bytes: text.length });
    } catch (err) {
      routeResults.push({ route: r, status: 0, ok: false, error: String(err?.message || err) });
    }
  }

  // Verify live `_next/static/` CSS & JS assets referenced in `/en/` HTML
  const origin = new URL(LIVE_BASE).origin;
  const assetHrefs = new Set();
  const assetRegex = /(?:href|src)\s*=\s*["']([^"']*\/_next\/static\/[^"']+)["']/gi;
  let m;
  while ((m = assetRegex.exec(enHtml)) !== null && assetHrefs.size < 4) {
    assetHrefs.add(m[1]);
  }
  const assetResults = [];
  for (const assetPath of assetHrefs) {
    const assetUrl = assetPath.startsWith('http') ? assetPath : `${origin}${assetPath}`;
    try {
      const resp = await fetchWithTimeout(
        assetUrl,
        { method: 'HEAD', headers: { 'User-Agent': USER_AGENT } },
        15000,
      );
      assetResults.push({ asset: assetPath, status: resp.status, ok: resp.status === 200 });
    } catch (err) {
      assetResults.push({ asset: assetPath, status: 0, ok: false, error: String(err?.message || err) });
    }
  }

  const failedRoutes = routeResults.filter((x) => !x.ok);
  const failedAssets = assetResults.filter((x) => !x.ok);
  const assetsOk = assetResults.length > 0 && failedAssets.length === 0;
  const expectedUrls = manifest.page_budget?.total_en_pages || 0;

  return {
    live_base: LIVE_BASE,
    checked_routes: routeResults.length,
    failed_routes: failedRoutes,
    checked_static_assets: assetResults.length,
    failed_static_assets: failedAssets,
    static_assets_ok: assetsOk,
    sitemap_live_urls: sitemapCount,
    manifest_expected_urls: expectedUrls,
    sitemap_synced: sitemapCount === expectedUrls,
    ok: failedRoutes.length === 0 && assetsOk && sitemapCount === expectedUrls,
  };
}

function fetchOpenAuditIssues() {
  try {
    const raw = execSync(
      `gh issue list -R ${REPO_SLUG} --state open --limit 50 --json number,title,url,createdAt,labels`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const allOpen = JSON.parse(raw);
    const auditIssues = allOpen.filter((iss) =>
      String(iss.title || '').toLowerCase().includes('[pinout/spec audit]'),
    );
    return {
      ok: true,
      total_open: allOpen.length,
      issues: auditIssues,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      total_open: null,
      issues: [],
      error: String(err?.stderr || err?.message || err).trim().slice(0, 160),
    };
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
  const issuesRes = fetchOpenAuditIssues();

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
      static_assets_ok: live.static_assets_ok,
      issues_check_ok: issuesRes.ok,
      open_audit_issues: issuesRes.ok ? issuesRes.issues.length : null,
    },
    pdfs: {
      broken: brokenPdfs,
      revision_drifts: changedPdfs,
      details: pdfChecks,
    },
    live,
    issues_check: issuesRes,
    open_issues: issuesRes.issues,
  };

  fs.mkdirSync(path.dirname(HEALTH_OUT), { recursive: true });
  fs.writeFileSync(HEALTH_OUT, JSON.stringify(report, null, 2) + '\n', 'utf8');

  const issueValueCell = issuesRes.ok
    ? `${issuesRes.issues.length} audit issues (${issuesRes.total_open} total open)`
    : `ERROR: ${issuesRes.error}`;
  const issueStatusCell = !issuesRes.ok
    ? 'GH_CLI_ERROR'
    : issuesRes.issues.length === 0
      ? 'CLEAR'
      : 'HEAL_PENDING';

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
    `| **Live Production CDN (${LIVE_BASE})** | ${live.checked_routes - live.failed_routes.length}/${live.checked_routes} HTTP 200 · _next/static ${live.checked_static_assets - live.failed_static_assets.length}/${live.checked_static_assets} (sitemap=${live.sitemap_live_urls}) | ${live.ok ? 'LIVE_OK' : 'DEGRADED'} |`,
    `| **Open Reader Audit Issues (`[Pinout/Spec Audit]`)** | ${issueValueCell} | ${issueStatusCell} |`,
    '',
  ].join('\n');

  fs.writeFileSync(OPS_DOC, md, 'utf8');
  console.log(JSON.stringify(report.summary, null, 2));
  if (brokenPdfs.length > 0 || !live.ok) {
    process.exitCode = 1;
  }
}

main();
