import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  ChevronRight,
  Cpu,
  FileSpreadsheet,
  Scale,
  ShieldCheck,
  Sliders,
  Thermometer,
  Zap,
} from 'lucide-react';
import {
  getAllAltHubs,
  getAllParts,
  getAllVsComparisons,
  getSiteConfig,
} from '@/lib/data-loader';
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildPageMetadata,
  buildSoftwareAppJsonLd,
  maxIsoDate,
} from '@/lib/format';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { JsonLd } from '@/components/JsonLd';

const siteConfig = getSiteConfig();

export const metadata: Metadata = buildPageMetadata({
  siteUrl: siteConfig.site_url,
  siteName: siteConfig.site_name,
  path: '/en/tools',
  title: 'Zero-Upload Hardware Engineering Tools & Calculators',
  description:
    'Seven browser-local hardware engineering tools powered by datasheet-verified specs: Live A-vs-B Comparator, Reverse Pinout Finder, BOM CSV Checker, E96 Feedback Solver, LDO Thermal, DC-DC Ripple, and Op-Amp/Comparator Checker.',
});

export default function ToolsHubPage() {
  const parts = getAllParts();
  const vsList = getAllVsComparisons();
  const altList = getAllAltHubs();

  const totalPairs = Math.floor((parts.length * (parts.length - 1)) / 2);
  const pkgCount = new Set(parts.map((p) => p.package.code)).size;
  const ldoCount = parts.filter((p) => p.category === 'ldo').length;
  const dcdcCount = parts.filter((p) => p.category === 'dcdc').length;
  const opampCount = parts.filter((p) => p.category === 'opamp').length;
  const adjCount = parts.filter(
    (p) =>
      (p.category === 'dcdc' && !p.specs.vout_fixed && p.specs.vref_v) ||
      (p.category === 'ldo' && !p.specs.vout_fixed),
  ).length;

  const latestDate = maxIsoDate(
    parts.map((p) => p.datasheet.verified_at),
    '2026-11-23',
  );

  const toolGroups = [
    {
      id: 'xref-footprint',
      heading: 'Cross-Reference & Footprint Matching',
      subtitle: 'Resolve part shortages, verify second-sources, and prevent pinout or thermal-tab board shorts.',
      tools: [
        {
          href: '/en/tools/compare',
          badge: 'NEW · XREF Engine',
          title: 'Live IC Pinout & Spec Comparator (Any A vs B)',
          description: `Compare any two of our ${parts.length} verified OPNs (${totalPairs.toLocaleString('en-US')} possible pairs) with synchronized top/bottom-mirror pinout SVGs, exposed-pad short detection, swap risks, and a live ΔTj thermal simulator.`,
          stat: `${totalPairs.toLocaleString('en-US')} live pairs · ${vsList.length} static audits`,
          icon: Scale,
          tone: 'text-sky-700 bg-sky-50 border-sky-200',
        },
        {
          href: '/en/tools/pinout-finder',
          badge: 'NEW · Footprint Recovery',
          title: 'Reverse Pinout Matcher & PCB Footprint Finder',
          description: `Dial in an existing PCB footprint across ${pkgCount} verified packages, per-pin roles, and thermal tab net (or pick a 1-click preset) to find Candidate Drop-In ICs without respinning copper.`,
          stat: `${pkgCount} packages · 7 footprint presets`,
          icon: Cpu,
          tone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        },
      ],
    },
    {
      id: 'bom-audit',
      heading: 'BOM & Supply-Chain Risk Audit',
      subtitle: 'Screen KiCad, Altium, EasyEDA, and PADS exports locally with zero server upload.',
      tools: [
        {
          href: '/en/tools/bom-checker',
          badge: 'v2 · Zero-Upload Privacy',
          title: 'Local BOM CSV / TSV Alternative & EOL Checker',
          description:
            'Parses RFC 4180 CSV/TSV BOMs in-browser, automatically skips passives (R/C/L/J/TP), flags EOL/NRND lifecycle hazards, catches fixed-voltage & footprint mismatches, and exports Markdown or CSV audit reports.',
          stat: `Up to 100 IC rows · ${altList.length} ranked alt hubs`,
          icon: FileSpreadsheet,
          tone: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        },
      ],
    },
    {
      id: 'power-analog-calc',
      heading: 'Power & Analog Engineering Calculators',
      subtitle: 'Every calculator is preloaded with 100% of verified datasheet parameters for its category.',
      tools: [
        {
          href: '/en/tools/feedback-divider',
          badge: 'NEW · E96 / E48 / E24',
          title: 'DC-DC & LDO Feedback Resistor Divider Solver',
          description:
            'Ranks the top 10 standard E96/E48/E24 R1/R2 pairs for any datasheet Vref, computes worst-case Vout tolerance bands + FB leakage shift + feed-forward C_ff, and renders a live schematic with KiCad BOM copy.',
          stat: `${adjCount} verified adjustable Vref presets`,
          icon: Sliders,
          tone: 'text-teal-700 bg-teal-50 border-teal-200',
        },
        {
          href: '/en/tools/ldo-thermal-calculator',
          badge: 'Upgraded · Derating Curve',
          title: 'LDO Thermal & Junction Temperature (Tj) Calculator',
          description:
            'Models Pd, steady-state Tj, thermal margin, dropout headroom, and rated-vs-thermal current limits with a live Tj(Iout) SVG derating plot across all verified LDOs.',
          stat: `${ldoCount} verified LDO OPNs`,
          icon: Thermometer,
          tone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        },
        {
          href: '/en/tools/dcdc-efficiency-ripple-calculator',
          badge: 'Upgraded · Buck / Boost / Buck-Boost',
          title: 'DC-DC Efficiency, Inductor & Output Ripple Calculator',
          description:
            'Calculates duty cycle, inductor ripple ΔIL, DCM boundary, peak switch current margin, output voltage ripple ΔVout (Cout + ESR), and full-load efficiency across Buck, Boost, and 4-Switch Buck-Boost topologies.',
          stat: `${dcdcCount} verified DC-DC OPNs`,
          icon: Zap,
          tone: 'text-amber-800 bg-amber-50 border-amber-200',
        },
        {
          href: '/en/tools/opamp-gbwp-slewrate-checker',
          badge: 'Upgraded · Op-Amp + Comparator Mode',
          title: 'Op-Amp GBWP / Slew Rate & Comparator Checker',
          description:
            'Checks inverting/non-inverting closed-loop bandwidth, full-power slew-rate distortion, and rail-to-rail headroom — and automatically switches to a propagation delay + pull-up R_pu solver for comparators.',
          stat: `${opampCount} verified Op-Amp & Comparator OPNs`,
          icon: Activity,
          tone: 'text-violet-700 bg-violet-50 border-violet-200',
        },
      ],
    },
  ];

  const allToolItems = toolGroups.flatMap((g) =>
    g.tools.map((t) => ({ name: t.title, path: t.href })),
  );

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Engineering Tools', path: '/en/tools' },
    ]),
    buildCollectionPageJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: '/en/tools',
      name: 'Pin2Pin Zero-Upload Hardware Engineering Tools',
      description:
        'Suite of 7 browser-local electronic engineering calculators, reverse pinout matcher, arbitrary A-vs-B comparator, and BOM CSV risk auditor.',
      dateModified: latestDate,
      items: allToolItems,
    }),
    buildSoftwareAppJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: '/en/tools',
      name: 'Pin2Pin Global Engineering Workbench',
      description:
        'Client-side hardware engineering toolset powered by dual-path PDF+Vision verified semiconductor specifications.',
      featureList: allToolItems.map((i) => i.name),
    }),
  ];

  return (
    <div className="space-y-8">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-600">
        <Link href="/en" className="hover:text-slate-950">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-semibold text-slate-950">Engineering Tools</span>
      </nav>

      {/* Hero Header */}
      <header className="space-y-3 max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 font-mono text-xs font-bold text-emerald-900">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          100% Browser-Local · Zero BOM Upload · Official Datasheet Preloaded
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          Hardware Engineering Tools &amp; Cross-Reference Workbench
        </h1>
        <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
          Seven deterministic, client-side engineering tools backed by {parts.length} dual-path PDF+Vision verified OPNs across {pkgCount} packages. Every calculation executes strictly inside your browser — proprietary BOMs and operating points never leave your workstation.
        </p>

        {/* Live DB Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Verified OPNs
            </div>
            <div className="mt-0.5 font-mono text-xl font-bold text-slate-950">
              {parts.length}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Live Compare Pairs
            </div>
            <div className="mt-0.5 font-mono text-xl font-bold text-sky-800">
              {totalPairs.toLocaleString('en-US')}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Package Footprints
            </div>
            <div className="mt-0.5 font-mono text-xl font-bold text-emerald-800">
              {pkgCount}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Zero-Upload Tools
            </div>
            <div className="mt-0.5 font-mono text-xl font-bold text-slate-950">
              7
            </div>
          </div>
        </div>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      {/* Tool Groups */}
      <div className="space-y-8">
        {toolGroups.map((group) => (
          <section key={group.id} aria-labelledby={`group-${group.id}`} className="space-y-3.5">
            <div className="space-y-1">
              <h2 id={`group-${group.id}`} className="text-lg font-bold text-slate-950">
                {group.heading}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">{group.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="group rounded-lg border border-slate-300 bg-white p-5 flex flex-col justify-between gap-4 hover:border-sky-600 hover:shadow-sm transition-all"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-bold ${tool.tone}`}>
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {tool.badge}
                        </span>
                        <span className="font-mono text-[11px] font-medium text-slate-600">
                          {tool.stat}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-950 group-hover:text-sky-800">
                        {tool.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 group-hover:translate-x-0.5 transition-transform">
                      Launch Tool
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Browse Catalog & Guides Footer Box */}
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <h2 className="text-sm font-bold text-slate-950">
            Need Raw Parametric Filtering or Deep Pinout Field Guides?
          </h2>
          <p className="text-xs text-slate-700">
            Explore the full searchable catalog of {parts.length} verified parts or read our bench-tested field guides on SOT-23-3 traps, exposed pad shorts, ceramic capacitor ESR, and comparator output stages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/en/catalog"
            className="rounded-md bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            Open Parametric Catalog →
          </Link>
          <Link
            href="/en/guides"
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 hover:bg-slate-100"
          >
            Engineering Field Guides →
          </Link>
        </div>
      </section>
    </div>
  );
}
