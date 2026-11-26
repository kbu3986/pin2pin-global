import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getAllParts, getSiteConfig } from '@/lib/data-loader';
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildSoftwareAppJsonLd,
} from '@/lib/format';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { JsonLd } from '@/components/JsonLd';
import { PinoutFinderClient } from '@/components/tools/PinoutFinderClient';

const siteConfig = getSiteConfig();

export const metadata: Metadata = buildPageMetadata({
  siteUrl: siteConfig.site_url,
  siteName: siteConfig.site_name,
  path: '/en/tools/pinout-finder',
  title: 'Reverse Pinout Matcher & PCB Footprint Finder',
  description:
    'Find datasheet-verified drop-in candidate ICs by PCB package, exact pin-by-pin role assignment, thermal tab net, ceramic cap stability, current, and Iq.',
});

export default function PinoutFinderPage() {
  const parts = getAllParts();

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Engineering Tools', path: '/en/tools' },
      { name: 'Reverse Pinout Finder', path: '/en/tools/pinout-finder' },
    ]),
    buildSoftwareAppJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: '/en/tools/pinout-finder',
      name: 'Pin2Pin Reverse Pinout Matcher & PCB Footprint Finder',
      description:
        'Browser-local reverse pinout lookup tool matching verified LDO, DC-DC, Op-Amp, and Comparator OPNs to an existing PCB footprint and exposed pad net.',
      featureList: [
        'Dynamic package filter across all verified footprints',
        'One-click presets for SOT-23-3, SOT-223-3 1117, SOT-23-5 LDO/Op-Amp, SOT-23-6 Sync Buck, SOIC-8 Dual Op-Amp',
        'Exposed thermal pad / tab electrical net filtering',
        'Direct checkbox handoff to Live A-vs-B Comparator',
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
        <span className="font-semibold text-slate-950">Reverse Pinout Finder</span>
      </nav>

      <header className="space-y-2 max-w-3xl">
        <div className="font-mono text-xs font-bold uppercase tracking-wide text-emerald-800">
          PCB Shortage &amp; Rework Recovery · {parts.length} Verified OPNs Indexed
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          Reverse Pinout Matcher &amp; PCB Footprint Finder
        </h1>
        <p className="text-sm text-slate-700 leading-relaxed">
          Already fabricated a PCB and hit a part shortage or EOL? Dial in your existing copper footprint — package, per-pin signal roles, and thermal tab net — to discover Candidate Drop-In and caution-flagged ICs before cutting a single trace.
        </p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <PinoutFinderClient parts={parts} />

      <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
        <h2 className="text-sm font-bold text-slate-950">Related Pinout Guides &amp; Tools</h2>
        <div className="flex flex-wrap gap-4 text-xs">
          <Link href="/en/compare/" className="font-semibold text-sky-700 hover:underline">
            Live A-vs-B Pinout Comparator →
          </Link>
          <Link href="/en/packages/" className="font-semibold text-sky-700 hover:underline">
            Package Pinout Trap Matrix →
          </Link>
          <Link href="/en/guides/sot23-3-ldo-pinout-traps/" className="font-semibold text-sky-700 hover:underline">
            Field Guide: SOT-23-3 LDO Pinout Traps →
          </Link>
          <Link href="/en/guides/sot23-5-pinout-chaos-guide/" className="font-semibold text-sky-700 hover:underline">
            Field Guide: SOT-23-5 Pinout Chaos (6 Pinouts) →
          </Link>
          <Link href="/en/tools/bom-checker/" className="font-semibold text-emerald-700 hover:underline">
            Audit Full BOM CSV Locally →
          </Link>
        </div>
      </section>
    </div>
  );
}
