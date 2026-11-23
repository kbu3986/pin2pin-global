import fs from 'node:fs';
import path from 'node:path';
import type {
  AltHubV2,
  BomIndexPart,
  CatalogPartRow,
  EngineeringGuide,
  GoldenPartV2,
  PartCategory,
  PilotManifest,
  SearchIndexItem,
  SiteConfig,
  ToolEntry,
  VsDirectoryItem,
  TrustPageDoc,
  TrustSlug,
  VsComparisonV2,
} from '@/types/schema';
import {
  MOCK_SMOKE_ALT,
  MOCK_SMOKE_GUIDES,
  MOCK_SMOKE_PARTS,
  MOCK_SMOKE_TRUST,
  MOCK_SMOKE_VS,
} from '@/lib/mock-fallback';
import {
  GUIDES_HUB_HREF,
  SITE_TOOLS,
  TOOLS_HUB_HREF,
  fmtNum,
  maxIsoDate,
  normalizeSearchText,
  type CommandSearchItem,
} from '@/lib/format';

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'config', 'site-config.json'))) {
    return cwd;
  }
  const parent = path.resolve(cwd, '..');
  if (fs.existsSync(path.join(parent, 'config', 'site-config.json'))) {
    return parent;
  }
  return parent;
}

const REPO_ROOT = resolveRepoRoot();

function collectJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results.sort();
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

let cachedSiteConfig: SiteConfig | null = null;
let cachedManifest: PilotManifest | null = null;
let cachedParts: GoldenPartV2[] | null = null;
let cachedAltHubs: AltHubV2[] | null = null;
let cachedVsComparisons: VsComparisonV2[] | null = null;
let cachedGuides: EngineeringGuide[] | null = null;
let cachedTrustDocs: TrustPageDoc[] | null = null;
let warnedMockParts = false;
let warnedMockAlt = false;
let warnedMockVs = false;
let warnedMockGuides = false;
let warnedMockTrust = false;

export function getSiteConfig(): SiteConfig {
  if (!cachedSiteConfig) {
    const raw = readJsonFile<SiteConfig & { live_site_url?: string; base_path?: string }>(
      path.join(REPO_ROOT, 'config', 'site-config.json'),
    );
    const envSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
    const envBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').trim().replace(/\/+$/, '');
    const fallbackUrl =
      !envSiteUrl && envBasePath && raw.live_site_url
        ? raw.live_site_url.replace(/\/+$/, '')
        : raw.site_url.replace(/\/+$/, '');
    cachedSiteConfig = {
      ...raw,
      site_url: envSiteUrl || fallbackUrl,
    };
  }
  return cachedSiteConfig;
}

export function getPilotManifest(): PilotManifest {
  if (!cachedManifest) {
    cachedManifest = readJsonFile<PilotManifest>(
      path.join(REPO_ROOT, 'data', 'pilot-manifest.json'),
    );
  }
  return cachedManifest;
}

export function getAllParts(): GoldenPartV2[] {
  if (cachedParts) return cachedParts;
  const partsDir = path.join(REPO_ROOT, 'data', 'parts');
  const files = collectJsonFiles(partsDir);
  if (files.length > 0) {
    cachedParts = files
      .map((f) => readJsonFile<GoldenPartV2>(f))
      .filter((p) => p && typeof p.slug === 'string' && p.schema_version === '2.0.0')
      .sort((a, b) => a.opn.localeCompare(b.opn));
    return cachedParts;
  }
  if (!warnedMockParts) {
    warnedMockParts = true;
    console.warn(
      `[Pin2Pin] DEV SMOKE FALLBACK: No real part JSON files found in ${partsDir}. Using ${MOCK_SMOKE_PARTS.length} built-in sample parts strictly for local smoke build.`,
    );
  }
  cachedParts = MOCK_SMOKE_PARTS;
  return cachedParts;
}

export function getPartBySlug(slug: string): GoldenPartV2 | null {
  return getAllParts().find((p) => p.slug === slug) ?? null;
}

export function getAllAltHubs(): AltHubV2[] {
  if (cachedAltHubs) return cachedAltHubs;
  const altDir = path.join(REPO_ROOT, 'data', 'generated', 'alt');
  const files = collectJsonFiles(altDir);
  if (files.length > 0) {
    cachedAltHubs = files
      .map((f) => readJsonFile<AltHubV2>(f))
      .filter((a) => a && typeof a.slug === 'string' && a.schema_version === '2.0.0')
      .sort((a, b) => a.slug.localeCompare(b.slug));
    return cachedAltHubs;
  }
  if (!warnedMockAlt) {
    warnedMockAlt = true;
    console.warn(
      `[Pin2Pin] DEV SMOKE FALLBACK: No real alt JSON files found in ${altDir}. Using ${MOCK_SMOKE_ALT.length} built-in sample alt hub strictly for local smoke build.`,
    );
  }
  cachedAltHubs = MOCK_SMOKE_ALT;
  return cachedAltHubs;
}

