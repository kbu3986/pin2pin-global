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
import {
  FeedbackDividerClient,
  type FeedbackPreset,
} from '@/components/tools/FeedbackDividerClient';

const siteConfig = getSiteConfig();

export const metadata: Metadata = buildPageMetadata({
  siteUrl: siteConfig.site_url,
  siteName: siteConfig.site_name,
  path: '/en/tools/feedback-divider',
  title: 'DC-DC & LDO E96/E24 Feedback Resistor Divider Solver',
  description:
    'Solve E96, E48, and E24 feedback resistor pairs (R1/R2) for adjustable DC-DC converters and LDOs with datasheet Vref presets, worst-case Vout tolerance bands, Cff sizing, and KiCad BOM copy.',
});

export default function FeedbackDividerPage() {
  const presets: FeedbackPreset[] = [];
  for (const p of getAllParts()) {
    if (p.category === 'dcdc' && !p.specs.vout_fixed && p.specs.vref_v) {
      presets.push({
        opn: p.opn,
        slug: p.slug,
        category: 'dcdc',
        manufacturer: p.manufacturer,
        packageCode: p.package.code,
        vrefV: p.specs.vref_v.value,
        voutMinV: p.specs.vout_min_v.value,
        voutMaxV: p.specs.vout_max_v.value,
        vrefPage: p.specs.vref_v.page,
        fswKhz: p.specs.fsw_typ_khz.value,
      });
    } else if (p.category === 'ldo' && !p.specs.vout_fixed) {
      presets.push({
        opn: p.opn,
        slug: p.slug,
        category: 'ldo',
        manufacturer: p.manufacturer,
        packageCode: p.package.code,
        vrefV: p.specs.vout_v.value,
        voutMinV: p.specs.vout_v.value,
        voutMaxV: Math.max(p.specs.vout_v.value + 1, p.specs.vin_max_v.value - 1),
        vrefPage: p.specs.vout_v.page,
        fswKhz: null,
      });
    }
  }
  presets.sort((a, b) => a.opn.localeCompare(b.opn));

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Engineering Tools', path: '/en/tools' },
      { name: 'Feedback Divider Solver', path: '/en/tools/feedback-divider' },
    ]),
    buildSoftwareAppJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: '/en/tools/feedback-divider',
      name: 'Pin2Pin Adjustable DC-DC & LDO Feedback Divider Solver',
      description:
        'Browser-local E96/E48/E24 resistor divider solver with verified datasheet Vref presets, worst-case tolerance bands, feed-forward capacitor Cff estimation, and live SVG schematic.',
      featureList: [
        'Verified adjustable DC-DC and LDO datasheet Vref presets',
        'Top 10 IEC 60063 E96 (1%), E48 (2%), and E24 (5%) pairs',
        'Worst-case Vout band combining resistor, Vref, and FB bias current tolerances',
        'Live SVG feedback schematic and KiCad/Markdown BOM export',
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
        <span className="font-semibold text-slate-950">Feedback Divider Solver</span>
      </nav>

      <header className="space-y-2 max-w-3xl">
        <div className="font-mono text-xs font-bold uppercase tracking-wide text-sky-800">
          Power Rail Synthesis · {presets.length} Verified Adjustable OPNs Preloaded
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          DC-DC &amp; LDO E96/E24 Feedback Resistor Divider Solver
        </h1>
        <p className="text-sm text-slate-700 leading-relaxed">
          Swapping adjustable converters with different Vref (0.6 V vs 0.8 V vs 1.25 V)? Pick any verified datasheet Vref or enter a custom reference to compute exact E96/E48/E24 resistor pairs, worst-case tolerance bands, divider Iq, and feed-forward capacitor C_ff.
        </p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <FeedbackDividerClient presets={presets} />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
          <h2 className="text-sm font-bold text-slate-950">Feedback Divider Engineering Notes</h2>
          <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
            <li className="font-mono">Vout = Vref × (1 + R1 / R2) + I_fb × R1</li>
            <li className="font-mono">f_zero = 1 / (2π · R1 · C_ff)</li>
            <li>
              Keep the FB trace as short as possible and place R1/R2 adjacent to the IC feedback pin, away from the high-dv/dt SW node and inductor field.
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
          <h2 className="text-sm font-bold text-slate-950">Related Power Design Tools</h2>
          <ul className="space-y-1.5 text-xs">
            <li>
              <Link href="/en/tools/dcdc-efficiency-ripple-calculator" className="font-semibold text-sky-700 hover:underline">
                DC-DC Efficiency, Inductor Ripple &amp; Output Ripple Calculator →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/compare" className="font-semibold text-sky-700 hover:underline">
                Live A-vs-B Comparator (Check Vref &amp; Pinout Diff) →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/ldo-thermal-calculator" className="font-semibold text-emerald-700 hover:underline">
                LDO Thermal &amp; Junction Temperature (Tj) Calculator →
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
