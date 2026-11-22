#!/usr/bin/env node
/**
 * Stage 5: Automated Static Build & Compliance QA Gate (AUD-01..AUD-06)
 *
 * Audits the built Next.js static export (`web/out/` by default) against `data/pilot-manifest.json`:
 *   1. Exact 200 canonical EN URLs in `sitemap.xml` matching `data/pilot-manifest.json`
 *      (50 part + 50 alt + 85 vs + 15 static).
 *   2. Every URL in sitemap resolves to an existing non-empty HTML file in `outDir`.
 *   3. Zero `NaN`, `undefined`, `[object Object]`, or empty `<td>` table cells across all 200 pages
 *      (inspecting visible rendered HTML after stripping `<script>`/`<style>`/comments so Next.js
 *      RSC flight payloads do not trigger false positives).
 *   4. Every page contains mandatory AUD-04 engineering disclaimer phrases (`Verify pinout` and
 *      `Not approved for medical`), exact `<link rel="canonical">`, and valid JSON-LD
 *      (`<script type="application/ld+json">`) with ZERO `FAQPage` types per AUD-06.
 *   5. Zero broken internal `/en/...` href links across all 200 pages.
 *   6. Every `/en/vs/` URL enforces alphabetical `slugA < slugB` order with zero reversed duplicates.
 *   7. Every `/en/part/` page contains an embedded pinout `<svg>` diagram and >= 12 spec rows.
 *
 * Usage:
 *   node pipeline/stage5_qa_gate.mjs
 *   node pipeline/stage5_qa_gate.mjs --out-dir web/out --manifest data/pilot-manifest.json
 *   node pipeline/stage5_qa_gate.mjs --out-dir web/out --json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function decodeBasicEntities(str) {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function stripNonVisibleBlocks(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function extractVisibleText(visibleHtml) {
  return decodeBasicEntities(visibleHtml.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveRouteToHtmlFile(outDir, routePath) {
  const clean = routePath.replace(/^\/+|\/+$/g, '');
  const candidates =
    clean === ''
      ? [path.join(outDir, 'index.html')]
      : [
          path.join(outDir, `${clean}.html`),
          path.join(outDir, clean, 'index.html'),
        ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function resolveInternalHref(outDir, rawHref) {
  const stripped = rawHref.split('#')[0].split('?')[0];
  if (!stripped || !stripped.startsWith('/en')) return { checked: false, ok: true };

  // Direct file match (e.g. static asset under /en/...)
  const cleanRel = stripped.replace(/^\/+/, '');
  const directPath = path.join(outDir, cleanRel);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return { checked: true, ok: true, target: directPath };
  }

  const htmlFile = resolveRouteToHtmlFile(outDir, stripped);
  return { checked: true, ok: Boolean(htmlFile), target: htmlFile };
}

function parseSitemapUrls(sitemapXml) {
  const urls = [];
  const locRegex = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(sitemapXml)) !== null) {
    urls.push(decodeBasicEntities(match[1].trim()));
  }
  return urls;
}

function extractCanonicalHrefs(html) {
  const results = [];
  const linkRegex = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    const tag = m[0];
    if (/\brel\s*=\s*["']canonical["']/i.test(tag)) {
      const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
      if (hrefMatch) {
        results.push(decodeBasicEntities(hrefMatch[1].trim()));
      }
    }
  }
  return results;
}

function collectJsonLdTypes(node, acc = []) {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdTypes(item, acc);
    return acc;
  }
  if (node['@type']) {
    if (Array.isArray(node['@type'])) {
      for (const t of node['@type']) acc.push(String(t));
    } else {
      acc.push(String(node['@type']));
    }
  }
  for (const val of Object.values(node)) {
    if (val && typeof val === 'object') {
      collectJsonLdTypes(val, acc);
    }
  }
  return acc;
}

function auditJsonLd(html) {
  const scriptRegex =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  const errors = [];
  const allTypes = [];
  let m;
  while ((m = scriptRegex.exec(html)) !== null) {
    const raw = m[1].trim();
    blocks.push(raw);
    try {
      const parsed = JSON.parse(raw);
      collectJsonLdTypes(parsed, allTypes);
    } catch (err) {
      errors.push(`Invalid JSON-LD JSON: ${err.message}`);
    }
  }

  if (blocks.length === 0) {
    errors.push('Missing <script type="application/ld+json"> block');
  }
  const hasFaqPage = allTypes.some((t) => t.toLowerCase() === 'faqpage');
  if (hasFaqPage) {
    errors.push('Forbidden JSON-LD @type "FAQPage" detected (violates AUD-06)');
  }

  return {
    count: blocks.length,
    types: allTypes,
    errors,
  };
}

function findEmptyTableCells(visibleHtml) {
  const tdRegex = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  let emptyCount = 0;
  let totalCount = 0;
  let m;
  while ((m = tdRegex.exec(visibleHtml)) !== null) {
    totalCount++;
    const inner = m[1];
    // Allow non-text graphical or form/icon content inside cells
    if (/<(svg|img|input|button|canvas)\b/i.test(inner)) {
      continue;
    }
    const text = extractVisibleText(inner);
    if (text.length === 0) {
      emptyCount++;
    }
  }
  return { totalCount, emptyCount };
}

function hasPinoutSvg(visibleHtml) {
  const svgRegex = /<svg\b[^>]*>([\s\S]*?)<\/svg>/gi;
  let totalSvgs = 0;
  let pinoutLikeSvgs = 0;
  let m;
  while ((m = svgRegex.exec(visibleHtml)) !== null) {
    totalSvgs++;
    const body = m[1];
    const hasText = /<text\b/i.test(body);
    const hasGeometry = /<(rect|circle|path|polygon|line)\b/i.test(body);
    if (hasText && hasGeometry) {
      pinoutLikeSvgs++;
    }
  }
  return { totalSvgs, pinoutLikeSvgs, ok: pinoutLikeSvgs > 0 };
}

function countPartSpecRows(visibleHtml) {
  // Check explicit data-spec-row markers first if rendered by frontend
  const markedRows = (visibleHtml.match(/\bdata-spec-row\b/gi) || []).length;

  const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let specTableRows = 0;
  let totalTableDataRows = 0;
  let m;
  while ((m = tableRegex.exec(visibleHtml)) !== null) {
    const tableHtml = m[1];
    const headerRegion =
      tableHtml.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] ||
      tableHtml.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1] ||
      '';
    const headerText = extractVisibleText(headerRegion).toLowerCase();

    const bodyRegion =
      tableHtml.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] || tableHtml;
    const rows = bodyRegion.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
    const dataRows = rows.filter((r) => /<td\b/i.test(r)).length;
    totalTableDataRows += dataRows;

    // Exclude pure pinout / gotcha tables from spec row count so a 14-pin pinout table
    // cannot mask missing electrical specifications.
    const isPinoutTable =
      /\bpin\b/.test(headerText) &&
      (/\brole\b/.test(headerText) || /\bdescription\b/.test(headerText) || /\bfunction\b/.test(headerText)) &&
      !/\bvalue\b/.test(headerText) &&
      !/\bparameter\b/.test(headerText) &&
      !/\bspec/.test(headerText);

    if (!isPinoutTable) {
      specTableRows += dataRows;
    }
  }

  const dtCount = (visibleHtml.match(/<dt\b[^>]*>/gi) || []).length;
  const effectiveSpecRows = Math.max(markedRows, specTableRows, dtCount);
  return {
    effectiveSpecRows,
    markedRows,
    specTableRows,
    totalTableDataRows,
    dtCount,
  };
}

function extractInternalHrefs(visibleHtml) {
  const hrefs = [];
  const hrefRegex = /\bhref\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = hrefRegex.exec(visibleHtml)) !== null) {
    const href = decodeBasicEntities(m[1].trim());
    if (href.startsWith('/en')) {
      hrefs.push(href);
    }
  }
  return hrefs;
}

function buildExpectedCanonicalUrls(manifest, siteUrl) {
  const base = siteUrl.replace(/\/+$/, '');
  const urls = [];

  for (const part of manifest.parts || []) {
    urls.push(`${base}/en/part/${part.slug}`);
  }
  for (const part of manifest.parts || []) {
    urls.push(`${base}/en/alt/${part.slug}-alternatives`);
  }
  for (const pair of manifest.vs_pairs || []) {
    urls.push(`${base}/en/vs/${pair.slug}`);
  }
  const staticRoutes = manifest.static_routes || {};
  for (const group of ['hubs', 'tools', 'guides', 'trust_pages']) {
    for (const route of staticRoutes[group] || []) {
      const normalized = route.startsWith('/') ? route : `/${route}`;
      urls.push(`${base}${normalized}`);
    }
  }

  return urls;
}

function collectDiskVsSlugs(outDir) {
  const vsDir = path.join(outDir, 'en', 'vs');
  if (!fs.existsSync(vsDir)) return [];
  const slugs = [];
  for (const entry of fs.readdirSync(vsDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      slugs.push(entry.name.replace(/\.html$/, ''));
    } else if (entry.isDirectory()) {
      if (fs.existsSync(path.join(vsDir, entry.name, 'index.html'))) {
        slugs.push(entry.name);
      }
    }
  }
  return slugs.sort();
}

export function runQaGate({
  outDir = path.resolve('web/out'),
  manifestPath = path.resolve('data/pilot-manifest.json'),
  siteConfigPath = path.resolve('config/site-config.json'),
} = {}) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }
  if (!fs.existsSync(outDir)) {
    throw new Error(`Static output directory not found: ${outDir}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let siteUrl = 'https://pin2pin.dev';
  if (fs.existsSync(siteConfigPath)) {
    const siteCfg = JSON.parse(fs.readFileSync(siteConfigPath, 'utf8'));
    if (siteCfg.site_url) siteUrl = siteCfg.site_url;
  }

  const expectedUrls = buildExpectedCanonicalUrls(manifest, siteUrl);
  const expectedSet = new Set(expectedUrls);
  const expectedTotal = manifest.page_budget?.total_en_pages ?? expectedUrls.length;

  const gates = {
    gate1_sitemap_urls: { pass: true, expected: expectedTotal, actual: 0, errors: [] },
    gate2_html_resolution: { pass: true, checked: 0, missing: [], errors: [] },
    gate3_clean_render_and_tables: { pass: true, pages_checked: 0, errors: [] },
    gate4_disclaimer_canonical_jsonld: { pass: true, pages_checked: 0, errors: [] },
    gate5_internal_links: { pass: true, links_checked: 0, broken: [], errors: [] },
    gate6_vs_alphabetical_order: { pass: true, vs_checked: 0, errors: [] },
    gate7_part_svg_and_spec_rows: { pass: true, part_pages_checked: 0, errors: [] },
  };

  // Gate 1: sitemap.xml exact canonical URL audit
  const sitemapPath = path.join(outDir, 'sitemap.xml');
  let sitemapUrls = [];
  if (!fs.existsSync(sitemapPath)) {
    gates.gate1_sitemap_urls.pass = false;
    gates.gate1_sitemap_urls.errors.push(`Missing sitemap.xml at ${sitemapPath}`);
  } else {
    const sitemapXml = fs.readFileSync(sitemapPath, 'utf8');
    sitemapUrls = parseSitemapUrls(sitemapXml);
    gates.gate1_sitemap_urls.actual = sitemapUrls.length;

    const seenSitemap = new Set();
    const duplicates = [];
    for (const u of sitemapUrls) {
      if (seenSitemap.has(u)) duplicates.push(u);
      seenSitemap.add(u);
    }

    const missingFromSitemap = expectedUrls.filter((u) => !seenSitemap.has(u));
    const unexpectedInSitemap = sitemapUrls.filter((u) => !expectedSet.has(u));

    if (sitemapUrls.length !== expectedTotal) {
      gates.gate1_sitemap_urls.errors.push(
        `Sitemap URL count mismatch: expected ${expectedTotal}, found ${sitemapUrls.length}.`,
      );
    }
    if (duplicates.length > 0) {
      gates.gate1_sitemap_urls.errors.push(
        `Duplicate URLs in sitemap.xml (${duplicates.length}): ${duplicates.slice(0, 5).join(', ')}`,
      );
    }
    if (missingFromSitemap.length > 0) {
      gates.gate1_sitemap_urls.errors.push(
        `Missing ${missingFromSitemap.length} expected URL(s) in sitemap.xml: ${missingFromSitemap.slice(0, 5).join(', ')}`,
      );
    }
    if (unexpectedInSitemap.length > 0) {
      gates.gate1_sitemap_urls.errors.push(
        `Unexpected ${unexpectedInSitemap.length} extra URL(s) in sitemap.xml: ${unexpectedInSitemap.slice(0, 5).join(', ')}`,
      );
    }
    gates.gate1_sitemap_urls.pass = gates.gate1_sitemap_urls.errors.length === 0;
  }

  // Audit all expected URLs (and any sitemap URLs) on disk
  const urlsToAudit = sitemapUrls.length > 0 ? [...new Set([...expectedUrls, ...sitemapUrls])] : expectedUrls;
  const partSlugSet = new Set((manifest.parts || []).map((p) => p.slug));
  const seenVsUnorderedPairs = new Map();
  const vsSlugsToCheck = new Set(collectDiskVsSlugs(outDir));

  for (const fullUrl of urlsToAudit) {
    let parsedUrl;
    try {
      parsedUrl = new URL(fullUrl);
    } catch {
      gates.gate2_html_resolution.errors.push(`Invalid URL in sitemap: ${fullUrl}`);
      continue;
    }

    const routePath = parsedUrl.pathname;
    if (routePath.startsWith('/en/vs/')) {
      vsSlugsToCheck.add(routePath.replace(/^\/en\/vs\//, '').replace(/\/+$/, ''));
    }

    // Gate 2: Resolve HTML file
    gates.gate2_html_resolution.checked++;
    const htmlFile = resolveRouteToHtmlFile(outDir, routePath);
    if (!htmlFile) {
      gates.gate2_html_resolution.missing.push(routePath);
      gates.gate2_html_resolution.errors.push(`Missing HTML file for ${routePath}`);
      continue;
    }

    const html = fs.readFileSync(htmlFile, 'utf8');
    if (html.trim().length < 200) {
      gates.gate2_html_resolution.errors.push(`HTML file unexpectedly tiny (${html.length} bytes): ${routePath}`);
    }

    const visibleHtml = stripNonVisibleBlocks(html);
    const visibleText = extractVisibleText(visibleHtml);

    // Gate 3: Zero NaN, undefined, [object Object], or empty <td> cells
    gates.gate3_clean_render_and_tables.pages_checked++;
    if (/\bNaN\b/.test(visibleText)) {
      gates.gate3_clean_render_and_tables.errors.push(`${routePath}: Visible "NaN" detected`);
    }
    if (/\bundefined\b/.test(visibleText)) {
      gates.gate3_clean_render_and_tables.errors.push(`${routePath}: Visible "undefined" detected`);
    }
    if (/\[object Object\]/.test(visibleText)) {
      gates.gate3_clean_render_and_tables.errors.push(`${routePath}: Visible "[object Object]" detected`);
    }
    const cellCheck = findEmptyTableCells(visibleHtml);
    if (cellCheck.emptyCount > 0) {
      gates.gate3_clean_render_and_tables.errors.push(
        `${routePath}: ${cellCheck.emptyCount} empty <td> cell(s) detected`,
      );
    }

    // Gate 4: AUD-04 disclaimer, canonical link, valid JSON-LD (zero FAQPage)
    gates.gate4_disclaimer_canonical_jsonld.pages_checked++;
    const lowerText = visibleText.toLowerCase();
    if (!lowerText.includes('verify pinout')) {
      gates.gate4_disclaimer_canonical_jsonld.errors.push(
        `${routePath}: Missing AUD-04 disclaimer phrase "Verify pinout"`,
      );
    }
    if (!lowerText.includes('not approved for medical')) {
      gates.gate4_disclaimer_canonical_jsonld.errors.push(
        `${routePath}: Missing AUD-04 safety-critical phrase "Not approved for medical"`,
      );
    }

    const canonicals = extractCanonicalHrefs(html);
    if (canonicals.length !== 1) {
      gates.gate4_disclaimer_canonical_jsonld.errors.push(
        `${routePath}: Expected exactly 1 <link rel="canonical">, found ${canonicals.length}`,
      );
    } else if (canonicals[0] !== fullUrl) {
      gates.gate4_disclaimer_canonical_jsonld.errors.push(
        `${routePath}: Canonical mismatch (expected "${fullUrl}", got "${canonicals[0]}")`,
      );
    }

    const jsonLdRes = auditJsonLd(html);
    for (const err of jsonLdRes.errors) {
      gates.gate4_disclaimer_canonical_jsonld.errors.push(`${routePath}: ${err}`);
    }

    // Gate 5: Internal /en/... href integrity
    const internalHrefs = extractInternalHrefs(visibleHtml);
    for (const href of internalHrefs) {
      gates.gate5_internal_links.links_checked++;
      const resolved = resolveInternalHref(outDir, href);
      if (resolved.checked && !resolved.ok) {
        const entry = `${routePath} -> ${href}`;
        gates.gate5_internal_links.broken.push(entry);
        gates.gate5_internal_links.errors.push(`Broken internal link: ${entry}`);
      }
    }

    // Gate 7: /en/part/ SVG pinout + >= 12 spec rows
    if (routePath.startsWith('/en/part/')) {
      gates.gate7_part_svg_and_spec_rows.part_pages_checked++;
      const svgRes = hasPinoutSvg(visibleHtml);
      if (!svgRes.ok) {
        gates.gate7_part_svg_and_spec_rows.errors.push(
          `${routePath}: Missing embedded pinout <svg> diagram (totalSvgs=${svgRes.totalSvgs}, pinoutLike=${svgRes.pinoutLikeSvgs})`,
        );
      }
      const specRes = countPartSpecRows(visibleHtml);
      if (specRes.effectiveSpecRows < 12) {
        gates.gate7_part_svg_and_spec_rows.errors.push(
          `${routePath}: Only ${specRes.effectiveSpecRows} spec row(s) found (minimum 12 required)`,
        );
      }
    }
  }

  // Gate 6: Alphabetical /en/vs/ slug enforcement & zero reversed duplicates
  for (const vsSlug of [...vsSlugsToCheck].sort()) {
    gates.gate6_vs_alphabetical_order.vs_checked++;
    const parts = vsSlug.split('-vs-');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      gates.gate6_vs_alphabetical_order.errors.push(
        `/en/vs/${vsSlug}: Malformed vs slug (expected "<slugA>-vs-<slugB>")`,
      );
      continue;
    }
    const [slugA, slugB] = parts;
    if (!(slugA < slugB)) {
      gates.gate6_vs_alphabetical_order.errors.push(
        `/en/vs/${vsSlug}: Violates alphabetical order (expected "${slugB}-vs-${slugA}")`,
      );
    }
    if (partSlugSet.size > 0 && (!partSlugSet.has(slugA) || !partSlugSet.has(slugB))) {
      gates.gate6_vs_alphabetical_order.errors.push(
        `/en/vs/${vsSlug}: References unknown manifest part slug(s)`,
      );
    }
    const unorderedKey = slugA < slugB ? `${slugA}|${slugB}` : `${slugB}|${slugA}`;
    if (seenVsUnorderedPairs.has(unorderedKey)) {
      gates.gate6_vs_alphabetical_order.errors.push(
        `/en/vs/${vsSlug}: Duplicate/reversed pair conflicts with /en/vs/${seenVsUnorderedPairs.get(unorderedKey)}`,
      );
    } else {
      seenVsUnorderedPairs.set(unorderedKey, vsSlug);
    }
  }

  // Finalize per-gate pass flags
  gates.gate2_html_resolution.pass = gates.gate2_html_resolution.errors.length === 0;
  gates.gate3_clean_render_and_tables.pass = gates.gate3_clean_render_and_tables.errors.length === 0;
  gates.gate4_disclaimer_canonical_jsonld.pass =
    gates.gate4_disclaimer_canonical_jsonld.errors.length === 0;
  gates.gate5_internal_links.pass = gates.gate5_internal_links.errors.length === 0;
  gates.gate6_vs_alphabetical_order.pass = gates.gate6_vs_alphabetical_order.errors.length === 0;
  gates.gate7_part_svg_and_spec_rows.pass = gates.gate7_part_svg_and_spec_rows.errors.length === 0;

  const allPassed = Object.values(gates).every((g) => g.pass);
  const totalErrors = Object.values(gates).reduce((sum, g) => sum + g.errors.length, 0);

  return {
    passed: allPassed,
    total_errors: totalErrors,
    out_dir: outDir,
    manifest_path: manifestPath,
    robots_txt_present: fs.existsSync(path.join(outDir, 'robots.txt')),
    audited_at: new Date().toISOString(),
    gates,
  };
}

function parseCliArgs(argv) {
  const opts = {
    outDir: path.resolve('web/out'),
    manifestPath: path.resolve('data/pilot-manifest.json'),
    siteConfigPath: path.resolve('config/site-config.json'),
    jsonOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out-dir' && argv[i + 1]) {
      opts.outDir = path.resolve(argv[++i]);
    } else if (arg === '--manifest' && argv[i + 1]) {
      opts.manifestPath = path.resolve(argv[++i]);
    } else if (arg === '--site-config' && argv[i + 1]) {
      opts.siteConfigPath = path.resolve(argv[++i]);
    } else if (arg === '--json') {
      opts.jsonOnly = true;
    }
  }
  return opts;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  try {
    const opts = parseCliArgs(process.argv.slice(2));
    const report = runQaGate(opts);

    if (opts.jsonOnly) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('=== Stage 5 Automated QA Gate Report ===');
      for (const [name, gate] of Object.entries(report.gates)) {
        const badge = gate.pass ? 'PASS' : 'FAIL';
        console.log(`[${badge}] ${name} (errors=${gate.errors.length})`);
        for (const err of gate.errors.slice(0, 10)) {
          console.log(`       - ${err}`);
        }
        if (gate.errors.length > 10) {
          console.log(`       ... +${gate.errors.length - 10} more error(s)`);
        }
      }
      console.log('\nJSON Summary:');
      console.log(
        JSON.stringify(
          {
            passed: report.passed,
            total_errors: report.total_errors,
            robots_txt_present: report.robots_txt_present,
            sitemap_urls: `${report.gates.gate1_sitemap_urls.actual}/${report.gates.gate1_sitemap_urls.expected}`,
            html_checked: report.gates.gate2_html_resolution.checked,
            internal_links_checked: report.gates.gate5_internal_links.links_checked,
            vs_checked: report.gates.gate6_vs_alphabetical_order.vs_checked,
            part_pages_checked: report.gates.gate7_part_svg_and_spec_rows.part_pages_checked,
          },
          null,
          2,
        ),
      );
      console.log(
        `\nOVERALL RESULT: ${report.passed ? 'ALL 7 QA GATES PASSED' : `FAILED (${report.total_errors} total error(s))`}`,
      );
    }

    process.exit(report.passed ? 0 : 1);
  } catch (err) {
    console.error(`Stage 5 QA Gate ERROR: ${err.message}`);
    process.exit(1);
  }
}
