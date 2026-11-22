import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Info,
  ShieldCheck,
} from 'lucide-react';
import {
  getAllAltHubs,
  getAllParts,
  getPartBySlug,
  getSiteConfig,
  getVsComparisonsForPart,
} from '@/lib/data-loader';
import type { GoldenPartV2 } from '@/types/schema';
import { PackagePinoutSvg } from '@/components/PackagePinoutSvg';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { ErrorReportButton } from '@/components/ErrorReportButton';
import { DistributorLinks } from '@/components/DistributorLinks';
import { LabGearAffiliate } from '@/components/LabGearAffiliate';
import { JsonLd } from '@/components/JsonLd';
import { LdoThermalCalculator } from '@/components/calculators/LdoThermalCalculator';
import { DcdcEfficiencyRippleCalculator } from '@/components/calculators/DcdcEfficiencyRippleCalculator';
import { OpampGbwpSlewCalculator } from '@/components/calculators/OpampGbwpSlewCalculator';
import {
  buildBreadcrumbJsonLd,
  buildDatasetJsonLd,
  buildTechArticleJsonLd,
  categoryLabel,
  fmtBool,
  fmtCited,
  fmtCurrentMa,
  fmtFrequencyKhz,
  fmtIqUa,
  fmtNum,
  fmtPage,
  getCompatibilityStyle,
} from '@/lib/format';

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllParts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const part = getPartBySlug(slug);
  const siteConfig = getSiteConfig();
  if (!part) {
    return { title: 'Part Not Found' };
  }
  const title = `${part.opn} Pinout, Datasheet Specs & Alternatives (${part.package.code})`;
  const description = `${part.opn} (${part.manufacturer}, ${part.package.code} ${part.package.pin_count}-pin) verified pinout diagram, datasheet-cited specifications, thermal limits, and pin-compatible alternatives.`;
  return {
    title,
    description,
    alternates: {
      canonical: `${siteConfig.site_url}/en/part/${part.slug}`,
    },
  };
}

interface SpecRow {
  label: string;
  value: string;
  condition: string;
  source: string;
}

