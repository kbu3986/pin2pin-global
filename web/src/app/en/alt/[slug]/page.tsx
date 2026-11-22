import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CheckSquare, ChevronRight } from 'lucide-react';
import {
  getAllAltHubs,
  getAllVsComparisons,
  getAltHubBySlug,
  getPartBySlug,
  getSiteConfig,
} from '@/lib/data-loader';
import { PackagePinoutSvg } from '@/components/PackagePinoutSvg';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { ErrorReportButton } from '@/components/ErrorReportButton';
import { DistributorLinks } from '@/components/DistributorLinks';
import { LabGearAffiliate } from '@/components/LabGearAffiliate';
import { AdSenseSlot } from '@/components/AdSenseSlot';
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
  return getAllAltHubs().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const alt = getAltHubBySlug(slug);
  const siteConfig = getSiteConfig();
  if (!alt) return { title: 'Alternatives Not Found' };

  return {
    title: `${alt.target_opn} Alternatives, Equivalents & Pin-Compatible Replacements`,
    description: `Ranked candidate drop-in and functional replacements for ${alt.target_opn} with pinout compatibility tiers, key engineering tradeoffs, and 1:1 pin-diff links.`,
    alternates: {
      canonical: `${siteConfig.site_url}/en/alt/${alt.slug}/`,
    },
  };
}

