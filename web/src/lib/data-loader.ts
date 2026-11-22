import fs from 'node:fs';
import path from 'node:path';
import type {
  AltHubV2,
  CatalogPartRow,
  EngineeringGuide,
  GoldenPartV2,
  PilotManifest,
  SiteConfig,
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
import { fmtNum } from '@/lib/format';

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
    const raw = readJsonFile<SiteConfig>(
      path.join(REPO_ROOT, 'config', 'site-config.json'),
    );
    const envSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
    cachedSiteConfig = {
      ...raw,
      site_url: envSiteUrl || raw.site_url.replace(/\/+$/, ''),
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
    };
  });
}
