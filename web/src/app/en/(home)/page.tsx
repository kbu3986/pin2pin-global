import type { Metadata } from 'next';
import Link from 'next/link';
import type { CatalogPartRow, GoldenPartV2, VsComparisonV2 } from '@/types/schema';
import {
  getAllGuides,
  getAllParts,
  getAllVsComparisons,
  getCatalogRows,
  getLatestVerifiedDate,
  getSiteConfig,
} from '@/lib/data-loader';
import { JsonLd } from '@/components/JsonLd';
import {
  SITE_TOOLS,
  buildBreadcrumbJsonLd,
  buildDatasetJsonLd,
  buildPageMetadata,
  buildWebsiteJsonLd,
} from '@/lib/format';
import { HomeHero } from '@/components/home/HomeHero';
import {
  HomeWorkbench,
  type WorkbenchDiffLine,
  type WorkbenchItem,
} from '@/components/home/HomeWorkbench';
import { HomeToolsSection } from '@/components/home/HomeToolsSection';
import {
  HomeFamiliesSection,
  type FamilyTabSpec,
} from '@/components/home/HomeFamiliesSection';
import { HomeVerifyAndFaq } from '@/components/home/HomeVerifyAndFaq';

const siteConfig = getSiteConfig();

function resolveBasePath(): string {
  const raw = (process.env.NEXT_PUBLIC_BASE_PATH || '').trim().replace(/\/+$/, '');
  if (!raw || raw === '/') return '';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

const homeTitle = 'Pin2Pin Global: Semiconductor pinout and cross-reference database';
const homeDescription =
  'Inspect 88 OPN-exact IC pinouts, 203 side-by-side diffs, and seven browser calculators sourced directly from official manufacturer PDFs.';

export const metadata: Metadata = buildPageMetadata({
  siteUrl: siteConfig.site_url,
  siteName: siteConfig.site_name,
  path: '/en',
  title: homeTitle,
  description: homeDescription,
  absoluteTitle: true,
});

function shortDiffFilename(partAOpn: string, partBOpn: string): string {
  const a = partAOpn.split('-')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 7);
  const b = partBOpn.split('-')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 7);
  return `${a}-${b}.pin`;
}

function compactFamilySpec(part: GoldenPartV2 | undefined, row: CatalogPartRow): string {
  if (!part) return row.highlight_metric;
  if (part.category === 'ldo') {
    const iMa = part.specs.iout_max_ma.value;
    const iStr = iMa >= 1000 ? `${(iMa / 1000).toFixed(1)} A` : `${Math.round(iMa)} mA`;
    const vdoMv = part.specs.dropout_typ_mv.value;
    const vdoStr = vdoMv >= 1000 ? `${(vdoMv / 1000).toFixed(1)} Vdo` : `${Math.round(vdoMv)} mV`;
    return `${iStr} · ${part.specs.vout_v.value} V · ${vdoStr}`;
  }
  if (part.category === 'dcdc') {
    const iMa = part.specs.iout_or_isw_max_ma.value;
    const iStr = iMa >= 1000 ? `${(iMa / 1000).toFixed(1)} A` : `${Math.round(iMa)} mA`;
    return `${iStr} · ${Math.round(part.specs.fsw_typ_khz.value)} kHz`;
  }
  return row.highlight_metric;
}

function summarizePackages(codes: string[], maxCount = 5): string {
  const unique = Array.from(new Set(codes)).sort();
  if (unique.length <= maxCount) return unique.join(', ');
  return `${unique.slice(0, maxCount).join(', ')} and ${unique.length - maxCount} more`;
}

