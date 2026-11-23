import Link from 'next/link';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { EngineeringGuide, SiteConfig } from '@/types/schema';
import { GUIDES_HUB_HREF, SITE_TOOLS, TOOLS_HUB_HREF } from '@/lib/format';

export function SiteFooter({
  siteConfig,
  guides,
}: {
  siteConfig: SiteConfig;
  guides: EngineeringGuide[];
}) {
  return (
    <footer className="site-footer print:hidden mt-14 border-t border-slate-300 bg-slate-900 text-slate-200">
      {/* Mandatory AUD-04 Engineering Disclaimer Banner on Every Page */}
      <div className="border-b border-slate-800 bg-slate-950/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="rounded-md border border-amber-500/40 bg-amber-950/30 p-3.5 text-xs text-amber-100 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="leading-relaxed">{siteConfig.legal.engineering_disclaimer_short}</p>
              <p className="text-[11px] text-slate-300">{siteConfig.legal.trademark_notice}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs">
          {/* Column 1 */}
          <div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-white mb-3">
              {siteConfig.site_name}
            </h2>
            <p className="text-slate-300 leading-relaxed mb-3">{siteConfig.tagline}</p>
            <div className="inline-flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 font-mono text-[11px] text-emerald-300">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Official Manufacturer PDFs Only
            </div>
            <ul className="mt-4 space-y-1.5 text-slate-300">
              <li>
                <Link href="/en/catalog/" className="hover:text-white transition-colors">
                  Parametric OPN Catalog
                </Link>
              </li>
              <li>
                <Link href="/en/compare/" className="hover:text-white transition-colors">
                  Freeform 2-OPN Comparator
                </Link>
              </li>
              <li>
                <Link href="/en/packages/" className="hover:text-white transition-colors">
                  Package Pinout Trap Matrix
                </Link>
              </li>
              <li>
                <Link href="/en/vs/" className="hover:text-white transition-colors">
                  All 1:1 Pin-Diff Comparisons
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Engineering Tools */}
          <div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-white mb-3">
              Engineering Tools ({SITE_TOOLS.length})
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href={TOOLS_HUB_HREF}
                  className="font-semibold text-emerald-300 hover:text-white transition-colors"
                >
                  All Tools &amp; Calculators Hub
                </Link>
              </li>
              <li>
                <Link href="/en/catalog/" className="text-slate-200 hover:text-white transition-colors">
                  Parametric OPN Catalog
                </Link>
              </li>
              {SITE_TOOLS.map((tool) => (
                <li key={tool.slug}>
                  <Link href={tool.href} className="text-slate-200 hover:text-white transition-colors">
                    {tool.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Field Guides */}
          <div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-white mb-3">
              Engineering Field Guides
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href={GUIDES_HUB_HREF}
                  className="font-semibold text-sky-300 hover:text-white transition-colors"
                >
                  Browse All {guides.length} Field Guides →
                </Link>
              </li>
              {guides.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/en/guides/${g.slug}/`}
                    className="text-slate-200 hover:text-white transition-colors"
                  >
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Verification & Legal */}
          <div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-white mb-3">
              Verification &amp; Policy
            </h2>
            <ul className="space-y-2">
              <li>
                <Link href="/en/about/" className="text-slate-200 hover:text-white transition-colors">
                  About Pin2Pin Global
                </Link>
              </li>
              <li>
                <Link href="/en/methodology/" className="text-slate-200 hover:text-white transition-colors">
                  Dual-Path Verification Methodology
                </Link>
              </li>
              <li>
                <Link href="/en/disclaimer/" className="text-slate-200 hover:text-white transition-colors">
                  Engineering Disclaimer &amp; Legal
                </Link>
              </li>
              <li>
                <Link href="/en/privacy/" className="text-slate-200 hover:text-white transition-colors">
                  Privacy Policy &amp; Disclosures
                </Link>
              </li>
              <li>
                <Link href="/en/contact/" className="text-slate-200 hover:text-white transition-colors">
                  Contact &amp; Report Pinout Error
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-800 pt-5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 font-mono">
          <span>© {new Date().getFullYear()} {siteConfig.site_name}. All rights reserved.</span>
          <span>Zero Distributor Scraping · Dual-Path 300 DPI Vision Audited</span>
        </div>
      </div>
    </footer>
  );
}
