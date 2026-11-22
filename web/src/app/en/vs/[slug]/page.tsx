import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  getAllAltHubs,
  getAllVsComparisons,
  getPartBySlug,
  getSiteConfig,
  getVsComparisonBySlug,
} from '@/lib/data-loader';
import { PackagePinoutSvg, type DiffStatus } from '@/components/PackagePinoutSvg';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { ErrorReportButton } from '@/components/ErrorReportButton';
import { DistributorLinks } from '@/components/DistributorLinks';
import { LabGearAffiliate } from '@/components/LabGearAffiliate';
import { JsonLd } from '@/components/JsonLd';
import {
  buildBreadcrumbJsonLd,
  buildDatasetJsonLd,
  buildTechArticleJsonLd,
  categoryLabel,
  getCompatibilityStyle,
} from '@/lib/format';

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllVsComparisons().map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vs = getVsComparisonBySlug(slug);
  const siteConfig = getSiteConfig();
  if (!vs) return { title: 'Comparison Not Found' };

  return {
    title: `${vs.part_a_opn} vs ${vs.part_b_opn} — Pinout Diff & Compatibility Comparison`,
    description: `${vs.part_a_opn} vs ${vs.part_b_opn}: ${vs.compatibility_badge}. Side-by-side SVG pinout diff, parameter winner matrix, and swap risks verified from official datasheets.`,
    alternates: {
      canonical: `${siteConfig.site_url}/en/vs/${vs.slug}/`,
    },
  };
}

