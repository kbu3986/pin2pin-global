import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, GitCompareArrows } from 'lucide-react';
import {
  getAllParts,
  getAllVsComparisons,
  getSiteConfig,
} from '@/lib/data-loader';
import { CompareWorkbenchClient } from '@/components/CompareWorkbenchClient';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { ErrorReportButton } from '@/components/ErrorReportButton';
import { JsonLd } from '@/components/JsonLd';
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildSoftwareAppJsonLd,
} from '@/lib/format';

const siteConfig = getSiteConfig();

export const metadata: Metadata = buildPageMetadata({
  siteUrl: siteConfig.site_url,
  siteName: siteConfig.site_name,
  path: '/en/compare',
  title: 'Freeform 2-OPN Pinout & Spec Comparator',
  description:
    'Compare any two datasheet-verified LDO, DC-DC, or Op-Amp OPNs side-by-side with live SVG pin-diff highlighting, exposed pad checks, and parameter tables.',
});

export default function CompareHubPage() {
  const parts = getAllParts();
  const existingVsSlugs = getAllVsComparisons().map((v) => v.slug);
  const pagePath = '/en/compare';

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Tools', path: '/en/tools' },
      { name: '2-OPN Comparator', path: pagePath },
    ]),
    buildSoftwareAppJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: pagePath,
      name: 'Pin2Pin Freeform 2-OPN Semiconductor Pinout & Spec Comparator',
      description:
        'Client-side interactive comparator for checking pin-by-pin compatibility, exposed thermal pad nets, and electrical ratings across any two datasheet-verified OPNs.',
      featureList: [
        'Side-by-side interactive SVG pinout diagrams with Match/Caution/Mismatch highlighting',
        'Exposed pad and thermal tab net compatibility verification',
        'Shareable ?a=<slug>&b=<slug> comparison URLs',
        'Candidate Drop-In / Tuning Required / Layout Change classification',
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
        <Link href="/en/tools" className="hover:text-slate-900">
          Tools
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-slate-900">Freeform 2-OPN Comparator</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-emerald-700">
            <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
            Interactive Cross-Reference Workbench · {parts.length} Audited OPNs
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            Freeform 2-OPN Pinout &amp; Spec Comparator
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Select any two orderable part numbers to run an instant pin-by-pin diff, check exposed pad
            and package compatibility, and compare datasheet-cited electrical and thermal limits.
            All verdicts are review candidates — verify against official PDFs before PCB release.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/en/vs"
            className="print:hidden rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Browse {existingVsSlugs.length} Pre-Built 1:1 Diffs →
          </Link>
          <ErrorReportButton
            siteConfig={siteConfig}
            subject="Freeform 2-OPN Comparator"
            pagePath={pagePath}
          />
        </div>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <CompareWorkbenchClient parts={parts} existingVsSlugs={existingVsSlugs} />
    </div>
  );
}