export function getAltHubBySlug(slug: string): AltHubV2 | null {
  return getAllAltHubs().find((a) => a.slug === slug) ?? null;
}

export function getAllVsComparisons(): VsComparisonV2[] {
  if (cachedVsComparisons) return cachedVsComparisons;
  const vsDir = path.join(REPO_ROOT, 'data', 'generated', 'vs');
  const files = collectJsonFiles(vsDir);
  if (files.length > 0) {
    cachedVsComparisons = files
      .map((f) => readJsonFile<VsComparisonV2>(f))
      .filter((v) => v && typeof v.slug === 'string' && v.schema_version === '2.0.0')
      .sort((a, b) => a.slug.localeCompare(b.slug));
    return cachedVsComparisons;
  }
  if (!warnedMockVs) {
    warnedMockVs = true;
    console.warn(
      `[Pin2Pin] DEV SMOKE FALLBACK: No real vs JSON files found in ${vsDir}. Using ${MOCK_SMOKE_VS.length} built-in sample comparison strictly for local smoke build.`,
    );
  }
  cachedVsComparisons = MOCK_SMOKE_VS;
  return cachedVsComparisons;
}

export function getVsComparisonBySlug(slug: string): VsComparisonV2 | null {
  return getAllVsComparisons().find((v) => v.slug === slug) ?? null;
}

export function getVsComparisonsForPart(partSlug: string): VsComparisonV2[] {
  return getAllVsComparisons().filter(
    (v) => v.part_a_slug === partSlug || v.part_b_slug === partSlug,
  );
}

