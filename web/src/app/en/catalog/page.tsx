import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getCatalogRows, getSiteConfig } from '@/lib/data-loader';
import { CatalogClient } from '@/components/CatalogClient';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { JsonLd } from '@/components/JsonLd';
import { buildBreadcrumbJsonLd, buildDatasetJsonLd } from '@/lib/format';

const siteConfig = getSiteConfig();

export const metadata: Metadata = {
  title: 'Parametric Semiconductor Catalog (LDO, DC-DC, Op-Amp OPNs)',
  description:
    'Filter datasheet-verified LDO regulators, DC-DC boost/buck converters, and Op-Amps/Comparators by package, manufacturer, ceramic-cap stability, Iq, and rated current.',
  alternates: {
    canonical: `${siteConfig.site_url}/en/catalog`,
  },
};

export default function CatalogPage() {
  const rows = getCatalogRows();

  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: 'Parametric Catalog', path: '/en/catalog' },
    ]),
    buildDatasetJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: '/en/catalog',
      name: 'Pin2Pin Global Parametric IC Catalog',
      description:
        'Filterable parametric index of official-datasheet-verified LDO, DC-DC, and Op-Amp orderable part numbers (OPNs) with exact package pinouts.',
      keywords: [
        'LDO parametric search',
        'SOT-23-3 LDO',
        'SOT-223-3 1117',
        'buck boost converter catalog',
        'rail to rail op-amp catalog',
      ],
      dateModified: '2026-04-01',
    }),
  ];

  return (
    <div className="space-y-5">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/en" className="hover:text-slate-900">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-slate-900">Parametric Catalog</span>
      </nav>

      <header className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          Parametric Semiconductor OPN Catalog
        </h1>
        <p className="text-sm text-slate-600 max-w-3xl">
          Every row represents a package-specific Orderable Part Number (OPN) audited against its official manufacturer PDF. Filter by package footprint, quiescent current, output current, or MLCC stability.
        </p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <CatalogClient rows={rows} />
    </div>
  );
}
