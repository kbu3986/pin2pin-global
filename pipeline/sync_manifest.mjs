#!/usr/bin/env node
/**
 * Autonomous Manifest Synchronizer (Drip-Feed Safe)
 *
 * Scans `data/parts/**\/*.json`, `data/guides/*.json`, and `data/trust/*.json` and updates
 * `data/pilot-manifest.json` deterministically:
 *  - Preserves all existing parts and existing `vs_pairs` (zero URL rot / 404).
 *  - Appends newly verified parts in deterministic order.
 *  - Auto-includes every legitimate symmetric Level 1 Candidate Drop-In pair (and prioritizes
 *    directional L1 replacements) so true drop-in pairs always have dedicated `/en/vs/` pages.
 *  - For each newly added part, selects up to `max_new_vs_per_part` (default 3) high-value
 *    same-category comparisons (penalizing op-amp vs comparator, boost vs buck, fixed Vout
 *    mismatch, and pinout mismatch) with strict alphabetical ordering (`part_a < part_b`) per AUD-06.
 *  - Keeps `static_routes` synced with all hubs (`/en`, `/en/catalog`, `/en/tools`, `/en/guides`),
 *    all 7 engineering tools, all verified guides, and all trust pages.
 *  - Recalculates `page_budget` accurately and marks completed OPNs in `data/expansion-backlog.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { verifyGoldenPart } from './stage2_physics_verifier.mjs';
import { evaluateCompatibility, evaluateReplacement } from './stage3_xref_engine.mjs';

const MANIFEST_PATH = path.resolve('data/pilot-manifest.json');
const BACKLOG_PATH = path.resolve('data/expansion-backlog.json');
const PARTS_DIR = path.resolve('data/parts');
const GUIDES_DIR = path.resolve('data/guides');
const TRUST_DIR = path.resolve('data/trust');

const MAX_NEW_VS_PER_PART = 3;

const REQUIRED_HUB_ROUTES = [
  '/en',
  '/en/catalog',
  '/en/compare',
  '/en/packages',
  '/en/vs',
  '/en/tools',
  '/en/guides',
];

const REQUIRED_TOOL_ROUTES = [
  '/en/tools/bom-checker',
  '/en/tools/compare',
  '/en/tools/pinout-finder',
  '/en/tools/feedback-divider',
  '/en/tools/ldo-thermal-calculator',
  '/en/tools/dcdc-efficiency-ripple-calculator',
  '/en/tools/opamp-gbwp-slewrate-checker',
];

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

export function pairSimilarityScore(a, b) {
  const evalSym = evaluateCompatibility(a, b);
  const evalAB = evaluateReplacement(a, b);
  const evalBA = evaluateReplacement(b, a);

  let score = 0;

  // Compatibility & physical pinout weighting
  if (evalSym.compatibility_level === 'LEVEL_1_CANDIDATE_DROP_IN') score += 90;
  else if (
    evalAB.compatibility_level === 'LEVEL_1_CANDIDATE_DROP_IN' ||
    evalBA.compatibility_level === 'LEVEL_1_CANDIDATE_DROP_IN'
  ) {
    score += 70;
  } else if (evalSym.compatibility_level === 'LEVEL_2_TUNING_REQUIRED') {
    score += 45;
  } else {
    score -= 25;
  }

  if (a.package.code === b.package.code) score += 45;
  else if (a.package.pin_count === b.package.pin_count) score += 20;
  else score -= 25;

  if (evalSym.pinout_exact_match) score += 35;
  else score -= 30;

  if (evalSym.exposed_pad_match) score += 10;
  else score -= 20;

  if (a.sub_topology === b.sub_topology) score += 20;
  if (a.manufacturer !== b.manufacturer) score += 8; // cross-vendor second-source value
  if (a.family !== b.family) score += 5;

  if (a.category === 'ldo' && b.category === 'ldo') {
    if (a.specs.vout_fixed && b.specs.vout_fixed) {
      if (Math.abs(a.specs.vout_v.value - b.specs.vout_v.value) <= 0.05) score += 15;
      else score -= 50; // penalize fixed Vout mismatch (e.g. 3.3V vs 5.0V)
    } else if (a.specs.vout_fixed !== b.specs.vout_fixed) {
      score -= 30;
    }
    const ratio =
      Math.min(a.specs.iout_max_ma.value, b.specs.iout_max_ma.value) /
      Math.max(a.specs.iout_max_ma.value, b.specs.iout_max_ma.value, 1);
    score += Math.round(ratio * 10);
  } else if (a.category === 'dcdc' && b.category === 'dcdc') {
    if (a.specs.topology === b.specs.topology) score += 25;
    else score -= 85; // strongly penalize boost vs buck
    if (a.specs.synchronous === b.specs.synchronous) score += 10;
    else score -= 20;
    if (a.specs.vout_fixed && b.specs.vout_fixed) {
      const va = a.specs.vout_nom_v?.value ?? a.specs.vout_min_v.value;
      const vb = b.specs.vout_nom_v?.value ?? b.specs.vout_min_v.value;
      if (Math.abs(va - vb) > 0.05) score -= 50;
    }
    const vinOverlap =
      Math.min(a.specs.vin_max_v.value, b.specs.vin_max_v.value) >
      Math.max(a.specs.vin_min_v.value, b.specs.vin_min_v.value);
    if (vinOverlap) score += 10;
  } else if (a.category === 'opamp' && b.category === 'opamp') {
    if (a.specs.channels === b.specs.channels) score += 25;
    else score -= 40;
    if (a.specs.device_kind === b.specs.device_kind) score += 20;
    else score -= 90; // strongly penalize op-amp vs comparator
    if (a.specs.output_type === b.specs.output_type) score += 10;
    else score -= 15;
  }

  return score;
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const partFiles = collectJsonFiles(PARTS_DIR);
const loadedParts = new Map();

for (const file of partFiles) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const check = verifyGoldenPart(raw, path.relative(process.cwd(), file));
  if (!check.ok) {
    console.error(`SYNC ABORTED: Invalid Golden Part ${file}:\n  - ${check.errors.join('\n  - ')}`);
    process.exit(1);
  }
  if (loadedParts.has(raw.slug)) {
    console.error(`SYNC ABORTED: Duplicate slug ${raw.slug}`);
    process.exit(1);
  }
  const relBatch = path.basename(path.dirname(file));
  loadedParts.set(raw.slug, { part: raw, batch: relBatch });
}

// 1. Preserve existing manifest part order and update metadata
const existingSlugs = new Set();
const syncedParts = [];
for (const entry of manifest.parts) {
  if (!loadedParts.has(entry.slug)) continue;
  const { part, batch } = loadedParts.get(entry.slug);
  existingSlugs.add(entry.slug);
  syncedParts.push({
    idx: syncedParts.length + 1,
    batch: entry.batch || batch,
    category: part.category,
    opn: part.opn,
    slug: part.slug,
    family: part.family,
    manufacturer: part.manufacturer,
    expected_package: part.package.code,
    hint_pdf_url: part.datasheet.pdf_url,
    hint_product_url: part.datasheet.product_page_url,
  });
}

// 2. Append newly verified parts
const newlyAddedSlugs = [];
for (const [slug, { part, batch }] of [...loadedParts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (existingSlugs.has(slug)) continue;
  newlyAddedSlugs.push(slug);
  syncedParts.push({
    idx: syncedParts.length + 1,
    batch,
    category: part.category,
    opn: part.opn,
    slug: part.slug,
    family: part.family,
    manufacturer: part.manufacturer,
    expected_package: part.package.code,
    hint_pdf_url: part.datasheet.pdf_url,
    hint_product_url: part.datasheet.product_page_url,
  });
}

// 3. Preserve existing vs_pairs (strictly alphabetical)
const vsSeen = new Set();
const syncedVs = [];
for (const pair of manifest.vs_pairs || []) {
  if (!loadedParts.has(pair.part_a) || !loadedParts.has(pair.part_b)) continue;
  const [sa, sb] = [pair.part_a, pair.part_b].sort();
  const slug = `${sa}-vs-${sb}`;
  if (vsSeen.has(slug)) continue;
  vsSeen.add(slug);
  syncedVs.push({
    slug,
    category: loadedParts.get(sa).part.category,
    part_a: sa,
    part_b: sb,
  });
}

// 4a. Auto-include all legitimate symmetric Level 1 Candidate Drop-In pairs across the dataset
let autoL1VsCount = 0;
const allEntries = [...loadedParts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (let i = 0; i < allEntries.length; i++) {
  const [slugA, { part: partA }] = allEntries[i];
  for (let j = i + 1; j < allEntries.length; j++) {
    const [slugB, { part: partB }] = allEntries[j];
    if (partA.category !== partB.category) continue;
    const vsSlug = `${slugA}-vs-${slugB}`;
    if (vsSeen.has(vsSlug)) continue;
    const sym = evaluateCompatibility(partA, partB);
    if (sym.compatibility_level === 'LEVEL_1_CANDIDATE_DROP_IN') {
      vsSeen.add(vsSlug);
      syncedVs.push({
        slug: vsSlug,
        category: partA.category,
        part_a: slugA,
        part_b: slugB,
      });
      autoL1VsCount++;
    }
  }
}

// 4b. Deterministically generate up to MAX_NEW_VS_PER_PART pairs for each newly added part
let addedVsCount = autoL1VsCount;
for (const newSlug of newlyAddedSlugs) {
  const newPart = loadedParts.get(newSlug).part;
  const candidates = [];
  for (const [otherSlug, { part: otherPart }] of loadedParts.entries()) {
    if (otherSlug === newSlug || otherPart.category !== newPart.category) continue;
    const [sa, sb] = [newSlug, otherSlug].sort();
    const vsSlug = `${sa}-vs-${sb}`;
    if (vsSeen.has(vsSlug)) continue;
    candidates.push({
      otherSlug,
      vsSlug,
      sa,
      sb,
      score: pairSimilarityScore(newPart, otherPart),
    });
  }
  candidates.sort((x, y) => y.score - x.score || x.vsSlug.localeCompare(y.vsSlug));
  for (const pick of candidates.slice(0, MAX_NEW_VS_PER_PART)) {
    vsSeen.add(pick.vsSlug);
    syncedVs.push({
      slug: pick.vsSlug,
      category: newPart.category,
      part_a: pick.sa,
      part_b: pick.sb,
    });
    addedVsCount++;
  }
}

// 5. Sync static routes (hubs, all 7 tools preserved via toolsSet, guides, trust pages)
const guideSlugs = collectJsonFiles(GUIDES_DIR).map((f) => path.basename(f, '.json'));
const trustSlugs = collectJsonFiles(TRUST_DIR).map((f) => path.basename(f, '.json'));

const hubsSet = new Set(manifest.static_routes?.hubs || []);
for (const hub of REQUIRED_HUB_ROUTES) hubsSet.add(hub);

const toolsSet = new Set(manifest.static_routes?.tools || []);
for (const tool of REQUIRED_TOOL_ROUTES) toolsSet.add(tool);

const staticRoutes = {
  hubs: [...hubsSet],
  tools: [...toolsSet],
  guides: guideSlugs.map((s) => `/en/guides/${s}`),
  trust_pages: ['about', 'methodology', 'disclaimer', 'privacy', 'contact']
    .filter((s) => trustSlugs.includes(s))
    .map((s) => `/en/${s}`),
};

const staticCount = Object.values(staticRoutes).reduce((acc, arr) => acc + arr.length, 0);
const totalPages = syncedParts.length * 2 + syncedVs.length + staticCount;

const nextManifest = {
  manifest_version: '2.2.0',
  locale: 'en',
  updated_at: new Date().toISOString().slice(0, 10),
  page_budget: {
    part_pages: syncedParts.length,
    alt_pages: syncedParts.length,
    vs_pages: syncedVs.length,
    static_hub_tool_guide_trust_pages: staticCount,
    total_en_pages: totalPages,
  },
  parts: syncedParts,
  vs_pairs: syncedVs,
  static_routes: staticRoutes,
};

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(nextManifest, null, 2) + '\n', 'utf8');

// 6. Mark completed parts in expansion-backlog.json
if (fs.existsSync(BACKLOG_PATH)) {
  const backlog = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  let completedUpdated = 0;
  for (const item of backlog.items || []) {
    if (loadedParts.has(item.slug) && item.status !== 'completed') {
      item.status = 'completed';
      item.completed_at = today;
      completedUpdated++;
    }
  }
  backlog.updated_at = today;
  fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2) + '\n', 'utf8');
  if (completedUpdated > 0) {
    console.log(`Updated expansion-backlog.json: marked ${completedUpdated} OPN(s) completed.`);
  }
}

console.log(
  `Manifest synced PASS: parts=${syncedParts.length} (+${newlyAddedSlugs.length} new), alt=${syncedParts.length}, vs=${syncedVs.length} (+${addedVsCount} new, incl. ${autoL1VsCount} auto-L1), static=${staticCount} (${staticRoutes.hubs.length} hubs, ${staticRoutes.tools.length} tools, ${staticRoutes.guides.length} guides, ${staticRoutes.trust_pages.length} trust), TOTAL=${totalPages} EN pages.`,
);
