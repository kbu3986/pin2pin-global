'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import type { CatalogPartRow } from '@/types/schema';

export function HomeQuickSearch({ parts }: { parts: CatalogPartRow[] }) {
  const [query, setQuery] = useState<string>('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parts.slice(0, 8);
    return parts
      .filter(
        (p) =>
          p.opn.toLowerCase().includes(q) ||
          p.family.toLowerCase().includes(q) ||
          p.manufacturer.toLowerCase().includes(q) ||
          p.package_code.toLowerCase().includes(q) ||
          p.highlight_metric.toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [parts, query]);

  return (
    <div className="rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50">
        <label htmlFor="quick-opn-search" className="sr-only">
          Search Orderable Part Number (OPN), Family, Package, or Manufacturer
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="quick-opn-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search OPN, family, package, or vendor (e.g., AP2112K, SOT-23-3, LM358DR, TPS54302)..."
            className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-4 py-2.5 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {matches.length === 0 ? (
          <div className="p-5 text-center text-xs text-slate-500">
            No matching OPNs found in current pilot database.{' '}
            <Link href="/en/catalog" className="text-sky-700 font-semibold underline">
              Browse full parametric catalog
            </Link>
            .
          </div>
        ) : (
          matches.map((p) => (
            <div
              key={p.slug}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50/90 transition-colors"
            >
              <div className="min-w-0 flex items-center gap-2.5">
                <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                  {p.category}
                </span>
                <Link
                  href={`/en/part/${p.slug}`}
                  className="font-mono text-sm font-bold text-slate-950 hover:text-sky-700 hover:underline"
                >
                  {p.opn}
                </Link>
                <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                  {p.package_code}
                </span>
                <span className="hidden md:inline text-xs text-slate-500">{p.manufacturer}</span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="hidden sm:inline font-mono tabular-nums text-slate-600">
                  {p.highlight_metric}
                </span>
                <Link
                  href={`/en/part/${p.slug}`}
                  className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"
                >
                  Pinout &amp; Specs
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
                {p.has_alt_page && (
                  <Link
                    href={`/en/alt/${p.slug}-alternatives`}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 font-semibold text-slate-700 hover:border-slate-500"
                  >
                    Alts
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 flex items-center justify-between text-xs text-slate-600">
        <span className="font-mono">
          Showing {matches.length} of {parts.length} datasheet-verified OPNs
        </span>
        <Link href="/en/catalog" className="font-semibold text-sky-700 hover:underline">
          Open Full Parametric Filter Table →
        </Link>
      </div>
    </div>
  );
}
