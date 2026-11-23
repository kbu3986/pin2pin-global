'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search } from 'lucide-react';
import type { CatalogPartRow } from '@/types/schema';
import { lifecycleBadgeClass, normalizeSearchText } from '@/lib/format';
import { trackGlobalSearchSelect } from '@/lib/analytics';

export function HomeQuickSearch({ parts }: { parts: CatalogPartRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState<string>('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const matches = useMemo(() => {
    const tokens = query
      .trim()
      .split(/\s+/)
      .map((t) => normalizeSearchText(t))
      .filter(Boolean);
    if (tokens.length === 0) return parts.slice(0, 8);

    const normFull = normalizeSearchText(query);
    const scored: Array<{ part: CatalogPartRow; score: number }> = [];
    for (const p of parts) {
      const opnNorm = normalizeSearchText(p.opn);
      const hay = normalizeSearchText(
        `${p.opn} ${p.family} ${p.manufacturer} ${p.package_code} ${p.mfg_package_code} ${p.highlight_metric} ${p.category} ${p.sub_topology}`,
      );
      if (!tokens.every((t) => hay.includes(t))) continue;
      let score = 0;
      if (opnNorm === normFull) score += 1000;
      else if (opnNorm.startsWith(normFull)) score += 500;
      else if (opnNorm.includes(normFull)) score += 250;
      else if (normalizeSearchText(p.mfg_package_code).includes(normFull)) score += 150;
      scored.push({ part: p, score });
    }
    scored.sort((a, b) => b.score - a.score || a.part.opn.localeCompare(b.part.opn));
    return scored.slice(0, 10).map((s) => s.part);
  }, [parts, query]);

  useEffect(() => {
    setActiveIndex(query.trim() ? 0 : -1);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? matches.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && matches[activeIndex]) {
      e.preventDefault();
      const chosen = matches[activeIndex];
      trackGlobalSearchSelect({
        result_type: 'home_quick_search',
        result_label: chosen.opn,
        query_length: query.trim().length,
        rank: activeIndex + 1,
      });
      router.push(`/en/part/${chosen.slug}/`);
    } else if (e.key === 'Escape') {
      setActiveIndex(-1);
    }
  };

  return (
    <div className="rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50">
        <label htmlFor="quick-opn-search" className="sr-only">
          Search Orderable Part Number (OPN), Family, Package, Mfg Package Code, or Manufacturer
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600"
            aria-hidden="true"
          />
          <input
            id="quick-opn-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search OPN, family, package, or mfg code (e.g., AP2112K, DBVR, DCY, SOT233, LM358)..."
            aria-autocomplete="list"
            aria-controls="home-quick-search-list"
            className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-4 py-2.5 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>
      </div>

      <div id="home-quick-search-list" role="listbox" className="divide-y divide-slate-100">
        {matches.length === 0 ? (
          <div className="p-5 text-center text-xs text-slate-600">
            No matching OPNs found in current database.{' '}
            <Link href="/en/catalog/" className="text-sky-700 font-semibold underline">
              Browse full parametric catalog
            </Link>
            .
          </div>
        ) : (
          matches.map((p, idx) => {
            const isActive = idx === activeIndex;
            const life = (p as CatalogPartRow & { lifecycle?: string }).lifecycle;
            return (
              <div
                key={p.slug}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 transition-colors ${
                  isActive ? 'bg-sky-50' : 'hover:bg-slate-50/90'
                }`}
              >
                <div className="min-w-0 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase text-white">
                    {p.category}
                  </span>
                  <Link
                    href={`/en/part/${p.slug}/`}
                    className="font-mono text-sm font-bold text-slate-950 hover:text-sky-700 hover:underline"
                  >
                    {p.opn}
                  </Link>
                  <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                    {p.package_code}
                    {p.mfg_package_code ? ` · ${p.mfg_package_code}` : ''}
                  </span>
                  {life && life !== 'Active' && (
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase ${lifecycleBadgeClass(life)}`}
                    >
                      {life}
                    </span>
                  )}
                  <span className="hidden md:inline text-xs text-slate-600">{p.manufacturer}</span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="hidden sm:inline font-mono tabular-nums text-slate-600">
                    {p.highlight_metric}
                  </span>
                  <Link
                    href={`/en/part/${p.slug}/`}
                    className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"
                  >
                    Pinout &amp; Specs
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                  {p.has_alt_page && (
                    <Link
                      href={`/en/alt/${p.slug}-alternatives/`}
                      className="rounded border border-slate-300 bg-white px-2 py-0.5 font-semibold text-slate-700 hover:border-slate-500"
                    >
                      Alts
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span className="font-mono">
          Showing {matches.length} of {parts.length} datasheet-verified OPNs · ↑↓ &amp; Enter supported
        </span>
        <Link href="/en/catalog/" className="font-semibold text-sky-700 hover:underline">
          Open Full Parametric Filter Table →
        </Link>
      </div>
    </div>
  );
}
