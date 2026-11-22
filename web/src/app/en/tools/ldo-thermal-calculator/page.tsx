import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getAllParts, getSiteConfig } from '@/lib/data-loader';
import {
  LdoThermalCalculator,
  type LdoPreset,
} from '@/components/calculators/LdoThermalCalculator';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { LabGearAffiliate } from '@/components/LabGearAffiliate';
import { JsonLd } from '@/components/JsonLd';
import { buildBreadcrumbJsonLd, buildSoftwareAppJsonLd } from '@/lib/format';

const siteConfig = getSiteConfig();

export const metadata: Metadata = {
  title: 'LDO Thermal & Junction Temperature (Tj) Margin Calculator',
  description:
    'Calculate LDO linear regulator power dissipation Pd, junction temperature Tj, thermal margin below Tj,max, dropout headroom, and max Iout at ambient Ta with official datasheet presets.',
  alternates: {
    canonical: `${siteConfig.site_url}/en/tools/ldo-thermal-calculator/`,
  },
};

export default function LdoThermalCalculatorPage() {
  const ldoPresets: LdoPreset[] = getAllParts()
    .filter((p) => p.category === 'ldo')
    .map((p) => ({
      opn: p.opn,
      vout: p.specs.vout_v.value,
      vinMin: p.specs.vin_min_v.value,
      vinMax: p.specs.vin_max_v.value,
      ioutMaxMa: p.specs.iout_max_ma.value,
      iqUa: p.specs.iq_typ_ua.value,
      dropoutMv: p.specs.dropout_typ_mv.value,
      thetaJa: p.package.theta_ja_c_per_w.value,
      tjMax: p.package.tj_max_c.value,
    }));

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'LDO Thermal Calculator', path: '/en/tools/ldo-thermal-calculator' },
    ]),
    buildSoftwareAppJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: '/en/tools/ldo-thermal-calculator',
      name: 'Pin2Pin LDO Thermal & Junction Temperature (Tj) Calculator',
      description:
        'Browser-local linear regulator thermal dissipation, junction temperature, and dropout margin calculator preloaded with official datasheet parameters.',
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
        <span className="font-medium text-slate-900">LDO Thermal Calculator</span>
      </nav>

      <header className="space-y-1.5 max-w-3xl">
        <div className="font-mono text-[11px] font-bold uppercase text-emerald-700">
          Engineering Tool 01 · Client-Side Execution
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          LDO Thermal &amp; Junction Temperature (Tj) Calculator
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Check linear regulator power dissipation, steady-state junction temperature, thermal margin, and dropout headroom before finalizing your PCB layout or swapping SOT-23 / SOT-223 packages.
        </p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <LdoThermalCalculator initialPreset={ldoPresets[0] ?? null} presets={ldoPresets} />

      {/* Engineering Reference Formulas & Tool Cross-Links */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-bold text-slate-950">Thermal &amp; Dropout Engineering Equations</h2>
          <ul className="space-y-1.5 text-xs text-slate-700 font-mono">
            <li>Pd = (Vin − Vout) × Iout + Vin × Iq</li>
            <li>Tj = Ta + (Pd × θJA)</li>
            <li>Thermal Margin = Tj,max − Tj  (target ≥ 15–25°C)</li>
            <li>Dropout Margin = (Vin − Vout) − Vdo  (must be ≥ 0 mV)</li>
          </ul>
          <p className="text-xs text-slate-600 pt-1 leading-relaxed">
            Datasheet θJA values assume standardized JEDEC 1s0p or 2s2p test boards. Smaller copper pours increase effective θJA significantly — always derate conservatively for enclosed ambient temperatures.
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
              <Link href="/en/guides/thermal-derating-tj-margin-guide" className="font-semibold text-sky-700 hover:underline">
                Read Guide: Thermal Derating &amp; Tj Margin Engineering →
              </Link>
            </li>
            <li>
              <Link href="/en/guides/ceramic-capacitor-esr-ldo-oscillation" className="font-semibold text-sky-700 hover:underline">
                Read Guide: Ceramic Capacitor ESR &amp; LDO Oscillation →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/dcdc-efficiency-ripple-calculator" className="font-semibold text-sky-700 hover:underline">
                Switch to Tool: DC-DC Efficiency &amp; Ripple Calculator →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/opamp-gbwp-slewrate-checker" className="font-semibold text-sky-700 hover:underline">
                Switch to Tool: Op-Amp GBWP &amp; Slew Rate Checker →
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <LabGearAffiliate siteConfig={siteConfig} category="ldo" />
    </div>
  );
}
