import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  BookOpen,
  Cpu,
  Layers,
  ShieldCheck,
  Thermometer,
  Zap,
} from 'lucide-react';
import {
  getAllGuides,
  getAllParts,
  getAllVsComparisons,
  getCatalogRows,
  getSiteConfig,
} from '@/lib/data-loader';
import { HomeQuickSearch } from '@/components/HomeQuickSearch';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { JsonLd } from '@/components/JsonLd';
import {
  buildBreadcrumbJsonLd,
  buildDatasetJsonLd,
  categoryLabel,
  getCompatibilityStyle,
} from '@/lib/format';

const siteConfig = getSiteConfig();

export const metadata: Metadata = {
  title: `${siteConfig.site_name} — Datasheet-Verified Semiconductor Pinout & Cross-Reference DB`,
  description:
    'OPN-exact IC pinout diagrams, side-by-side compatibility diff tables, and interactive LDO, DC-DC, and Op-Amp engineering calculators verified from official manufacturer PDFs.',
  alternates: {
    canonical: `${siteConfig.site_url}/en/`,
  },
};

export default function EnHomePage() {
  const parts = getAllParts();
  const catalogRows = getCatalogRows();
  const vsList = getAllVsComparisons();
  const guides = getAllGuides();

  const ldoCount = parts.filter((p) => p.category === 'ldo').length;
  const dcdcCount = parts.filter((p) => p.category === 'dcdc').length;
  const opampCount = parts.filter((p) => p.category === 'opamp').length;

  // Highlight critical pinout / layout mismatch traps first, then tuning-required comparisons
  const featuredTraps = [
    ...vsList.filter((v) => v.compatibility_level === 'LEVEL_3_LAYOUT_CHANGE' && v.package_match),
    ...vsList.filter((v) => v.compatibility_level === 'LEVEL_2_TUNING_REQUIRED'),
    ...vsList,
  ]
    .filter((v, idx, arr) => arr.findIndex((x) => x.slug === v.slug) === idx)
    .slice(0, 6);

  const jsonLd = [
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
      dateModified: parts[0]?.datasheet.verified_at ?? '2026-04-01',
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
            <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-slate-300">
              OPN-Exact Package Isolation (Family 1:N OPN)
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            Stop Guessing Drop-In Replacements. Verify Every Pin &amp; Thermal Margin.
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Deterministic SVG pinout diagrams, side-by-side pin-diff matrices, and pre-filled engineering calculators sourced strictly from official manufacturer PDFs with page-level citations.
          </p>
        </div>

        {/* Metrics Strip */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-slate-800">
          <div className="rounded-md bg-slate-800/70 border border-slate-700/80 px-3.5 py-2.5">
            <div className="text-[11px] text-slate-400">Verified OPNs</div>
            <div className="font-mono text-xl font-bold tabular-nums text-white">{parts.length}</div>
          </div>
          <div className="rounded-md bg-slate-800/70 border border-slate-700/80 px-3.5 py-2.5">
            <div className="text-[11px] text-slate-400">1:1 Pin-Diff Comparisons</div>
            <div className="font-mono text-xl font-bold tabular-nums text-emerald-300">
              {vsList.length}
            </div>
          </div>
          <div className="rounded-md bg-slate-800/70 border border-slate-700/80 px-3.5 py-2.5">
            <div className="text-[11px] text-slate-400">Interactive Calculators</div>
            <div className="font-mono text-xl font-bold tabular-nums text-sky-300">3</div>
          </div>
          <div className="rounded-md bg-slate-800/70 border border-slate-700/80 px-3.5 py-2.5">
            <div className="text-[11px] text-slate-400">Distributor Scraping</div>
            <div className="font-mono text-xl font-bold tabular-nums text-amber-300">0%</div>
          </div>
        </div>
      </section>

      {/* Instant OPN Search */}
      <section aria-label="Quick OPN Lookup" className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-950">Quick Orderable Part Number (OPN) Lookup</h2>
          <Link href="/en/catalog" className="text-xs font-semibold text-sky-700 hover:underline">
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
            href="/en/catalog?category=ldo"
            className="group rounded-lg border border-slate-300 bg-white p-5 hover:border-slate-900 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Thermometer className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {ldoCount} OPNs
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-950 group-hover:text-sky-700">
              LDO Linear Regulators
            </h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              SOT-23-3, SOT-23-5, TSOT-23-5 &amp; SOT-223-3 fixed 3.3V LDOs with exact ESR stability windows, Tab net alerts, and pre-filled Tj calculators.
            </p>
          </Link>

          <Link
            href="/en/catalog?category=dcdc"
            className="group rounded-lg border border-slate-300 bg-white p-5 hover:border-slate-900 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                <Zap className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {dcdcCount} OPNs
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-950 group-hover:text-sky-700">
              Boost, Buck &amp; Buck-Boost DC-DC
            </h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              SOT-23-5/6, TSOT-23-6, SC-70-6, WSON-6, SOIC-8, VSON-10/14 &amp; TO-263-5 switchers distinguishing Isw vs Iout ratings and fsw ripple budgets.
            </p>
          </Link>

          <Link
            href="/en/catalog?category=opamp"
            className="group rounded-lg border border-slate-300 bg-white p-5 hover:border-slate-900 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                <Activity className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {opampCount} OPNs
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-950 group-hover:text-sky-700">
              Op-Amps &amp; Comparators
            </h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Single SOT-23-5 &amp; dual SOIC-8 amplifiers and open-collector comparators checked for rail-to-rail swing, GBWP, slew rate, and pinout reversals.
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
          <Link href="/en/catalog" className="text-xs font-semibold text-sky-700 hover:underline">
            Explore all verified parts →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredTraps.map((vs) => {
            const style = getCompatibilityStyle(vs.compatibility_level);
            return (
              <Link
                key={vs.slug}
                href={`/en/vs/${vs.slug}`}
                className="group flex flex-col justify-between rounded-lg border border-slate-300 bg-white p-4 hover:border-slate-900 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dotColor}`} />
                      {style.tierCode} · {style.shortLabel}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-slate-500">
                      {categoryLabel(vs.category)}
                    </span>
                  </div>
                  <h3 className="font-mono text-sm font-bold text-slate-950 group-hover:text-sky-700">
                    {vs.part_a_opn} <span className="text-slate-400 font-sans font-normal">vs</span>{' '}
                    {vs.part_b_opn}
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {vs.engineering_verdict}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                  <span className={vs.pinout_exact_match ? 'text-emerald-700' : 'text-rose-700 font-semibold'}>
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

      {/* Interactive Engineering Calculators */}
      <section id="tools" aria-label="Interactive Engineering Calculators" className="space-y-3 scroll-mt-20">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-slate-800" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-950">Interactive Browser Engineering Calculators</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/en/tools/ldo-thermal-calculator"
            className="group rounded-lg border border-slate-300 bg-white p-5 hover:border-emerald-600 transition-colors"
          >
            <div className="font-mono text-[11px] font-bold uppercase text-emerald-700">Tool 01 · Thermal</div>
            <h3 className="mt-1.5 text-sm font-bold text-slate-950 group-hover:text-sky-700">
              LDO Thermal &amp; Tj Margin Calculator
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Compute power dissipation Pd, junction temp Tj, dropout headroom, and max Iout at ambient Ta with real OPN presets.
            </p>
          </Link>

          <Link
            href="/en/tools/dcdc-efficiency-ripple-calculator"
            className="group rounded-lg border border-slate-300 bg-white p-5 hover:border-amber-600 transition-colors"
          >
            <div className="font-mono text-[11px] font-bold uppercase text-amber-700">Tool 02 · Switching</div>
            <h3 className="mt-1.5 text-sm font-bold text-slate-950 group-hover:text-sky-700">
              DC-DC Efficiency, Ripple &amp; Ipeak Calculator
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Analyze Buck, Boost, and 4-switch Buck-Boost duty cycle, ΔIL ripple, peak switch current limits, and minimum inductor sizing.
            </p>
          </Link>

          <Link
            href="/en/tools/opamp-gbwp-slewrate-checker"
            className="group rounded-lg border border-slate-300 bg-white p-5 hover:border-sky-600 transition-colors"
          >
            <div className="font-mono text-[11px] font-bold uppercase text-sky-700">Tool 03 · Analog</div>
            <h3 className="mt-1.5 text-sm font-bold text-slate-950 group-hover:text-sky-700">
              Op-Amp GBWP &amp; Slew Rate Distortion Checker
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Check closed-loop −3 dB bandwidth (GBWP/Acl), required slew rate (2π·f·Vpeak), and full-power bandwidth before selecting a swap.
            </p>
          </Link>
        </div>
      </section>

      {/* Deep Engineering Field Guides */}
      <section id="guides" aria-label="Engineering Field Guides" className="space-y-3 scroll-mt-20">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-slate-800" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-950">Hardware Field Guides &amp; Failure-Mode Playbooks</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guides.map((g) => (
            <Link
              key={g.slug}
              href={`/en/guides/${g.slug}`}
              className="group flex flex-col justify-between rounded-lg border border-slate-300 bg-white p-4 hover:border-slate-900 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1.5">
                  <span className="uppercase font-semibold text-slate-700">
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
              Every part JSON passes Dual-Path text + 300 DPI Vision verification, deterministic physics checks (Vabs ≥ Vrec, pin counts, thermal bounds), and OPN-level package isolation.
            </p>
          </div>
        </div>
        <Link
          href="/en/methodology"
          className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
        >
          Read Audit Methodology →
        </Link>
      </section>
    </div>
  );
}