function buildDiffLinesFromVs(vs: VsComparisonV2, partA: GoldenPartV2 | undefined, partB: GoldenPartV2 | undefined): WorkbenchDiffLine[] {
  const lines: WorkbenchDiffLine[] = [];
  let o = 1;
  let n = 1;

  for (const pd of vs.pin_diff) {
    if (pd.status === 'MISMATCH') {
      lines.push({
        oldNum: String(o++),
        newNum: '',
        kind: 'del',
        text: `pin_${pd.pin}: ${pd.part_a_name} (${pd.part_a_role})  # ${vs.part_a_opn} p.${partA?.package.pinout_source_page ?? 1}`,
      });
      lines.push({
        oldNum: '',
        newNum: String(n++),
        kind: 'add',
        text: `pin_${pd.pin}: ${pd.part_b_name} (${pd.part_b_role})  # ${vs.part_b_opn} p.${partB?.package.pinout_source_page ?? 1}`,
      });
    } else {
      lines.push({
        oldNum: String(o++),
        newNum: String(n++),
        kind: 'ctx',
        text: `pin_${pd.pin}: ${pd.part_a_name} == ${pd.part_b_name} (${pd.status})`,
      });
    }
  }

  const epA = partA?.package.exposed_pad.present ? partA.package.exposed_pad.net : 'NONE';
  const epB = partB?.package.exposed_pad.present ? partB.package.exposed_pad.net : 'NONE';
  lines.push({
    oldNum: String(o++),
    newNum: String(n++),
    kind: 'target',
    text: vs.exposed_pad_match
      ? `exposed_pad: ${epA} == ${epB} (verified net match)`
      : `exposed_pad: ${epA} != ${epB} (THERMAL TAB SHORT HAZARD)`,
  });

  for (const row of vs.parameter_matrix.slice(0, 12)) {
    const cleanMetric = row.metric.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (row.part_a_value === row.part_b_value) {
      lines.push({
        oldNum: String(o++),
        newNum: String(n++),
        kind: 'ctx',
        text: `${cleanMetric}: ${row.part_a_value}`,
      });
    } else {
      lines.push({
        oldNum: String(o++),
        newNum: '',
        kind: 'del',
        text: `${cleanMetric}: ${row.part_a_value}`,
      });
      lines.push({
        oldNum: '',
        newNum: String(n++),
        kind: 'add',
        text: `${cleanMetric}: ${row.part_b_value}`,
      });
    }
  }

  lines.push({
    oldNum: String(o++),
    newNum: String(n++),
    kind: 'ctx',
    text: `source_a: ${partA?.datasheet.source_domain ?? 'manufacturer'} (${partA?.datasheet.revision ?? 'PDF'})`,
  });
  lines.push({
    oldNum: String(o++),
    newNum: String(n++),
    kind: 'ctx',
    text: `source_b: ${partB?.datasheet.source_domain ?? 'manufacturer'} (${partB?.datasheet.revision ?? 'PDF'})`,
  });
  lines.push({
    oldNum: String(o++),
    newNum: String(n++),
    kind: 'ctx',
    text: 'audit_mode: DUAL_PATH_TEXT_VISION (300 DPI)',
  });

  return lines;
}

function buildSpecLinesFromPart(part: GoldenPartV2): WorkbenchDiffLine[] {
  const lines: WorkbenchDiffLine[] = [];
  let lineNo = 1;
  const push = (kind: WorkbenchDiffLine['kind'], text: string) => {
    lines.push({
      oldNum: kind === 'add' ? '' : String(lineNo),
      newNum: kind === 'del' ? '' : String(lineNo),
      kind,
      text,
    });
    lineNo++;
  };

  for (const pin of part.package.pinout) {
    push('ctx', `pin_${pin.pin}: ${pin.name} (${pin.role})  # p.${part.package.pinout_source_page}`);
  }
  push(
    'target',
    `exposed_pad: ${part.package.exposed_pad.present ? part.package.exposed_pad.net : 'NONE'} (${part.package.code}, ${part.package.mfg_package_code})`,
  );
  push('add', `theta_ja: ${part.package.theta_ja_c_per_w.value} C/W (p.${part.package.theta_ja_c_per_w.page})`);
  push('add', `tj_max: ${part.package.tj_max_c.value} C (p.${part.package.tj_max_c.page})`);
  push('ctx', `lifecycle: ${part.lifecycle_status}`);
  push('ctx', `manufacturer: ${part.manufacturer}`);
  push('ctx', `family: ${part.family}`);

  for (const gotcha of part.design_gotchas.slice(0, 4)) {
    push(gotcha.severity === 'CRITICAL' ? 'del' : 'ctx', `${gotcha.severity.toLowerCase()}: ${gotcha.title}`);
  }

  push('ctx', `datasheet: ${part.datasheet.source_domain} (${part.datasheet.revision})`);
  push('ctx', `verified_at: ${part.datasheet.verified_at}`);
  push('ctx', `parse_mode: ${part.datasheet.parse_source_mode}`);
  push('ctx', `pages: ${part.datasheet.page_count}`);
  push('ctx', 'policy: Verify pinout against official datasheet before layout');

  while (lines.length < 22) {
    push('ctx', `pin_view: ${part.package.pinout_view} · pin_count: ${part.package.pin_count}`);
  }

  return lines;
}