function buildSpecRows(part: GoldenPartV2): SpecRow[] {
  const rows: SpecRow[] = [];

  if (part.category === 'ldo') {
    const s = part.specs;
    rows.push(
      { label: 'Output Voltage (Vout)', value: fmtCited(s.vout_v, 'V', 2), condition: s.vout_fixed ? 'Fixed Output' : 'Adjustable', source: fmtPage(s.vout_v) },
      { label: 'Output Voltage Tolerance', value: `±${fmtCited(s.vout_tolerance_pct, '%', 2)}`, condition: s.vout_tolerance_pct.condition ?? 'Nominal load / Ta=25°C', source: fmtPage(s.vout_tolerance_pct) },
      { label: 'Recommended Input Range (Vin)', value: `${fmtNum(s.vin_min_v.value, 2)} V to ${fmtNum(s.vin_max_v.value, 2)} V`, condition: s.vin_max_v.condition ?? 'Operating range', source: fmtPage(s.vin_max_v) },
      { label: 'Absolute Maximum Vin', value: fmtCited(s.vin_abs_max_v, 'V', 2), condition: s.vin_abs_max_v.condition ?? 'Stress limit — do not exceed', source: fmtPage(s.vin_abs_max_v) },
      { label: 'Max Output Current (Iout)', value: fmtCurrentMa(s.iout_max_ma.value), condition: s.iout_max_ma.condition ?? 'Subject to Tj thermal derating', source: fmtPage(s.iout_max_ma) },
      { label: 'Quiescent Current (Iq, Typ)', value: fmtIqUa(s.iq_typ_ua.value), condition: s.iq_typ_ua.condition ?? 'No load', source: fmtPage(s.iq_typ_ua) },
      { label: 'Shutdown Current (Ishdn, Typ)', value: s.ishdn_typ_ua ? fmtIqUa(s.ishdn_typ_ua.value) : 'N/A (No EN pin)', condition: s.ishdn_typ_ua?.condition ?? '—', source: fmtPage(s.ishdn_typ_ua) },
      { label: 'Dropout Voltage (Vdo, Typ)', value: fmtCited(s.dropout_typ_mv, 'mV', 0), condition: s.dropout_typ_mv.condition ?? 'Rated load', source: fmtPage(s.dropout_typ_mv) },
      { label: 'PSRR', value: s.psrr_db ? fmtCited(s.psrr_db, 'dB', 1) : 'Not Specified', condition: s.psrr_db?.condition ?? '—', source: fmtPage(s.psrr_db) },
      { label: 'Output Noise Voltage', value: s.output_noise_uvrms ? fmtCited(s.output_noise_uvrms, 'µVrms', 1) : 'Not Specified', condition: s.output_noise_uvrms?.condition ?? '—', source: fmtPage(s.output_noise_uvrms) },
      { label: 'Ceramic Cap (MLCC) Stable', value: s.ceramic_cap_stable ? 'Yes (MLCC Stable)' : 'No (Minimum ESR Required)', condition: 'Loop phase margin requirement', source: fmtPage(s.min_cout_uf) },
      { label: 'Minimum Output Capacitance', value: fmtCited(s.min_cout_uf, 'µF', 2), condition: s.min_cout_uf.condition ?? 'Effective capacitance', source: fmtPage(s.min_cout_uf) },
      {
        label: 'Output Capacitor ESR Window',
        value:
          s.esr_min_ohm || s.esr_max_ohm
            ? `${s.esr_min_ohm ? fmtNum(s.esr_min_ohm.value, 3) : '0'} Ω to ${s.esr_max_ohm ? fmtNum(s.esr_max_ohm.value, 2) : '∞'} Ω`
            : s.ceramic_cap_stable
              ? 'Low-ESR Ceramic Compatible'
              : 'Verify Datasheet ESR Curve',
        condition: s.esr_min_ohm?.condition ?? s.esr_max_ohm?.condition ?? 'Stability region',
        source: fmtPage(s.esr_min_ohm ?? s.esr_max_ohm ?? s.min_cout_uf),
      },
      { label: 'Enable (EN) Polarity', value: s.en_active_high === null ? 'No EN Pin' : s.en_active_high ? 'Active High' : 'Active Low', condition: 'Control pin logic', source: `p.${part.package.pinout_source_page}` },
      { label: 'Reverse Current Protection', value: fmtBool(s.reverse_current_protection), condition: 'Vout > Vin backfeed behavior', source: fmtPage(s.vin_abs_max_v) },
    );
  } else if (part.category === 'dcdc') {
    const s = part.specs;
    rows.push(
      { label: 'Converter Topology', value: `${s.topology.toUpperCase()} (${s.synchronous ? 'Synchronous' : 'Non-Synchronous'})`, condition: s.vout_fixed ? 'Fixed Vout' : 'Adjustable via FB divider', source: `p.${part.package.pinout_source_page}` },
      { label: 'Recommended Input Range (Vin)', value: `${fmtNum(s.vin_min_v.value, 2)} V to ${fmtNum(s.vin_max_v.value, 2)} V`, condition: s.vin_max_v.condition ?? 'Operating range', source: fmtPage(s.vin_max_v) },
      { label: 'Absolute Maximum Vin', value: fmtCited(s.vin_abs_max_v, 'V', 2), condition: s.vin_abs_max_v.condition ?? 'Stress limit', source: fmtPage(s.vin_abs_max_v) },
      { label: 'Output Voltage Range (Vout)', value: s.vout_fixed && s.vout_nom_v ? `${fmtNum(s.vout_nom_v.value, 2)} V (Fixed)` : `${fmtNum(s.vout_min_v.value, 2)} V to ${fmtNum(s.vout_max_v.value, 2)} V`, condition: s.vout_max_v.condition ?? 'Output regulation range', source: fmtPage(s.vout_nom_v ?? s.vout_max_v) },
      { label: 'Feedback Reference (Vref)', value: s.vref_v ? fmtCited(s.vref_v, 'V', 3) : 'Internal (Fixed Vout)', condition: s.vref_v?.condition ?? '—', source: fmtPage(s.vref_v) },
      { label: s.is_switch_limit ? 'Peak Switch Current Limit (Isw)' : 'Max Continuous Output Current (Iout)', value: fmtCurrentMa(s.iout_or_isw_max_ma.value), condition: s.iout_or_isw_max_ma.condition ?? (s.is_switch_limit ? 'Switch limit (not output load current)' : 'Continuous output rating'), source: fmtPage(s.iout_or_isw_max_ma) },
      { label: 'Switching Frequency (fsw, Typ)', value: fmtFrequencyKhz(s.fsw_typ_khz.value), condition: s.fsw_typ_khz.condition ?? 'Nominal switching frequency', source: fmtPage(s.fsw_typ_khz) },
      { label: 'Quiescent Current (Iq, Typ)', value: fmtIqUa(s.iq_typ_ua.value), condition: s.iq_typ_ua.condition ?? 'Non-switching / light load', source: fmtPage(s.iq_typ_ua) },
      { label: 'Peak Efficiency (η)', value: s.efficiency_peak_pct ? fmtCited(s.efficiency_peak_pct, '%', 1) : 'See Efficiency Curve', condition: s.efficiency_peak_pct?.condition ?? 'Typical operating point', source: fmtPage(s.efficiency_peak_pct) },
      { label: 'Recommended Typical Inductor (L)', value: fmtCited(s.inductor_typ_uh, 'µH', 2), condition: s.inductor_typ_uh.condition ?? 'Typical application circuit', source: fmtPage(s.inductor_typ_uh) },
      { label: 'Minimum Output Capacitance', value: fmtCited(s.min_cout_uf, 'µF', 1), condition: s.min_cout_uf.condition ?? 'Ceramic low-ESR recommended', source: fmtPage(s.min_cout_uf) },
      { label: 'Enable (EN) Polarity', value: s.en_active_high === null ? 'No EN Pin' : s.en_active_high ? 'Active High' : 'Active Low', condition: 'Control pin logic', source: `p.${part.package.pinout_source_page}` },
    );
  } else {
    const s = part.specs;
    rows.push(
      { label: 'Device Type & Channels', value: `${s.channels}-Channel ${s.device_kind === 'comparator' ? 'Comparator' : 'Operational Amplifier'}`, condition: `Output stage: ${s.output_type}`, source: `p.${part.package.pinout_source_page}` },
      { label: 'Supply Voltage Range (Vs)', value: `${fmtNum(s.vs_min_v.value, 2)} V to ${fmtNum(s.vs_max_v.value, 2)} V`, condition: s.vs_max_v.condition ?? 'Single-supply total span', source: fmtPage(s.vs_max_v) },
      { label: 'Absolute Maximum Supply (Vs,abs)', value: fmtCited(s.vs_abs_max_v, 'V', 1), condition: s.vs_abs_max_v.condition ?? 'Stress limit', source: fmtPage(s.vs_abs_max_v) },
      { label: 'Gain-Bandwidth Product (GBWP)', value: s.gbwp_mhz ? fmtCited(s.gbwp_mhz, 'MHz', 2) : 'N/A (Comparator)', condition: s.gbwp_mhz?.condition ?? 'Unity-gain small-signal', source: fmtPage(s.gbwp_mhz) },
      { label: 'Slew Rate (SR)', value: s.slew_rate_v_per_us ? fmtCited(s.slew_rate_v_per_us, 'V/µs', 2) : 'N/A (Comparator)', condition: s.slew_rate_v_per_us?.condition ?? 'Large-signal step response', source: fmtPage(s.slew_rate_v_per_us) },
      { label: 'Propagation Delay (tpd)', value: s.prop_delay_ns ? fmtCited(s.prop_delay_ns, 'ns', 0) : 'N/A (Linear Op-Amp)', condition: s.prop_delay_ns?.condition ?? 'Overdrive step response', source: fmtPage(s.prop_delay_ns) },
      { label: 'Input Offset Voltage (Vos, Max)', value: fmtCited(s.vos_max_mv, 'mV', 3), condition: s.vos_max_mv.condition ?? 'Ta = 25°C', source: fmtPage(s.vos_max_mv) },
      { label: 'Input Bias Current (Ib, Typ)', value: s.ib_typ_pa.value >= 1000 ? `${fmtNum(s.ib_typ_pa.value / 1000, 2)} nA` : `${fmtNum(s.ib_typ_pa.value, 1)} pA`, condition: s.ib_typ_pa.condition ?? 'Ta = 25°C', source: fmtPage(s.ib_typ_pa) },
      { label: 'Quiescent Current / Channel (Iq)', value: fmtIqUa(s.iq_per_ch_typ_ua.value), condition: s.iq_per_ch_typ_ua.condition ?? 'Per channel, no load', source: fmtPage(s.iq_per_ch_typ_ua) },
      { label: 'Rail-to-Rail Input / Output', value: `In: ${s.rail_to_rail_in ? 'Yes' : 'No'} · Out: ${s.rail_to_rail_out ? 'Yes' : 'No'}`, condition: 'Verify Vcm & VOH/VOL swing headroom', source: fmtPage(s.vs_max_v) },
      { label: 'Output Stage Architecture', value: s.output_type, condition: s.output_type === 'push-pull' ? 'Active sink & source' : 'External pull-up resistor required', source: `p.${part.package.pinout_source_page}` },
      { label: 'CMRR (Typ)', value: s.cmrr_typ_db ? fmtCited(s.cmrr_typ_db, 'dB', 1) : 'Not Specified', condition: s.cmrr_typ_db?.condition ?? 'DC common-mode rejection', source: fmtPage(s.cmrr_typ_db) },
      { label: 'Input Voltage Noise Density', value: s.input_noise_nv_rt_hz ? fmtCited(s.input_noise_nv_rt_hz, 'nV/√Hz', 1) : 'Not Specified', condition: s.input_noise_nv_rt_hz?.condition ?? '—', source: fmtPage(s.input_noise_nv_rt_hz) },
      { label: 'Output Short-Circuit Current', value: s.iout_short_ma ? fmtCited(s.iout_short_ma, 'mA', 0) : 'Not Specified', condition: s.iout_short_ma?.condition ?? '—', source: fmtPage(s.iout_short_ma) },
    );
  }

  // Common Thermal, Package & Provenance rows (guarantees >= 19 rows for every part!)
  rows.push(
    { label: 'Package Code (Standard / Mfg)', value: `${part.package.code} (${part.package.mfg_package_code})`, condition: `${part.package.pin_count} pins · ${part.package.pinout_view.replace('_', ' ')}`, source: `p.${part.package.pinout_source_page}` },
    { label: 'Exposed Thermal Pad / Tab Net', value: part.package.exposed_pad.present ? part.package.exposed_pad.net : 'None', condition: part.package.exposed_pad.note ?? 'Check PCB land pattern', source: `p.${part.package.pinout_source_page}` },
    { label: 'Thermal Resistance θJA', value: fmtCited(part.package.theta_ja_c_per_w, '°C/W', 1), condition: part.package.theta_ja_c_per_w.condition ?? 'JEDEC test board', source: fmtPage(part.package.theta_ja_c_per_w) },
    { label: 'Thermal Resistance θJC', value: part.package.theta_jc_c_per_w ? fmtCited(part.package.theta_jc_c_per_w, '°C/W', 1) : 'Not Specified', condition: part.package.theta_jc_c_per_w?.condition ?? '—', source: fmtPage(part.package.theta_jc_c_per_w) },
    { label: 'Max Junction Temperature (Tj,max)', value: fmtCited(part.package.tj_max_c, '°C', 0), condition: part.package.tj_max_c.condition ?? 'Absolute maximum silicon limit', source: fmtPage(part.package.tj_max_c) },
    { label: 'Ambient Temperature Grade', value: `${part.temp_grade.ta_min_c}°C to +${part.temp_grade.ta_max_c}°C`, condition: part.temp_grade.grade_label, source: fmtPage(part.package.tj_max_c) },
    { label: 'Datasheet Revision & Source', value: `${part.datasheet.revision} (${part.datasheet.page_count} pp)`, condition: `Official domain: ${part.datasheet.source_domain}`, source: `Verified ${part.datasheet.verified_at}` },
  );

  return rows;
}

