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
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildSoftwareAppJsonLd,
} from '@/lib/format';

const siteConfig = getSiteConfig();

const PAGE_PATH = '/en/tools/opamp-gbwp-slewrate-checker';
const PAGE_TITLE = 'Op-Amp GBWP, Slew Rate & Comparator Checker';
const PAGE_DESCRIPTION =
  'Verify op-amp closed-loop bandwidth (GBWP/NG), slew-rate distortion (FPBW), rail headroom, and comparator pull-up rise time with verified OPN presets.';

export const metadata: Metadata = buildPageMetadata({
  siteUrl: siteConfig.site_url,
  siteName: siteConfig.site_name,
  path: PAGE_PATH,
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
});

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
      vsMin: p.specs.vs_min_v.value,
      outputType: p.specs.output_type,
      railToRailOut: p.specs.rail_to_rail_out,
      railToRailIn: p.specs.rail_to_rail_in,
      ioutShortMa: p.specs.iout_short_ma ? p.specs.iout_short_ma.value : null,
    }));

  const defaultPreset =
    opampPresets.find((p) => p.deviceKind === 'opamp') ?? opampPresets[0] ?? null;

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Tools', path: '/en/tools' },
      { name: 'Op-Amp GBWP & Slew Rate Checker', path: PAGE_PATH },
    ]),
    buildSoftwareAppJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: PAGE_PATH,
      name: 'Pin2Pin Op-Amp GBWP, Slew Rate & Comparator Timing Checker',
      description: PAGE_DESCRIPTION,
      featureList: [
        'Inverting (NG = 1 + |Av|) and Non-Inverting (NG = Av) closed-loop bandwidth checks',
        'Large-signal slew-rate limiting and Full-Power Bandwidth (FPBW) verification',
        'Supply rail and Rail-to-Rail Output (RRO) headroom validation',
        'Auto-switched Comparator mode with propagation delay f_max and open-collector R_pu sizing',
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
        <span className="font-semibold text-slate-950">Op-Amp GBWP &amp; Slew Rate Checker</span>
      </nav>

      <header className="space-y-1.5 max-w-3xl">
        <div className="font-mono text-xs font-bold uppercase text-sky-800">
          Engineering Tool · Client-Side Execution · {opampPresets.length} Verified Analog OPNs
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          Op-Amp GBWP, Slew Rate &amp; Comparator Timing Checker
        </h1>
        <p className="text-sm text-slate-700 leading-relaxed">
          Verify op-amp small-signal bandwidth using true noise gain, large-signal slew-rate limits, and output rail
          headroom — or select a comparator OPN to auto-switch into propagation delay and pull-up resistor sizing mode.
        </p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <section aria-labelledby="opamp-calc-section">
        <h2 id="opamp-calc-section" className="sr-only">
          Interactive Op-Amp &amp; Comparator Workbench
        </h2>
        <OpampGbwpSlewCalculator initialPreset={defaultPreset} presets={opampPresets} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-bold text-slate-950">Op-Amp &amp; Comparator Equations</h2>
          <ul className="space-y-1.5 text-xs text-slate-800 font-mono">
            <li>Noise Gain: NG = Av (non-inv) · NG = 1 + |Av| (inverting)</li>
            <li>f_-3dB = GBWP / NG (target ≥ 5 × f_sig for flat gain)</li>
            <li>SR_req = 2π × f_sig × Vpeak · FPBW = SR / (2π × Vpeak)</li>
            <li>Comparator: f_max ≈ 1/(4·t_pd) · t_r ≈ 2.2·R_pu·C_load</li>
            <li>Open-Collector Sink: I_sink = (Vpu − Vol) / R_pu</li>
          </ul>
          <p className="text-xs text-slate-700 pt-1 leading-relaxed">
            Small-signal bandwidth alone can mislead: a slow op-amp like LM358 (0.3 V/µs) suffers slew-rate distortion
            on 2 Vpeak signals well below its −3 dB cutoff, and non-RRO outputs typically clip within ~1.5 V of the
            supply rails.
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
                Live A-vs-B Comparator: Pin-by-Pin &amp; Spec Diff →
              </Link>
            </li>
            <li>
              <Link href="/en/tools/feedback-divider/" className="font-semibold text-sky-800 hover:underline">
                Feedback Divider Solver: E96/E24 Resistor Ratio Tool →
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
              <Link href="/en/tools/dcdc-efficiency-ripple-calculator/" className="font-semibold text-sky-800 hover:underline">
                Switch to Tool: DC-DC Efficiency &amp; Ripple Calculator →
              </Link>
            </li>
            <li>
              <Link href="/en/guides/rail-to-rail-opamp-phase-reversal-slew/" className="font-semibold text-sky-800 hover:underline">
                Read Guide: Rail-to-Rail Op-Amp Phase Reversal &amp; Slew Traps →
              </Link>
            </li>
            <li>
              <Link href="/en/catalog/" className="font-semibold text-sky-800 hover:underline">
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