function buildWorkbenchItems(
  parts: GoldenPartV2[],
  catalogRows: CatalogPartRow[],
  vsList: VsComparisonV2[],
): WorkbenchItem[] {
  const partMap = new Map(parts.map((p) => [p.slug, p]));
  const rowMap = new Map(catalogRows.map((r) => [r.slug, r]));
  const preferredSlugs = [
    'ams1117-3-3',
    'ap7361c-33e-13',
    'cat6219-330td-gt3',
    'ap2112k-3-3trg1',
    'ap2204k-3-3trg1',
    'tps54302ddcr',
    'lm358dr',
    'tlv73333pdbvr',
    'ap62200wu-7',
    'ap2210n-3-3trg1',
    'lm27313xmf-nopb',
    'ap7333-33sag-7',
  ];

  const picked: GoldenPartV2[] = [];
  for (const s of preferredSlugs) {
    const p = partMap.get(s);
    if (p) picked.push(p);
  }
  for (const p of parts) {
    if (picked.length >= 12) break;
    if (!picked.some((x) => x.slug === p.slug)) picked.push(p);
  }

  const tones: Array<'1' | '2' | '3' | '4' | '5'> = ['1', '3', '5', '4', '2'];

  return picked.map((part, idx) => {
    const row = rowMap.get(part.slug);
    const preferredVs =
      part.slug === 'ams1117-3-3' || part.slug === 'ap7361c-33e-13'
        ? vsList.find((v) => v.slug === 'ams1117-3-3-vs-ap7361c-33e-13')
        : vsList.find(
            (v) =>
              (v.part_a_slug === part.slug || v.part_b_slug === part.slug) &&
              v.compatibility_level === 'LEVEL_3_LAYOUT_CHANGE' &&
              v.package_match,
          ) ??
          vsList.find((v) => v.part_a_slug === part.slug || v.part_b_slug === part.slug);

    const statusTone: 'l1' | 'l2' | 'l3' =
      preferredVs?.compatibility_level === 'LEVEL_3_LAYOUT_CHANGE'
        ? 'l3'
        : preferredVs?.compatibility_level === 'LEVEL_2_TUNING_REQUIRED'
          ? 'l2'
          : 'l1';

    const statusLabel =
      statusTone === 'l3'
        ? 'Pin trap'
        : statusTone === 'l2'
          ? 'Tuning'
          : part.lifecycle_status === 'EOL'
            ? 'EOL'
            : part.lifecycle_status === 'NRND'
              ? 'NRND'
              : 'Drop-in';

    const initials = part.category === 'ldo' ? 'LD' : part.category === 'dcdc' ? 'DC' : 'OA';
    const ratingLabel = row?.highlight_metric ?? `${part.package.pin_count}-pin ${part.category.toUpperCase()}`;

    if (preferredVs) {
      const partA = partMap.get(preferredVs.part_a_slug);
      const partB = partMap.get(preferredVs.part_b_slug);
      const mismatchCount = preferredVs.pin_diff.filter((d) => d.status === 'MISMATCH').length;
      const lines = buildDiffLinesFromVs(preferredVs, partA, partB);
      const levelNote =
        preferredVs.compatibility_level === 'LEVEL_3_LAYOUT_CHANGE'
          ? `Level 3 layout change required. ${mismatchCount} pin role conflict(s) between ${preferredVs.part_a_opn} and ${preferredVs.part_b_opn}. Verify pinout before PCB layout.`
          : preferredVs.compatibility_level === 'LEVEL_2_TUNING_REQUIRED'
            ? `Level 2 tuning required. Pin roles align between ${preferredVs.part_a_opn} and ${preferredVs.part_b_opn}, but passive or thermal margins differ.`
            : `Level 1 candidate drop-in. Package ${part.package.code} and pin roles match; confirm thermal headroom on datasheet.`;

      return {
        slug: part.slug,
        opn: part.opn,
        manufacturer: part.manufacturer,
        category: part.category,
        packageCode: part.package.code,
        pinCount: part.package.pin_count,
        ratingLabel,
        statusLabel,
        statusTone,
        avatarTone: tones[idx % tones.length],
        initials,
        diffDir: `${part.package.code.toLowerCase()}/`,
        diffFile: shortDiffFilename(preferredVs.part_a_opn, preferredVs.part_b_opn),
        addCount: `+${Math.max(1, mismatchCount)}`,
        delCount: `-${Math.max(1, mismatchCount)}`,
        hunkSig: `${preferredVs.part_a_opn} vs ${preferredVs.part_b_opn} (${part.package.code})`,
        threadTitle: 'Audit Gate',
        threadMeta: part.datasheet.verified_at,
        threadMessage: levelNote,
        primaryHref: `/en/vs/${preferredVs.slug}/`,
        primaryLinkLabel: 'Open full diff',
        partHref: `/en/part/${part.slug}/`,
        lines,
      };
    }

    return {
      slug: part.slug,
      opn: part.opn,
      manufacturer: part.manufacturer,
      category: part.category,
      packageCode: part.package.code,
      pinCount: part.package.pin_count,
      ratingLabel,
      statusLabel,
      statusTone: 'l1',
      avatarTone: tones[idx % tones.length],
      initials,
      diffDir: `${part.package.code.toLowerCase()}/`,
      diffFile: `${part.slug}.spec`,
      addCount: `+${part.package.pin_count}`,
      delCount: '-0',
      hunkSig: `${part.opn} · ${part.package.code} datasheet audit`,
      threadTitle: 'Audit Gate',
      threadMeta: part.datasheet.verified_at,
      threadMessage: `Dual-path PDF + 300 DPI vision verified (${part.datasheet.revision}). Verify pinout against official datasheet before production.`,
      primaryHref: `/en/part/${part.slug}/`,
      primaryLinkLabel: 'Open part page',
      partHref: `/en/part/${part.slug}/`,
      lines: buildSpecLinesFromPart(part),
    };
  });
}

