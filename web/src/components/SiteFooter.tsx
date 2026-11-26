import Link from 'next/link';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
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
    <footer className="site-footer print:hidden mt-16 border-t border-white/12 bg-[#0f0f0f] text-white/80">
      {/* Mandatory AUD-04 Engineering Disclaimer Banner on Every Page */}
      <div className="border-b border-white/12 bg-[#161616]">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-4">
          <div className="rounded-[6px] border border-white/12 border-l-[3px] border-l-amber-400 bg-[#1a1a1a] p-3.5 text-xs text-white/90 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="leading-relaxed">{siteConfig.legal.engineering_disclaimer_short}</p>
              <p className="text-[11px] text-[#8f8f8f]">{siteConfig.legal.trademark_notice}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs">
          {/* Column 1: Brand & Core Index */}
          <div>
            <Link
              href="/en/"
              className="inline-flex items-center gap-2 mb-3 text-white hover:text-[#dafa9c] transition-colors"
            >
              <span
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[#dafa9c] text-[#0f0f0f] font-semibold text-xs leading-none"
                aria-hidden="true"
              >
                P
              </span>
              <span className="text-[15px] font-medium tracking-[-0.02em]">
                {siteConfig.site_name}
              </span>
            </Link>
            <p className="text-[#8f8f8f] leading-relaxed mb-3">{siteConfig.tagline}</p>
            <div className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#dafa9c]/30 bg-[#dafa9c]/10 px-2.5 py-1 font-mono text-[11px] text-[#dafa9c]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Official Manufacturer PDFs Only
            </div>
            <ul className="mt-4 space-y-2 text-white/75">
              <li>
                <Link href="/en/catalog/" className="hover:text-[#dafa9c] transition-colors">
                  Parametric OPN Catalog
                </Link>
              </li>
              <li>
                <Link href="/en/compare/" className="hover:text-[#dafa9c] transition-colors">
                  Freeform 2-OPN Comparator
                </Link>
              </li>
              <li>
                <Link href="/en/packages/" className="hover:text-[#dafa9c] transition-colors">
                  Package Pinout Trap Matrix
                </Link>
              </li>
              <li>
                <Link href="/en/vs/" className="hover:text-[#dafa9c] transition-colors">
                  All 1:1 Pin-Diff Comparisons
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Engineering Tools */}
          <div>
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-[#8f8f8f] mb-3.5">
              Engineering Tools ({SITE_TOOLS.length})
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href={TOOLS_HUB_HREF}
                  className="font-medium text-[#dafa9c] hover:text-white transition-colors"
                >
                  All Tools &amp; Calculators Hub →
                </Link>
              </li>
              {SITE_TOOLS.map((tool) => (
                <li key={tool.slug}>
                  <Link
                    href={tool.href}
                    className="text-white/75 hover:text-white transition-colors"
                  >
                    {tool.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Field Guides */}
          <div>
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-[#8f8f8f] mb-3.5">
              Engineering Field Guides
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href={GUIDES_HUB_HREF}
                  className="font-medium text-[#dafa9c] hover:text-white transition-colors"
                >
                  Browse All {guides.length} Field Guides →
                </Link>
              </li>
              {guides.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/en/guides/${g.slug}/`}
                    className="text-white/75 hover:text-white transition-colors"
                  >
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Verification & Policy */}
          <div>
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-[#8f8f8f] mb-3.5">
              Verification &amp; Policy
            </h2>
            <ul className="space-y-2">
              <li>
                <Link href="/en/about/" className="text-white/75 hover:text-white transition-colors">
                  About Pin2Pin Global
                </Link>
              </li>
              <li>
                <Link
                  href="/en/methodology/"
                  className="text-white/75 hover:text-white transition-colors"
                >
                  Dual-Path Verification Methodology
                </Link>
              </li>
              <li>
                <Link
                  href="/en/disclaimer/"
                  className="text-white/75 hover:text-white transition-colors"
                >
                  Engineering Disclaimer &amp; Legal
                </Link>
              </li>
              <li>
                <Link
                  href="/en/privacy/"
                  className="text-white/75 hover:text-white transition-colors"
                >
                  Privacy Policy &amp; Disclosures
                </Link>
              </li>
              <li>
                <Link
                  href="/en/contact/"
                  className="text-white/75 hover:text-white transition-colors"
                >
                  Contact &amp; Report Pinout Error
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/12 pt-5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8f8f8f] font-mono">
          <span>
            © {new Date().getFullYear()} {siteConfig.site_name}. All rights reserved.
          </span>
          <span>Zero Distributor Scraping · Dual-Path 300 DPI Vision Audited</span>
        </div>
      </div>
    </footer>
  );
}
