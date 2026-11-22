import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import {
  getAllGuides,
  getAllParts,
  getAllVsComparisons,
  getGuideBySlug,
  getSiteConfig,
} from '@/lib/data-loader';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { LabGearAffiliate } from '@/components/LabGearAffiliate';
import { AdSenseSlot } from '@/components/AdSenseSlot';
import { JsonLd } from '@/components/JsonLd';
import {
  buildBreadcrumbJsonLd,
  buildTechArticleJsonLd,
  categoryLabel,
} from '@/lib/format';
import type { PartCategory } from '@/types/schema';

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  const siteConfig = getSiteConfig();
  if (!guide) return { title: 'Guide Not Found' };

  return {
    title: guide.title,
    description: guide.summary,
    alternates: {
      canonical: `${siteConfig.site_url}/en/guides/${guide.slug}/`,
    },
  };
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  const siteConfig = getSiteConfig();
  const allParts = getAllParts();
  const allVs = getAllVsComparisons();
  const allGuides = getAllGuides();

  const relatedParts = guide.related_parts
    .map((s) => allParts.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const relatedVs = guide.related_vs
    .map((s) => allVs.find((v) => v.slug === s))
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  const otherGuides = allGuides.filter((g) => g.slug !== guide.slug);
  const labCategory: PartCategory = guide.category === 'general' ? 'ldo' : guide.category;
  const pagePath = `/en/guides/${guide.slug}`;

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: guide.title, path: pagePath },
    ]),
    buildTechArticleJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: pagePath,
      headline: guide.title,
      description: guide.summary,
      datePublished: guide.published_at,
      dateModified: guide.updated_at,
    }),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <Link href="/en" className="hover:text-slate-900">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/en#guides" className="hover:text-slate-900">
          Field Guides
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-slate-900 truncate">{guide.title}</span>
      </nav>

      {/* Guide Header */}
      <header className="rounded-lg border border-slate-300 bg-white p-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 font-bold uppercase text-emerald-300">
            <BookOpen className="h-3 w-3" aria-hidden="true" />
            {categoryLabel(guide.category)} Guide
          </span>
          <span className="text-slate-500">{guide.reading_time_min} min read</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">{guide.author_role}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">Updated {guide.updated_at}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          {guide.title}
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">{guide.subtitle}</p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      {/* Key Takeaways Box */}
      <section className="rounded-lg border border-emerald-300 bg-emerald-50/70 p-5 space-y-2.5">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-900">
          Key Engineering Takeaways
        </h2>
        <ul className="space-y-1.5 text-sm text-emerald-950">
          {guide.key_takeaways.map((kt, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
              <span className="leading-relaxed">{kt}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Structured Sections */}
      <article className="space-y-6">
        {guide.sections.map((sec, idx) => (
          <section
            key={idx}
            className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 space-y-4"
          >
            <h2 className="text-lg sm:text-xl font-bold text-slate-950 border-b border-slate-100 pb-2">
              {sec.heading}
            </h2>
            <div className="space-y-3">
              {sec.body.map((para, pIdx) => (
                <p key={pIdx} className="text-sm text-slate-700 leading-relaxed">
                  {para}
                </p>
              ))}
            </div>

            {sec.callout && (
              <div
                className={`rounded-r-md border border-l-4 p-4 space-y-1 ${
                  sec.callout.type === 'CRITICAL'
                    ? 'border-rose-200 border-l-rose-600 bg-rose-50/70 text-rose-950'
                    : sec.callout.type === 'WARNING'
                      ? 'border-amber-200 border-l-amber-500 bg-amber-50/70 text-amber-950'
                      : 'border-sky-200 border-l-sky-600 bg-sky-50/70 text-sky-950'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1.5">
                  {sec.callout.type === 'CRITICAL' ? (
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" aria-hidden="true" />
                  ) : sec.callout.type === 'WARNING' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
                  ) : (
                    <Lightbulb className="h-4 w-4 text-sky-600 shrink-0" aria-hidden="true" />
                  )}
                  <span>{sec.callout.title}</span>
                </div>
                <p className="text-xs leading-relaxed">{sec.callout.text}</p>
              </div>
            )}

            {sec.table && sec.table.headers.length > 0 && (
              <div className="rounded-md border border-slate-300 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-900 text-slate-100 font-mono text-[11px]">
                    <tr>
                      {sec.table.headers.map((h, hIdx) => (
                        <th key={hIdx} className="px-3 py-2 text-left">
                          {h || '—'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {sec.table.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-3 py-2 ${cIdx === 0 ? 'font-mono font-semibold text-slate-950' : 'text-slate-700'}`}
                          >
                            {cell && cell.trim() !== '' ? cell : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </article>

      {/* Related Verified Parts & VS Comparisons */}
      {(relatedParts.length > 0 || relatedVs.length > 0) && (
        <section className="rounded-lg border border-slate-300 bg-white p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-950">
            Referenced OPNs &amp; Pin-Diff Comparisons in This Guide
          </h2>
          {relatedParts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono font-semibold uppercase text-slate-500">
                Verified Part Datasheets
              </h3>
              <div className="flex flex-wrap gap-2">
                {relatedParts.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/en/part/${p.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs font-bold text-slate-900 hover:border-sky-600 hover:text-sky-800"
                  >
                    {p.opn}
                    <span className="text-[10px] font-normal text-slate-500">
                      ({p.package.code})
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {relatedVs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-mono font-semibold uppercase text-slate-500">
                1:1 Pinout Diff Pages
              </h3>
              <div className="flex flex-wrap gap-2">
                {relatedVs.map((v) => (
                  <Link
                    key={v.slug}
                    href={`/en/vs/${v.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 font-mono text-xs font-bold text-sky-950 hover:bg-sky-100"
                  >
                    {v.part_a_opn} vs {v.part_b_opn}
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Other Guides */}
      {otherGuides.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-bold text-slate-950">More Engineering Field Guides</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {otherGuides.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/en/guides/${g.slug}`}
                  className="font-semibold text-sky-700 hover:underline"
                >
                  {g.title} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <LabGearAffiliate siteConfig={siteConfig} category={labCategory} />

      <AdSenseSlot
        publisherId={siteConfig.monetization.adsense_publisher_id}
        enabled={siteConfig.monetization.adsense_enabled}
      />
    </div>
  );
}