export default function EnHomePage() {
  const basePath = resolveBasePath();
  const parts = getAllParts();
  const catalogRows = getCatalogRows();
  const vsList = getAllVsComparisons();
  const guides = getAllGuides();
  const latestVerifiedDate = getLatestVerifiedDate();

  const ldoRows = catalogRows.filter((r) => r.category === 'ldo');
  const dcdcRows = catalogRows.filter((r) => r.category === 'dcdc');
  const opampRows = catalogRows.filter((r) => r.category === 'opamp');

  const trapVs = vsList
    .filter((v) => v.compatibility_level === 'LEVEL_3_LAYOUT_CHANGE' && v.package_match)
    .slice(0, 8);

  const partMap = new Map(parts.map((p) => [p.slug, p]));

  const workbenchItems = buildWorkbenchItems(parts, catalogRows, vsList);
  const categoryCounts = {
    all: workbenchItems.length,
    ldo: workbenchItems.filter((i) => i.category === 'ldo').length,
    dcdc: workbenchItems.filter((i) => i.category === 'dcdc').length,
    opamp: workbenchItems.filter((i) => i.category === 'opamp').length,
    traps: workbenchItems.filter((i) => i.statusTone === 'l3').length,
  };

  const familyTabs: FamilyTabSpec[] = [
    {
      id: 'ldo',
      label: 'LDO',
      description: `${ldoRows.length} fixed and adjustable linear regulators across ${summarizePackages(ldoRows.map((r) => r.package_code))}. Every entry records MLCC ESR stability windows, exposed tab nets, and page-cited dropout limits.`,
      ctaLabel: 'Browse LDO catalog',
      ctaHref: '/en/catalog/?category=ldo',
      sheetTitle: 'Verified LDO Regulators',
      sheetMeta: `${ldoRows.length} OPNs`,
      rows: ldoRows.slice(0, 8).map((r) => ({
        label: r.opn,
        badge: r.package_code,
        spec: compactFamilySpec(partMap.get(r.slug), r),
        href: `/en/part/${r.slug}/`,
      })),
    },
    {
      id: 'dcdc',
      label: 'DC-DC',
      description: `${dcdcRows.length} buck, boost, and buck-boost switchers across ${summarizePackages(dcdcRows.map((r) => r.package_code))}. Specs distinguish switch-current limits (Isw) from continuous load current, switching frequency, and Vref.`,
      ctaLabel: 'Browse DC-DC catalog',
      ctaHref: '/en/catalog/?category=dcdc',
      sheetTitle: 'Verified DC-DC Converters',
      sheetMeta: `${dcdcRows.length} OPNs`,
      rows: dcdcRows.slice(0, 8).map((r) => ({
        label: r.opn,
        badge: r.package_code,
        spec: compactFamilySpec(partMap.get(r.slug), r),
        href: `/en/part/${r.slug}/`,
      })),
    },
    {
      id: 'opamp',
      label: 'Op-Amps',
      description: `${opampRows.length} single and dual op-amps and comparators across ${summarizePackages(opampRows.map((r) => r.package_code))}. Audited for rail-to-rail swing, GBWP, slew rate, and SOT-23-5 U-pinout reversals.`,
      ctaLabel: 'Browse Op-Amp catalog',
      ctaHref: '/en/catalog/?category=opamp',
      sheetTitle: 'Verified Op-Amps & Comparators',
      sheetMeta: `${opampRows.length} OPNs`,
      rows: opampRows.slice(0, 8).map((r) => ({
        label: r.opn,
        badge: r.package_code,
        spec: compactFamilySpec(partMap.get(r.slug), r),
        href: `/en/part/${r.slug}/`,
      })),
    },
    {
      id: 'traps',
      label: 'Pin traps',
      description: `${trapVs.length} same-package Level 3 pinout conflicts where identical JEDEC footprints swap VIN, VOUT, GND, or thermal tab nets. Inspect each diff before substituting second-source parts.`,
      ctaLabel: 'Inspect package directory',
      ctaHref: '/en/packages/',
      sheetTitle: 'Same-Package Pinout Traps',
      sheetMeta: 'Level 3 conflicts',
      rows: trapVs.map((v) => {
        const pkg = partMap.get(v.part_a_slug)?.package.code ?? 'Same pkg';
        const mismatches = v.pin_diff.filter((d) => d.status === 'MISMATCH').length;
        return {
          label: `${v.part_a_opn} vs ${v.part_b_opn}`,
          badge: pkg,
          isTrap: true,
          spec: `${mismatches} pin conflict${mismatches === 1 ? '' : 's'}`,
          href: `/en/vs/${v.slug}/`,
        };
      }),
    },
  ];

  const jsonLd = [
    buildWebsiteJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      description: homeDescription,
    }),
    buildBreadcrumbJsonLd(siteConfig.site_url, [{ name: 'Home', path: '/en' }]),
    buildDatasetJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: '/en',
      name: 'Pin2Pin Global Verified Semiconductor Cross-Reference Database',
      description:
        'OPN-exact pinout configurations, absolute maximum ratings, thermal impedances, and compatibility diff matrices verified from official manufacturer PDF datasheets.',
      keywords: [
        'semiconductor cross reference',
        'IC pinout diagram',
        'LDO alternative',
        'DC-DC buck boost replacement',
        'Op-Amp pin compatible',
      ],
      dateModified: latestVerifiedDate,
    }),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* Screen 1: Hero triptych */}
      <HomeHero partCount={parts.length} vsCount={vsList.length} toolCount={SITE_TOOLS.length} />

      {/* Screen 2: App-frame interactive workbench on sage bg-band */}
      <section className="section bg-band bg-bleed" id="workbench" aria-labelledby="workbench-h">
        <div className="wrap">
          <div className="grid">
            <div className="span-5">
              <h2 id="workbench-h">Inspect every IC pinout before layout.</h2>
            </div>
            <div className="span-6 start-7 stack-4">
              <p className="muted">
                Select any verified orderable part number on the left to review pin-role diffs,
                exposed thermal tab nets, and datasheet page citations side by side.
              </p>
              <Link className="link" href="/en/catalog/" prefetch={false}>
                Browse full catalog
              </Link>
            </div>
          </div>

          <HomeWorkbench
            items={workbenchItems}
            totalParts={parts.length}
            categoryCounts={categoryCounts}
          />
        </div>
      </section>

      {/* Screens 3 & 4: Features 2x2 tools showcase */}
      <HomeToolsSection basePath={basePath} partCount={parts.length} />

      {/* Screen 5: Verified IC families & package traps tabs-tour */}
      <HomeFamiliesSection tabs={familyTabs} />

      {/* Screens 6 & 7: iris-opens verification showcase + calm open FAQ */}
      <HomeVerifyAndFaq guides={guides} latestVerifiedDate={latestVerifiedDate} />
    </>
  );
}