export default async function AlternativesHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const alt = getAltHubBySlug(slug);
  if (!alt) notFound();

  const siteConfig = getSiteConfig();
  const targetPart = getPartBySlug(alt.target_slug);
  const existingVsSet = new Set(getAllVsComparisons().map((v) => v.slug));
  const pagePath = `/en/alt/${alt.slug}`;

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Catalog', path: '/en/catalog' },
      ...(targetPart ? [{ name: targetPart.opn, path: `/en/part/${targetPart.slug}` }] : []),
      { name: `${alt.target_opn} Alternatives`, path: pagePath },
    ]),
    buildTechArticleJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: pagePath,
      headline: `${alt.target_opn} Ranked Alternatives & Cross-Reference Replacements`,
      description: alt.summary,
      dateModified: alt.generated_at,
      about: `${alt.target_opn} equivalents and alternatives`,
    }),
    buildDatasetJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: pagePath,
      name: `${alt.target_opn} Cross-Reference Candidates Dataset`,
      description: `Ranked cross-reference alternatives for ${alt.target_opn} audited against official manufacturer datasheets.`,
      keywords: [
        `${alt.target_opn} alternative`,
        `${alt.target_opn} equivalent`,
        `${alt.target_opn} replacement`,
        `${alt.target_opn} cross reference`,
      ],
      dateModified: alt.generated_at,
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
        {targetPart && (
          <>
            <Link href={`/en/part/${targetPart.slug}`} className="font-mono hover:text-slate-900">
              {targetPart.opn}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </>
        )}
        <span className="font-medium text-slate-900">Alternatives</span>
      </nav>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold uppercase text-white">
              {categoryLabel(alt.category)} Cross-Reference
            </span>
            {targetPart && (
              <span className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
                Target Package: {targetPart.package.code}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            <span className="font-mono">{alt.target_opn}</span> Ranked Alternatives &amp; Replacements
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">{alt.summary}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {targetPart && (
            <Link
              href={`/en/part/${targetPart.slug}`}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              ← View {targetPart.opn} Datasheet Specs
            </Link>
          )}
          <ErrorReportButton
            siteConfig={siteConfig}
            subject={`${alt.target_opn} Alternatives Matrix`}
            pagePath={pagePath}
          />
        </div>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      {/* Above-the-Fold Target Pinout Reference + Ranked Candidates Overview */}
      {targetPart && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5">
            <PackagePinoutSvg opn={targetPart.opn} pkg={targetPart.package} compact />
          </div>
          <div className="lg:col-span-7 rounded-lg border border-slate-300 bg-white p-5 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Baseline Target Reference ({targetPart.opn})
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {targetPart.engineering_summary}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
              <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                <div className="text-[11px] text-slate-500">Manufacturer</div>
                <div className="text-xs font-bold text-slate-900 mt-0.5">{targetPart.manufacturer}</div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                <div className="text-[11px] text-slate-500">Package</div>
                <div className="font-mono text-xs font-bold text-slate-900 mt-0.5">
                  {targetPart.package.code} ({targetPart.package.pin_count}p)
                </div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                <div className="text-[11px] text-slate-500">Exposed Pad / Tab</div>
                <div className="font-mono text-xs font-bold text-slate-900 mt-0.5">
                  {targetPart.package.exposed_pad.present
                    ? targetPart.package.exposed_pad.net
                    : 'NONE'}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Ranked Candidates Table */}
      <section aria-label="Ranked Alternative Candidates" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-950">
            Ranked Replacement Candidates ({alt.candidates.length})
          </h2>
          <span className="font-mono text-xs text-slate-500">
            Sorted by pinout match &amp; engineering compatibility score
          </span>
        </div>

        <div className="rounded-lg border border-slate-300 bg-white overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-900 text-slate-100 font-mono text-[11px] uppercase">
              <tr>
                <th className="px-3.5 py-2.5 text-left">Score</th>
                <th className="px-3.5 py-2.5 text-left">Candidate OPN</th>
                <th className="px-3 py-2.5 text-left">Package</th>
                <th className="px-3 py-2.5 text-left">Compatibility Level</th>
                <th className="px-3 py-2.5 text-left">Engineering Tier</th>
                <th className="px-3 py-2.5 text-left">Key Advantage</th>
                <th className="px-3 py-2.5 text-left">Key Tradeoff / Risk</th>
                <th className="px-3.5 py-2.5 text-right">1:1 Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {alt.candidates.map((c, idx) => {
                const style = getCompatibilityStyle(c.compatibility_level);
                const hasVs = c.vs_slug !== null && existingVsSet.has(c.vs_slug);
                return (
                  <tr key={`${c.alt_slug}-${idx}`} className="hover:bg-slate-50">
                    <td className="px-3.5 py-3 font-mono font-bold tabular-nums text-slate-950 whitespace-nowrap">
                      <span className="inline-flex h-7 w-10 items-center justify-center rounded bg-slate-100 border border-slate-300">
                        {Math.round(c.score)}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <Link
                        href={`/en/part/${c.alt_slug}`}
                        className="font-mono font-bold text-slate-950 hover:text-sky-700 hover:underline block"
                      >
                        {c.alt_opn}
                      </Link>
                      <span className="text-[11px] text-slate-500">{c.manufacturer}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
                        {c.package_code}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dotColor}`} />
                        {style.tierCode}: {style.shortLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="rounded bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-semibold text-sky-900">
                        {c.tier_tag}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700 min-w-[180px]">{c.key_advantage}</td>
                    <td className="px-3 py-3 text-slate-700 min-w-[180px]">{c.key_tradeoff}</td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      {hasVs && c.vs_slug ? (
                        <Link
                          href={`/en/vs/${c.vs_slug}`}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                        >
                          Pin Diff
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      ) : (
                        <Link
                          href={`/en/part/${c.alt_slug}`}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          View Spec
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Selection Checklist */}
      <section className="rounded-lg border border-slate-300 bg-white p-5 space-y-3">
        <h2 className="text-base font-bold text-slate-950">
          Pre-Production Substitution Verification Checklist
        </h2>
        <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
          {alt.selection_checklist.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <CheckSquare className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <DistributorLinks
        siteConfig={siteConfig}
        opn={alt.target_opn}
        label={`Check Live Distributor Stock for Baseline Part: `}
      />

      <LabGearAffiliate siteConfig={siteConfig} category={alt.category} />

      <AdSenseSlot
        publisherId={siteConfig.monetization.adsense_publisher_id}
        enabled={siteConfig.monetization.adsense_enabled}
      />
    </div>
  );
}