function buildKeyKpis(part: GoldenPartV2): Array<{ label: string; value: string; page: string }> {
  if (part.category === 'ldo') {
    return [
      { label: 'Output Voltage', value: `${fmtNum(part.specs.vout_v.value, 2)} V`, page: fmtPage(part.specs.vout_v) },
      { label: 'Vin Operating', value: `${fmtNum(part.specs.vin_min_v.value, 1)}–${fmtNum(part.specs.vin_max_v.value, 1)} V`, page: fmtPage(part.specs.vin_max_v) },
      { label: 'Max Iout', value: fmtCurrentMa(part.specs.iout_max_ma.value), page: fmtPage(part.specs.iout_max_ma) },
      { label: 'Quiescent Iq', value: fmtIqUa(part.specs.iq_typ_ua.value), page: fmtPage(part.specs.iq_typ_ua) },
      { label: 'Dropout Vdo', value: fmtCited(part.specs.dropout_typ_mv, 'mV', 0), page: fmtPage(part.specs.dropout_typ_mv) },
      { label: 'θJA / Tj,max', value: `${fmtNum(part.package.theta_ja_c_per_w.value, 0)}°C/W · ${fmtNum(part.package.tj_max_c.value, 0)}°C`, page: fmtPage(part.package.theta_ja_c_per_w) },
    ];
  }
  if (part.category === 'dcdc') {
    return [
      { label: 'Topology', value: `${part.specs.topology.toUpperCase()}`, page: `p.${part.package.pinout_source_page}` },
      { label: 'Vin Operating', value: `${fmtNum(part.specs.vin_min_v.value, 1)}–${fmtNum(part.specs.vin_max_v.value, 1)} V`, page: fmtPage(part.specs.vin_max_v) },
      { label: part.specs.is_switch_limit ? 'Switch Limit Isw' : 'Max Iout', value: fmtCurrentMa(part.specs.iout_or_isw_max_ma.value), page: fmtPage(part.specs.iout_or_isw_max_ma) },
      { label: 'Switching fsw', value: fmtFrequencyKhz(part.specs.fsw_typ_khz.value), page: fmtPage(part.specs.fsw_typ_khz) },
      { label: 'Typ Inductor', value: fmtCited(part.specs.inductor_typ_uh, 'µH', 1), page: fmtPage(part.specs.inductor_typ_uh) },
      { label: 'Quiescent Iq', value: fmtIqUa(part.specs.iq_typ_ua.value), page: fmtPage(part.specs.iq_typ_ua) },
    ];
  }
  return [
    { label: 'Type / Ch', value: `${part.specs.channels}ch ${part.specs.device_kind === 'comparator' ? 'Comp' : 'Op-Amp'}`, page: `p.${part.package.pinout_source_page}` },
    { label: 'Supply Vs', value: `${fmtNum(part.specs.vs_min_v.value, 1)}–${fmtNum(part.specs.vs_max_v.value, 1)} V`, page: fmtPage(part.specs.vs_max_v) },
    {
      label: part.specs.device_kind === 'comparator' ? 'Prop Delay tpd' : 'GBWP',
      value:
        part.specs.device_kind === 'comparator'
          ? fmtCited(part.specs.prop_delay_ns, 'ns', 0)
          : fmtCited(part.specs.gbwp_mhz, 'MHz', 2),
      page: fmtPage(part.specs.device_kind === 'comparator' ? part.specs.prop_delay_ns : part.specs.gbwp_mhz),
    },
    {
      label: 'Slew Rate / Output',
      value: part.specs.slew_rate_v_per_us
        ? fmtCited(part.specs.slew_rate_v_per_us, 'V/µs', 2)
        : part.specs.output_type,
      page: fmtPage(part.specs.slew_rate_v_per_us ?? part.specs.vs_max_v),
    },
    { label: 'Vos Max', value: fmtCited(part.specs.vos_max_mv, 'mV', 2), page: fmtPage(part.specs.vos_max_mv) },
    { label: 'Iq / Channel', value: fmtIqUa(part.specs.iq_per_ch_typ_ua.value), page: fmtPage(part.specs.iq_per_ch_typ_ua) },
  ];
}

