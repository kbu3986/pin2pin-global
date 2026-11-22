import Link from 'next/link';
import { ChevronRight, Mail } from 'lucide-react';
import type { SiteConfig, TrustPageDoc } from '@/types/schema';
import { DisclaimerStrip } from '@/components/DisclaimerStrip';
import { ErrorReportButton } from '@/components/ErrorReportButton';
import { JsonLd } from '@/components/JsonLd';
import { buildBreadcrumbJsonLd, buildTechArticleJsonLd } from '@/lib/format';

export function TrustPageView({
  doc,
  siteConfig,
}: {
  doc: TrustPageDoc;
  siteConfig: SiteConfig;
}) {
  const pagePath = `/en/${doc.slug}`;
  const jsonLd = [
    buildBreadcrumbJsonLd(siteConfig.site_url, [
      { name: 'Home', path: '/en' },
      { name: doc.title, path: pagePath },
    ]),
    buildTechArticleJsonLd({
      siteUrl: siteConfig.site_url,
      siteName: siteConfig.site_name,
      path: pagePath,
      headline: doc.title,
      description: doc.description,
      dateModified: doc.updated_at,
    }),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/en" className="hover:text-slate-900">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-slate-900">{doc.title}</span>
      </nav>

      <header className="rounded-lg border border-slate-300 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold uppercase text-emerald-300">
            Trust &amp; Governance
          </span>
          <span className="font-mono text-xs text-slate-500">Last Updated: {doc.updated_at}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          {doc.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{doc.description}</p>
      </header>

      <DisclaimerStrip siteConfig={siteConfig} />

      <article className="space-y-5">
        {doc.sections.map((sec) => (
          <section
            key={sec.heading}
            className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 space-y-3"
          >
            <h2 className="text-lg font-bold text-slate-950 border-b border-slate-100 pb-2">
              {sec.heading}
            </h2>
            {sec.paragraphs.map((p, idx) => (
              <p key={idx} className="text-sm text-slate-700 leading-relaxed">
                {p}
              </p>
            ))}
            {sec.bullets && sec.bullets.length > 0 && (
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700">
                {sec.bullets.map((b, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>

      {doc.slug === 'contact' && (
        <section className="rounded-lg border border-slate-300 bg-slate-50 p-5 sm:p-6 space-y-3">
          <h2 className="text-base font-bold text-slate-950">
            Direct Error Reporting &amp; Audit Channels
          </h2>
          <p className="text-sm text-slate-700">
            Report any datasheet citation, pinout numbering, exposed pad net, or thermal rating issue directly via GitHub Issues or email:
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <ErrorReportButton
              siteConfig={siteConfig}
              subject="General Pinout / Spec Report"
              pagePath="/en/contact"
            />
            <a
              href={`mailto:${siteConfig.contact_email}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              {siteConfig.contact_email}
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
