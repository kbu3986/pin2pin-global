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
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildSoftwareAppJsonLd,
} from '@/lib/format';

const siteConfig = getSiteConfig();

const PAGE_PATH = '/en/tools/ldo-thermal-calculator';
const PAGE_TITLE = 'LDO Thermal & Junction Temp (Tj) Calculator';
const PAGE_DESCRIPTION =
  'Calculate LDO power dissipation Pd, junction temp Tj, thermal margin, dropout headroom, and derating curves with datasheet-verified OPN presets.';

export const metadata: Metadata = buildPageMetadata({
  siteUrl: siteConfig.site_url,
  siteName: siteConfig.site_name,
  path: PAGE_PATH,
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
});

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
      packageCode: p.package.code,
    }));

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Tools', path: '/en/tools' },
      { name: 'LDO Thermal Calculator', path: PAGE_PATH },
    ]),
    buildSoftwareAppJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: PAGE_PATH,
      name: 'Pin2Pin LDO Thermal & Junction Temperature (Tj) Calculator',
      description: PAGE_DESCRIPTION,
      featureList: [
        'Datasheet-verified OPN preset search across all verified LDO regulators',
        'Simultaneous thermal, Vin_max, dropout, and Iout_max violation detection',
        'Stacked Ta + ΔT thermal gauge and interactive Tj vs Iout derating curve',
        'Zero-upload browser-local execution with shareable URL parameters',
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
        <span className="font-semibold text-slate-950">LDO Thermal Calculator</span>
      </nav>

      <header className="space-y-1.5 max-w-3xl">
        <div className="font-mono text-xs font-bold uppercase text-emerald-800">
          Engineering Tool · Client-Side Execution · {ldoPresets.length} Verified LDO OPNs
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          LDO Thermal &amp; Junction Temperature (Tj) Calculator
        </h1>
        <p className="text-sm text-slate-700 leading-relaxed">
          Check linear regulator power dissipation, steady-state junction temperature, thermal margin, and dropout
          headroom before finalizing your PCB layout or swapping SOT-23 / SOT-223 packages.
        </p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <section aria-labelledby="ldo-calc-section">
        <h2 id="ldo-calc-section" className="sr-only">
          Interactive LDO Thermal Workbench
        </h2>
        <LdoThermalCalculator initialPreset={ldoPresets[0] ?? null} presets={ldoPresets} />
      </section>

      {/* Engineering Reference Formulas & Tool Cross-Links */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-bold text-slate-950">Thermal &amp; Dropout Engineering Equations</h2>
          <ul className="space-y-1.5 text-xs text-slate-800 font-mono">
            <li>Pd = (Vin − Vout) × Iout + Vin × Iq</li>
            <li>Tj = Ta + (Pd × θJA)</li>
            <li>Max Iout @ Ta = min(Iout,thermal, Iout,rated)</li>
            <li>Thermal Margin = Tj,max − Tj (target ≥ 15–25°C)</li>
            <li>Dropout Margin = (Vin − Vout) − Vdo (must be ≥ 0 mV)</li>
          </ul>
          <p className="text-xs text-slate-700 pt-1 leading-relaxed">
            Datasheet θJA values assume standardized JEDEC 1s0p or 2s2p test boards. Smaller copper pours increase
            effective θJA significantly — always derate conservatively for enclosed ambient temperatures.
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
              <Link href="/en/tools/compare/" className="font-semibold text-emerald-800 hover:underline">
                Live A-vs-B Comparator: Pin-by-Pin &amp; Thermal Delta Diff →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/feedback-divider/" className="font-semibold text-sky-800 hover:underline">
                Feedback Divider Solver: E96/E24 Resistors for Adjustable LDOs →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/bom-checker/" className="font-semibold text-emerald-800 hover:underline">
                Audit Full BOM: Zero-Upload BOM CSV Alternative &amp; EOL Checker →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/dcdc-efficiency-ripple-calculator/" className="font-semibold text-sky-800 hover:underline">
                Switch to Tool: DC-DC Efficiency &amp; Ripple Calculator →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/opamp-gbwp-slewrate-checker/" className="font-semibold text-sky-800 hover:underline">
                Switch to Tool: Op-Amp GBWP &amp; Slew Rate Checker →
              </Link>
            </li>
            <li>
              <Link href="/en/guides/thermal-derating-tj-margin-guide/" className="font-semibold text-sky-800 hover:underline">
                Read Guide: Thermal Derating &amp; Tj Margin Engineering →
              </Link>
            </li>
            <li>
              <Link href="/en/guides/ceramic-capacitor-esr-ldo-oscillation/" className="font-semibold text-sky-800 hover:underline">
                Read Guide: Ceramic Capacitor ESR &amp; LDO Oscillation →
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <LabGearAffiliate siteConfig={siteConfig} category="ldo" />
    </div>
  );
}
