import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, ChevronRight, Layers } from 'lucide-react';
import {
  getAllParts,
  getMaxVerifiedAt,
  getPackageCounts,
  getSiteConfig,
} from '@/lib/data-loader';
import { PackageTrapMatrixClient } from '@/components/PackageTrapMatrixClient';
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
  path: '/en/packages',
  title: 'IC Package Pinout Trap Matrix (SOT-23, SOT-223, SOIC-8)',
  description:
    'Audit same-footprint pinout conflicts across SOT-23-5, SOT-23-3, SOT-223-3, and SOIC-8 ICs. Spot reversed power pins and exposed-pad shorts before PCB spin.',
});

export default function PackagesHubPage() {
  const parts = getAllParts();
  const packageCounts = getPackageCounts();
  const maxVerified = getMaxVerifiedAt();
  const pagePath = '/en/packages';

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Package Pinout Matrix', path: pagePath },
    ]),
    buildDatasetJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: pagePath,
      name: 'Pin2Pin Global IC Package Pinout Trap Matrix',
      description:
        'Cross-part pinout matrix grouping official-datasheet-verified OPNs by physical package footprint (SOT-23-3, SOT-23-5, SOT-223-3, SOIC-8, DFN/WSON) to expose hidden pin-order reversals and thermal tab net hazards.',
      keywords: [
        'SOT-23-3 pinout trap',
        'SOT-23-5 LDO pinout difference',
        'SOT-223-3 tab VOUT vs GND',
        'SOIC-8 op-amp comparator pinout',
        'IC footprint pinout matrix',
      ],
      dateModified: maxVerified,
      variableMeasured: [
        'Package footprint code',
        'Pin 1..N signal role assignment',
        'Exposed pad / thermal tab electrical net',
        'Pinout variant group count per package',
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
        <span className="font-medium text-slate-900">Package Pinout Trap Matrix</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-amber-700">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            Footprint-Level Pinout Chaos Audit · {packageCounts.length} Packages · {parts.length} OPNs
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            IC Package Pinout Trap Matrix
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Identical SMD footprints routinely hide destructive pinout reversals across vendors and
            even inside the same part family. Inspect every verified OPN grouped by package to catch
            <strong> SOT-23-3</strong> (GND-OUT-IN vs GND-IN-OUT vs IN-OUT-GND),{' '}
            <strong>SOT-23-5</strong> (swapped VIN/EN/FB pins on LDOs and buck converters),{' '}
            <strong>SOT-223-3</strong> (Tab = VOUT on 1117 vs Tab = GND on modern LDOs), and{' '}
            <strong>SOIC-8</strong> (op-amp vs open-collector comparator traps) before dropping a
            substitute onto an existing PCB.
          </p>
        </div>

        <ErrorReportButton
          siteConfig={siteConfig}
          subject="Package Pinout Trap Matrix"
          pagePath={pagePath}
        />
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      {/* Highlighted Failure-Mode Callout Strip */}
      <section
        aria-label="Common Package Pinout Traps"
        className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs"
      >
        <div className="rounded-lg border border-l-4 border-rose-200 border-l-rose-600 bg-rose-50/70 p-4 space-y-1">
          <div className="font-mono font-bold text-rose-900 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" aria-hidden="true" />
            SOT-23-3 &amp; SOT-223-3 Power Reversals
          </div>
          <p className="text-rose-950/90 leading-relaxed">
            Classic 1117 regulators tie the SOT-223 tab to <strong>VOUT</strong>, while many newer
            LDOs tie the tab to <strong>GND</strong>. In SOT-23-3, suffix letters (-SAG vs -SRG)
            invert VIN and GND on the exact same footprint.
          </p>
          <Link
            href="/en/guides/sot23-3-ldo-pinout-traps"
            className="inline-flex items-center gap-1 font-semibold text-rose-900 underline pt-0.5"
          >
            Read SOT-23-3 Trap Guide <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        <div className="rounded-lg border border-l-4 border-amber-200 border-l-amber-500 bg-amber-50/70 p-4 space-y-1">
          <div className="font-mono font-bold text-amber-950 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
            SOT-23-5 / TSOT-23-6 Multi-Function Pins
          </div>
          <p className="text-amber-950/90 leading-relaxed">
            Pin 4 on 5-pin LDOs alternates between <strong>NC, BYP, PG, and ADJ/FB</strong>, while
            6-pin buck converters diverge on EN polarity, Vref (0.6V vs 0.8V), and BOOT pin order.
          </p>
          <Link
            href="/en/guides/dcdc-vref-en-polarity-traps"
            className="inline-flex items-center gap-1 font-semibold text-amber-950 underline pt-0.5"
          >
            Read Vref &amp; EN Trap Guide <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        <div className="rounded-lg border border-l-4 border-sky-200 border-l-sky-600 bg-sky-50/70 p-4 space-y-1">
          <div className="font-mono font-bold text-sky-950 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-sky-600 shrink-0" aria-hidden="true" />
            SOIC-8 Op-Amp vs Comparator Confusion
          </div>
          <p className="text-sky-950/90 leading-relaxed">
            Dual op-amps (LM358, TLV9002) and dual comparators (LM393) share identical 8-pin SOIC
            pin numbering, yet comparators have open-collector outputs and no internal compensation.
          </p>
          <Link
            href="/en/guides/opamp-vs-comparator-soic8-traps"
            className="inline-flex items-center gap-1 font-semibold text-sky-950 underline pt-0.5"
          >
            Read SOIC-8 Trap Guide <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <PackageTrapMatrixClient parts={parts} />
    </div>
  );
}
