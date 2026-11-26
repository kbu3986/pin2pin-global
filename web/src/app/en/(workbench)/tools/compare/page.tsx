import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import {
  getAllParts,
  getAllVsComparisons,
  getSiteConfig,
} from '@/lib/data-loader';
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildSoftwareAppJsonLd,
} from '@/lib/format';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { JsonLd } from '@/components/JsonLd';
import { CompareToolClient } from '@/components/tools/CompareToolClient';

const siteConfig = getSiteConfig();

export const metadata: Metadata = buildPageMetadata({
  siteUrl: siteConfig.site_url,
  siteName: siteConfig.site_name,
  path: '/en/tools/compare',
  title: 'Live IC Pinout & Spec Comparator (Any A vs B Pair)',
  description:
    'Compare any two verified LDO, DC-DC, Op-Amp, or Comparator OPNs side-by-side with interactive pinout diff SVGs, exposed-pad short detection, swap risks, and thermal delta.',
});

export default function LiveCompareToolPage() {
  const parts = getAllParts();
  const vsSlugs = getAllVsComparisons().map((v) => v.slug);
  const totalPairs = Math.floor((parts.length * (parts.length - 1)) / 2);

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Engineering Tools', path: '/en/tools' },
      { name: 'Live A-vs-B Comparator', path: '/en/tools/compare' },
    ]),
    buildSoftwareAppJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: '/en/tools/compare',
      name: 'Pin2Pin Live IC Pinout & Cross-Reference Comparator',
      description:
        'Browser-local deterministic IC cross-reference comparator evaluating pinouts, exposed pad nets, electrical ratings, swap traps, and thermal delta across any two verified OPNs.',
      featureList: [
        'Instant client-side comparison across all verified OPN pairs',
        'Synchronized top/bottom-mirror interactive pinout SVG diff',
        'Exposed pad / thermal tab short-circuit hazard detection',
        'Live dual-part junction temperature (ΔTj) thermal comparator',
        'Shareable URL state (?a=<slug>&b=<slug>)',
      ],
    }),
  ];

  return (
    <div className="space-y-6">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
        <Link href="/en" className="hover:text-slate-950">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/en/tools" className="hover:text-slate-950">
          Engineering Tools
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-semibold text-slate-950">Live A-vs-B Comparator</span>
      </nav>

      <header className="space-y-2 max-w-3xl">
        <div className="font-mono text-xs font-bold uppercase tracking-wide text-sky-800">
          Client-Side Cross-Reference Engine · {parts.length} Verified OPNs · {totalPairs.toLocaleString('en-US')} Pairs
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          Live IC Pinout &amp; Spec Comparator (Any A vs B)
        </h1>
        <p className="text-sm text-slate-700 leading-relaxed">
          Select any two datasheet-verified OPNs to run deterministic pin-by-pin diffing, exposed thermal tab short detection, electrical rating checks, and a live dual-part junction temperature delta — 100% locally in your browser.
        </p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <Suspense
        fallback={
          <div className="rounded-lg border border-slate-300 bg-white p-6 text-sm text-slate-600">
            Loading interactive comparator…
          </div>
        }
      >
        <CompareToolClient parts={parts} vsSlugs={vsSlugs} />
      </Suspense>

      <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
        <h2 className="text-sm font-bold text-slate-950">Next Steps in Your Second-Sourcing Workflow</h2>
        <div className="flex flex-wrap gap-4 text-xs">
          <Link href="/en/tools/pinout-finder" className="font-semibold text-sky-700 hover:underline">
            Have a PCB footprint? Open Reverse Pinout Finder →
          </Link>
          <Link href="/en/tools/feedback-divider" className="font-semibold text-sky-700 hover:underline">
            Different Vref? Solve E96 Feedback Resistors →
          </Link>
          <Link href="/en/tools/bom-checker" className="font-semibold text-emerald-700 hover:underline">
            Check a full BOM CSV locally →
          </Link>
          <Link href="/en/catalog" className="font-semibold text-slate-800 hover:underline">
            Browse Full Verified Catalog →
          </Link>
        </div>
      </section>
    </div>
  );
}
