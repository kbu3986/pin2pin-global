import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';
import {
  getAllGuides,
  getAllParts,
  getGuideWordCount,
  getMaxGuideUpdatedAt,
  getSiteConfig,
} from '@/lib/data-loader';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { JsonLd } from '@/components/JsonLd';
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildPageMetadata,
} from '@/lib/format';
import { GuidesCatalogClient, type GuideCardItem } from './GuidesCatalogClient';

const siteConfig = getSiteConfig();

export const metadata: Metadata = buildPageMetadata({
  siteUrl: siteConfig.site_url,
  siteName: siteConfig.site_name,
  path: '/en/guides',
  title: 'Hardware Engineering Field Guides & Failure-Mode Playbooks',
  description:
    'Datasheet-backed engineering field guides covering SOT-23 pinout traps, LDO ceramic capacitor ESR stability, DC-DC Vref/EN pitfalls, comparator output stages, thermal derating, and BOM second-sourcing.',
});

export default function GuidesIndexPage() {
  const guides = getAllGuides();
  const partBySlug = new Map(getAllParts().map((p) => [p.slug, p]));
  const latestUpdated = getMaxGuideUpdatedAt();

  const cards: GuideCardItem[] = guides.map((g) => ({
    slug: g.slug,
    title: g.title,
    subtitle: g.subtitle,
    summary: g.summary,
    category: g.category,
    reading_time_min: g.reading_time_min,
    word_count: getGuideWordCount(g),
    updated_at: g.updated_at,
    related_parts: g.related_parts
      .map((s) => partBySlug.get(s))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ slug: p.slug, opn: p.opn, package_code: p.package.code })),
  }));

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Engineering Field Guides', path: '/en/guides' },
    ]),
    buildCollectionPageJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: '/en/guides',
      name: 'Pin2Pin Global Hardware Engineering Field Guides',
      description:
        'Collection of datasheet-verified failure-mode playbooks and second-sourcing guides for power and analog PCB design.',
      dateModified: latestUpdated,
      items: guides.map((g) => ({
        name: g.title,
        path: `/en/guides/${g.slug}`,
      })),
    }),
  ];

  return (
    <div className="space-y-6">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-600">
        <Link href="/en/" className="hover:text-slate-900">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-slate-900">Engineering Field Guides</span>
      </nav>

      <header className="rounded-lg border border-slate-300 bg-white p-6 space-y-2.5">
        <div className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase text-emerald-300">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          {guides.length} Field Playbooks · Updated {latestUpdated}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          Hardware Engineering Field Guides &amp; Failure-Mode Playbooks
        </h1>
        <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
          Deep bench-tested failure analyses and drop-in substitution checklists grounded directly in
          official manufacturer datasheets — cross-linked to verified OPNs, pinout SVGs, and
          interactive calculators.
        </p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <GuidesCatalogClient guides={cards} />
    </div>
  );
}