export default async function PartDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const part = getPartBySlug(slug);
  if (!part) notFound();

  const siteConfig = getSiteConfig();
  const relatedVs = getVsComparisonsForPart(part.slug);
  const altHub = getAllAltHubs().find((a) => a.target_slug === part.slug) ?? null;
  const specRows = buildSpecRows(part);
  const keyKpis = buildKeyKpis(part);
  const pagePath = `/en/part/${part.slug}`;

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Catalog', path: '/en/catalog' },
      { name: part.opn, path: pagePath },
    ]),
    buildTechArticleJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: pagePath,
      headline: `${part.opn} Pinout, Datasheet Specs & Thermal Calculator (${part.package.code})`,
      description: part.engineering_summary,
      dateModified: part.datasheet.verified_at,
      about: `${part.opn} ${part.manufacturer} ${part.package.code}`,
    }),
    buildDatasetJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: pagePath,
      name: `${part.opn} Verified Pinout & Datasheet Parametric Record`,
      description: `${part.opn} (${part.package.code}) electrical, thermal, and pin configuration dataset verified from ${part.datasheet.source_domain}.`,
      keywords: [part.opn, part.family, part.manufacturer, part.package.code, `${part.opn} pinout`, `${part.opn} equivalent`],
      dateModified: part.datasheet.verified_at,
    }),
  ];

  return (
    <div className="space-y-6">
      <JsonLd data={jsonLd} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <Link href="/en" className="hover:text-slate-900">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/en/catalog" className="hover:text-slate-900">
          Catalog
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-mono font-semibold text-slate-900">{part.opn}</span>
      </nav>

      {/* Part Title Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold uppercase text-white">
              {categoryLabel(part.category)}
            </span>
            <span className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
              {part.package.code} ({part.package.mfg_package_code})
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-900">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              Dual-Path Vision Verified ({Math.round(part.audit.confidence_score * 100)}%)
            </span>
            <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
              {part.lifecycle_status}
            </span>
          </div>
          <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            {part.opn}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Family <strong className="font-mono text-slate-900">{part.family}</strong> · Manufactured by{' '}
            <strong className="text-slate-900">{part.manufacturer}</strong> · Official PDF Rev:{' '}
            <span className="font-mono text-slate-800">{part.datasheet.revision}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ErrorReportButton
            siteConfig={siteConfig}
            subject={`${part.opn} (${part.package.code})`}
            pagePath={pagePath}
            datasheetRef={`${part.datasheet.pdf_url} (${part.datasheet.revision})`}
          />
        </div>
      </header>

      {/* Mandatory Compact Disclaimer Above Spec & Pinout Workbench */}
      <DisclaimerStrip siteConfig={siteConfig} />

      {/* ABOVE-THE-FOLD WORKBENCH: SVG PINOUT + KEY SPECS & ACTIONS */}
      <section aria-label="Pinout Diagram and Key Specifications" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-6">
          <PackagePinoutSvg opn={part.opn} pkg={part.package} />
        </div>

        <div className="lg:col-span-6 space-y-4">
          {/* 6 KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {keyKpis.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-lg border border-slate-300 bg-white p-3 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500">
                  <span className="font-medium truncate">{kpi.label}</span>
                  <span className="font-mono text-[10px] rounded bg-slate-100 px-1 py-0.5 text-slate-600 shrink-0">
                    {kpi.page}
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-base font-bold tabular-nums text-slate-950">
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          {/* Primary Action Bar */}
          <div className="rounded-lg border border-slate-300 bg-white p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {altHub && (
                <Link
                  href={`/en/alt/${altHub.slug}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
                >
                  View Ranked Alternatives ({altHub.candidates.length})
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
              <a
                href="#calculator"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-950 hover:bg-emerald-100 transition-colors"
              >
                Run Pre-Filled Calculator ↓
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-slate-100">
              <a
                href={part.datasheet.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-white hover:border-slate-500 transition-colors"
              >
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                  Official Manufacturer PDF
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              </a>
              <a
                href={part.datasheet.product_page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-white hover:border-slate-500 transition-colors"
              >
                <span>Manufacturer Product Page</span>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Compact Engineering Summary */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Engineering Overview
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {part.engineering_summary}
            </p>
          </div>
        </div>
      </section>

      {/* Design Gotchas & Hardware Pitfalls */}
      <section aria-label="Critical Design Gotchas" className="space-y-3">
        <h2 className="text-lg font-bold text-slate-950">
          Critical Design Gotchas &amp; Hardware Verification Notes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {part.design_gotchas.map((g, idx) => {
            const sevStyles =
              g.severity === 'CRITICAL'
                ? 'border-l-4 border-l-rose-600 border-rose-200 bg-rose-50/70'
                : g.severity === 'WARNING'
                  ? 'border-l-4 border-l-amber-500 border-amber-200 bg-amber-50/70'
                  : 'border-l-4 border-l-sky-600 border-sky-200 bg-sky-50/70';
            const badgeStyles =
              g.severity === 'CRITICAL'
                ? 'bg-rose-600 text-white'
                : g.severity === 'WARNING'
                  ? 'bg-amber-600 text-white'
                  : 'bg-sky-700 text-white';
            return (
              <div key={idx} className={`rounded-r-lg border p-4 ${sevStyles}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${badgeStyles}`}>
                    {g.severity}
                  </span>
                  {g.page !== undefined && (
                    <span className="font-mono text-[11px] text-slate-600">Datasheet p.{g.page}</span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-950 flex items-start gap-1.5">
                  {g.severity === 'CRITICAL' ? (
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : g.severity === 'WARNING' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <span>{g.title}</span>
                </h3>
                <p className="mt-1.5 text-xs text-slate-700 leading-relaxed">{g.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pin Configuration Table */}
      <section aria-label="Pin Configuration Table" className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-950">
            Pin Configuration ({part.package.code} · {part.package.pinout_view.replace('_', ' ')})
          </h2>
          <span className="font-mono text-xs text-slate-600">
            Source: Official Datasheet p.{part.package.pinout_source_page}
          </span>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-900 text-slate-100 font-mono text-[11px] uppercase">
              <tr>
                <th className="px-3.5 py-2.5 text-left w-16">Pin #</th>
                <th className="px-3.5 py-2.5 text-left w-32">Pin Name</th>
                <th className="px-3.5 py-2.5 text-left w-32">Signal Role</th>
                <th className="px-3.5 py-2.5 text-left">Functional Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {part.package.pinout.map((pin) => (
                <tr key={pin.pin} className="hover:bg-slate-50">
                  <td className="px-3.5 py-2 font-mono font-bold text-slate-950">{pin.pin}</td>
                  <td className="px-3.5 py-2 font-mono font-semibold text-slate-900">{pin.name}</td>
                  <td className="px-3.5 py-2">
                    <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
                      {pin.role}
                    </span>
                  </td>
                  <td className="px-3.5 py-2 text-slate-700">{pin.description}</td>
                </tr>
              ))}
              {part.package.exposed_pad.present && (
                <tr className="bg-amber-50/70">
                  <td className="px-3.5 py-2 font-mono font-bold text-amber-950">EP/TAB</td>
                  <td className="px-3.5 py-2 font-mono font-semibold text-amber-950">
                    Thermal Pad / Tab
                  </td>
                  <td className="px-3.5 py-2">
                    <span className="rounded bg-amber-600 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">
                      {part.package.exposed_pad.net}
                    </span>
                  </td>
                  <td className="px-3.5 py-2 text-amber-950">
                    {part.package.exposed_pad.note ??
                      `Electrical net: ${part.package.exposed_pad.net}. Verify PCB copper tie before layout.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Complete Datasheet-Cited Specification Table */}
      <section aria-label="Datasheet Cited Specifications" className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-950">
            Datasheet-Cited Electrical &amp; Thermal Specifications
          </h2>
          <span className="font-mono text-xs text-slate-600">
            {specRows.length} cited parameters · {part.datasheet.source_domain}
          </span>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-900 text-slate-100 font-mono text-[11px] uppercase">
              <tr>
                <th className="px-3.5 py-2.5 text-left">Parameter</th>
                <th className="px-3.5 py-2.5 text-left">Datasheet Value</th>
                <th className="px-3.5 py-2.5 text-left">Test Condition / Engineering Note</th>
                <th className="px-3.5 py-2.5 text-right">PDF Citation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {specRows.map((row) => (
                <tr key={row.label} className="hover:bg-slate-50">
                  <td className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                    {row.label}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono font-bold tabular-nums text-slate-950 whitespace-nowrap">
                    {row.value}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-600">{row.condition}</td>
                  <td className="px-3.5 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">{row.source}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Embedded Pre-Filled Engineering Calculator */}
      <section id="calculator" aria-label="Pre-filled Engineering Calculator" className="scroll-mt-20 space-y-2.5">
        <h2 className="text-lg font-bold text-slate-950">
          Pre-Filled Interactive Workbench Calculator for{' '}
          <span className="font-mono">{part.opn}</span>
        </h2>
        {part.category === 'ldo' && (
          <LdoThermalCalculator
            initialPreset={{
              opn: part.opn,
              vout: part.specs.vout_v.value,
              vinMin: part.specs.vin_min_v.value,
              vinMax: part.specs.vin_max_v.value,
              ioutMaxMa: part.specs.iout_max_ma.value,
              iqUa: part.specs.iq_typ_ua.value,
              dropoutMv: part.specs.dropout_typ_mv.value,
              thetaJa: part.package.theta_ja_c_per_w.value,
              tjMax: part.package.tj_max_c.value,
            }}
            presets={[]}
          />
        )}
        {part.category === 'dcdc' && (
          <DcdcEfficiencyRippleCalculator
            initialPreset={{
              opn: part.opn,
              topology: part.specs.topology,
              vinMin: part.specs.vin_min_v.value,
              vinMax: part.specs.vin_max_v.value,
              voutNom: part.specs.vout_nom_v?.value ?? Math.min(5.0, part.specs.vout_max_v.value),
              fswKhz: part.specs.fsw_typ_khz.value,
              inductorUh: part.specs.inductor_typ_uh.value,
              ratedCurrentMa: part.specs.iout_or_isw_max_ma.value,
              isSwitchLimit: part.specs.is_switch_limit,
              synchronous: part.specs.synchronous,
              efficiencyPct: part.specs.efficiency_peak_pct?.value ?? 90,
            }}
            presets={[]}
          />
        )}
        {part.category === 'opamp' && (
          <OpampGbwpSlewCalculator
            initialPreset={{
              opn: part.opn,
              deviceKind: part.specs.device_kind,
              gbwpMhz: part.specs.gbwp_mhz ? part.specs.gbwp_mhz.value : null,
              slewRateVus: part.specs.slew_rate_v_per_us ? part.specs.slew_rate_v_per_us.value : null,
              propDelayNs: part.specs.prop_delay_ns ? part.specs.prop_delay_ns.value : null,
              vsMax: part.specs.vs_max_v.value,
            }}
            presets={[]}
          />
        )}
      </section>

      {/* Related 1:1 Pin-Diff Comparisons & Typical Use Cases */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 rounded-lg border border-slate-300 bg-white p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-950">
              1:1 Pin-Diff Comparisons for {part.opn}
            </h2>
            {altHub && (
              <Link
                href={`/en/alt/${altHub.slug}`}
                className="text-xs font-semibold text-sky-700 hover:underline"
              >
                All Ranked Alternatives →
              </Link>
            )}
          </div>
          {relatedVs.length === 0 ? (
            <p className="text-xs text-slate-600">
              Browse the{' '}
              <Link href="/en/catalog" className="text-sky-700 font-semibold underline">
                parametric catalog
              </Link>{' '}
              to compare similar {categoryLabel(part.category)} devices.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {relatedVs.map((vs) => {
                const style = getCompatibilityStyle(vs.compatibility_level);
                return (
                  <Link
                    key={vs.slug}
                    href={`/en/vs/${vs.slug}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:bg-slate-50 px-2 -mx-2 rounded transition-colors"
                  >
                    <div className="font-mono text-xs font-bold text-slate-950">
                      {vs.part_a_opn} <span className="font-sans font-normal text-slate-400">vs</span>{' '}
                      {vs.part_b_opn}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
                    >
                      {style.tierCode}: {style.shortLabel}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 rounded-lg border border-slate-300 bg-white p-5 space-y-3">
          <h2 className="text-base font-bold text-slate-950">Typical Engineering Applications</h2>
          <ul className="space-y-2 text-xs text-slate-700">
            {part.typical_use_cases.map((uc, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
                <span className="leading-relaxed">{uc}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Zero-Scraping Distributor Search Deeplinks */}
      <DistributorLinks siteConfig={siteConfig} opn={part.opn} />

      {/* Contextual Bench Validation Lab Gear */}
      <LabGearAffiliate siteConfig={siteConfig} category={part.category} />

      {/* Audit Trail Provenance */}
      <section className="rounded-lg border border-slate-200 bg-slate-100/70 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="space-y-1">
          <div className="font-mono font-semibold text-slate-800">
            Audit Trail · Mode: {part.datasheet.parse_source_mode} · Vision Pages Checked: [
            {part.audit.vision_pages_checked.join(', ')}] · Physics Gate:{' '}
            {part.audit.physics_checks_passed ? 'PASS' : 'REVIEW'}
          </div>
          <p className="text-[11px] text-slate-500">{part.audit.audit_notes.join(' · ')}</p>
        </div>
        <ErrorReportButton
          siteConfig={siteConfig}
          subject={`${part.opn} Audit Review`}
          pagePath={pagePath}
          datasheetRef={`${part.datasheet.pdf_url} (${part.datasheet.revision})`}
        />
      </section>
    </div>
  );
}