export default async function VsComparisonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vs = getVsComparisonBySlug(slug);
  if (!vs) notFound();

  const siteConfig = getSiteConfig();
  const partA = getPartBySlug(vs.part_a_slug);
  const partB = getPartBySlug(vs.part_b_slug);
  const altSlugSet = new Set(getAllAltHubs().map((a) => a.target_slug));
  const style = getCompatibilityStyle(vs.compatibility_level);
  const pagePath = `/en/vs/${vs.slug}`;

  // Build synchronized Diff Highlights map for both SVG pinout diagrams
  const diffHighlights: Record<number, DiffStatus> = {};
  for (const row of vs.pin_diff) {
    diffHighlights[row.pin] = row.status;
  }

  const mismatchCount = vs.pin_diff.filter((r) => r.status === 'MISMATCH').length;
  const cautionCount = vs.pin_diff.filter((r) => r.status === 'CAUTION').length;
  const matchCount = vs.pin_diff.filter((r) => r.status === 'MATCH').length;

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Catalog', path: '/en/catalog' },
      { name: `${vs.part_a_opn} vs ${vs.part_b_opn}`, path: pagePath },
    ]),
    buildTechArticleJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: pagePath,
      headline: `${vs.part_a_opn} vs ${vs.part_b_opn}: Pinout Diff & Substitution Analysis`,
      description: vs.engineering_verdict,
      dateModified: vs.generated_at,
      about: `${vs.part_a_opn} vs ${vs.part_b_opn}`,
    }),
    buildDatasetJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: pagePath,
      name: `${vs.part_a_opn} vs ${vs.part_b_opn} Side-by-Side Pin & Parametric Diff`,
      description: `Pin-by-pin and electrical parameter comparison between ${vs.part_a_opn} and ${vs.part_b_opn}.`,
      keywords: [
        `${vs.part_a_opn} vs ${vs.part_b_opn}`,
        `${vs.part_a_opn} pinout`,
        `${vs.part_b_opn} pinout`,
        'drop-in replacement check',
      ],
      dateModified: vs.generated_at,
    }),
  ];

  return (
    <div className="space-y-6">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <Link href="/en" className="hover:text-slate-900">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/en/catalog" className="hover:text-slate-900">
          Catalog
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-mono font-semibold text-slate-900">
          {vs.part_a_opn} vs {vs.part_b_opn}
        </span>
      </nav>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="font-mono text-[11px] font-bold uppercase text-slate-500">
            1:1 Pinout &amp; Parametric Diff · {categoryLabel(vs.category)}
          </div>
          <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            {vs.part_a_opn} <span className="font-sans font-normal text-slate-400">vs</span>{' '}
            {vs.part_b_opn}
          </h1>
        </div>
        <ErrorReportButton
          siteConfig={siteConfig}
          subject={`VS Diff: ${vs.part_a_opn} vs ${vs.part_b_opn}`}
          pagePath={pagePath}
        />
      </header>

      {/* ABOVE-THE-FOLD COMPATIBILITY VERDICT BANNER */}
      <section
        aria-label="Compatibility Level Verdict"
        className={`rounded-lg border-2 p-4 sm:p-5 ${style.bannerBg} ${style.bannerBorder}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs font-bold uppercase ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
              >
                <span className={`h-2 w-2 rounded-full ${style.dotColor}`} />
                {style.tierCode}
              </span>
              <span className="text-sm sm:text-base font-bold text-slate-950">
                {vs.compatibility_badge}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-700">
              Pin Audit Summary: <strong className="text-emerald-800">{matchCount} Match</strong> ·{' '}
              <strong className="text-amber-800">{cautionCount} Caution</strong> ·{' '}
              <strong className="text-rose-800">{mismatchCount} Mismatch</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span
              className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 font-semibold ${
                vs.package_match
                  ? 'border-emerald-300 bg-white text-emerald-900'
                  : 'border-rose-300 bg-white text-rose-900'
              }`}
            >
              {vs.package_match ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
              )}
              Package: {vs.package_match ? 'Match' : 'Different'}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 font-semibold ${
                vs.pinout_exact_match
                  ? 'border-emerald-300 bg-white text-emerald-900'
                  : 'border-rose-300 bg-white text-rose-900'
              }`}
            >
              {vs.pinout_exact_match ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
              )}
              Pinout: {vs.pinout_exact_match ? 'Exact Match' : 'Mismatch'}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 font-semibold ${
                vs.exposed_pad_match
                  ? 'border-emerald-300 bg-white text-emerald-900'
                  : 'border-rose-300 bg-white text-rose-900'
              }`}
            >
              {vs.exposed_pad_match ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
              )}
              EP / Tab: {vs.exposed_pad_match ? 'Compatible' : 'Conflict'}
            </span>
          </div>
        </div>
      </section>

      <DisclaimerStrip siteConfig={siteConfig} />

      {/* ABOVE-THE-FOLD SIDE-BY-SIDE DIFF SVG PINMAPS */}
      <section aria-label="Side-by-Side Pinout Diff Diagrams" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-950">
            Side-by-Side Pinout Diff Diagrams
          </h2>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Match
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Caution
            </span>
            <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Mismatch
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Part A ·{' '}
                {partA ? (
                  <Link
                    href={`/en/part/${partA.slug}`}
                    className="font-mono text-sky-700 hover:underline"
                  >
                    {partA.opn}
                  </Link>
                ) : (
                  <span className="font-mono text-slate-900">{vs.part_a_opn}</span>
                )}
              </span>
              {partA && (
                <span className="text-xs text-slate-500">{partA.manufacturer}</span>
              )}
            </div>
            {partA ? (
              <PackagePinoutSvg
                opn={partA.opn}
                pkg={partA.package}
                diffHighlights={diffHighlights}
              />
            ) : (
              <div className="rounded-lg border border-slate-300 bg-white p-6 text-xs text-slate-500">
                Full package data for {vs.part_a_opn} unavailable.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Part B ·{' '}
                {partB ? (
                  <Link
                    href={`/en/part/${partB.slug}`}
                    className="font-mono text-sky-700 hover:underline"
                  >
                    {partB.opn}
                  </Link>
                ) : (
                  <span className="font-mono text-slate-900">{vs.part_b_opn}</span>
                )}
              </span>
              {partB && (
                <span className="text-xs text-slate-500">{partB.manufacturer}</span>
              )}
            </div>
            {partB ? (
              <PackagePinoutSvg
                opn={partB.opn}
                pkg={partB.package}
                diffHighlights={diffHighlights}
              />
            ) : (
              <div className="rounded-lg border border-slate-300 bg-white p-6 text-xs text-slate-500">
                Full package data for {vs.part_b_opn} unavailable.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pin-by-Pin Diff Table */}
      <section aria-label="Pin-by-Pin Diff Table" className="space-y-2.5">
        <h2 className="text-lg font-bold text-slate-950">Pin-by-Pin Diff Table</h2>
        <div className="rounded-lg border border-slate-300 bg-white overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-900 text-slate-100 font-mono text-[11px] uppercase">
              <tr>
                <th className="px-3.5 py-2.5 text-left w-16">Pin #</th>
                <th className="px-3.5 py-2.5 text-left">{vs.part_a_opn} (Part A)</th>
                <th className="px-3.5 py-2.5 text-left">{vs.part_b_opn} (Part B)</th>
                <th className="px-3.5 py-2.5 text-left w-28">Status</th>
                <th className="px-3.5 py-2.5 text-left">Engineering Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {vs.pin_diff.map((row) => {
                const rowBg =
                  row.status === 'MISMATCH'
                    ? 'bg-rose-50/70'
                    : row.status === 'CAUTION'
                      ? 'bg-amber-50/60'
                      : 'bg-white';
                const statusBadge =
                  row.status === 'MISMATCH'
                    ? 'bg-rose-600 text-white'
                    : row.status === 'CAUTION'
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-600 text-white';
                return (
                  <tr key={row.pin} className={rowBg}>
                    <td className="px-3.5 py-2.5 font-mono font-bold text-slate-950">{row.pin}</td>
                    <td className="px-3.5 py-2.5 font-mono">
                      <span className="font-bold text-slate-950">{row.part_a_name || 'N/A'}</span>
                      {row.part_a_role ? (
                        <span className="text-slate-500"> ({row.part_a_role})</span>
                      ) : null}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono">
                      <span className="font-bold text-slate-950">{row.part_b_name || 'N/A'}</span>
                      {row.part_b_role ? (
                        <span className="text-slate-500"> ({row.part_b_role})</span>
                      ) : null}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${statusBadge}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-700">{row.note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Parameter Winner Matrix */}
      <section aria-label="Parameter Winner Matrix" className="space-y-2.5">
        <h2 className="text-lg font-bold text-slate-950">Parameter Winner Matrix</h2>
        <div className="rounded-lg border border-slate-300 bg-white overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-900 text-slate-100 font-mono text-[11px] uppercase">
              <tr>
                <th className="px-3.5 py-2.5 text-left">Metric</th>
                <th className="px-3 py-2.5 text-left">Unit</th>
                <th className="px-3.5 py-2.5 text-right">{vs.part_a_opn}</th>
                <th className="px-3.5 py-2.5 text-right">{vs.part_b_opn}</th>
                <th className="px-3 py-2.5 text-center">Advantage</th>
                <th className="px-3.5 py-2.5 text-left">Engineering Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {vs.parameter_matrix.map((row) => {
                const winnerBadge =
                  row.winner === 'A'
                    ? 'bg-sky-100 text-sky-900 border-sky-300'
                    : row.winner === 'B'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-slate-100 text-slate-700 border-slate-300';
                const winnerLabel =
                  row.winner === 'A'
                    ? 'Part A'
                    : row.winner === 'B'
                      ? 'Part B'
                      : row.winner === 'TIE'
                        ? 'Tie'
                        : 'Context';
                return (
                  <tr key={row.metric} className="hover:bg-slate-50">
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                      {row.metric}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                      {row.unit || '—'}
                    </td>
                    <td
                      className={`px-3.5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                        row.winner === 'A' ? 'font-bold text-sky-900' : 'text-slate-800'
                      }`}
                    >
                      {row.part_a_value || '—'}
                    </td>
                    <td
                      className={`px-3.5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                        row.winner === 'B' ? 'font-bold text-emerald-900' : 'text-slate-800'
                      }`}
                    >
                      {row.part_b_value || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${winnerBadge}`}>
                        {winnerLabel}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">{row.note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Swap Risks & Engineering Verdict */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-6 rounded-lg border border-l-4 border-rose-200 border-l-rose-600 bg-rose-50/60 p-5 space-y-3">
          <h2 className="text-base font-bold text-rose-950 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-700" aria-hidden="true" />
            Swap Risks &amp; Mandatory Bench Checks
          </h2>
          <ul className="space-y-2 text-xs sm:text-sm text-rose-950">
            {vs.swap_risks.map((risk, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
                <span className="leading-relaxed">{risk}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:col-span-6 rounded-lg border border-slate-300 bg-white p-5 space-y-3 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950 mb-2">Engineering Verdict</h2>
            <p className="text-sm text-slate-700 leading-relaxed">{vs.engineering_verdict}</p>
          </div>
          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2">
            {partA && (
              <Link
                href={`/en/part/${partA.slug}`}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs font-semibold text-slate-900 hover:bg-slate-100"
              >
                {partA.opn} Specs <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            )}
            {partB && (
              <Link
                href={`/en/part/${partB.slug}`}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs font-semibold text-slate-900 hover:bg-slate-100"
              >
                {partB.opn} Specs <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            )}
            {altSlugSet.has(vs.part_a_slug) && (
              <Link
                href={`/en/alt/${vs.part_a_slug}-alternatives`}
                className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {vs.part_a_opn} Alts
              </Link>
            )}
            {altSlugSet.has(vs.part_b_slug) && (
              <Link
                href={`/en/alt/${vs.part_b_slug}-alternatives`}
                className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {vs.part_b_opn} Alts
              </Link>
            )}
          </div>
        </section>
      </div>

      {/* Dual Distributor Search Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DistributorLinks siteConfig={siteConfig} opn={vs.part_a_opn} label="Part A Stock Search: " />
        <DistributorLinks siteConfig={siteConfig} opn={vs.part_b_opn} label="Part B Stock Search: " />
      </div>

      <LabGearAffiliate siteConfig={siteConfig} category={vs.category} />
    </div>
  );
}