export function getAllGuides(): EngineeringGuide[] {
  if (cachedGuides) return cachedGuides;
  const guidesDir = path.join(REPO_ROOT, 'data', 'guides');
  const files = collectJsonFiles(guidesDir);
  if (files.length > 0) {
    const manifestOrder = getPilotManifest().static_routes.guides.map((r) =>
      r.replace(/^\/en\/guides\//, ''),
    );
    cachedGuides = files
      .map((f) => readJsonFile<EngineeringGuide>(f))
      .filter((g) => g && typeof g.slug === 'string')
      .sort((a, b) => {
        const ia = manifestOrder.indexOf(a.slug);
        const ib = manifestOrder.indexOf(b.slug);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    return cachedGuides;
  }
  if (!warnedMockGuides) {
    warnedMockGuides = true;
    console.warn(
      `[Pin2Pin] DEV SMOKE FALLBACK: No real guide JSON files found in ${guidesDir}. Using ${MOCK_SMOKE_GUIDES.length} built-in sample guides strictly for local smoke build.`,
    );
  }
  cachedGuides = MOCK_SMOKE_GUIDES;
  return cachedGuides;
}

export function getGuideBySlug(slug: string): EngineeringGuide | null {
  return getAllGuides().find((g) => g.slug === slug) ?? null;
}

export function getAllTrustDocs(): TrustPageDoc[] {
  if (cachedTrustDocs) return cachedTrustDocs;
  const trustDir = path.join(REPO_ROOT, 'data', 'trust');
  const files = collectJsonFiles(trustDir);
  if (files.length > 0) {
    cachedTrustDocs = files
      .map((f) => readJsonFile<TrustPageDoc>(f))
      .filter((t) => t && typeof t.slug === 'string');
    return cachedTrustDocs;
  }
  if (!warnedMockTrust) {
    warnedMockTrust = true;
    console.warn(
      `[Pin2Pin] DEV SMOKE FALLBACK: No real trust JSON files found in ${trustDir}. Using ${MOCK_SMOKE_TRUST.length} built-in sample trust pages strictly for local smoke build.`,
    );
  }
  cachedTrustDocs = MOCK_SMOKE_TRUST;
  return cachedTrustDocs;
}

export function getTrustDocBySlug(slug: TrustSlug): TrustPageDoc {
  const found = getAllTrustDocs().find((t) => t.slug === slug);
  if (found) return found;
  return MOCK_SMOKE_TRUST.find((t) => t.slug === slug) ?? MOCK_SMOKE_TRUST[0];
}

export function getCatalogRows(): CatalogPartRow[] {
  const parts = getAllParts();
  const altSlugSet = new Set(getAllAltHubs().map((a) => a.target_slug));
  return parts.map((p) => {
    if (p.category === 'ldo') {
      return {
        slug: p.slug,
        opn: p.opn,
        family: p.family,
        manufacturer: p.manufacturer,
        category: 'ldo',
        sub_topology: p.sub_topology,
        package_code: p.package.code,
        mfg_package_code: p.package.mfg_package_code,
        pin_count: p.package.pin_count,
        exposed_pad_net: p.package.exposed_pad.present ? p.package.exposed_pad.net : 'NONE',
        vin_or_vs_min_v: p.specs.vin_min_v.value,
        vin_or_vs_max_v: p.specs.vin_max_v.value,
        current_ma: p.specs.iout_max_ma.value,
        current_label: `${fmtNum(p.specs.iout_max_ma.value, 0)} mA`,
        iq_ua: p.specs.iq_typ_ua.value,
        theta_ja: p.package.theta_ja_c_per_w.value,
        ceramic_cap_stable: p.specs.ceramic_cap_stable,
        highlight_metric: `${fmtNum(p.specs.vout_v.value, 2)}V · Vdo ${fmtNum(p.specs.dropout_typ_mv.value, 0)}mV`,
        has_alt_page: altSlugSet.has(p.slug),
      lifecycle: p.lifecycle_status,
      exposed_pad_present: p.package.exposed_pad.present,
      };
    }
    if (p.category === 'dcdc') {
      return {
        slug: p.slug,
        opn: p.opn,
        family: p.family,
        manufacturer: p.manufacturer,
        category: 'dcdc',
        sub_topology: p.sub_topology,
        package_code: p.package.code,
        mfg_package_code: p.package.mfg_package_code,
        pin_count: p.package.pin_count,
        exposed_pad_net: p.package.exposed_pad.present ? p.package.exposed_pad.net : 'NONE',
        vin_or_vs_min_v: p.specs.vin_min_v.value,
        vin_or_vs_max_v: p.specs.vin_max_v.value,
        current_ma: p.specs.iout_or_isw_max_ma.value,
        current_label: `${fmtNum(p.specs.iout_or_isw_max_ma.value, 0)} mA ${p.specs.is_switch_limit ? '(Isw)' : '(Iout)'}`,
        iq_ua: p.specs.iq_typ_ua.value,
        theta_ja: p.package.theta_ja_c_per_w.value,
        ceramic_cap_stable: null,
        highlight_metric: `${p.specs.topology.toUpperCase()} · ${fmtNum(p.specs.fsw_typ_khz.value, 0)} kHz`,
        has_alt_page: altSlugSet.has(p.slug),
      lifecycle: p.lifecycle_status,
      exposed_pad_present: p.package.exposed_pad.present,
      };
    }
    return {
      slug: p.slug,
      opn: p.opn,
      family: p.family,
      manufacturer: p.manufacturer,
      category: 'opamp',
      sub_topology: p.sub_topology,
      package_code: p.package.code,
      mfg_package_code: p.package.mfg_package_code,
      pin_count: p.package.pin_count,
      exposed_pad_net: p.package.exposed_pad.present ? p.package.exposed_pad.net : 'NONE',
      vin_or_vs_min_v: p.specs.vs_min_v.value,
      vin_or_vs_max_v: p.specs.vs_max_v.value,
      current_ma: p.specs.iout_short_ma ? p.specs.iout_short_ma.value : null,
      current_label: p.specs.iout_short_ma
        ? `${fmtNum(p.specs.iout_short_ma.value, 0)} mA (Isc)`
        : `${p.specs.channels}ch ${p.specs.device_kind}`,
      iq_ua: p.specs.iq_per_ch_typ_ua.value,
      theta_ja: p.package.theta_ja_c_per_w.value,
      ceramic_cap_stable: null,
      highlight_metric:
        p.specs.device_kind === 'comparator'
          ? `Comp · tpd ${p.specs.prop_delay_ns ? fmtNum(p.specs.prop_delay_ns.value, 0) + 'ns' : '—'}`
          : `${p.specs.gbwp_mhz ? fmtNum(p.specs.gbwp_mhz.value, 2) + ' MHz' : '—'} · ${p.specs.slew_rate_v_per_us ? fmtNum(p.specs.slew_rate_v_per_us.value, 2) + ' V/µs' : '—'}`,
      has_alt_page: altSlugSet.has(p.slug),
      lifecycle: p.lifecycle_status,
      exposed_pad_present: p.package.exposed_pad.present,
    };
  });
}

export function getBomIndexParts(): BomIndexPart[] {
  const parts = getAllParts();
  const altByTarget = new Map<string, AltHubV2>();
  for (const alt of getAllAltHubs()) {
    altByTarget.set(alt.target_slug, alt);
  }
  const existingVsSet = new Set(getAllVsComparisons().map((v) => v.slug));

  return parts.map((p) => {
    const altHub = altByTarget.get(p.slug) ?? null;
    const alts = (altHub?.candidates ?? []).slice(0, 2).map((c) => {
      let vsSlug: string | null = null;
      if (c.vs_slug && existingVsSet.has(c.vs_slug)) {
        vsSlug = c.vs_slug;
      } else {
        const canonicalPair = [p.slug, c.alt_slug].sort().join('-vs-');
        if (existingVsSet.has(canonicalPair)) {
          vsSlug = canonicalPair;
        }
      }
      return {
        opn: c.alt_opn,
        slug: c.alt_slug,
        pkg: c.package_code,
        lvl: c.compatibility_level,
        vs: vsSlug,
      };
    });

    const crit = p.design_gotchas
      .filter((g) => g.severity === 'CRITICAL')
      .map((g) => g.title)
      .slice(0, 3);

    const warn = p.design_gotchas
      .filter((g) => g.severity === 'WARNING')
      .map((g) => g.title)
      .slice(0, 1);

    return {
      opn: p.opn,
      slug: p.slug,
      fam: p.family,
      mfg: p.manufacturer,
      cat: p.category,
      sub: p.sub_topology,
      pkg: p.package.code,
      life: p.lifecycle_status,
      ceramic: p.category === 'ldo' ? p.specs.ceramic_cap_stable : null,
      hasAlt: Boolean(altHub),
      pdf_url: p.datasheet.pdf_url,
      crit,
      warn,
      alts,
    };
  });
}

// ---------------------------------------------------------------------------
// Track 4 additions: hubs, related-content linking, global search index
// ---------------------------------------------------------------------------

/** Latest datasheet `verified_at` across the whole golden dataset (YYYY-MM-DD). */
export function getMaxVerifiedAt(): string {
  return maxIsoDate(
    getAllParts().map((p) => p.datasheet.verified_at),
    getAllAltHubs()[0]?.generated_at?.slice(0, 10) ?? '2026-01-01',
  );
}

/** Latest `updated_at` across all guides. */
export function getMaxGuideUpdatedAt(): string {
  return maxIsoDate(
    getAllGuides().map((g) => g.updated_at),
    getMaxVerifiedAt(),
  );
}

function guideText(g: EngineeringGuide): string {
  const parts: string[] = [g.title, g.subtitle, g.summary, ...g.key_takeaways];
  for (const s of g.sections) {
    parts.push(s.heading, ...s.body);
    if (s.callout) parts.push(s.callout.title, s.callout.text);
    if (s.table) {
      parts.push(...s.table.headers);
      for (const row of s.table.rows) parts.push(...row);
    }
  }
  return parts.join(' ');
}

const guideWordCountCache = new Map<string, number>();
const guideTextLowerCache = new Map<string, string>();

export function getGuideWordCount(g: EngineeringGuide): number {
  const cached = guideWordCountCache.get(g.slug);
  if (cached !== undefined) return cached;
  const count = guideText(g).split(/\s+/).filter(Boolean).length;
  guideWordCountCache.set(g.slug, count);
  return count;
}

function guideTextLower(g: EngineeringGuide): string {
  let t = guideTextLowerCache.get(g.slug);
  if (t === undefined) {
    t = guideText(g).toLowerCase();
    guideTextLowerCache.set(g.slug, t);
  }
  return t;
}

interface GuideMatchContext {
  partSlugs: string[];
  vsSlugs: string[];
  category: PartCategory;
  packageCodes: string[];
}

function rankGuides(ctx: GuideMatchContext, limit: number): EngineeringGuide[] {
  const guides = getAllGuides();
  const partBySlug = new Map(getAllParts().map((p) => [p.slug, p]));
  const scored = guides.map((g, order) => {
    let score = 0;
    // 1) explicit references (strongest)
    if (ctx.partSlugs.some((s) => g.related_parts.includes(s))) score += 100;
    if (ctx.vsSlugs.some((s) => g.related_vs.includes(s))) score += 100;
    // 2) category + package.code match
    const sameCategory = g.category === ctx.category;
    if (sameCategory) score += 30;
    const guidePkgs = new Set(
      g.related_parts.map((s) => partBySlug.get(s)?.package.code).filter(Boolean) as string[],
    );
    const text = guideTextLower(g);
    for (const code of ctx.packageCodes) {
      if (guidePkgs.has(code as never)) score += sameCategory ? 25 : 12;
      if (text.includes(code.toLowerCase())) score += 8;
    }
    // 3) cross-cutting engineering guides (thermal derating, etc.) are a safe fallback
    if (g.category === 'general') score += 5;
    return { g, score, order };
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  const picked = scored.filter((s) => s.score > 0).slice(0, limit);
  // Guarantee at least 2 contextual guides on every page
  for (const s of scored) {
    if (picked.length >= Math.min(2, guides.length)) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked.map((s) => s.g);
}

export function getRelatedGuidesForPart(part: GoldenPartV2, limit = 3): EngineeringGuide[] {
  const vsSlugs = getVsComparisonsForPart(part.slug).map((v) => v.slug);
  return rankGuides(
    {
      partSlugs: [part.slug],
      vsSlugs,
      category: part.category,
      packageCodes: [part.package.code],
    },
    limit,
  );
}

export function getRelatedGuidesForVs(vs: VsComparisonV2, limit = 3): EngineeringGuide[] {
  const a = getPartBySlug(vs.part_a_slug);
  const b = getPartBySlug(vs.part_b_slug);
  const packageCodes = [a?.package.code, b?.package.code].filter(Boolean) as string[];
  return rankGuides(
    {
      partSlugs: [vs.part_a_slug, vs.part_b_slug],
      vsSlugs: [vs.slug],
      category: vs.category,
      packageCodes: Array.from(new Set(packageCodes)),
    },
    limit,
  );
}

export function getRelatedGuidesForAlt(alt: AltHubV2, limit = 3): EngineeringGuide[] {
  const target = getPartBySlug(alt.target_slug);
  const candidatePkgs = alt.candidates.map((c) => c.package_code as string);
  return rankGuides(
    {
      partSlugs: [alt.target_slug, ...alt.candidates.map((c) => c.alt_slug)],
      vsSlugs: alt.candidates.map((c) => c.vs_slug).filter(Boolean) as string[],
      category: alt.category,
      packageCodes: Array.from(new Set([target?.package.code, ...candidatePkgs].filter(Boolean) as string[])),
    },
    limit,
  );
}

/** Standalone calculators + BOM checker + freeform comparator (shared by hub, search and related blocks). */
export const TOOL_ENTRIES: ToolEntry[] = [
  {
    slug: 'compare',
    href: '/en/tools/compare/',
    title: 'Live A-vs-B Comparator',
    short: 'Live Compare',
    description:
      'Pick any two verified OPNs and see an instant side-by-side pinout SVG, pin-diff table and parameter matrix with Candidate Drop-In / Tuning / Layout-Change review levels.',
    category: 'general',
    badge: 'New · Live Compare',
    features: [
      'Any verified OPN vs any OPN, not just pre-built pairs',
      'Pin-by-pin role diff with exposed-pad net check',
      'Shareable ?a=…&b=… URLs',
      'Links to the pre-built 1:1 page when one exists',
    ],
  },
  {
    slug: 'pinout-finder',
    href: '/en/tools/pinout-finder/',
    title: 'Reverse Pinout & Footprint Finder',
    short: 'Pinout Finder',
    description:
      'Match an existing PCB footprint and pin-by-pin net assignment against every verified OPN in the database to discover pin-compatible candidates.',
    category: 'general',
    badge: 'New · Pinout Match',
    features: [
      'Filter by package code and exposed pad net',
      'Pin-by-pin role matcher (VIN, GND, EN, VOUT, SW, FB)',
      'Instant deep-links to Live Compare and part specs',
    ],
  },
  {
    slug: 'feedback-divider',
    href: '/en/tools/feedback-divider/',
    title: 'Feedback Divider Solver (E96/E24)',
    short: 'Feedback Divider',
    description:
      'Solve standard E96 (1%) and E24 (5%) R1/R2 feedback resistor pairs for adjustable LDO and DC-DC converters with worst-case tolerance error and divider power.',
    category: 'dcdc',
    badge: 'New · R1/R2 Solver',
    features: [
      'Pre-filled Vref presets from verified adjustable parts',
      'Standard E96 & E24 pair ranking by voltage accuracy',
      'Worst-case tolerance band & quiescent divider current',
    ],
  },
  {
    slug: 'bom-checker',
    href: '/en/tools/bom-checker/',
    title: 'Zero-Upload BOM Checker',
    short: 'BOM CSV Checker',
    description:
      'Audit KiCad, Altium, PADS and JLCPCB BOM CSVs entirely in browser memory for EOL parts, ESR/pinout traps and Candidate Drop-In alternatives. Nothing is uploaded.',
    category: 'general',
    badge: 'Featured · Zero-Upload',
    features: [
      'KiCad / Altium / PADS / JLCPCB header auto-mapping',
      'Footprint vs datasheet package mismatch flags',
      'Lifecycle (NRND / EOL) and candidate alternative review',
      '100% client-side — the CSV never leaves your browser',
    ],
  },
  {
    slug: 'ldo-thermal-calculator',
    href: '/en/tools/ldo-thermal-calculator/',
    title: 'LDO Thermal & Tj Margin Calculator',
    short: 'LDO Thermal Calculator',
    description:
      'Compute LDO power dissipation, junction temperature, dropout headroom and maximum load current at a given ambient using real datasheet θJA values.',
    category: 'ldo',
    badge: 'Tool · Thermal',
    features: ['Pd = (Vin − Vout) × Iout + Vin × Iq', 'Tj and headroom vs Tj,max', 'Pre-filled from verified OPNs'],
  },
  {
    slug: 'dcdc-efficiency-ripple-calculator',
    href: '/en/tools/dcdc-efficiency-ripple-calculator/',
    title: 'DC-DC Efficiency, Ripple & Ipeak Calculator',
    short: 'DC-DC Ripple Calculator',
    description:
      'Analyze buck, boost and buck-boost duty cycle, inductor ripple ΔIL, peak switch current versus the datasheet limit, and minimum inductance for a chosen fsw.',
    category: 'dcdc',
    badge: 'Tool · Switching',
    features: ['Duty cycle and ΔIL ripple', 'Ipeak vs switch-current limit', 'Efficiency-based loss estimate'],
  },
  {
    slug: 'opamp-gbwp-slewrate-checker',
    href: '/en/tools/opamp-gbwp-slewrate-checker/',
    title: 'Op-Amp GBWP & Slew Rate Checker',
    short: 'Op-Amp / Comparator Checker',
    description:
      'Check closed-loop bandwidth (GBWP/Acl), required slew rate (2π·f·Vpeak) and full-power bandwidth before swapping an op-amp, plus comparator pull-up timing.',
    category: 'opamp',
    badge: 'Tool · Analog',
    features: ['Closed-loop −3 dB bandwidth', 'Slew-limited full-power bandwidth', 'Comparator pull-up rise time'],
  },
];

export function getToolForCategory(category: PartCategory): ToolEntry {
  const slug =
    category === 'ldo'
      ? 'ldo-thermal-calculator'
      : category === 'dcdc'
        ? 'dcdc-efficiency-ripple-calculator'
        : 'opamp-gbwp-slewrate-checker';
  return TOOL_ENTRIES.find((t) => t.slug === slug) as ToolEntry;
}

export function getToolBySlug(slug: string): ToolEntry | null {
  return TOOL_ENTRIES.find((t) => t.slug === slug) ?? null;
}

export function getVsDirectoryItems(): VsDirectoryItem[] {
  const partBySlug = new Map(getAllParts().map((p) => [p.slug, p]));
  return getAllVsComparisons().map((v) => {
    const summary = v.engineering_verdict.replace(/\s+/g, ' ').trim();
    return {
      slug: v.slug,
      partAOpn: v.part_a_opn,
      partBOpn: v.part_b_opn,
      partAPkg: partBySlug.get(v.part_a_slug)?.package.code ?? '—',
      partBPkg: partBySlug.get(v.part_b_slug)?.package.code ?? '—',
      category: v.category,
      compatibilityLevel: v.compatibility_level,
      pinoutMatch: v.pinout_exact_match,
      exposedPadMatch: v.exposed_pad_match,
      summary: summary.length > 220 ? `${summary.slice(0, 217).replace(/\s+\S*$/, '')}…` : summary,
    };
  });
}

export function getPackageCounts(): Array<{ code: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of getAllParts()) {
    counts.set(p.package.code, (counts.get(p.package.code) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

/** Lightweight Cmd+K index: parts, top 1:1 pairs, guides, tools, packages and hubs. */
export function getSearchIndex(): SearchIndexItem[] {
  const items: SearchIndexItem[] = [];
  for (const p of getAllParts()) {
    items.push({
      t: 'part',
      l: p.opn,
      s: `${p.manufacturer} · ${p.family} · ${p.package.code}`,
      h: `/en/part/${p.slug}`,
      k: `${p.category} ${p.sub_topology} ${p.package.mfg_package_code} ${p.lifecycle_status}`.toLowerCase(),
    });
  }
  // Level 1 pairs first (most useful), then the rest
  const rank = (lvl: string) => (lvl === 'LEVEL_1_CANDIDATE_DROP_IN' ? 0 : lvl === 'LEVEL_2_TUNING_REQUIRED' ? 1 : 2);
  const vsSorted = [...getAllVsComparisons()].sort(
    (a, b) => rank(a.compatibility_level) - rank(b.compatibility_level) || a.slug.localeCompare(b.slug),
  );
  for (const v of vsSorted) {
    items.push({
      t: 'vs',
      l: `${v.part_a_opn} vs ${v.part_b_opn}`,
      s: `1:1 pin-diff · ${v.compatibility_level.replace('LEVEL_', 'L').split('_')[0]}`,
      h: `/en/vs/${v.slug}`,
      k: `${v.category} compare alternative replacement`,
    });
  }
  for (const g of getAllGuides()) {
    items.push({
      t: 'guide',
      l: g.title,
      s: `Field guide · ${g.reading_time_min} min`,
      h: `/en/guides/${g.slug}`,
      k: `${g.category} ${g.subtitle}`.toLowerCase(),
    });
  }
  for (const t of TOOL_ENTRIES) {
    items.push({ t: 'tool', l: t.title, s: t.badge, h: t.href, k: `${t.short} ${t.category} calculator`.toLowerCase() });
  }
  for (const { code, count } of getPackageCounts()) {
    items.push({
      t: 'package',
      l: `${code} package`,
      s: `${count} verified OPN${count === 1 ? '' : 's'} — filter catalog`,
      h: `/en/catalog?package=${encodeURIComponent(code)}`,
      k: 'package footprint pinout trap',
    });
  }
  items.push(
    { t: 'page', l: 'Parametric Catalog', s: 'Filter all verified OPNs', h: '/en/catalog/', k: 'catalog search filter' },
    { t: 'page', l: 'Engineering Field Guides', s: 'Failure-mode playbooks', h: GUIDES_HUB_HREF, k: 'guides hub' },
    { t: 'page', l: 'Engineering Tools & Calculators', s: 'All 7 zero-upload tools', h: TOOLS_HUB_HREF, k: 'tools hub' },
    { t: 'page', l: 'Audit Methodology', s: 'Dual-path PDF + 300 DPI vision', h: '/en/methodology/', k: 'methodology trust' },
    { t: 'page', l: 'Report a Pinout / Spec Error', s: 'Contact & error reporting', h: '/en/contact/', k: 'error report contact' },
  );
  return items;
}

/**
 * Latest verified / updated ISO date (YYYY-MM-DD) across parts, guides, VS diffs and manifest.
 */
export function getLatestVerifiedDate(): string {
  const manifest = getPilotManifest() as PilotManifest & { updated_at?: string };
  return maxIsoDate(
    [
      ...getAllParts().map((p) => p.datasheet.verified_at),
      ...getAllGuides().map((g) => g.updated_at),
      ...getAllVsComparisons().map((v) => v.generated_at),
      manifest.updated_at,
    ],
    '2026-04-01',
  );
}

/**
 * Bidirectional internal linking helper: returns Engineering Guides referencing or relevant to a part slug.
 */
export function getGuidesForPart(partSlug: string, limit = 3): EngineeringGuide[] {
  const part = getPartBySlug(partSlug);
  if (!part) return [];
  return getRelatedGuidesForPart(part, limit);
}

export interface QuickCompareOption {
  slug: string;
  opn: string;
  family: string;
  manufacturer: string;
  package_code: string;
  category: PartCategory;
  lifecycle_status: GoldenPartV2['lifecycle_status'];
}

/** Compact serializable part options for QuickComparePicker on part detail pages. */
export function getQuickCompareOptions(): QuickCompareOption[] {
  return getAllParts().map((p) => ({
    slug: p.slug,
    opn: p.opn,
    family: p.family,
    manufacturer: p.manufacturer,
    package_code: p.package.code,
    category: p.category,
    lifecycle_status: p.lifecycle_status,
  }));
}

/**
 * Compact pre-built search index fed to the global CommandPalette (Ctrl+K / Cmd+K) in en/layout.tsx.
 * Pre-normalizes OPN, family, mfg_package_code, package code, and category for hyphen-insensitive search.
 */
export function getCommandSearchItems(): CommandSearchItem[] {
  const items: CommandSearchItem[] = [];

  for (const p of getAllParts()) {
    items.push({
      id: `part:${p.slug}`,
      type: 'part',
      label: p.opn,
      sublabel: `${p.manufacturer} · ${p.package.code} (${p.package.mfg_package_code}) · ${p.category.toUpperCase()}`,
      href: `/en/part/${p.slug}/`,
      keywords: normalizeSearchText(
        `${p.opn} ${p.family} ${p.manufacturer} ${p.package.code} ${p.package.mfg_package_code} ${p.category} ${p.sub_topology} ${p.lifecycle_status}`,
      ),
      lifecycle: p.lifecycle_status,
    });
  }

  // All 7 Tools + Tools Hub
  items.push({
    id: 'tool:hub',
    type: 'tool',
    label: 'All 7 Engineering Tools & Calculators',
    sublabel: 'Tools Hub · Zero-Upload Browser Workbench',
    href: TOOLS_HUB_HREF,
    keywords: normalizeSearchText('tools hub calculators workbench bom compare pinout divider'),
  });
  for (const t of SITE_TOOLS) {
    items.push({
      id: `tool:${t.slug}`,
      type: 'tool',
      label: t.label,
      sublabel: t.description,
      href: t.href,
      keywords: normalizeSearchText(`${t.label} ${t.shortLabel} ${t.slug} ${t.description} tool calculator`),
    });
  }

  // Engineering Field Guides + Guides Hub
  items.push({
    id: 'guide:hub',
    type: 'guide',
    label: 'All Engineering Field Guides',
    sublabel: `${getAllGuides().length} hardware failure-mode playbooks`,
    href: GUIDES_HUB_HREF,
    keywords: normalizeSearchText('guides playbooks tutorials field guides reference'),
  });
  for (const g of getAllGuides()) {
    items.push({
      id: `guide:${g.slug}`,
      type: 'guide',
      label: g.title,
      sublabel: `${g.category.toUpperCase()} Guide · ${g.reading_time_min} min read`,
      href: `/en/guides/${g.slug}/`,
      keywords: normalizeSearchText(`${g.title} ${g.subtitle} ${g.category} ${g.related_parts.join(' ')}`),
    });
  }

  // Popular VS comparisons (prioritize Level 1 & Level 3 same-package traps)
  const vsRank = (lvl: string, pkgMatch: boolean) =>
    lvl === 'LEVEL_3_LAYOUT_CHANGE' && pkgMatch
      ? 0
      : lvl === 'LEVEL_1_CANDIDATE_DROP_IN'
        ? 1
        : lvl === 'LEVEL_2_TUNING_REQUIRED'
          ? 2
          : 3;
  const sortedVs = [...getAllVsComparisons()].sort(
    (a, b) =>
      vsRank(a.compatibility_level, a.package_match) - vsRank(b.compatibility_level, b.package_match) ||
      a.slug.localeCompare(b.slug),
  );
  for (const v of sortedVs.slice(0, 60)) {
    const tier = v.compatibility_level.replace('LEVEL_', 'L').split('_')[0];
    items.push({
      id: `vs:${v.slug}`,
      type: 'vs',
      label: `${v.part_a_opn} vs ${v.part_b_opn}`,
      sublabel: `1:1 Pin Diff · ${tier} · ${v.pinout_exact_match ? 'Pinout Match' : 'Pinout Mismatch'}`,
      href: `/en/vs/${v.slug}/`,
      keywords: normalizeSearchText(`${v.part_a_opn} ${v.part_b_opn} ${v.category} vs compare diff replacement`),
    });
  }

  // Core Navigation Pages
  items.push(
    {
      id: 'page:catalog',
      type: 'page',
      label: 'Parametric OPN Catalog',
      sublabel: `Filter all ${getAllParts().length} verified parts by package, Iq, current & MLCC`,
      href: '/en/catalog/',
      keywords: normalizeSearchText('catalog parametric search filter table opns'),
    },
    {
      id: 'page:methodology',
      type: 'page',
      label: 'Dual-Path Verification Methodology',
      sublabel: '300 DPI Vision audit, physics checks & Family 1:N OPN schema',
      href: '/en/methodology/',
      keywords: normalizeSearchText('methodology verification vision audit rules'),
    },
    {
      id: 'page:contact',
      type: 'page',
      label: 'Report a Pinout / Spec Error',
      sublabel: 'Audit feedback & GitHub issue reporting',
      href: '/en/contact/',
      keywords: normalizeSearchText('contact report error bug issue feedback'),
    },
  );

  return items;
}
