import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  AlertOctagon,
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Cpu,
  FileSpreadsheet,
  Layers,
  Lock,
  ShieldCheck,
  Thermometer,
  Zap,
} from 'lucide-react';
import {
  getAllGuides,
  getAllParts,
  getAllVsComparisons,
  getCatalogRows,
  getLatestVerifiedDate,
  getSiteConfig,
} from '@/lib/data-loader';
import { HomeQuickSearch } from '@/components/HomeQuickSearch';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { JsonLd } from '@/components/JsonLd';
import {
  GUIDES_HUB_HREF,
  SITE_TOOLS,
  TOOLS_HUB_HREF,
  buildBreadcrumbJsonLd,
  buildDatasetJsonLd,
  buildPageMetadata,
  buildWebsiteJsonLd,
  categoryLabel,
  getCompatibilityStyle,
} from '@/lib/format';

const siteConfig = getSiteConfig();
const homeDescription =
  'OPN-exact IC pinout diagrams, side-by-side compatibility diff tables, zero-upload BOM CSV checker, and interactive LDO, DC-DC, and Op-Amp calculators verified from official manufacturer PDFs.';

export const metadata: Metadata = buildPageMetadata({
  siteUrl: siteConfig.site_url,
  siteName: siteConfig.site_name,
  path: '/en',
  title: `${siteConfig.site_name} — Datasheet-Verified Semiconductor Pinout & Cross-Reference DB`,
  description: homeDescription,
  absoluteTitle: true,
});

function summarizePackages(codes: string[], maxCount = 6): string {
  const unique = Array.from(new Set(codes)).sort();
  if (unique.length <= maxCount) return unique.join(', ');
  return `${unique.slice(0, maxCount).join(', ')} & +${unique.length - maxCount} more`;
}

