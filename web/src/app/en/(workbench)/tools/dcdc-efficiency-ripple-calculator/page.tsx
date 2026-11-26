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
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildSoftwareAppJsonLd,
} from '@/lib/format';

const siteConfig = getSiteConfig();

const PAGE_PATH = '/en/tools/dcdc-efficiency-ripple-calculator';
const PAGE_TITLE = 'DC-DC Buck, Boost & Buck-Boost Ripple Calculator';
const PAGE_DESCRIPTION =
  'Calculate Buck, Boost, and 4-switch Buck-Boost inductor ripple ΔIL, peak switch current Ipeak, output ripple ΔVout, and DCM boundary with verified OPNs.';

export const metadata: Metadata = buildPageMetadata({
  siteUrl: siteConfig.site_url,
  siteName: siteConfig.site_name,
  path: PAGE_PATH,
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
});

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
      minCoutUf: p.specs.min_cout_uf.value,
    }));

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Tools', path: '/en/tools' },
      { name: 'DC-DC Efficiency & Ripple Calculator', path: PAGE_PATH },
    ]),
    buildSoftwareAppJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: PAGE_PATH,
      name: 'Pin2Pin DC-DC Efficiency, Inductor Ripple & Peak Current Calculator',
      description: PAGE_DESCRIPTION,
      featureList: [
        'Buck, Boost, and 4-switch Buck-Boost (including transition-region) ripple modeling',
        'Peak switch current (Isw) vs continuous load current (Iout) separation',
        'Output voltage ripple ΔVout (mVpp) from Cout and capacitor ESR',
        'DCM boundary detection and 2-cycle inductor current waveform visualization',
      ],
    }),
  ];

  return (
    <div className="space-y-6">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
        <Link href="/en/" className="hover:text-slate-950 hover:underline">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
        <Link href="/en/tools/" className="hover:text-slate-950 hover:underline">
          Tools
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
        <span className="font-semibold text-slate-950">DC-DC Efficiency &amp; Ripple Calculator</span>
      </nav>

      <header className="space-y-1.5 max-w-3xl">
        <div className="font-mono text-xs font-bold uppercase text-amber-800">
          Engineering Tool · Client-Side Execution · {dcdcPresets.length} Verified DC-DC OPNs
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          DC-DC Efficiency, Inductor Ripple &amp; Peak Switch Current Calculator
        </h1>
        <p className="text-sm text-slate-700 leading-relaxed">
          Evaluate Buck, Boost, and 4-switch Buck-Boost duty cycle, inductor ripple current, output voltage ripple from
          Cout/ESR, DCM boundary, and peak switch current against datasheet limits.
        </p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <section aria-labelledby="dcdc-calc-section">
        <h2 id="dcdc-calc-section" className="sr-only">
          Interactive DC-DC Ripple &amp; Peak Current Workbench
        </h2>
        <DcdcEfficiencyRippleCalculator
          initialPreset={dcdcPresets[0] ?? null}
          presets={dcdcPresets}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-bold text-slate-950">Switching Topology Equations</h2>
          <ul className="space-y-1.5 text-xs text-slate-800 font-mono">
            <li>Buck: D = Vout/(Vin·η) · ΔIL = Vout·(Vin−Vout)/(Vin·fsw·L)</li>
            <li>Boost: D = 1−(Vin·η)/Vout · IL,avg = Iout·Vout/(Vin·η)</li>
            <li>Buck-Boost Transition (0.85–1.15): D = Vout/(Vin+Vout) · ΔIL = Vin·D/(fsw·L)</li>
            <li>Peak / DCM: Ipeak = IL,avg + ΔIL/2 · DCM when IL,avg &lt; ΔIL/2</li>
            <li>Inductor Isat Rating ≥ 1.25 × Ipeak (worst-case Vin,min)</li>
          </ul>
          <p className="text-xs text-slate-700 pt-1 leading-relaxed">
            Watch out on Boost converters: datasheets typically specify peak switch current limit (Isw), not continuous
            output current. At low Vin, average inductor current scales up by Vout / (Vin · η).
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-bold text-slate-950">Related Tools &amp; Field Guides</h2>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/en/tools/" className="font-semibold text-slate-900 hover:underline">
                Browse All Engineering Tools Hub →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/feedback-divider/" className="font-semibold text-amber-800 hover:underline">
                Feedback Divider Solver: E96/E24 Resistors for Adjustable Vout →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/compare/" className="font-semibold text-emerald-800 hover:underline">
                Live A-vs-B Comparator: Pin-by-Pin &amp; Spec Diff →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/bom-checker/" className="font-semibold text-emerald-800 hover:underline">
                Audit Full BOM: Zero-Upload BOM CSV Alternative &amp; EOL Checker →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/ldo-thermal-calculator/" className="font-semibold text-sky-800 hover:underline">
                Switch to Tool: LDO Thermal &amp; Tj Margin Calculator →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/opamp-gbwp-slewrate-checker/" className="font-semibold text-sky-800 hover:underline">
                Switch to Tool: Op-Amp GBWP &amp; Slew Rate Checker →
              </Link>
            </li>
            <li>
              <Link href="/en/guides/boost-buck-layout-inductor-selection/" className="font-semibold text-sky-800 hover:underline">
                Read Guide: Boost &amp; Buck Layout &amp; Inductor Selection →
              </Link>
            </li>
            <li>
              <Link href="/en/catalog/" className="font-semibold text-sky-800 hover:underline">
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
