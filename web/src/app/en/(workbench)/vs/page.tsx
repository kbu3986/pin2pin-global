import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ChevronRight, GitCompareArrows } from 'lucide-react';
import {
  getMaxVerifiedAt,
  getSiteConfig,
  getVsDirectoryItems,
} from '@/lib/data-loader';
import { VsDirectoryClient } from '@/components/VsDirectoryClient';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { ErrorReportButton } from '@/components/ErrorReportButton';
import { JsonLd } from '@/components/JsonLd';
import {
  buildBreadcrumbJsonLd,
  buildDatasetJsonLd,
  buildPageMetadata,
} from '@/lib/format';

const siteConfig = getSiteConfig();

export const metadata: Metadata = buildPageMetadata({
  siteUrl: siteConfig.site_url,
  siteName: siteConfig.site_name,
  path: '/en/vs',
  title: '1:1 Semiconductor Pinout Diff Directory',
  description:
    'Browse all datasheet-verified 1:1 IC comparisons across LDO, DC-DC, and Op-Amp OPNs with Candidate Drop-In, Tuning Required, and Layout Change tiers.',
});

export default function VsDirectoryHubPage() {
  const items = getVsDirectoryItems();
  const maxVerified = getMaxVerifiedAt();
  const pagePath = '/en/vs';

  const l1Count = items.filter((i) => i.compatibilityLevel === 'LEVEL_1_CANDIDATE_DROP_IN').length;
  const l2Count = items.filter((i) => i.compatibilityLevel === 'LEVEL_2_TUNING_REQUIRED').length;
  const l3Count = items.filter((i) => i.compatibilityLevel === 'LEVEL_3_LAYOUT_CHANGE').length;

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: '1:1 Comparisons', path: pagePath },
    ]),
    buildDatasetJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: pagePath,
      name: 'Pin2Pin Global 1:1 Semiconductor Pinout & Spec Comparisons Directory',
      description:
        'Complete searchable directory of datasheet-audited 1:1 pin-diff comparisons for LDO regulators, DC-DC converters, and Op-Amps/Comparators.',
      keywords: [
        'IC comparison directory',
        'LDO vs LDO pinout diff',
        'buck converter cross reference',
        'op-amp replacement comparison',
        'drop-in replacement check',
      ],
      dateModified: maxVerified,
      variableMeasured: [
        'Compatibility tier (Level 1 / Level 2 / Level 3)',
        'Exact pin-by-pin signal role match',
        'Exposed pad / tab net compatibility',
        'Electrical and thermal parameter diff',
      ],
    }),
  ];

  return (
    <div className="space-y-6">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <Link href="/en" className="hover:text-slate-900">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-slate-900">1:1 Pin-Diff Comparisons</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-sky-700">
            <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
            Verified Cross-Reference Index · {items.length} Canonical Pairs
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            1:1 Pinout &amp; Spec Comparisons Directory
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every comparison below pairs two package-specific OPNs with deterministic pin-by-pin SVG
            diffs, exposed pad checks, and datasheet-cited winner matrices. Need a pair not listed
            here? Launch the freeform 2-OPN comparator to test any two verified parts instantly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/en/compare"
            className="print:hidden inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            Freeform 2-OPN Comparator
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <ErrorReportButton
            siteConfig={siteConfig}
            subject="1:1 Comparisons Directory"
            pagePath={pagePath}
          />
        </div>
      </header>

      {/* Summary Counts Strip */}
      <section
        aria-label="Compatibility Tier Summary"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <div className="rounded-lg border border-slate-300 bg-white p-3.5">
          <div className="text-[11px] font-mono uppercase text-slate-500">Total 1:1 Diffs</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-950">
            {items.length}
          </div>
        </div>
        <div className="rounded-lg border border-emerald-300 bg-emerald-50/70 p-3.5">
          <div className="text-[11px] font-mono uppercase text-emerald-900">
            L1 · Candidate Drop-In
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-900">
            {l1Count}
          </div>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3.5">
          <div className="text-[11px] font-mono uppercase text-amber-950">
            L2 · Tuning Required
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-950">
            {l2Count}
          </div>
        </div>
        <div className="rounded-lg border border-rose-300 bg-rose-50/70 p-3.5">
          <div className="text-[11px] font-mono uppercase text-rose-950">
            L3 · Layout Change
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-rose-950">
            {l3Count}
          </div>
        </div>
      </section>

      <DisclaimerStrip siteConfig={siteConfig} />

      <VsDirectoryClient items={items} />
    </div>
  );
}