export default function EnHomePage() {
  const parts = getAllParts();
  const catalogRows = getCatalogRows();
  const vsList = getAllVsComparisons();
  const guides = getAllGuides();
  const latestVerifiedDate = getLatestVerifiedDate();

  const ldoParts = parts.filter((p) => p.category === 'ldo');
  const dcdcParts = parts.filter((p) => p.category === 'dcdc');
  const opampParts = parts.filter((p) => p.category === 'opamp');

  const ldoPkgs = summarizePackages(ldoParts.map((p) => p.package.code));
  const dcdcPkgs = summarizePackages(dcdcParts.map((p) => p.package.code));
  const opampPkgs = summarizePackages(opampParts.map((p) => p.package.code));

  // Highlight critical same-package pinout traps first, then tuning-required comparisons
  const featuredTraps = [
    ...vsList.filter((v) => v.compatibility_level === 'LEVEL_3_LAYOUT_CHANGE' && v.package_match),
    ...vsList.filter((v) => v.compatibility_level === 'LEVEL_2_TUNING_REQUIRED'),
    ...vsList,
  ]
    .filter((v, idx, arr) => arr.findIndex((x) => x.slug === v.slug) === idx)
    .slice(0, 6);

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
    <div className="space-y-8">
      <JsonLd data={jsonLd} />

      {/* Precision Workbench Hero */}
      <section className="rounded-xl border border-slate-300 bg-slate-900 text-slate-100 p-6 sm:p-8 shadow-sm">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex flex-wrap items-center gap-2 text-[11px] font-mono">
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-emerald-300 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Dual-Path PDF + 300 DPI Vision Audited
            </span>
            <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-slate-200">
              OPN-Exact Package Isolation (Family 1:N OPN)
            </span>
            <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-slate-200">
              Verified {latestVerifiedDate}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            Stop Guessing Drop-In Replacements. Verify Every Pin &amp; Thermal Margin.
          </h1>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
            Deterministic SVG pinout diagrams, side-by-side pin-diff matrices, zero-upload BOM CSV
            risk auditing, and {SITE_TOOLS.length} browser-side engineering tools sourced strictly
            from official manufacturer PDFs with page-level citations.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/en/tools/bom-checker/"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Launch Zero-Upload BOM Checker
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/en/tools/compare/"
              className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/50 bg-sky-500/15 px-4 py-2.5 text-xs sm:text-sm font-semibold text-sky-100 hover:bg-sky-500/25 transition-colors"
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
              Live A-vs-B Compare
            </Link>
            <Link
              href="/en/catalog/"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-100 hover:border-slate-400 hover:bg-slate-800 transition-colors"
            >
              Browse Parametric Catalog
            </Link>
          </div>
        </div>

        {/* Metrics Strip */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-slate-800">
          <div className="rounded-md bg-slate-800/70 border border-slate-700/80 px-3.5 py-2.5">
            <div className="text-[11px] text-slate-300">Verified OPNs</div>
            <div className="font-mono text-xl font-bold tabular-nums text-white">{parts.length}</div>
          </div>
          <div className="rounded-md bg-slate-800/70 border border-slate-700/80 px-3.5 py-2.5">
            <div className="text-[11px] text-slate-300">1:1 Pin-Diff Comparisons</div>
            <div className="font-mono text-xl font-bold tabular-nums text-emerald-300">
              {vsList.length}
            </div>
          </div>
          <div className="rounded-md bg-slate-800/70 border border-slate-700/80 px-3.5 py-2.5">
            <div className="text-[11px] text-slate-300">Zero-Upload Browser Tools</div>
            <div className="font-mono text-xl font-bold tabular-nums text-sky-300">
              {SITE_TOOLS.length}
            </div>
          </div>
          <div className="rounded-md bg-slate-800/70 border border-slate-700/80 px-3.5 py-2.5">
            <div className="text-[11px] text-slate-300">Engineering Field Guides</div>
            <div className="font-mono text-xl font-bold tabular-nums text-amber-300">
              {guides.length}
            </div>
          </div>
        </div>
      </section>

      {/* Instant OPN Search */}
      <section aria-label="Quick OPN Lookup" className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-950">
            Quick Orderable Part Number (OPN) Lookup
          </h2>
          <Link href="/en/catalog/" className="text-xs font-semibold text-sky-700 hover:underline">
            Advanced Parametric Filters →
          </Link>
        </div>
        <HomeQuickSearch parts={catalogRows} />
      </section>

      <DisclaimerStrip siteConfig={siteConfig} />

      {/* Category Summary Cards */}
      <section aria-label="Semiconductor Categories" className="space-y-3">
        <h2 className="text-lg font-bold text-slate-950">Verified Component Families</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/en/catalog/?category=ldo"
            className="group rounded-lg border border-slate-300 bg-white p-5 hover:border-slate-900 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Thermometer className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                {ldoParts.length} OPNs
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-950 group-hover:text-sky-700">
              LDO Linear Regulators
            </h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Fixed (3.3V / 5.0V) &amp; adjustable LDOs across {ldoPkgs} with verified MLCC ESR
              stability windows, exposed tab net alerts, and pre-filled Tj derating calculators.
            </p>
          </Link>

          <Link
            href="/en/catalog/?category=dcdc"
            className="group rounded-lg border border-slate-300 bg-white p-5 hover:border-slate-900 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                <Zap className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                {dcdcParts.length} OPNs
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-950 group-hover:text-sky-700">
              Boost, Buck &amp; Buck-Boost DC-DC
            </h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Synchronous &amp; non-synchronous switchers across {dcdcPkgs} distinguishing peak
              switch limits (Isw) vs continuous load (Iout), Vref dividers, and fsw ripple budgets.
            </p>
          </Link>

          <Link
            href="/en/catalog/?category=opamp"
            className="group rounded-lg border border-slate-300 bg-white p-5 hover:border-slate-900 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                <Activity className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                {opampParts.length} OPNs
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-950 group-hover:text-sky-700">
              Op-Amps &amp; Comparators
            </h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Single &amp; dual amplifiers and push-pull / open-collector comparators across{' '}
              {opampPkgs} audited for RRIO swing, GBWP, slew rate, and U-pinout reversals.
            </p>
          </Link>
        </div>
      </section>

      {/* Featured Pinout Traps & Critical Comparisons */}
      <section aria-label="Featured Pinout Traps" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-rose-600" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-950">
              High-Risk Pinout Traps &amp; 1:1 Cross-Reference Comparisons
            </h2>
          </div>
          <Link href="/en/tools/compare/" className="text-xs font-semibold text-sky-700 hover:underline">
            Compare any 2 OPNs live →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredTraps.map((vs) => {
            const style = getCompatibilityStyle(vs.compatibility_level);
            return (
              <Link
                key={vs.slug}
                href={`/en/vs/${vs.slug}/`}
                className="group flex flex-col justify-between rounded-lg border border-slate-300 bg-white p-4 hover:border-slate-900 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-bold uppercase ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dotColor}`} />
                      {style.tierCode} · {style.shortLabel}
                    </span>
                    <span className="font-mono text-[11px] uppercase text-slate-600">
                      {categoryLabel(vs.category)}
                    </span>
                  </div>
                  <h3 className="font-mono text-sm font-bold text-slate-950 group-hover:text-sky-700">
                    {vs.part_a_opn}{' '}
                    <span className="text-slate-600 font-sans font-normal">vs</span>{' '}
                    {vs.part_b_opn}
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {vs.engineering_verdict}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                  <span
                    className={
                      vs.pinout_exact_match ? 'text-emerald-700' : 'text-rose-700 font-semibold'
                    }
                  >
                    {vs.pinout_exact_match ? 'Pinout Match' : 'Pinout Mismatch!'}
                  </span>
                  <span className="text-sky-700 font-sans font-semibold inline-flex items-center gap-1">
                    Inspect Diff SVG <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Interactive Engineering Tools & Calculators (All 7) */}
      <section
        id="tools"
        aria-label="Interactive Engineering Tools and Calculators"
        className="space-y-3 scroll-mt-20"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-slate-800" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-950">
              {SITE_TOOLS.length} Interactive Browser Engineering Tools &amp; Calculators
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-900">
              <Lock className="h-3 w-3" aria-hidden="true" />
              100% Client-Side
            </span>
            <Link href={TOOLS_HUB_HREF} className="text-xs font-semibold text-sky-700 hover:underline">
              Open Tools Hub →
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SITE_TOOLS.map((tool, idx) => {
            const isFeatured = tool.slug === 'bom-checker' || tool.slug === 'compare';
            return (
              <Link
                key={tool.slug}
                href={tool.href}
                className={`group flex flex-col justify-between rounded-lg p-4 transition-colors ${
                  isFeatured
                    ? 'border-2 border-emerald-500/80 bg-emerald-50/40 hover:border-emerald-700 hover:bg-white'
                    : 'border border-slate-300 bg-white hover:border-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold uppercase text-emerald-800">
                      Tool 0{idx + 1}
                    </span>
                    {isFeatured && (
                      <span className="rounded bg-emerald-700 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase text-white">
                        Zero-Upload
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1.5 text-sm font-bold text-slate-950 group-hover:text-sky-700">
                    {tool.label}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    {tool.description}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/70 text-xs font-semibold text-sky-700 inline-flex items-center gap-1">
                  Open Tool <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Deep Engineering Field Guides */}
      <section id="guides" aria-label="Engineering Field Guides" className="space-y-3 scroll-mt-20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-slate-800" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-950">
              Hardware Field Guides &amp; Failure-Mode Playbooks ({guides.length})
            </h2>
          </div>
          <Link href={GUIDES_HUB_HREF} className="text-xs font-semibold text-sky-700 hover:underline">
            Browse All Guides →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guides.map((g) => (
            <Link
              key={g.slug}
              href={`/en/guides/${g.slug}/`}
              className="group flex flex-col justify-between rounded-lg border border-slate-300 bg-white p-4 hover:border-slate-900 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 mb-1.5">
                  <span className="uppercase font-semibold text-slate-800">
                    {categoryLabel(g.category)}
                  </span>
                  <span>{g.reading_time_min} min read</span>
                </div>
                <h3 className="text-sm font-bold text-slate-950 group-hover:text-sky-700 leading-snug">
                  {g.title}
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {g.summary}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-xs font-semibold text-sky-700 flex items-center gap-1">
                Read Engineering Guide <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Methodology CTA Strip */}
      <section className="rounded-lg border border-slate-300 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3 max-w-2xl">
          <Layers className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-slate-950">
              Why Pin2Pin Global Never Scrapes Distributors or Guesses Pinouts
            </h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Every part JSON passes Dual-Path text + 300 DPI Vision verification, deterministic
              physics checks (Vabs ≥ Vrec, pin counts, thermal bounds), and OPN-level package
              isolation.
            </p>
          </div>
        </div>
        <Link
          href="/en/methodology/"
          className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
        >
          Read Audit Methodology →
        </Link>
      </section>
    </div>
  );
}
