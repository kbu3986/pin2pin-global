import Link from 'next/link';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { EngineeringGuide, SiteConfig } from '@/types/schema';

export function SiteFooter({
  siteConfig,
  guides,
}: {
  siteConfig: SiteConfig;
  guides: EngineeringGuide[];
}) {
  return (
    <footer className="mt-14 border-t border-slate-300 bg-slate-900 text-slate-300">
      {/* Mandatory AUD-04 Engineering Disclaimer Banner on Every Page */}
      <div className="border-b border-slate-800 bg-slate-950/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="rounded-md border border-amber-500/40 bg-amber-950/30 p-3.5 text-xs text-amber-100 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="leading-relaxed">{siteConfig.legal.engineering_disclaimer_short}</p>
              <p className="text-[11px] text-slate-400">{siteConfig.legal.trademark_notice}</p>
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
            <p className="text-slate-400 leading-relaxed mb-3">{siteConfig.tagline}</p>
            <div className="inline-flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 font-mono text-[11px] text-emerald-300">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Official Manufacturer PDFs Only
            </div>
          </div>

          {/* Column 2: Engineering Tools */}
          <div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-white mb-3">
              Engineering Tools &amp; Calculators
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/en/tools/bom-checker"
                  className="font-semibold text-emerald-300 hover:text-white transition-colors"
                >
                  Zero-Upload BOM Checker (CSV)
                </Link>
              </li>
              <li>
                <Link href="/en/catalog" className="hover:text-white transition-colors">
                  Parametric OPN Catalog
                </Link>
              </li>
              <li>
                <Link
                  href="/en/tools/ldo-thermal-calculator"
                  className="hover:text-white transition-colors"
                >
                  LDO Thermal &amp; Tj Margin Calculator
                </Link>
              </li>
              <li>
                <Link
                  href="/en/tools/dcdc-efficiency-ripple-calculator"
                  className="hover:text-white transition-colors"
                >
                  DC-DC Ripple &amp; Peak Current Calculator
                </Link>
              </li>
              <li>
                <Link
                  href="/en/tools/opamp-gbwp-slewrate-checker"
                  className="hover:text-white transition-colors"
                >
                  Op-Amp GBWP &amp; Slew Rate Checker
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Field Guides */}
          <div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-white mb-3">
              Engineering Field Guides
            </h2>
            <ul className="space-y-2">
              {guides.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/en/guides/${g.slug}`}
                    className="hover:text-white transition-colors"
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
                <Link href="/en/about" className="hover:text-white transition-colors">
                  About Pin2Pin Global
                </Link>
              </li>
              <li>
                <Link href="/en/methodology" className="hover:text-white transition-colors">
                  Dual-Path Verification Methodology
                </Link>
              </li>
              <li>
                <Link href="/en/disclaimer" className="hover:text-white transition-colors">
                  Engineering Disclaimer &amp; Legal
                </Link>
              </li>
              <li>
                <Link href="/en/privacy" className="hover:text-white transition-colors">
                  Privacy Policy &amp; Disclosures
                </Link>
              </li>
              <li>
                <Link href="/en/contact" className="hover:text-white transition-colors">
                  Contact &amp; Report Pinout Error
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-800 pt-5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
          <span>© {new Date().getFullYear()} {siteConfig.site_name}. All rights reserved.</span>
          <span>Zero Distributor Scraping · Dual-Path 300 DPI Vision Audited</span>
        </div>
      </div>
    </footer>
  );
}
