'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Clock, FileText } from 'lucide-react';
import type { PartCategory } from '@/types/schema';
import { categoryLabel } from '@/lib/format';

export interface GuideCardItem {
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  category: PartCategory | 'general';
  reading_time_min: number;
  word_count: number;
  updated_at: string;
  related_parts: Array<{ slug: string; opn: string; package_code: string }>;
}

type CategoryFilter = 'all' | PartCategory | 'general';

export function GuidesCatalogClient({ guides }: { guides: GuideCardItem[] }) {
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const counts = useMemo(
    () => ({
      all: guides.length,
      ldo: guides.filter((g) => g.category === 'ldo').length,
      dcdc: guides.filter((g) => g.category === 'dcdc').length,
      opamp: guides.filter((g) => g.category === 'opamp').length,
      general: guides.filter((g) => g.category === 'general').length,
    }),
    [guides],
  );

  const visible = useMemo(
    () => (filter === 'all' ? guides : guides.filter((g) => g.category === filter)),
    [guides, filter],
  );

  const tabs: Array<[CategoryFilter, string]> = [
    ['all', `All Guides (${counts.all})`],
    ['ldo', `LDO Regulators (${counts.ldo})`],
    ['dcdc', `DC-DC Converters (${counts.dcdc})`],
    ['opamp', `Op-Amp / Comparator (${counts.opamp})`],
    ['general', `General Hardware (${counts.general})`],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter guides by topic">
        {tabs
          .filter(([key]) => key === 'all' || counts[key] > 0)
          .map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                filter === key
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.map((g) => (
          <article
            key={g.slug}
            className="flex flex-col justify-between rounded-lg border border-slate-300 bg-white p-5 hover:border-slate-900 transition-colors"
          >
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-600">
                <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 font-bold uppercase text-emerald-300">
                  <BookOpen className="h-3 w-3" aria-hidden="true" />
                  {categoryLabel(g.category)}
                </span>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {g.reading_time_min} min
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3 w-3" aria-hidden="true" />
                    {g.word_count.toLocaleString('en-US')} words
                  </span>
                </div>
              </div>

              <h2 className="text-base font-bold text-slate-950 leading-snug">
                <Link href={`/en/guides/${g.slug}/`} className="hover:text-sky-700 hover:underline">
                  {g.title}
                </Link>
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">{g.summary}</p>

              {g.related_parts.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-600">Key OPNs:</span>
                  {g.related_parts.slice(0, 4).map((p) => (
                    <Link
                      key={p.slug}
                      href={`/en/part/${p.slug}/`}
                      className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800 hover:border-sky-500 hover:text-sky-800"
                    >
                      {p.opn}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-slate-600">Updated {g.updated_at}</span>
              <Link
                href={`/en/guides/${g.slug}/`}
                className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"
              >
                Read Playbook <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
