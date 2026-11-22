import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getAllParts, getSiteConfig } from '@/lib/data-loader';
import {
  OpampGbwpSlewCalculator,
  type OpampPreset,
} from '@/components/calculators/OpampGbwpSlewCalculator';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { LabGearAffiliate } from '@/components/LabGearAffiliate';
import { JsonLd } from '@/components/JsonLd';
import { buildBreadcrumbJsonLd, buildSoftwareAppJsonLd } from '@/lib/format';

const siteConfig = getSiteConfig();

export const metadata: Metadata = {
  title: 'Op-Amp GBWP, Closed-Loop Bandwidth & Slew Rate Distortion Checker',
  description:
    'Verify operational amplifier closed-loop -3 dB bandwidth (GBWP/Acl), required sine-wave slew rate (2π·f·Vpeak), and full-power bandwidth (FPBW) with datasheet OPN presets.',
  alternates: {
    canonical: `${siteConfig.site_url}/en/tools/opamp-gbwp-slewrate-checker/`,
  },
};

export default function OpampCalculatorPage() {
  const opampPresets: OpampPreset[] = getAllParts()
    .filter((p) => p.category === 'opamp')
    .map((p) => ({
      opn: p.opn,
      deviceKind: p.specs.device_kind,
      gbwpMhz: p.specs.gbwp_mhz ? p.specs.gbwp_mhz.value : null,
      slewRateVus: p.specs.slew_rate_v_per_us ? p.specs.slew_rate_v_per_us.value : null,
      propDelayNs: p.specs.prop_delay_ns ? p.specs.prop_delay_ns.value : null,
      vsMax: p.specs.vs_max_v.value,
    }));

  const defaultPreset =
    opampPresets.find((p) => p.deviceKind === 'opamp') ?? opampPresets[0] ?? null;

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      {
        name: 'Op-Amp GBWP & Slew Rate Checker',
        path: '/en/tools/opamp-gbwp-slewrate-checker',
      },
    ]),
    buildSoftwareAppJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: '/en/tools/opamp-gbwp-slewrate-checker',
      name: 'Pin2Pin Op-Amp GBWP & Slew Rate Distortion Checker',
      description:
        'Browser-local analog amplifier calculator verifying small-signal closed-loop bandwidth and large-signal full-power slew-rate limits.',
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
        <span className="font-medium text-slate-900">Op-Amp GBWP &amp; Slew Rate Checker</span>
      </nav>

      <header className="space-y-1.5 max-w-3xl">
        <div className="font-mono text-[11px] font-bold uppercase text-sky-700">
          Engineering Tool 03 · Client-Side Execution
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          Op-Amp GBWP &amp; Slew Rate Distortion Checker
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Check both small-signal closed-loop bandwidth (GBWP / Acl) and large-signal full-power bandwidth (SR / 2π·Vpeak) to catch gain roll-off and triangle-wave slew distortion before substituting op-amps.
        </p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <OpampGbwpSlewCalculator initialPreset={defaultPreset} presets={opampPresets} />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-bold text-slate-950">Bandwidth &amp; Slew Rate Equations</h2>
          <ul className="space-y-1.5 text-xs text-slate-700 font-mono">
            <li>f_-3dB = GBWP / Acl   (target ≥ 5 × f_sig for flat gain)</li>
            <li>SR_req = 2π × f_sig × Vpeak</li>
            <li>FPBW = SR / (2π × Vpeak)</li>
          </ul>
          <p className="text-xs text-slate-600 pt-1 leading-relaxed">
            Small-signal bandwidth alone can mislead: a slow op-amp like LM358 (0.3 V/µs) suffers severe slew-rate limiting on 2 Vpeak audio signals well below its −3 dB small-signal cutoff.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-bold text-slate-950">Related Tools &amp; Field Guides</h2>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/en/guides/rail-to-rail-opamp-phase-reversal-slew" className="font-semibold text-sky-700 hover:underline">
                Read Guide: Rail-to-Rail Op-Amp Phase Reversal &amp; Slew Traps →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/ldo-thermal-calculator" className="font-semibold text-sky-700 hover:underline">
                Switch to Tool: LDO Thermal &amp; Tj Margin Calculator →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/dcdc-efficiency-ripple-calculator" className="font-semibold text-sky-700 hover:underline">
                Switch to Tool: DC-DC Efficiency &amp; Ripple Calculator →
              </Link>
            </li>
            <li>
              <Link href="/en/catalog" className="font-semibold text-sky-700 hover:underline">
                Browse Verified Op-Amp &amp; Comparator OPNs →
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <LabGearAffiliate siteConfig={siteConfig} category="opamp" />
    </div>
  );
}
