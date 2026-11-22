import Link from 'next/link';
import { Cpu } from 'lucide-react';
import type { SiteConfig } from '@/types/schema';

export function SiteHeader({ siteConfig }: { siteConfig: SiteConfig }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          <Link href="/en" className="flex items-center gap-2.5 group shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
              <Cpu className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                  {siteConfig.site_name}
                </span>
                <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                  DB v2.0
                </span>
              </div>
              <span className="hidden sm:block text-[11px] text-slate-400">
                OPN-Exact Pinout &amp; Cross-Reference Workbench
              </span>
            </div>
          </Link>

          <nav aria-label="Primary Navigation" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium">
            <Link
              href="/en/catalog"
              className="rounded-md px-2.5 py-1.5 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Catalog
            </Link>
            <Link
              href="/en/tools/bom-checker"
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-emerald-200 font-semibold hover:bg-emerald-500/25 hover:text-white transition-colors"
            >
              BOM Checker
            </Link>
            <Link
              href="/en/tools/ldo-thermal-calculator"
              className="rounded-md px-2.5 py-1.5 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Calculators
            </Link>
            <Link
              href="/en#guides"
              className="hidden md:inline-flex rounded-md px-2.5 py-1.5 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Guides
            </Link>
            <Link
              href="/en/methodology"
              className="hidden lg:inline-flex rounded-md px-2.5 py-1.5 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Methodology
            </Link>
            <Link
              href="/en/contact"
              className="hidden sm:inline-flex rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:border-emerald-500/60 hover:text-emerald-200 transition-colors"
            >
              Report Error
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
