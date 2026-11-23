import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  FileSpreadsheet,
  GitCompareArrows,
  Layers,
  Wrench,
} from 'lucide-react';
import type { EngineeringGuide, PartCategory } from '@/types/schema';
import { getToolForCategory } from '@/lib/data-loader';
import { categoryLabel } from '@/lib/format';

export function RelatedGuidesToolsSection({
  category,
  guides,
  compareSlugA,
  compareSlugB,
  calculatorOpn,
}: {
  category: PartCategory;
  guides: EngineeringGuide[];
  compareSlugA?: string;
  compareSlugB?: string;
  calculatorOpn?: string;
}) {
  const categoryTool = getToolForCategory(category);
  const calcHref = calculatorOpn
    ? `${categoryTool.href}?opn=${encodeURIComponent(calculatorOpn)}`
    : categoryTool.href;
  const compareHref =
    compareSlugA && compareSlugB
      ? `/en/compare?a=${encodeURIComponent(compareSlugA)}&b=${encodeURIComponent(compareSlugB)}`
      : compareSlugA
        ? `/en/compare?a=${encodeURIComponent(compareSlugA)}`
        : '/en/compare';

  return (
    <section
      data-print-hide="true"
      aria-label="Related Field Guides and Engineering Tools"
      className="print:hidden rounded-lg border border-slate-300 bg-white p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-slate-800" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-950">
            Related Field Guides &amp; Engineering Tools
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/en/guides" className="font-semibold text-sky-700 hover:underline">
            All Guides →
          </Link>
          <Link href="/en/tools" className="font-semibold text-sky-700 hover:underline">
            All Tools →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Matched Field Guides (2-3 cards) */}
        <div className="lg:col-span-7 space-y-2.5">
          <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Matched Failure-Mode Playbooks
          </div>
          <div className="space-y-2">
            {guides.map((g) => (
              <Link
                key={g.slug}
                href={`/en/guides/${g.slug}`}
                className="group block rounded-md border border-slate-200 bg-slate-50/70 p-3 hover:border-slate-800 hover:bg-white transition-colors"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
                  <span className="uppercase font-semibold text-slate-700">
                    {categoryLabel(g.category)}
                  </span>
                  <span>{g.reading_time_min} min read</span>
                </div>
                <div className="mt-1 text-xs sm:text-sm font-bold text-slate-950 group-hover:text-sky-700 leading-snug">
                  {g.title}
                </div>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {g.summary}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Matched Engineering Tools */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Interactive Workbench Tools
          </div>
          <div className="space-y-2">
            <Link
              href={calcHref}
              className="group flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-white p-3 hover:border-sky-600 transition-colors"
            >
              <div className="flex items-start gap-2.5">
                <Wrench className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <div className="text-xs font-bold text-slate-950 group-hover:text-sky-700">
                    {categoryTool.title}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-600 leading-relaxed">
                    {calculatorOpn
                      ? `Open standalone calculator preloaded with ${calculatorOpn}.`
                      : `Run worst-case ${categoryLabel(category)} margin checks in browser.`}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-700 shrink-0 mt-0.5" aria-hidden="true" />
            </Link>

            <Link
              href={compareHref}
              className="group flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-white p-3 hover:border-emerald-600 transition-colors"
            >
              <div className="flex items-start gap-2.5">
                <GitCompareArrows className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <div className="text-xs font-bold text-slate-950 group-hover:text-emerald-800">
                    Freeform 2-OPN Pinout Comparator
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-600 leading-relaxed">
                    {compareSlugA && compareSlugB
                      ? 'Open this pair in the interactive comparator or swap either side.'
                      : 'Compare this OPN against any other audited device side-by-side.'}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
            </Link>

            <Link
              href="/en/tools/bom-checker"
              className="group flex items-start justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50/50 p-3 hover:border-emerald-600 hover:bg-white transition-colors"
            >
              <div className="flex items-start gap-2.5">
                <FileSpreadsheet className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <div className="text-xs font-bold text-slate-950 group-hover:text-emerald-800">
                    Zero-Upload BOM CSV Checker
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-600 leading-relaxed">
                    Audit an entire KiCad, Altium, or JLCPCB BOM locally for EOL &amp; pinout hazards.
                  </p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            </Link>

            <Link
              href="/en/packages"
              className="group flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-white p-3 hover:border-amber-600 transition-colors"
            >
              <div className="flex items-start gap-2.5">
                <Layers className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <div className="text-xs font-bold text-slate-950 group-hover:text-amber-800">
                    Package Pinout Trap Matrix
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-600 leading-relaxed">
                    Inspect same-package pin-order conflicts across all audited footprints.
                  </p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
