import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getAllParts, getSiteConfig } from '@/lib/data-loader';
import {
  DcdcEfficiencyRippleCalculator,
  type DcdcPreset,
} from '@/components/calculators/DcdcEfficiencyRippleCalculator';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { LabGearAffiliate } from '@/components/LabGearAffiliate';
import { JsonLd } from '@/components/JsonLd';
import { buildBreadcrumbJsonLd, buildSoftwareAppJsonLd } from '@/lib/format';

const siteConfig = getSiteConfig();

export const metadata: Metadata = {
  title: 'DC-DC Buck, Boost & Buck-Boost Ripple, Ipeak & Loss Calculator',
  description:
    'Interactive switching converter calculator for Buck, Boost, and 4-switch Buck-Boost duty cycle, inductor ripple ΔIL, peak switch current Ipeak vs rated limits, and minimum inductance.',
  alternates: {
    canonical: `${siteConfig.site_url}/en/tools/dcdc-efficiency-ripple-calculator/`,
  },
};

export default function DcdcCalculatorPage() {
  const dcdcPresets: DcdcPreset[] = getAllParts()
    .filter((p) => p.category === 'dcdc')
    .map((p) => ({
      opn: p.opn,
      topology: p.specs.topology,
      vinMin: p.specs.vin_min_v.value,
      vinMax: p.specs.vin_max_v.value,
      voutNom: p.specs.vout_nom_v?.value ?? Math.min(5.0, p.specs.vout_max_v.value),
      fswKhz: p.specs.fsw_typ_khz.value,
      inductorUh: p.specs.inductor_typ_uh.value,
      ratedCurrentMa: p.specs.iout_or_isw_max_ma.value,
      isSwitchLimit: p.specs.is_switch_limit,
      synchronous: p.specs.synchronous,
      efficiencyPct: p.specs.efficiency_peak_pct?.value ?? 90,
    }));

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      {
        name: 'DC-DC Efficiency & Ripple Calculator',
        path: '/en/tools/dcdc-efficiency-ripple-calculator',
      },
    ]),
    buildSoftwareAppJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: '/en/tools/dcdc-efficiency-ripple-calculator',
      name: 'Pin2Pin DC-DC Efficiency, Inductor Ripple & Peak Current Calculator',
      description:
        'Browser-local Buck, Boost, and Buck-Boost switching regulator ripple current, peak switch current, and power loss estimator.',
    }),
  ];

  return (
    <div className="space-y-6">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/en" className="hover:text-slate-900">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-slate-900">DC-DC Efficiency &amp; Ripple Calculator</span>
      </nav>

      <header className="space-y-1.5 max-w-3xl">
        <div className="font-mono text-[11px] font-bold uppercase text-amber-700">
          Engineering Tool 02 · Client-Side Execution
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          DC-DC Efficiency, Inductor Ripple &amp; Peak Switch Current Calculator
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Evaluate Buck, Boost, and 4-switch Buck-Boost operating duty cycle, peak inductor/switch current versus IC switch current limits, and minimum inductance for a 30% ripple target.
        </p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <DcdcEfficiencyRippleCalculator
        initialPreset={dcdcPresets[0] ?? null}
        presets={dcdcPresets}
      />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-bold text-slate-950">Switching Topology Equations</h2>
          <ul className="space-y-1.5 text-xs text-slate-700 font-mono">
            <li>Buck:  D = Vout/(Vin·η) · ΔIL = Vout·(Vin−Vout)/(Vin·fsw·L)</li>
            <li>Boost: D = 1−(Vin·η)/Vout · IL,avg = Iout·Vout/(Vin·η)</li>
            <li>Peak:  Ipeak = IL,avg + ΔIL / 2</li>
            <li>Inductor Isat Rating ≥ 1.25 × Ipeak (worst-case Vin,min)</li>
          </ul>
          <p className="text-xs text-slate-600 pt-1 leading-relaxed">
            Watch out on Boost converters: datasheets specify peak switch current limit (Isw), NOT continuous output current. At low Vin, input current scales up by Vout / (Vin · η).
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-bold text-slate-950">Related Tools &amp; Field Guides</h2>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/en/tools/bom-checker" className="font-semibold text-emerald-700 hover:underline">
                Audit Full BOM: Zero-Upload BOM CSV Alternative &amp; EOL Checker →
              </Link>
            </li>
            <li>
              <Link href="/en/guides/boost-buck-layout-inductor-selection" className="font-semibold text-sky-700 hover:underline">
                Read Guide: Boost &amp; Buck Layout &amp; Inductor Selection →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/ldo-thermal-calculator" className="font-semibold text-sky-700 hover:underline">
                Switch to Tool: LDO Thermal &amp; Tj Margin Calculator →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/opamp-gbwp-slewrate-checker" className="font-semibold text-sky-700 hover:underline">
                Switch to Tool: Op-Amp GBWP &amp; Slew Rate Checker →
              </Link>
            </li>
            <li>
              <Link href="/en/catalog" className="font-semibold text-sky-700 hover:underline">
                Browse Verified DC-DC OPNs in Parametric Catalog →
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <LabGearAffiliate siteConfig={siteConfig} category="dcdc" />
    </div>
  );
}
